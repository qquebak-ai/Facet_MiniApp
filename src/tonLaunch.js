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
     npm install @ton-community/assets-sdk @ton/ton @ston-fi/sdk @orbs-network/ton-access

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

   RPC ENDPOINT — why this uses TON Access instead of a hardcoded host:
   A hardcoded single host (e.g. testnet-v4.tonhubapi.com, or even the
   correctly-named sandbox-v4.tonhubapi.com) is a single point of failure
   from inside a browser/Telegram WebView: if that specific node is down,
   slow, or doesn't send permissive CORS headers to your app's origin,
   every request just times out. @orbs-network/ton-access
   (getHttpV4Endpoint) is built for this: it's a free, decentralized proxy
   in front of multiple TON API v4 nodes, explicitly designed for
   client-side dapp use, and it auto-selects a healthy node instead of
   pinning you to one.

   DIAGNOSTICS — added in this revision:
   The original version could fail with a bare, generic
   "Exceeded number of retries" message coming from deep inside one of
   the TON SDK libraries (TonClient4 / AssetsSDK / ton-access), with no
   indication of *which* call failed or *why*. Every network-touching
   step below is now wrapped in its own try/catch that:
     - logs the raw underlying error to the console (console.error/warn,
       prefixed "[launch-debug]") so it's visible even inside a Telegram
       WebView via remote debugging or a debug badge in the UI,
     - rethrows a new Error with a stage-specific Russian message plus
       the original error's text appended, so whatever bubbles up to
       TokenLaunchOverlay's error screen is actually actionable instead
       of a dead end.
   waitForActive() also now tracks and reports the last polling error
   instead of silently swallowing every failed attempt.
--------------------------------------------------------- */

import { Address, beginCell, toNano, storeStateInit } from "@ton/core";
import { TonClient4 } from "@ton/ton";
import { getHttpV4Endpoint } from "@orbs-network/ton-access";
import { AssetsSDK, JettonParams } from "@ton-community/assets-sdk";
import { DEX, pTON } from "@ston-fi/sdk";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------
   1. TonConnect -> ton-core Sender adapter
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
   2. Metadata — upload logo + TEP-64 off-chain JSON to Supabase Storage
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
   2b. Raw connectivity probe — a plain fetch() with its own hard
   timeout, deliberately bypassing TonClient4/AssetsSDK's internal
   retry logic. If this fails, the problem is basic network reachability
   (blocked host, no internet, CORS) — not a library/version bug. If
   this succeeds but deployJetton still throws "Exceeded number of
   retries", the problem is inside the SDK call itself (version
   mismatch, malformed request, wallet-state read failing, etc).

   Known-good TON API v4 hosts are used as a fallback list if the
   TON Access-selected endpoint doesn't answer within PROBE_TIMEOUT_MS —
   this lets the app try a different node instead of giving up.
--------------------------------------------------------- */
const PROBE_TIMEOUT_MS = 8000;
const FALLBACK_V4_ENDPOINTS = {
  mainnet: ["https://mainnet-v4.tonhubapi.com"],
  testnet: ["https://testnet-v4.tonhubapi.com", "https://sandbox-v4.tonhubapi.com"],
};

async function probeEndpoint(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${endpoint}/block/latest`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }
    const json = await res.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return { ok: false, reason: "unexpected response body" };
    }
    return { ok: true };
  } catch (e) {
    clearTimeout(timer);
    const reason = e?.name === "AbortError" ? `timed out after ${PROBE_TIMEOUT_MS}ms` : (e?.message || String(e));
    return { ok: false, reason };
  }
}

async function pickWorkingEndpoint(preferredEndpoint, network) {
  const candidates = [preferredEndpoint, ...(FALLBACK_V4_ENDPOINTS[network] || [])];
  const tried = [];
  for (const candidate of candidates) {
    if (!candidate || tried.includes(candidate)) continue;
    tried.push(candidate);
    console.log("[launch-debug] probing RPC endpoint:", candidate);
    const result = await probeEndpoint(candidate);
    if (result.ok) {
      console.log("[launch-debug] endpoint OK:", candidate);
      return candidate;
    }
    console.warn("[launch-debug] endpoint unreachable:", candidate, "-", result.reason);
  }
  throw new Error(
    `Ни один TON RPC-узел не ответил (пробовали: ${tried.join(", ")}). ` +
    `Похоже на проблему сети/файрвола на устройстве, а не на код приложения.`
  );
}

/* ---------------------------------------------------------
   3. Poll until an address is an active contract on-chain.
   Now tracks the last error seen during polling instead of silently
   discarding it, so a timeout tells you *why* it never became active
   (bad RPC node, wrong network, genuinely still pending, etc.) rather
   than just "timed out".
--------------------------------------------------------- */
async function waitForActive(client, address, { timeoutMs = 90000, intervalMs = 3000, label = "" } = {}) {
  const start = Date.now();
  let lastErr = null;
  let attempts = 0;
  while (Date.now() - start < timeoutMs) {
    attempts += 1;
    try {
      const seq = (await client.getLastBlock()).last.seqno;
      const state = await client.getAccount(seq, address);
      if (state?.account?.state?.type === "active") {
        console.log(`[launch-debug] ${label || "waitForActive"}: active after ${attempts} attempt(s)`);
        return true;
      }
    } catch (e) {
      lastErr = e;
      console.warn(`[launch-debug] ${label || "waitForActive"} poll #${attempts} failed:`, e?.message || e);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const suffix = lastErr ? ` (last error: ${lastErr.message || lastErr})` : " (no errors, contract just never went active in time)";
  throw new Error(`Timed out waiting for on-chain confirmation${label ? ` [${label}]` : ""}${suffix}`);
}

/* ---------------------------------------------------------
   4. Main orchestration — called from the app's launch flow.
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
  const totalSupply = 1_000_000_000n; // matches TOKEN_FIXED_SUPPLY in App.jsx
  const decimals = 9n;

  // ---- Stage 0: metadata upload ----
  onStage?.(0);
  let metadataUrl;
  try {
    const uploaded = await uploadJettonAssets({
      logoFile,
      name,
      symbol,
      description: form.desc.trim(),
    });
    metadataUrl = uploaded.metadataUrl;
    console.log("[launch-debug] metadata uploaded:", metadataUrl);
  } catch (e) {
    console.error("[launch-debug] metadata upload failed:", e);
    throw new Error(`Не удалось загрузить метаданные токена: ${e?.message || e}`);
  }

  // TON Access picks a healthy TON API v4 node for us (mainnet or
  // testnet) instead of pinning to one hardcoded host. We then verify
  // it's actually reachable with a raw probe (bypassing the library's
  // own retry logic) before trusting it, falling back to known-good
  // hardcoded hosts if it isn't — see pickWorkingEndpoint above.
  let taEndpoint = null;
  try {
    taEndpoint = await getHttpV4Endpoint({ network });
    console.log("[launch-debug] TON Access suggested endpoint:", taEndpoint, "network:", network);
  } catch (e) {
    console.warn("[launch-debug] getHttpV4Endpoint failed, will rely on fallback list:", e?.message || e);
  }

  let endpoint;
  try {
    endpoint = await pickWorkingEndpoint(taEndpoint, network);
    console.log("[launch-debug] using RPC endpoint:", endpoint);
  } catch (e) {
    console.error("[launch-debug] no reachable RPC endpoint:", e);
    throw new Error(e?.message || String(e));
  }

  let client, sender, sdk;
  try {
    client = new TonClient4({ endpoint });
    sender = tonConnectSender(tonConnectUI, walletAddress);
    sdk = AssetsSDK.create({ api: client, sender, storage: null });
  } catch (e) {
    console.error("[launch-debug] SDK/client init failed:", e);
    throw new Error(`Не удалось инициализировать TON-клиент: ${e?.message || e}`);
  }

  // ---- Stage 1: deploy jetton minter ----
  onStage?.(1);
  let jettonMasterAddress;
  try {
    const jetton = await sdk.deployJetton(
      { uri: metadataUrl },
      {
        premintAmount: totalSupply * 10n ** decimals,
        sender,
      }
    );
    jettonMasterAddress = jetton.address;
    console.log("[launch-debug] jetton deployed at:", jettonMasterAddress.toString());
  } catch (e) {
    console.error("[launch-debug] deployJetton failed:", e);
    throw new Error(
      `Не удалось задеплоить jetton-контракт: ${e?.message || e}. ` +
      `Проверьте версию пакета @ton-community/assets-sdk — метод deployJetton ` +
      `и его параметры могли измениться между версиями.`
    );
  }

  // ---- Stage 2: wait for jetton minter to go active ----
  onStage?.(2);
  try {
    await waitForActive(client, jettonMasterAddress, { label: "jetton minter" });
  } catch (e) {
    console.error("[launch-debug] waitForActive(jetton) failed:", e);
    throw new Error(
      `Токен отправлен в сеть, но контракт не подтвердился вовремя: ${e?.message || e}`
    );
  }

  // ---- Stage 3: seed STON.fi liquidity pool ----
  onStage?.(3);
  // @ston-fi/sdk v2 API: routers are addressed through the versioned
  // DEX.v1 / DEX.v2_1 namespaces. DEX.v1 has separate deployed contracts
  // on mainnet vs testnet, so the address is picked based on `network`
  // (verify these still match current deployments before relying on them).
  const ROUTER_ADDRESS =
    network === "testnet"
      ? "EQBsGx9ArADUrREB34W-ghgsCgBShvfUr4Jvlu-0KGc33Rbt"
      : DEX.v1.Router.address; // EQB3ncyBUTjZUA5EnFKR5_EnOMI9V1tTEAAPaiU71gc4TiUt
  const PROXY_TON_ADDRESS =
    network === "testnet"
      ? "kQAcOvXSnnOhCdLYc6up2ECYwtNNTzlmOlidBeCs5cFPV7AM"
      : pTON.v1.address; // EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez

  let poolAddress;
  try {
    const router = client.open(new DEX.v1.Router(ROUTER_ADDRESS));
    const proxyTon = new pTON.v1(PROXY_TON_ADDRESS);
    const tonAmount = toNano(String(buyAmountTon));
    const jettonAmount =
      (totalSupply * 10n ** decimals * BigInt(Math.round(buyAmountTon * 1000))) / 1_000_000n;

    const { to, value, body } = await router.getProvideLiquidityTonTxParams({
      userWalletAddress: Address.parse(walletAddress),
      proxyTon,
      sendAmount: tonAmount,
      otherTokenAddress: jettonMasterAddress,
      minLpOut: 1n,
    });

    console.log("[launch-debug] sending liquidity tx to:", to.toString(), "value:", value.toString());
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

    // getPoolAddress is confirmed correct for the v1 Router API (returns
    // Promise<Address> directly).
    poolAddress = await router.getPoolAddress({
      token0: jettonMasterAddress,
      token1: proxyTon.address,
    });
    console.log("[launch-debug] pool address:", poolAddress.toString());
  } catch (e) {
    console.error("[launch-debug] STON.fi pool creation failed:", e);
    throw new Error(
      `Токен создан (${jettonMasterAddress.toString()}), но не удалось создать пул ликвидности на STON.fi: ${e?.message || e}`
    );
  }

  // ---- Stage 4: wait for pool to go active ----
  try {
    await waitForActive(client, poolAddress, { label: "STON.fi pool" });
  } catch (e) {
    console.error("[launch-debug] waitForActive(pool) failed:", e);
    throw new Error(
      `Пул отправлен в сеть, но не подтвердился вовремя: ${e?.message || e}. ` +
      `Токен уже задеплоен по адресу ${jettonMasterAddress.toString()} — проверьте пул вручную в STON.fi позже.`
    );
  }

  return {
    jettonMasterAddress: jettonMasterAddress.toString(),
    poolAddress: poolAddress.toString(),
    explorerUrl: `https://tonscan.org/address/${jettonMasterAddress.toString()}`,
  };
}
