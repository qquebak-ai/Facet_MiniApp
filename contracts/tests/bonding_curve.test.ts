import { Blockchain, SandboxContract, TreasuryContract, internal } from "@ton/sandbox";
import { Address, beginCell, Cell, toNano } from "@ton/core";
import "@ton/test-utils";
import { BondingCurve, JettonTransfer, storeJettonTransfer } from "../build/bonding_curve_BondingCurve";

// Кошелёк жетона в тестах подменён обычным адресом: кривая только шлёт
// на него JettonTransfer и принимает от него уведомления, поэтому
// проверить обе стороны можно без развёртывания настоящего жетона.
const JETTON_MASTER = new Address(0, Buffer.alloc(32, 7));

const VIRTUAL_TON = toNano("30");
const VIRTUAL_TOKENS = toNano("1073000000");
const TOKENS_FOR_SALE = toNano("900000000");
const GRADUATION_TON = toNano("100");
const FEE_BPS = 100n; // 1%
// Должно совпадать с GasBuyOverhead в bonding_curve.tact и с
// CURVE_GAS_BUY_OVERHEAD в src/curveConfig.js: контракт удерживает
// столько из каждой покупки на газ.
const GAS_BUY_OVERHEAD = toNano("0.25");

describe("BondingCurve", () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let admin: SandboxContract<TreasuryContract>;
  let feeWallet: SandboxContract<TreasuryContract>;
  let dexSeeder: SandboxContract<TreasuryContract>;
  let jettonWallet: SandboxContract<TreasuryContract>;
  let buyer: SandboxContract<TreasuryContract>;
  let curve: SandboxContract<BondingCurve>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
    admin = await blockchain.treasury("admin");
    feeWallet = await blockchain.treasury("feeWallet");
    dexSeeder = await blockchain.treasury("dexSeeder");
    jettonWallet = await blockchain.treasury("jettonWallet");
    buyer = await blockchain.treasury("buyer");

    curve = blockchain.openContract(
      await BondingCurve.fromInit(
        admin.address,
        JETTON_MASTER,
        feeWallet.address,
        dexSeeder.address,
        VIRTUAL_TON,
        VIRTUAL_TOKENS,
        TOKENS_FOR_SALE,
        GRADUATION_TON,
        FEE_BPS,
      ),
    );

    await curve.send(deployer.getSender(), { value: toNano("0.5") }, { $$type: "Deploy", queryId: 0n });
  });

  async function bindWallet() {
    return curve.send(admin.getSender(), { value: toNano("0.05") }, {
      $$type: "SetJettonWallet",
      wallet: jettonWallet.address,
    });
  }

  async function buy(value: string, minTokensOut: bigint = 0n) {
    return curve.send(buyer.getSender(), { value: toNano(value) }, {
      $$type: "Buy",
      queryId: 0n,
      minTokensOut,
    });
  }

  // Уведомление о переводе жетонов — то, что настоящий кошелёк жетона
  // прислал бы кривой после перевода от продавца.
  function sellNotification(amount: bigint, seller: Address, minTonOut?: bigint) {
    // TEP-74 кладёт forwardPayload как Either Cell ^Cell, поэтому перед
    // содержимым идёт бит-признак. Кривая читает его первым.
    const payload = minTonOut === undefined
      ? beginCell().endCell().beginParse()
      : beginCell().storeBit(false).storeUint(0x53454c4c, 32).storeCoins(minTonOut).endCell().beginParse();
    return {
      $$type: "JettonTransferNotification" as const,
      queryId: 0n,
      amount,
      sender: seller,
      forwardPayload: payload,
    };
  }

  function jettonTransferFrom(result: any): JettonTransfer | null {
    for (const tx of result.transactions) {
      for (const out of tx.outMessages.values()) {
        const body: Cell = out.body;
        const slice = body.beginParse();
        if (slice.remainingBits < 32) continue;
        if (slice.preloadUint(32) !== 0xf8a7ea5) continue;
        slice.loadUint(32);
        return {
          $$type: "JettonTransfer",
          queryId: slice.loadUintBig(64),
          amount: slice.loadCoins(),
          destination: slice.loadAddress(),
          responseDestination: slice.loadMaybeAddress(),
          customPayload: slice.loadMaybeRef(),
          forwardTonAmount: slice.loadCoins(),
          forwardPayload: slice,
        } as JettonTransfer;
      }
    }
    return null;
  }

  it("отвергает покупку, пока не привязан кошелёк жетона", async () => {
    const res = await buy("1");
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: false });
  });

  it("привязывает кошелёк жетона только админом и только один раз", async () => {
    const byStranger = await curve.send(buyer.getSender(), { value: toNano("0.05") }, {
      $$type: "SetJettonWallet",
      wallet: jettonWallet.address,
    });
    expect(byStranger.transactions).toHaveTransaction({ to: curve.address, success: false });

    const ok = await bindWallet();
    expect(ok.transactions).toHaveTransaction({ to: curve.address, success: true });

    const again = await bindWallet();
    expect(again.transactions).toHaveTransaction({ to: curve.address, success: false });
  });

  it("продаёт токены за TON и берёт комиссию", async () => {
    await bindWallet();

    const before = await curve.getData();
    const net = toNano("1") - GAS_BUY_OVERHEAD;
    const expected = await curve.getTokensOutFor(net - net / 100n);

    const res = await buy("1");
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: true });

    const transfer = jettonTransferFrom(res);
    expect(transfer).not.toBeNull();
    expect(transfer!.destination.toString()).toBe(buyer.address.toString());
    expect(transfer!.amount).toBe(expected);

    const after = await curve.getData();
    expect(after.tokensSold).toBe(before.tokensSold + expected);
    expect(after.realTon).toBeGreaterThan(0n);

    // Комиссия ушла на кошелёк платформы отдельным сообщением.
    expect(res.transactions).toHaveTransaction({ from: curve.address, to: feeWallet.address, success: true });
  });

  it("поднимает цену: та же сумма приносит меньше токенов", async () => {
    await bindWallet();
    const first = jettonTransferFrom(await buy("5"))!;
    const second = jettonTransferFrom(await buy("5"))!;
    expect(second.amount).toBeLessThan(first.amount);
  });

  it("не исполняет покупку при проскальзывании", async () => {
    await bindWallet();
    const fair = await curve.getTokensOutFor(toNano("1"));
    const res = await buy("1", fair * 2n);
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: false });
  });

  it("выкупает токены обратно и возвращает TON", async () => {
    await bindWallet();
    const bought = jettonTransferFrom(await buy("10"))!.amount;

    const before = await curve.getData();
    const res = await curve.send(jettonWallet.getSender(), { value: toNano("0.2") },
      sellNotification(bought, buyer.address));
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: true });
    expect(res.transactions).toHaveTransaction({ from: curve.address, to: buyer.address, success: true });

    const after = await curve.getData();
    expect(after.tokensSold).toBe(before.tokensSold - bought);
    expect(after.realTon).toBeLessThan(before.realTon);
  });

  it("не даёт заработать на круге купил-продал", async () => {
    await bindWallet();
    const spent = toNano("10");
    const balanceBefore = await buyer.getBalance();
    const bought = jettonTransferFrom(await buy("10"))!.amount;
    await curve.send(jettonWallet.getSender(), { value: toNano("0.2") }, sellNotification(bought, buyer.address));
    const balanceAfter = await buyer.getBalance();
    expect(balanceAfter).toBeLessThan(balanceBefore);
    expect(balanceBefore - balanceAfter).toBeGreaterThan(spent / 100n);
  });

  it("отвергает уведомление не от своего кошелька жетона", async () => {
    await bindWallet();
    jettonTransferFrom(await buy("5"))!;
    const res = await curve.send(deployer.getSender(), { value: toNano("0.2") },
      sellNotification(toNano("1000"), deployer.address));
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: false });
  });

  it("не платит за жетоны сверх проданного — это приход запаса, а не продажа", async () => {
    await bindWallet();
    const bought = jettonTransferFrom(await buy("5"))!.amount;
    const before = await curve.getData();

    // Больше, чем когда-либо продано, может прийти только как торговый
    // запас при запуске. Платить за это нельзя: иначе кто угодно
    // «продал» бы кривой её же токены и выкачал резерв.
    const res = await curve.send(jettonWallet.getSender(), { value: toNano("0.2") },
      sellNotification(bought + 1n, buyer.address));
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: true });
    expect(res.transactions).not.toHaveTransaction({ from: curve.address, to: buyer.address });

    const after = await curve.getData();
    expect(after.realTon).toBe(before.realTon);
    expect(after.tokensSold).toBe(before.tokensSold);
  });

  it("уважает minTonOut при продаже", async () => {
    await bindWallet();
    const bought = jettonTransferFrom(await buy("10"))!.amount;
    const fair = await curve.getTonOutFor(bought);
    const res = await curve.send(jettonWallet.getSender(), { value: toNano("0.2") },
      sellNotification(bought, buyer.address, fair * 2n));
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: false });
  });

  it("закрывает торговлю и отдаёт ликвидность только на заданный адрес", async () => {
    await bindWallet();

    // Добираем порог несколькими покупками.
    for (let i = 0; i < 12; i++) {
      await buy("10");
    }
    const data = await curve.getData();
    expect(data.graduated).toBe(true);

    // После выпуска торговать нельзя.
    const afterGrad = await buy("1");
    expect(afterGrad.transactions).toHaveTransaction({ to: curve.address, success: false });

    const res = await curve.send(deployer.getSender(), { value: toNano("0.3") }, { $$type: "Graduate", queryId: 0n });
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: true });
    // TON ушли на адрес, заданный при создании, а не отправителю.
    expect(res.transactions).toHaveTransaction({ from: curve.address, to: dexSeeder.address, success: true });

    const transfer = jettonTransferFrom(res);
    expect(transfer).not.toBeNull();
    expect(transfer!.destination.toString()).toBe(dexSeeder.address.toString());

    const done = await curve.getData();
    expect(done.realTon).toBe(0n);
    expect(done.tokensSold).toBe(TOKENS_FOR_SALE);
  });

  it("возвращает деньги, если жетоны выдать не удалось", async () => {
    await bindWallet();
    const before = await curve.getData();

    const res = await buy("10");
    const transfer = jettonTransferFrom(res)!;
    expect(transfer).not.toBeNull();

    const afterBuy = await curve.getData();
    expect(afterBuy.realTon).toBeGreaterThan(before.realTon);

    // Кошелёк жетона не смог выполнить перевод и вернул сообщение —
    // ровно то, что произойдёт, если покупка обгонит приход запаса.
    const bounced = await blockchain.sendMessage(
      internal({
        from: jettonWallet.address,
        to: curve.address,
        value: toNano("0.05"),
        bounced: true,
        body: beginCell()
          .storeUint(0xffffffff, 32)
          .storeUint(0xf8a7ea5, 32)
          .storeUint(transfer.queryId, 64)
          .storeCoins(transfer.amount)
          .endCell(),
      }),
    );

    // Деньги ушли обратно покупателю, продажа отменена.
    expect(bounced.transactions).toHaveTransaction({ from: curve.address, to: buyer.address, success: true });
    const afterBounce = await curve.getData();
    expect(afterBounce.realTon).toBe(before.realTon);
    expect(afterBounce.tokensSold).toBe(before.tokensSold);
  });

  it("не отменяет выданную покупку возвратом от прошлой попытки", async () => {
    await bindWallet();
    const first = jettonTransferFrom(await buy("10"))!;
    const before = await curve.getData();

    // Приход торгового запаса — кривая повторяет выдачу под новым
    // номером.
    const flush = await curve.send(jettonWallet.getSender(), { value: toNano("0.2") },
      sellNotification(TOKENS_FOR_SALE, buyer.address));
    const retry = jettonTransferFrom(flush)!;
    expect(retry).not.toBeNull();
    expect(retry.amount).toBe(first.amount);
    expect(retry.queryId).not.toBe(first.queryId);

    // Возврат от первой попытки приходит с опозданием. Он относится к
    // номеру, которого уже нет, поэтому сделку трогать не должен.
    const late = await blockchain.sendMessage(
      internal({
        from: jettonWallet.address,
        to: curve.address,
        value: toNano("0.05"),
        bounced: true,
        body: beginCell()
          .storeUint(0xffffffff, 32)
          .storeUint(0xf8a7ea5, 32)
          .storeUint(first.queryId, 64)
          .storeCoins(first.amount)
          .endCell(),
      }),
    );
    expect(late.transactions).not.toHaveTransaction({ from: curve.address, to: buyer.address });

    const after = await curve.getData();
    expect(after.realTon).toBe(before.realTon);
    expect(after.tokensSold).toBe(before.tokensSold);
  });

  it("не отдаёт ликвидность до достижения порога", async () => {
    await bindWallet();
    await buy("5");
    const res = await curve.send(deployer.getSender(), { value: toNano("0.3") }, { $$type: "Graduate", queryId: 0n });
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: false });
  });
});
