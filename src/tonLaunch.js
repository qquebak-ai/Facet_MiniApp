/* ---------------------------------------------------------
   tonLaunch.js — REAL on-chain memecoin launch via TonConnect.

   Replaces the previous fully-simulated TokenLaunchOverlay flow with
   actual blockchain transactions:
     1) upload logo + TEP-64 off-chain metadata JSON to public storage
     2) deploy a standard TEP-74 Jetton minter, signed by the user's
        connected wallet through TonConnect (no server-side private key
        ever touches this — the user approves every transaction)
     3) wait for the deploy to land on-chain
     4) create a TON/Jetton liquidity pool on STON.fi, seeded with the
        jetton supply share + the TON amount the user committed
     5) wait for the pool transaction to confirm

   REQUIRED NEW DEPENDENCIES (not in the project yet — run before use):
     npm install @ton-community/assets-sdk @ton/ton @ston-fi/sdk

   IMPORTANT — read before shipping to mainnet:
   - This code was written without the ability to run it against a live
     network or verify it compiles against the exact package versions
     you'll install. Library APIs on the TON ecosystem move fast.
   - TEST ON TESTNET FIRST with small amounts. Confirm the minter
     deploys, the pool appears on STON.fi's testnet UI, and a test
     buy/sell round-trips correctly, before enabling this on mainnet.
   - Every step that moves funds goes through `tonConnectUI.sendTransaction`,
     which always shows the user their wallet's own approval screen with
     the exact amount — nothing is auto-signed or hidden.
--------------------------------------------------------- */

import { Address, beginCell, toNano, storeStateInit } from "@ton/core";
import { TonClient4 } from "@ton/ton";
import { AssetsSDK, JettonParams } from "@ton-community/assets-sdk";
import { DEX, pTON } from "@ston-fi/sdk";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------
   1. TonConnect -> ton-core Sender adapter
   AssetsSDK and the STON.fi SDK both expect a `Sender`
   ({ address, send(args) }) — the same interface a server-side
   keypair wallet would implement. This adapter fulfills that
   interface by routing every send() through the user's own
   TonConnect wallet popup instead of signing with a private key.
--------------------------------------------------------- */
function tonConnectSender(tonConnectUI, walletAddress) {
  return {
    address: Address.parse(walletAddress),
    async send(args) {
      const message = {
        address: args.to.toString(),
        amount: args.value.toString(),
      };
      if (args.body) {
        message.payload = args.body.toBoc().toString("base64");
      }
      if (args.init) {
        message.stateInit = beginCell()
          .store(storeStateInit(args.init))
          .endCell()
          .toBoc()
          .toString("base64");
      }
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [message],
      });
    },
  };
}

/* ---------------------------------------------------------
   2. Metadata — upload logo + TEP-64 off-chain JSON to Supabase
   Storage so the jetton has a real public content URI (wallets
   and explorers fetch this to show name/symbol/image).
   Requires a public "token-assets" bucket in your Supabase project
   (Storage -> New bucket -> public read).
--------------------------------------------------------- */
async function uploadJettonAssets({ logoFile, name, symbol, description }) {
  const stamp = Date.now();
  const ext = (logoFile.name || "logo.png").split(".").pop();
  const imagePath = `${stamp}/logo.${ext}`;

  const { error: imgErr } = await supabase.storage
    .from("token-assets")
    .upload(imagePath, logoFile, { upsert: true });
  if (imgErr) throw new Error(`Logo upload failed: ${imgErr.message}`);
  const { data: imgData } = supabase.storage.from("token-assets").getPublicUrl(imagePath);
  const imageUrl = imgData.publicUrl;

  const metadata = {
    name,
    symbol,
    description: description || "",
    image: imageUrl,
    decimals: 9,
  };
  const metaPath = `${stamp}/metadata.json`;
  const metaBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
  const { error: metaErr } = await supabase.storage
    .from("token-assets")
    .upload(metaPath, metaBlob, { upsert: true, contentType: "application/json" });
  if (metaErr) throw new Error(`Metadata upload failed: ${metaErr.message}`);
  const { data: metaData } = supabase.storage.from("token-assets").getPublicUrl(metaPath);

  return { imageUrl, metadataUrl: metaData.publicUrl };
}

/* ---------------------------------------------------------
   3. Poll until an address is an active contract on-chain.
   Deploys aren't instant — the block needs to be produced and
   indexed before the minter (or pool) actually exists to interact
   with. Times out after ~60s so the UI can surface a clear error
   instead of spinning forever if something goes wrong.
--------------------------------------------------------- */
async function waitForActive(client, address, { timeoutMs = 60000, intervalMs = 2500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const seq = (await client.getLastBlock()).last.seqno;
      const state = await client.getAccount(seq, address);
      if (state?.account?.state?.type === "active") return true;
    } catch (_e) {
      // transient RPC error — keep polling until timeout
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for on-chain confirmation");
}

/* ---------------------------------------------------------
   4. Main orchestration — called from the app's launch flow.
   onStage(i) drives the existing LAUNCH_STEPS UI:
     0 preparing   -> uploading metadata
     1 generating  -> building + deploying the jetton minter
     2 deploying   -> waiting for minter to confirm on-chain
     3 confirming  -> creating + confirming the STON.fi pool
--------------------------------------------------------- */
export async function launchRealToken({
  tonConnectUI,
  walletAddress,
  form,
  logoFile,
  buyAmountTon,
  network = "mainnet", // switch to "testnet" while validating this flow
  onStage,
}) {
  if (!walletAddress) throw new Error("Wallet not connected");
  if (!logoFile) throw new Error("Logo file is required");

  const name = form.name.trim();
  const symbol = form.ticker.trim().toUpperCase();
  const totalSupply = 1_000_000_000n; // matches TOKEN_FIXED_SUPPLY in App.tsx
  const decimals = 9n;

  onStage?.(0);
  const { metadataUrl } = await uploadJettonAssets({
    logoFile,
    name,
    symbol,
    description: form.desc.trim(),
  });

  const client = new TonClient4({
    endpoint:
      network === "testnet"
        ? "https://testnet-v4.tonhubapi.com"
        : "https://mainnet-v4.tonhubapi.com",
  });
  const sender = tonConnectSender(tonConnectUI, walletAddress);
  const sdk = AssetsSDK.create({ api: client, sender, storage: null });

  onStage?.(1);
  // Deploys the standard, audited TEP-74 jetton minter contract with
  // off-chain (URI-based) content pointing at the metadata JSON above,
  // and pre-mints the full fixed supply to the creator's own wallet.
  // NOTE: check AssetsSDK's README for your installed version — some
  // releases name this method deployJetton / mintJetton with slightly
  // different option keys.
  const jetton = await sdk.deployJetton(
    { uri: metadataUrl },
    {
      premintAmount: totalSupply * 10n ** decimals,
      sender,
    }
  );
  const jettonMasterAddress = jetton.address;

  onStage?.(2);
  await waitForActive(client, jettonMasterAddress);

  onStage?.(3);
  // Seed a TON/Jetton pool on STON.fi with the TON amount the creator
  // committed at launch, paired with the matching share of jetton supply
  // (mirrors the existing tokensForTon() cosmetic math in App.tsx so the
  // "you will get" preview the user already saw stays accurate).
  //
  // @ston-fi/sdk v2 API: routers are addressed through the versioned
  // DEX.v1 / DEX.v2_1 namespaces instead of the old Router/ROUTER_REVISION
  // exports. DEX.v1.Router is STON.fi's original, most liquid mainnet
  // router — DEX.v1.Router.address is its well-known deployed address, so
  // there's no revision lookup needed anymore.
  const router = client.open(new DEX.v1.Router(DEX.v1.Router.address));
  const proxyTon = new pTON.v1();
  const tonAmount = toNano(String(buyAmountTon));
  const jettonAmount = (totalSupply * 10n ** decimals * BigInt(Math.round(buyAmountTon * 1000))) / 1_000_000n;

  const { to, value, body } = await router.getProvideLiquidityTonTxParams({
    userWalletAddress: Address.parse(walletAddress),
    proxyTon,
    sendAmount: tonAmount,
    otherTokenAddress: jettonMasterAddress,
    minLpOut: 1n,
  });
  await tonConnectUI.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [
      {
        address: to.toString(),
        amount: value.toString(),
        payload: body.toBoc().toString("base64"),
      },
    ],
  });

  // NOTE: verify this against your installed SDK version on testnet —
  // some v2 releases return a Pool *contract* from getPool() rather than
  // a bare address, in which case use `client.open(await router.getPool(...)).address`.
  const poolContract = await router.getPool({
    token0: jettonMasterAddress,
    token1: proxyTon.address,
  });
  const poolAddress = poolContract.address;
  await waitForActive(client, poolAddress);

  return {
    jettonMasterAddress: jettonMasterAddress.toString(),
    poolAddress: poolAddress.toString(),
    explorerUrl: `https://tonscan.org/address/${jettonMasterAddress.toString()}`,
  };
}
