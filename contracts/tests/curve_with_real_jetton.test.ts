import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Address, beginCell, toNano } from "@ton/core";
import "@ton/test-utils";
import { JettonMinter, JettonWallet } from "@ton-community/assets-sdk";
import { BondingCurve } from "../build/bonding_curve_BondingCurve";

// Настоящий жетон вместо заглушки.
//
// В основном наборе тестов кошелёк жетона подменён обычным адресом:
// он принимает любое сообщение и ни на что не жалуется. Из-за этого
// мимо тестов прошли отказы, которые случались только в реальной сети —
// нехватка газа на развёртывание кошелька покупателя и отказ кошелька
// пересылать уведомление. Здесь разворачивается настоящий минтер из
// assets-sdk, тот же, что использует приложение, и проверяется, что
// жетоны действительно доходят до покупателя, а TON — до продавца.

const VIRTUAL_TON = toNano("291.217");
const VIRTUAL_TOKENS = toNano("1073000000");
const TOKENS_FOR_SALE = toNano("900000000");
const GRADUATION_TON = toNano("1500");
const FEE_BPS = 100n;

describe("BondingCurve с настоящим жетоном", () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let feeWallet: SandboxContract<TreasuryContract>;
  let dexSeeder: SandboxContract<TreasuryContract>;
  let buyer: SandboxContract<TreasuryContract>;
  let minter: SandboxContract<JettonMinter>;
  let curve: SandboxContract<BondingCurve>;
  let curveWallet: Address;

  async function jettonBalance(owner: Address): Promise<bigint> {
    const addr = await minter.getWalletAddress(owner);
    const state = await blockchain.getContract(addr);
    if (state.accountState?.type !== "active") return 0n;
    const wallet = blockchain.openContract(JettonWallet.createFromAddress(addr));
    const data = await wallet.getData();
    return data.balance;
  }

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
    feeWallet = await blockchain.treasury("feeWallet");
    dexSeeder = await blockchain.treasury("dexSeeder");
    buyer = await blockchain.treasury("buyer");

    const content = beginCell().storeUint(0x01, 8).storeStringTail("https://example.invalid/meta.json").endCell();
    minter = blockchain.openContract(
      JettonMinter.createFromConfig({ admin: deployer.address, content }),
    );
    await minter.sendDeploy(deployer.getSender(), toNano("0.1"));

    curve = blockchain.openContract(
      await BondingCurve.fromInit(
        deployer.address,
        minter.address,
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

    curveWallet = await minter.getWalletAddress(curve.address);
    await curve.send(deployer.getSender(), { value: toNano("0.05") }, {
      $$type: "SetJettonWallet",
      wallet: curveWallet,
    });
  });

  it("выдаёт жетоны покупателю, у которого ещё нет кошелька", async () => {
    await minter.sendMint(deployer.getSender(), curve.address, TOKENS_FOR_SALE);
    expect(await jettonBalance(curve.address)).toBe(TOKENS_FOR_SALE);
    expect(await jettonBalance(buyer.address)).toBe(0n);

    const res = await curve.send(buyer.getSender(), { value: toNano("5") }, {
      $$type: "Buy",
      queryId: 0n,
      minTokensOut: 0n,
    });
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: true });

    // Главная проверка: жетоны реально дошли, а не «сообщение отправлено».
    const got = await jettonBalance(buyer.address);
    expect(got).toBeGreaterThan(0n);

    const data = await curve.getData();
    expect(data.tokensSold).toBe(got);
    expect(data.realTon).toBeGreaterThan(0n);
  });

  it("довыдаёт покупку, пришедшую раньше торгового запаса", async () => {
    // Ровно порядок запуска: покупка обгоняет выпуск запаса.
    await curve.send(buyer.getSender(), { value: toNano("5") }, {
      $$type: "Buy",
      queryId: 0n,
      minTokensOut: 0n,
    });
    expect(await jettonBalance(buyer.address)).toBe(0n);

    await minter.sendMint(deployer.getSender(), curve.address, TOKENS_FOR_SALE);

    const got = await jettonBalance(buyer.address);
    expect(got).toBeGreaterThan(0n);
    const data = await curve.getData();
    expect(data.tokensSold).toBe(got);
  });

  it("выкупает жетоны обратно и платит TON", async () => {
    await minter.sendMint(deployer.getSender(), curve.address, TOKENS_FOR_SALE);
    await curve.send(buyer.getSender(), { value: toNano("10") }, {
      $$type: "Buy",
      queryId: 0n,
      minTokensOut: 0n,
    });
    const held = await jettonBalance(buyer.address);
    expect(held).toBeGreaterThan(0n);

    const buyerWallet = await minter.getWalletAddress(buyer.address);
    const tonBefore = await buyer.getBalance();

    // Тот же перевод, что строит приложение при продаже.
    const body = beginCell()
      .storeUint(0xf8a7ea5, 32)
      .storeUint(0, 64)
      .storeCoins(held)
      .storeAddress(curve.address)
      .storeAddress(buyer.address)
      .storeBit(false)
      .storeCoins(toNano("0.08"))
      .storeBit(false)
      .storeUint(0x53454c4c, 32)
      .storeCoins(0)
      .endCell();

    const res = await buyer.send({ to: buyerWallet, value: toNano("0.25"), body });
    expect(res.transactions).toHaveTransaction({ to: curve.address, success: true });

    expect(await jettonBalance(buyer.address)).toBe(0n);
    expect(await buyer.getBalance()).toBeGreaterThan(tonBefore);

    const data = await curve.getData();
    expect(data.tokensSold).toBe(0n);
  });
});
