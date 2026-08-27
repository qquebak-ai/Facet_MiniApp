import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Address, beginCell, toNano } from "@ton/core";
import "@ton/test-utils";
import { JettonMinter, JettonWallet } from "@ton-community/assets-sdk";
import { BondingCurve } from "../build/bonding_curve_BondingCurve";
import { LiquidityPool } from "../build/liquidity_pool_LiquidityPool";

// Жизнь токена после кривой.
//
// Проверяется то, ради чего пул и написан: кривая, набрав порог, отдаёт
// ему обе половины ликвидности — TON и непроданный остаток, — и с этого
// момента торговля продолжается в пуле. Раньше на этом месте деньги
// уходили на кошелёк площадки, и торговать было негде до тех пор, пока
// пару не заведут руками на чужой бирже.

const VIRTUAL_TON = toNano("291.217");
const VIRTUAL_TOKENS = toNano("1073000000");
const TOKENS_FOR_SALE = toNano("900000000");
const TOTAL_SUPPLY = toNano("1000000000");
// Порог маленький: в песочнице казна выдаёт ограниченный запас, и на
// боевые полторы тысячи TON её не хватит.
const GRADUATION_TON = toNano("50");
const FEE_BPS = 100n;

describe("LiquidityPool", () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let feeWallet: SandboxContract<TreasuryContract>;
  let buyer: SandboxContract<TreasuryContract>;
  let trader: SandboxContract<TreasuryContract>;
  let minter: SandboxContract<JettonMinter>;
  let curve: SandboxContract<BondingCurve>;
  let pool: SandboxContract<LiquidityPool>;

  async function jettonBalance(owner: Address): Promise<bigint> {
    const addr = await minter.getWalletAddress(owner);
    const state = await blockchain.getContract(addr);
    if (state.accountState?.type !== "active") return 0n;
    const wallet = blockchain.openContract(JettonWallet.createFromAddress(addr));
    const data = await wallet.getData();
    return data.balance;
  }

  // Продажа: тот же перевод жетонов, что строит приложение.
  function продажа(сколько: bigint, куда: Address, кто: Address, minTonOut: bigint) {
    return beginCell()
      .storeUint(0xf8a7ea5, 32)
      .storeUint(0, 64)
      .storeCoins(сколько)
      .storeAddress(куда)
      .storeAddress(кто)
      .storeBit(false)
      .storeCoins(toNano("0.08"))
      .storeBit(false)
      .storeUint(0x53454c4c, 32)
      .storeCoins(minTonOut)
      .endCell();
  }

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
    feeWallet = await blockchain.treasury("feeWallet");
    buyer = await blockchain.treasury("buyer", { balance: toNano("400") });
    trader = await blockchain.treasury("trader", { balance: toNano("200") });

    const content = beginCell().storeUint(0x01, 8).storeStringTail("https://example.invalid/meta.json").endCell();
    minter = blockchain.openContract(JettonMinter.createFromConfig({ admin: deployer.address, content }));
    await minter.sendDeploy(deployer.getSender(), toNano("0.1"));

    // Пул создаётся первым: его адрес зависит только от жетона и
    // параметров площадки. Кривая же создаётся с адресом пула внутри —
    // именно туда она отдаст ликвидность, когда наберёт порог.
    pool = blockchain.openContract(
      await LiquidityPool.fromInit(
        deployer.address,
        minter.address,
        feeWallet.address,
        FEE_BPS,
      ),
    );

    curve = blockchain.openContract(
      await BondingCurve.fromInit(
        deployer.address,
        minter.address,
        feeWallet.address,
        pool.address,
        VIRTUAL_TON,
        VIRTUAL_TOKENS,
        TOKENS_FOR_SALE,
        GRADUATION_TON,
        FEE_BPS,
      ),
    );

    await curve.send(deployer.getSender(), { value: toNano("0.5") }, { $$type: "Deploy", queryId: 0n });
    await pool.send(deployer.getSender(), { value: toNano("0.5") }, { $$type: "Deploy", queryId: 0n });

    await curve.send(deployer.getSender(), { value: toNano("0.05") }, {
      $$type: "SetJettonWallet",
      wallet: await minter.getWalletAddress(curve.address),
    });
    await pool.send(deployer.getSender(), { value: toNano("0.05") }, {
      $$type: "SetJettonWallet",
      wallet: await minter.getWalletAddress(pool.address),
    });
    await pool.send(deployer.getSender(), { value: toNano("0.05") }, {
      $$type: "SetCurve",
      curve: curve.address,
    });

    await minter.sendMint(deployer.getSender(), curve.address, TOTAL_SUPPLY);
  });

  async function довестиДоПула() {
    // Набираем порог и закрываем кривую.
    await curve.send(buyer.getSender(), { value: toNano("120") }, { $$type: "Buy", queryId: 0n, minTokensOut: 0n });
    const состояние = await curve.getData();
    expect(состояние.graduated).toBe(true);

    await curve.send(deployer.getSender(), { value: toNano("0.4") }, { $$type: "Graduate", queryId: 1n });
  }

  it("забирает у кривой обе половины ликвидности", async () => {
    await довестиДоПула();

    const данные = await pool.getData();
    expect(данные.ready).toBe(true);
    expect(данные.tonReserve).toBeGreaterThan(0n);
    expect(данные.tokenReserve).toBeGreaterThan(0n);
    // Токены действительно лежат на пуле, а не только записаны в него.
    expect(await jettonBalance(pool.address)).toBe(данные.tokenReserve);
  });

  it("продаёт токены за TON и берёт комиссию", async () => {
    await довестиДоПула();
    const до = await pool.getData();
    const комиссияДо = await feeWallet.getBalance();

    const res = await pool.send(trader.getSender(), { value: toNano("10") }, {
      $$type: "PoolBuy",
      queryId: 0n,
      minTokensOut: 0n,
    });
    expect(res.transactions).toHaveTransaction({ to: pool.address, success: true });

    const получено = await jettonBalance(trader.address);
    expect(получено).toBeGreaterThan(0n);

    const после = await pool.getData();
    expect(после.tonReserve).toBeGreaterThan(до.tonReserve);
    expect(после.tokenReserve).toBe(до.tokenReserve - получено);
    expect(await feeWallet.getBalance()).toBeGreaterThan(комиссияДо);
  });

  it("выкупает токены обратно", async () => {
    await довестиДоПула();
    await pool.send(trader.getSender(), { value: toNano("10") }, { $$type: "PoolBuy", queryId: 0n, minTokensOut: 0n });

    const держит = await jettonBalance(trader.address);
    expect(держит).toBeGreaterThan(0n);
    const денегДо = await trader.getBalance();
    const резервДо = (await pool.getData()).tonReserve;

    const traderWallet = await minter.getWalletAddress(trader.address);
    await trader.send({
      to: traderWallet,
      value: toNano("0.3"),
      body: продажа(держит, pool.address, trader.address, 0n),
    });

    expect(await jettonBalance(trader.address)).toBe(0n);
    expect(await trader.getBalance()).toBeGreaterThan(денегДо);
    const после = await pool.getData();
    expect(после.tonReserve).toBeLessThan(резервДо);
    expect(после.tokenReserve).toBeGreaterThan(0n);
  });

  it("цена ходит вверх и вниз, а не только вверх", async () => {
    await довестиДоПула();
    const цена = async () => {
      const d = await pool.getData();
      return Number(d.tonReserve) / Number(d.tokenReserve);
    };

    const старт = await цена();
    await pool.send(trader.getSender(), { value: toNano("20") }, { $$type: "PoolBuy", queryId: 0n, minTokensOut: 0n });
    const послеПокупки = await цена();
    expect(послеПокупки).toBeGreaterThan(старт);

    const держит = await jettonBalance(trader.address);
    await trader.send({
      to: await minter.getWalletAddress(trader.address),
      value: toNano("0.3"),
      body: продажа(держит, pool.address, trader.address, 0n),
    });
    const послеПродажи = await цена();
    expect(послеПродажи).toBeLessThan(послеПокупки);
  });

  it("не принимает ликвидность от чужого адреса", async () => {
    // Пустой перевод от постороннего — это покупка, а пул ещё пуст,
    // поэтому она обязана отбиться, а не записаться в резерв.
    const res = await pool.send(trader.getSender(), { value: toNano("5") }, null);
    expect(res.transactions).toHaveTransaction({ to: pool.address, success: false });
    const данные = await pool.getData();
    expect(данные.tonReserve).toBe(0n);
    expect(данные.ready).toBe(false);
  });

  it("защита от проскальзывания отбивает покупку", async () => {
    await довестиДоПула();
    const res = await pool.send(trader.getSender(), { value: toNano("5") }, {
      $$type: "PoolBuy",
      queryId: 0n,
      // Заведомо больше, чем можно получить.
      minTokensOut: toNano("1000000000"),
    });
    expect(res.transactions).toHaveTransaction({ to: pool.address, success: false });
    expect(await jettonBalance(trader.address)).toBe(0n);
  });
});
