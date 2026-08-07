import "@stdlib/deploy";

//  BondingCurve — рынок для одного токена, запущенного в приложении.
//
//  Зачем он нужен. Обычному AMM нужна ликвидность: пока кто-то не внёс
//  в пул пару TON/токен, торговать нечем. У свежего мемкоина такой пары
//  нет, поэтому первые покупатели упираются в пустоту. Кривая решает это
//  тем, что сама выступает второй стороной сделки: цена считается по
//  формуле, а не по чужим заявкам, и купить можно с первой секунды.
//
//  Формула — постоянное произведение на виртуальных резервах:
//
//      k = (virtualTon + realTon) * (virtualTokens - tokensSold)
//
//  Виртуальные резервы задают стартовую цену и крутизну роста, но не
//  лежат на контракте: реальные деньги — только realTon. Из-за этого
//  первая покупка не может «съесть» весь запас за копейки, как было бы
//  на пустом пуле.
//
//  Когда в кривой накапливается graduationTon, торговля на ней
//  закрывается, а собранные TON вместе с непроданным остатком уходят
//  одним переводом на graduationDestination — адрес, заданный при
//  создании и неизменяемый. Это единственный способ вынуть деньги из
//  контракта: администратор не может забрать их раньше срока или
//  отправить куда-то ещё.

// ---------------------------------------------------------------------
// Сообщения стандарта жетонов (TEP-74). Tact не поставляет их в stdlib,
// поэтому объявляем ровно те, что используем.
// ---------------------------------------------------------------------

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x7362d09c) JettonTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Slice as remaining;
}

// ---------------------------------------------------------------------
// Свои сообщения
// ---------------------------------------------------------------------

// Покупка: TON приходят вместе с сообщением, minTokensOut защищает от
// проскальзывания — если цена ушла, сделка не состоится.
message(0x42555921) Buy {
    queryId: Int as uint64;
    minTokensOut: Int as coins;
}

// Адрес кошелька жетона у самой кривой известен только после деплоя
// жетона, поэтому ставится отдельным сообщением и ровно один раз.
message(0x5745544a) SetJettonWallet {
    wallet: Address;
}

// Перевод набранной ликвидности на graduationDestination. Разрешён
// только после достижения порога — до него сообщение отвергается.
message(0x47524144) Graduate {
    queryId: Int as uint64;
}

// Уведомление об остатке газа от кошелька жетона. Приходит после
// удачного перевода — по нему видно, что жетоны у покупателя.
message(0xd53276db) JettonExcesses {
    queryId: Int as uint64;
}

// Незакрытая покупка: жетоны отправлены, но подтверждения ещё нет.
// Нужна, чтобы при возврате сообщения знать, кому и сколько вернуть.
struct PendingBuy {
    buyer: Address;
    ton: Int as coins;
    tokens: Int as coins;
}

struct CurveData {
    virtualTon: Int;
    virtualTokens: Int;
    realTon: Int;
    tokensSold: Int;
    tokensForSale: Int;
    graduationTon: Int;
    feeBps: Int;
    graduated: Bool;
    jettonWallet: Address?;
}

contract BondingCurve with Deployable {
    // --- неизменяемое после создания ---
    admin: Address;                   // может только привязать кошелёк жетона
    jettonMaster: Address;            // жетон, которым торгует кривая
    feeWallet: Address;               // куда уходит комиссия платформы
    graduationDestination: Address;   // единственный получатель ликвидности

    // --- параметры кривой ---
    virtualTon: Int as coins;
    virtualTokens: Int as coins;
    tokensForSale: Int as coins;
    graduationTon: Int as coins;
    feeBps: Int as uint16;

    // --- состояние ---
    jettonWallet: Address? = null;
    realTon: Int as coins = 0;
    tokensSold: Int as coins = 0;
    graduated: Bool = false;
    // Покупки, по которым жетоны отправлены, но исход ещё неизвестен.
    // Ключ — свой сквозной номер: на него ссылаются и подтверждение, и
    // возврат, а внешние queryId могли бы совпасть между покупателями.
    pending: map<Int as uint64, PendingBuy>;
    nextQueryId: Int as uint64 = 1;

    // Сколько TON удерживается из входящего сообщения на газ: перевод
    // жетона покупателю, отправка комиссии и хранение самого контракта.
    const GasBuyOverhead: Int = ton("0.25");
    // Столько прикладывается к переводу жетонов. Прежние 0.05 TON не
    // покрывали развёртывание кошелька получателя — у первого
    // покупателя его ещё нет, — поэтому перевод не проходил, и человек
    // платил, не получая токенов.
    const GasJettonTransfer: Int = ton("0.12");
    // Неснижаемый остаток на контракте — на хранение.
    const MinContractBalance: Int = ton("0.05");

    init(
        admin: Address,
        jettonMaster: Address,
        feeWallet: Address,
        graduationDestination: Address,
        virtualTon: Int,
        virtualTokens: Int,
        tokensForSale: Int,
        graduationTon: Int,
        feeBps: Int,
    ) {
        require(virtualTon > 0, "virtualTon must be positive");
        require(virtualTokens > 0, "virtualTokens must be positive");
        require(tokensForSale > 0, "tokensForSale must be positive");
        require(tokensForSale < virtualTokens, "tokensForSale must be below virtualTokens");
        require(graduationTon > 0, "graduationTon must be positive");
        require(feeBps >= 0 && feeBps <= 1000, "feeBps out of range");

        // Порог обязан быть достижимым. Когда продан весь tokensForSale,
        // кривая упирается в потолок сбора: дальше покупать нечего.
        // Если порог выше этого потолка, выпуск не наступит никогда, и
        // собранные деньги останутся заперты в контракте навсегда.
        let maxTonReserve: Int = virtualTon * virtualTokens / (virtualTokens - tokensForSale);
        require(graduationTon <= maxTonReserve - virtualTon, "graduationTon unreachable");

        self.admin = admin;
        self.jettonMaster = jettonMaster;
        self.feeWallet = feeWallet;
        self.graduationDestination = graduationDestination;
        self.virtualTon = virtualTon;
        self.virtualTokens = virtualTokens;
        self.tokensForSale = tokensForSale;
        self.graduationTon = graduationTon;
        self.feeBps = feeBps;
    }

    // -----------------------------------------------------------------
    // Математика кривой
    //
    // Округление везде в пользу контракта: покупатель получает не больше
    // расчётного, продавец — не больше расчётного. Иначе накопленная
    // ошибка позволяет выкачивать резерв циклом «купил-продал».
    // -----------------------------------------------------------------

    get fun tonReserve(): Int {
        return self.virtualTon + self.realTon;
    }

    get fun tokenReserve(): Int {
        return self.virtualTokens - self.tokensSold;
    }

    get fun k(): Int {
        return self.tonReserve() * self.tokenReserve();
    }

    // Сколько токенов даст покупка на tonIn (комиссия уже вычтена).
    get fun tokensOutFor(tonIn: Int): Int {
        if (tonIn <= 0) {
            return 0;
        }
        let newTonReserve: Int = self.tonReserve() + tonIn;
        // Деление вниз завышает newTokenReserve, значит tokensOut выходит
        // меньше или равен точному — округление в пользу контракта.
        let newTokenReserve: Int = self.k() / newTonReserve;
        let out: Int = self.tokenReserve() - newTokenReserve;
        if (out < 0) {
            return 0;
        }
        return out;
    }

    // Сколько TON вернёт продажа tokensIn токенов (до вычета комиссии).
    get fun tonOutFor(tokensIn: Int): Int {
        if (tokensIn <= 0) {
            return 0;
        }
        let newTokenReserve: Int = self.tokenReserve() + tokensIn;
        // Здесь деление вниз занижает newTonReserve и тем самым завышало
        // бы выплату, поэтому округляем вверх.
        let newTonReserve: Int = (self.k() + newTokenReserve - 1) / newTokenReserve;
        let out: Int = self.tonReserve() - newTonReserve;
        if (out < 0) {
            return 0;
        }
        return out;
    }

    get fun data(): CurveData {
        return CurveData{
            virtualTon: self.virtualTon,
            virtualTokens: self.virtualTokens,
            realTon: self.realTon,
            tokensSold: self.tokensSold,
            tokensForSale: self.tokensForSale,
            graduationTon: self.graduationTon,
            feeBps: self.feeBps,
            graduated: self.graduated,
            jettonWallet: self.jettonWallet,
        };
    }

    // -----------------------------------------------------------------
    // Привязка кошелька жетона
    // -----------------------------------------------------------------

    receive(msg: SetJettonWallet) {
        require(sender() == self.admin, "only admin");
        require(self.jettonWallet == null, "jetton wallet already set");
        self.jettonWallet = msg.wallet;
    }

    // -----------------------------------------------------------------
    // Покупка
    // -----------------------------------------------------------------

    receive(msg: Buy) {
        self.handleBuy(msg.queryId, msg.minTokensOut);
    }

    // Пустое сообщение с TON — тоже покупка, без защиты от
    // проскальзывания. Нужно для кошельков, которые умеют только
    // «отправить TON на адрес».
    receive() {
        self.handleBuy(0, 0);
    }

    fun handleBuy(queryId: Int, minTokensOut: Int) {
        require(!self.graduated, "curve graduated");
        let wallet: Address = self.requireWallet();

        let value: Int = context().value;
        require(value > self.GasBuyOverhead, "not enough value for gas");
        let tonIn: Int = value - self.GasBuyOverhead;

        let fee: Int = tonIn * self.feeBps / 10000;
        let net: Int = tonIn - fee;
        require(net > 0, "amount too small");

        let tokensOut: Int = self.tokensOutFor(net);
        require(tokensOut > 0, "amount too small");
        require(self.tokensSold + tokensOut <= self.tokensForSale, "not enough tokens left");
        require(tokensOut >= minTokensOut, "slippage");

        self.realTon = self.realTon + net;
        self.tokensSold = self.tokensSold + tokensOut;

        if (fee > 0) {
            send(SendParameters{
                to: self.feeWallet,
                value: fee,
                mode: SendIgnoreErrors,
                bounce: false,
            });
        }

        // Намеренно без SendIgnoreErrors. Если выдать жетоны не вышло,
        // фаза действий обязана упасть целиком: тогда запись о продаже
        // не сохранится, а деньги вернутся покупателю. С IgnoreErrors
        // всё было наоборот — контракт считал сделку состоявшейся, а
        // токены до человека не доходили.
        // Покупку записываем как незакрытую и отправляем перевод с
        // возвратом остатка на себя: удачная выдача пришлёт excesses и
        // закроет запись, неудачная вернёт сообщение — и тогда деньги
        // уйдут обратно покупателю. Благодаря этому покупка может прийти
        // раньше, чем на кривую доедет торговый запас: в худшем случае
        // человек просто получит свои TON назад.
        let id: Int = self.nextQueryId;
        self.nextQueryId = id + 1;
        self.pending.set(id, PendingBuy{ buyer: sender(), ton: net, tokens: tokensOut });

        send(SendParameters{
            to: wallet,
            value: self.GasJettonTransfer,
            bounce: true,
            body: JettonTransfer{
                queryId: id,
                amount: tokensOut,
                destination: sender(),
                responseDestination: myAddress(),
                customPayload: null,
                forwardTonAmount: 1,
                forwardPayload: emptySlice(),
            }.toCell(),
        });

        self.maybeGraduate();
    }

    // -----------------------------------------------------------------
    // Продажа: пользователь переводит жетоны на кошелёк кривой, тот
    // присылает сюда уведомление.
    // -----------------------------------------------------------------

    receive(msg: JettonTransferNotification) {
        let wallet: Address = self.requireWallet();
        // Уведомление принимаем только от собственного кошелька жетона —
        // иначе кто угодно прислал бы поддельное и выкачал резерв.
        require(sender() == wallet, "unknown jetton wallet");
        require(!self.graduated, "curve graduated");
        require(msg.amount > 0, "empty transfer");

        // Приход торгового запаса — не продажа. Он больше всего, что
        // когда-либо продано, и приходит один раз при запуске. В этот
        // момент довыдаём покупки, которые не смогли исполниться раньше:
        // при запуске покупка может обогнать запас, и без этого её исход
        // зависел бы от порядка доставки сообщений.
        if (msg.amount > self.tokensSold) {
            self.flushPending();
            return;
        }

        let minTonOut: Int = self.parseMinTonOut(msg.forwardPayload);

        let gross: Int = self.tonOutFor(msg.amount);
        let fee: Int = gross * self.feeBps / 10000;
        let payout: Int = gross - fee;
        require(payout > 0, "amount too small");
        require(payout >= minTonOut, "slippage");
        require(gross <= self.realTon, "reserve underflow");

        self.realTon = self.realTon - gross;
        self.tokensSold = self.tokensSold - msg.amount;

        if (fee > 0) {
            send(SendParameters{
                to: self.feeWallet,
                value: fee,
                mode: SendIgnoreErrors,
                bounce: false,
            });
        }

        // Тоже без IgnoreErrors: не смогли выплатить — вся операция
        // откатывается, и жетоны остаются у продавца, а не пропадают.
        send(SendParameters{
            to: msg.sender,
            value: payout,
            bounce: false,
        });
    }

    // Разбор необязательной защиты от проскальзывания в forwardPayload.
    // Читаем только когда бит точно есть: исключение здесь означало бы,
    // что уведомление не обработано, а жетоны остались на кривой — то
    // есть продавец потерял бы их. Любой непонятный payload трактуем как
    // «ограничения нет».
    fun parseMinTonOut(payload: Slice): Int {
        let s: Slice = payload;
        if (s.bits() < 1) {
            return 0;
        }
        let isRef: Bool = s.loadBool();
        if (isRef) {
            return 0;
        }
        if (s.bits() < 32) {
            return 0;
        }
        let op: Int = s.loadUint(32);
        if (op != 0x53454c4c) {
            return 0;
        }
        if (s.bits() < 4) {
            return 0;
        }
        return s.loadCoins();
    }

    // Повторная выдача по всем незакрытым покупкам. Записи не удаляем:
    // их закроет excesses после удачного перевода, а если снова не
    // выйдет — сработает возврат и деньги вернутся покупателю.
    fun flushPending() {
        let wallet: Address = self.requireWallet();
        foreach (id, buy in self.pending) {
            send(SendParameters{
                to: wallet,
                value: self.GasJettonTransfer,
                bounce: true,
                body: JettonTransfer{
                    queryId: id,
                    amount: buy.tokens,
                    destination: buy.buyer,
                    responseDestination: myAddress(),
                    customPayload: null,
                    forwardTonAmount: 1,
                    forwardPayload: emptySlice(),
                }.toCell(),
            });
        }
    }

    // Жетоны дошли — запись о покупке больше не нужна.
    receive(msg: JettonExcesses) {
        self.pending.del(msg.queryId);
    }

    // Сообщение вернулось: выдать жетоны не вышло (обычно их ещё нет на
    // кошельке кривой). Откатываем сделку и возвращаем деньги.
    bounced(src: Slice) {
        if (src.bits() < 32 + 64) {
            return;
        }
        let op: Int = src.loadUint(32);
        if (op != 0xf8a7ea5) {
            return;
        }
        let id: Int = src.loadUint(64);
        let entry: PendingBuy? = self.pending.get(id);
        if (entry == null) {
            return;
        }
        let buy: PendingBuy = entry!!;
        self.pending.del(id);

        self.realTon = self.realTon - buy.ton;
        self.tokensSold = self.tokensSold - buy.tokens;

        send(SendParameters{
            to: buy.buyer,
            value: buy.ton,
            mode: SendIgnoreErrors,
            bounce: false,
        });
    }

    // -----------------------------------------------------------------
    // Выпуск на DEX
    // -----------------------------------------------------------------

    fun maybeGraduate() {
        if (!self.graduated && self.realTon >= self.graduationTon) {
            self.graduated = true;
        }
    }

    receive(msg: Graduate) {
        require(self.graduated, "threshold not reached");
        let wallet: Address = self.requireWallet();

        // Непроданный остаток уходит вместе с деньгами — из него на
        // стороне DEX собирается пара.
        let leftover: Int = self.tokensForSale - self.tokensSold;
        if (leftover > 0) {
            self.tokensSold = self.tokensForSale;
            send(SendParameters{
                to: wallet,
                value: self.GasJettonTransfer,
                mode: SendIgnoreErrors,
                bounce: false,
                body: JettonTransfer{
                    queryId: msg.queryId,
                    amount: leftover,
                    destination: self.graduationDestination,
                    responseDestination: self.graduationDestination,
                    customPayload: null,
                    forwardTonAmount: 1,
                    forwardPayload: emptySlice(),
                }.toCell(),
            });
        }

        let payout: Int = self.realTon;
        self.realTon = 0;
        if (payout > 0) {
            send(SendParameters{
                to: self.graduationDestination,
                value: payout,
                mode: SendIgnoreErrors,
                bounce: false,
            });
        }
    }

    fun requireWallet(): Address {
        let wallet: Address? = self.jettonWallet;
        require(wallet != null, "jetton wallet not set");
        return wallet!!;
    }
}
