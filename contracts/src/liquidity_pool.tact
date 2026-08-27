import "@stdlib/deploy";

//  LiquidityPool — рынок токена после того, как кривая отторговала.
//
//  Зачем он нужен. Кривая живёт до порога: набрала graduationTon —
//  закрылась и отдала всё, что у неё было, одному получателю. Раньше
//  этим получателем был кошелёк площадки, а пару на бирже потом заводили
//  руками. Пока её не завели, торговать было негде, и токен зависал
//  между «здесь уже нельзя» и «там ещё нет».
//
//  Теперь получатель — этот контракт. Он принимает TON и остаток
//  выпуска и продолжает торговлю по тем же правилам, что и кривая, с
//  одним отличием: резервы настоящие, виртуальных нет.
//
//      k = tonReserve * tokenReserve
//
//  Из-за этого цена больше не растёт «сама по себе»: она ходит вверх и
//  вниз ровно настолько, насколько покупают и продают. Ликвидность
//  никуда не выводится — на контракте лежит и то и другое, продать
//  можно всегда.
//
//  Чего здесь намеренно нет: долей поставщиков ликвидности (LP-жетонов).
//  Ликвидность в пул кладёт один раз кривая, и забрать её нельзя —
//  никому, включая администратора. Единственное, что умеет админ, —
//  привязать кошелёк жетона, и то один раз.

// ---------------------------------------------------------------------
// Сообщения стандарта жетонов (TEP-74) — те же, что у кривой.
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

message(0xd53276db) JettonExcesses {
    queryId: Int as uint64;
}

// ---------------------------------------------------------------------
// Свои сообщения
// ---------------------------------------------------------------------

// Покупка за TON. minTokensOut защищает от проскальзывания.
message(0x50425559) PoolBuy {
    queryId: Int as uint64;
    minTokensOut: Int as coins;
}

// Кошелёк жетона у самого пула. Известен только после деплоя жетона,
// поэтому приходит отдельным сообщением и ровно один раз.
message(0x5745544a) SetJettonWallet {
    wallet: Address;
}

// Кривая этого токена — единственный, у кого пул примет ликвидность.
// Отдельным сообщением, а не параметром создания, по простой причине:
// кривая создаётся с адресом пула внутри, и если бы пул создавался с
// адресом кривой, ни один из двух адресов нельзя было бы вычислить —
// каждый зависел бы от другого. Ставится один раз и навсегда.
message(0x53435256) SetCurve {
    curve: Address;
}

// Незакрытая покупка: жетоны отправлены, подтверждения ещё нет. То же
// решение, что и на кривой: пока исход неизвестен, знаем, кому и сколько
// вернуть, если перевод не прошёл.
struct PoolPendingBuy {
    buyer: Address;
    ton: Int as coins;
    tokens: Int as coins;
    failed: Bool;
}

struct PoolData {
    tonReserve: Int;
    tokenReserve: Int;
    feeBps: Int;
    // Обе половины ликвидности на месте, торговля открыта.
    ready: Bool;
    curve: Address?;
    jettonMaster: Address;
    jettonWallet: Address?;
}

contract LiquidityPool with Deployable {
    // --- неизменяемое после создания ---
    admin: Address;         // может только привязать кошелёк жетона
    jettonMaster: Address;  // жетон, которым торгует пул
    feeWallet: Address;     // куда уходит комиссия площадки
    feeBps: Int as uint16;

    // --- состояние ---
    jettonWallet: Address? = null;
    // Кривая этого токена: единственный источник ликвидности.
    curve: Address? = null;
    tonReserve: Int as coins = 0;
    tokenReserve: Int as coins = 0;
    // Половины ликвидности приходят двумя сообщениями и в любом порядке,
    // поэтому отмечаются отдельно. Торговля открывается, когда есть обе:
    // с одной стороной пула цена не определена.
    tonFunded: Bool = false;
    tokensFunded: Bool = false;

    pending: map<Int as uint64, PoolPendingBuy>;
    nextQueryId: Int as uint64 = 1;

    // Газ на перевод жетонов покупателю, отправку комиссии и хранение.
    // Числа те же, что на кривой: сообщения и получатели одинаковые.
    const GasBuyOverhead: Int = ton("0.12");
    const GasJettonTransfer: Int = ton("0.08");
    const MinContractBalance: Int = ton("0.05");

    init(
        admin: Address,
        jettonMaster: Address,
        feeWallet: Address,
        feeBps: Int,
    ) {
        require(feeBps >= 0 && feeBps <= 1000, "feeBps out of range");
        self.admin = admin;
        self.jettonMaster = jettonMaster;
        self.feeWallet = feeWallet;
        self.feeBps = feeBps;
    }

    // -----------------------------------------------------------------
    // Математика. Округление везде в пользу пула: покупатель получает не
    // больше расчётного, продавец — не больше расчётного. Иначе цикл
    // «купил-продал» вытягивал бы резерв по копейке.
    // -----------------------------------------------------------------

    get fun k(): Int {
        return self.tonReserve * self.tokenReserve;
    }

    get fun ready(): Bool {
        return self.tonFunded && self.tokensFunded && self.tonReserve > 0 && self.tokenReserve > 0;
    }

    // Сколько токенов даст покупка на tonIn (комиссия уже вычтена).
    get fun tokensOutFor(tonIn: Int): Int {
        if (tonIn <= 0 || !self.ready()) {
            return 0;
        }
        let newTonReserve: Int = self.tonReserve + tonIn;
        let newTokenReserve: Int = self.k() / newTonReserve;
        let out: Int = self.tokenReserve - newTokenReserve;
        if (out < 0) {
            return 0;
        }
        return out;
    }

    // Сколько TON вернёт продажа tokensIn токенов (до вычета комиссии).
    get fun tonOutFor(tokensIn: Int): Int {
        if (tokensIn <= 0 || !self.ready()) {
            return 0;
        }
        let newTokenReserve: Int = self.tokenReserve + tokensIn;
        let newTonReserve: Int = (self.k() + newTokenReserve - 1) / newTokenReserve;
        let out: Int = self.tonReserve - newTonReserve;
        if (out < 0) {
            return 0;
        }
        return out;
    }

    get fun data(): PoolData {
        return PoolData{
            tonReserve: self.tonReserve,
            tokenReserve: self.tokenReserve,
            feeBps: self.feeBps,
            ready: self.ready(),
            curve: self.curve,
            jettonMaster: self.jettonMaster,
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

    receive(msg: SetCurve) {
        require(sender() == self.admin, "only admin");
        require(self.curve == null, "curve already set");
        self.curve = msg.curve;
    }

    // -----------------------------------------------------------------
    // Покупка
    // -----------------------------------------------------------------

    receive(msg: PoolBuy) {
        self.handleBuy(msg.minTokensOut);
    }

    // Пустое сообщение с TON. От кривой это денежная половина
    // ликвидности — она уходит именно так, простым переводом. От всех
    // остальных — покупка без защиты от проскальзывания: некоторые
    // кошельки умеют только «отправить TON на адрес».
    receive() {
        if (self.curve != null && sender() == self.curve!! && !self.tonFunded) {
            let value: Int = context().value;
            // Немного оставляем на хранение: пул должен пережить время
            // между приходом ликвидности и первой сделкой.
            let liquidity: Int = value - self.MinContractBalance;
            require(liquidity > 0, "liquidity too small");
            self.tonReserve = self.tonReserve + liquidity;
            self.tonFunded = true;
            return;
        }
        self.handleBuy(0);
    }

    fun handleBuy(minTokensOut: Int) {
        require(self.ready(), "pool not ready");
        let wallet: Address = self.requireWallet();

        let value: Int = context().value;
        require(value > self.GasBuyOverhead, "not enough value for gas");
        let tonIn: Int = value - self.GasBuyOverhead;

        let fee: Int = tonIn * self.feeBps / 10000;
        let net: Int = tonIn - fee;
        require(net > 0, "amount too small");

        let tokensOut: Int = self.tokensOutFor(net);
        require(tokensOut > 0, "amount too small");
        // Резерв нельзя опустошить полностью: при нулевом резерве цена
        // перестаёт быть определённой, и пул уже не починить.
        require(tokensOut < self.tokenReserve, "not enough liquidity");
        require(tokensOut >= minTokensOut, "slippage");

        self.tonReserve = self.tonReserve + net;
        self.tokenReserve = self.tokenReserve - tokensOut;

        if (fee > 0) {
            send(SendParameters{
                to: self.feeWallet,
                value: fee,
                mode: SendIgnoreErrors,
                bounce: false,
            });
        }

        // Как и на кривой: перевод идёт с возвратом остатка на себя.
        // Удачная выдача пришлёт excesses и закроет запись, неудачная
        // вернётся сюда — и тогда TON уйдут обратно покупателю.
        let id: Int = self.nextQueryId;
        self.nextQueryId = id + 1;
        self.pending.set(id, PoolPendingBuy{ buyer: sender(), ton: net, tokens: tokensOut, failed: false });

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
                forwardTonAmount: 0,
                forwardPayload: beginCell().storeBool(false).asSlice(),
            }.toCell(),
        });
    }

    // -----------------------------------------------------------------
    // Приход токенов: половина ликвидности от кривой или продажа.
    // -----------------------------------------------------------------

    receive(msg: JettonTransferNotification) {
        let wallet: Address = self.requireWallet();
        // Уведомление принимаем только от собственного кошелька жетона —
        // иначе поддельное сообщение выкачало бы резерв.
        require(sender() == wallet, "unknown jetton wallet");
        require(msg.amount > 0, "empty transfer");

        // Токенная половина ликвидности. Отправитель — кривая, и это
        // единственный перевод, который она делает: дальше её остаток
        // равен нулю.
        if (!self.tokensFunded && self.curve != null && msg.sender == self.curve!!) {
            self.tokenReserve = self.tokenReserve + msg.amount;
            self.tokensFunded = true;
            return;
        }

        require(self.ready(), "pool not ready");

        let minTonOut: Int = self.parseMinTonOut(msg.forwardPayload);

        let gross: Int = self.tonOutFor(msg.amount);
        let fee: Int = gross * self.feeBps / 10000;
        let payout: Int = gross - fee;
        require(payout > 0, "amount too small");
        require(payout >= minTonOut, "slippage");
        // Резерв обязан остаться при деньгах: продажа не может забрать
        // его целиком, иначе цена перестанет считаться.
        require(gross < self.tonReserve, "not enough liquidity");

        self.tonReserve = self.tonReserve - gross;
        self.tokenReserve = self.tokenReserve + msg.amount;

        if (fee > 0) {
            send(SendParameters{
                to: self.feeWallet,
                value: fee,
                mode: SendIgnoreErrors,
                bounce: false,
            });
        }

        // Без SendIgnoreErrors: не смогли выплатить — операция
        // откатывается целиком, и жетоны остаются у продавца.
        send(SendParameters{
            to: msg.sender,
            value: payout,
            bounce: false,
        });
    }

    // Разбор необязательной защиты от проскальзывания. Правила те же,
    // что на кривой: непонятный payload означает «ограничения нет», и
    // исключение здесь недопустимо — иначе жетоны застряли бы в пуле.
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

    // Жетоны дошли — запись о покупке больше не нужна.
    receive(msg: JettonExcesses) {
        self.pending.del(msg.queryId);
    }

    // Сообщение вернулось: выдать жетоны не вышло. Сделку отменяем и
    // возвращаем деньги покупателю, резервы — к тому, что было до неё.
    // Разбираем сырым срезом, а не bounced<JettonTransfer>: возврат
    // несёт только первые 224 бита тела, и типизированный разбор на нём
    // работает не во всех случаях.
    bounced(src: Slice) {
        if (src.bits() < 32 + 64) {
            return;
        }
        let op: Int = src.loadUint(32);
        if (op != 0xf8a7ea5) {
            return;
        }
        let id: Int = src.loadUint(64);
        let buy: PoolPendingBuy? = self.pending.get(id);
        if (buy == null) {
            return;
        }
        let b: PoolPendingBuy = buy!!;
        self.pending.del(id);
        self.tonReserve = self.tonReserve - b.ton;
        self.tokenReserve = self.tokenReserve + b.tokens;

        send(SendParameters{
            to: b.buyer,
            value: b.ton,
            mode: SendIgnoreErrors,
            bounce: false,
        });
    }

    fun requireWallet(): Address {
        let wallet: Address? = self.jettonWallet;
        require(wallet != null, "jetton wallet not set");
        return wallet!!;
    }
}
