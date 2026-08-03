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

   REVISION 2 — ton-access's own node-manager is itself unreachable here:
   Testing surfaced that BOTH getHttpV4Endpoint() and AssetsSDK's own
   createApi() fail identically — a SyntaxError parsing the response from
   ton.access.orbs.network/mngr/nodes, meaning that call never gets back
   valid JSON at all (blocked host, WAF/interstitial page, etc. from
   inside this environment). Every path that depends on ton-access's node
   manager is therefore unusable here, not just intermittently slow — so
   this revision stops depending on it as anything but a best-effort first
   try, and always falls back to a manually-built TonClient4 pointed at a
   known-good hardcoded v4 host (same list probeEndpoint already uses).
   AssetsSDK is now ALSO always constructed from that same manual
   TonClient4 (never from createApi()), since createApi() was observed to
   fail via the exact same broken call and was only ever adding a slow,
   guaranteed-to-fail network round trip before falling back anyway.

   REVISION 4 — deployJetton() no longer used as a combined send+wait call:
   The diagnostic trail showed getAccountLite succeeding, then all 3
   deployJetton retries failing identically with the exact same
   "Exceeded number of retries" — with NO "requesting wallet approval"
   log line ever appearing in between. deployJetton() is a convenience
   wrapper that (a) sends the deploy message via `sender`, then (b)
   internally polls the raw `client` it was built with to confirm the
   contract went active — a SEPARATE poll from this file's own
   waitForActive(), using the same fallback RPC host that Revision 3
   already proved can serve a stuck/stale block height. That internal
   poll is what was throwing, independent of whether the deploy message
   ever reached the wallet.

   Fix: the jetton minter's address is deterministic (computed from its
   code + init data, known before any transaction lands), so it's
   obtained via sdk.openJetton() without deploying anything. The actual
   deploy message is then sent explicitly via jetton.sendDeploy(sender,
   ...), and confirmation relies solely on this file's own waitForActive
   (which already goes through tonapi.io, not the flaky raw client).
   AssetsSDK's own internal wait-for-deploy is never invoked, so it can
   no longer be the thing exhausting retries.

   DEPLOY RETRY — why the deploy send is still wrapped in its own retry
   loop: even with a confirmed-reachable RPC endpoint, a single send
   attempt can still hit a transient wallet/network hiccup, so the send
   itself gets a few retries with backoff before surfacing an error.

   DIAGNOSTICS:
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
import { AssetsSDK, JettonParams, createApi } from "@ton-community/assets-sdk";
import { DEX, pTON } from "@ston-fi/sdk";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------
   1. TonConnect -> ton-core Sender adapter
--------------------------------------------------------- */
function tonConnectSender(tonConnectUI, walletAddress, log = console.log, warn = console.warn) {
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
      // Deploy failures have twice now shown identical results on every
      // retry, which means the actual problem isn't visible from outside
      // deployJetton — we can't tell from the "Exceeded number of retries"
      // message alone whether the wallet was ever even asked to sign, or
      // whether it signed and this is purely a confirmation-polling issue.
      // Logging around the one call that actually leaves this app (the
      // TonConnect approval request) answers that directly the next time
      // this happens, since it's included in the error screen's trail.
      log(`sender.send: requesting wallet approval — to ${message.address}, amount ${message.amount}${message.stateInit ? ", with stateInit" : ""}`);
      try {
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages: [message],
        });
        log("sender.send: wallet approved, transaction submitted");
      } catch (e) {
        warn(`sender.send: wallet did not approve / send failed: ${describeError(e)}`);
        throw e;
      }
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

  // WebKit inside Telegram's in-app WKWebView has a known bug where
  // fetch() silently fails with the bare message "Load failed" when the
  // request body is a streamed File/Blob — the body never actually gets
  // sent, so the request never reaches the server at all (no useful
  // status code, no CORS error, nothing — exactly the symptom seen here).
  // Reading the file into a plain ArrayBuffer first sends it as a normal
  // binary body instead, sidestepping that streaming path entirely.
  const imageBuffer = await logoFile.arrayBuffer();
  const imageContentType = logoFile.type || "image/png";

  const { error: imgErr } = await supabase.storage
    .from("token-assets")
    .upload(imagePath, imageBuffer, { upsert: true, contentType: imageContentType });
  if (imgErr) {
    // Surface everything Supabase actually gave back (status/statusText
    // included, when present) instead of just imgErr.message, so a
    // missing bucket / RLS-policy rejection reads as an actual reason
    // instead of collapsing into the same "Load failed" wall of text.
    const status = imgErr.statusCode || imgErr.status;
    const detail = [imgErr.message, status ? `(HTTP ${status})` : null].filter(Boolean).join(" ");
    throw new Error(`Logo upload failed: ${detail}`);
  }
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
  // Same fix applied here: encode to raw bytes rather than passing a Blob.
  const metaBuffer = new TextEncoder().encode(JSON.stringify(metadata));
  const { error: metaErr } = await supabase.storage
    .from("token-assets")
    .upload(metaPath, metaBuffer, { upsert: true, contentType: "application/json" });
  if (metaErr) {
    const status = metaErr.statusCode || metaErr.status;
    const detail = [metaErr.message, status ? `(HTTP ${status})` : null].filter(Boolean).join(" ");
    throw new Error(`Metadata upload failed: ${detail}`);
  }
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

async function pickWorkingEndpoint(preferredEndpoint, network, log = console.log, warn = console.warn) {
  const candidates = [preferredEndpoint, ...(FALLBACK_V4_ENDPOINTS[network] || [])];
  const tried = [];
  for (const candidate of candidates) {
    if (!candidate || tried.includes(candidate)) continue;
    tried.push(candidate);
    log(`probing RPC endpoint: ${candidate}`);
    const result = await probeEndpoint(candidate);
    if (result.ok) {
      log(`endpoint OK: ${candidate}`);
      return candidate;
    }
    warn(`endpoint unreachable: ${candidate} - ${result.reason}`);
  }
  throw new Error(
    `Ни один TON RPC-узел не ответил (пробовали: ${tried.join(", ")}). ` +
    `Похоже на проблему сети/файрвола на устройстве, а не на код приложения.`
  );
}

/* ---------------------------------------------------------
   3. Poll until an address is an active contract on-chain.

   REVISION 3 — why this no longer polls through TonClient4 at all:
   The retry wrapper around deployJetton (added in revision 2) made
   zero difference — all 3 attempts failed with the exact same
   "Exceeded number of retries" instantly, one after another. That
   rules out a transient node hiccup: a real flake would vary between
   attempts. Identical, deterministic failure on every single try means
   whatever this was polling against was never going to change — most
   likely the community-run fallback host (testnet-v4.tonhubapi.com)
   was serving a stuck/stale block height, so every "did it go active
   yet" check was really asking about the same frozen block over and
   over, long after the deploy had actually gone through.

   Fix: stop asking that RPC host at all for this specific check. This
   app already depends on tonapi.io successfully elsewhere (the wallet
   balance fetch in App.jsx uses testnet.tonapi.io/tonapi.io directly
   and works) — so contract-active polling now goes through tonapi.io's
   own REST endpoint instead, which reports account status directly
   without needing a live block seqno from the same node being polled.
   Now tracks the last error seen during polling instead of silently
   discarding it, so a timeout tells you *why* it never became active
   (bad RPC node, wrong network, genuinely still pending, etc.) rather
   than just "timed out".
--------------------------------------------------------- */
async function fetchAccountStatusViaTonapi(address, network) {
  const host = network === "testnet" ? "testnet.tonapi.io" : "tonapi.io";
  const res = await fetch(`https://${host}/v2/blockchain/accounts/${address.toString()}`);
  if (!res.ok) throw new Error(`tonapi.io ${res.status}`);
  const body = await res.json().catch(() => null);
  return body && typeof body.status === "string" ? body.status : null;
}

/* describeError — up to now every catch block only ever logged
   `e?.message`. When a library throws a short, generic string like
   "Exceeded number of retries" that message alone tells us nothing
   about what's actually underneath it — three separate diagnostic
   passes chased that string in three different directions with no way
   to tell which guess was right. This pulls every signal an Error
   object might carry (message, a slice of the stack so we know which
   file/line actually threw, `.cause` if the library wrapped a deeper
   error, and any other enumerable own properties some SDKs attach
   like `.code`/`.response`) so the NEXT failure is diagnosable from
   the trail alone instead of requiring another guess. */
function describeError(e) {
  if (!e) return String(e);
  const parts = [e.message || String(e)];
  if (e.cause) parts.push(`cause: ${describeError(e.cause)}`);
  try {
    const extra = Object.getOwnPropertyNames(e)
      .filter((k) => !["message", "stack", "cause"].includes(k))
      .map((k) => { try { return `${k}=${JSON.stringify(e[k])}`; } catch { return `${k}=<unserializable>`; } });
    if (extra.length) parts.push(`extra: ${extra.join(", ")}`);
  } catch { /* ignore */ }
  if (e.stack) {
    const firstLines = e.stack.split("\n").slice(0, 3).join(" | ");
    parts.push(`at: ${firstLines}`);
  }
  return parts.join(" — ");
}

async function waitForActive(address, network, { timeoutMs = 90000, intervalMs = 3000, label = "", log = console.log, warn = console.warn } = {}) {
  const start = Date.now();
  let lastErr = null;
  let attempts = 0;
  while (Date.now() - start < timeoutMs) {
    attempts += 1;
    try {
      const status = await fetchAccountStatusViaTonapi(address, network);
      if (status === "active") {
        log(`${label || "waitForActive"}: active after ${attempts} attempt(s)`);
        return true;
      }
    } catch (e) {
      lastErr = e;
      warn(`${label || "waitForActive"} poll #${attempts} failed: ${describeError(e)}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const suffix = lastErr ? ` (last error: ${lastErr.message || lastErr})` : " (no errors, contract just never went active in time)";
  throw new Error(`Timed out waiting for on-chain confirmation${label ? ` [${label}]` : ""}${suffix}`);
}

/* Retries an arbitrary async step a few times with a short, increasing
   delay before giving up. */
/* Wraps a TonClient4 instance so every RPC method call it makes is logged
   (call + success/failure) before deployJetton ever gets to use it. This
   was added after the trail showed deployJetton failing WITHOUT ever
   reaching sender.send (no "requesting wallet approval" line at all) —
   meaning the retries being exhausted are on some internal read call
   happening before the deploy message is even built/sent, not on wallet
   confirmation or post-deploy polling. Only known async RPC methods are
   wrapped (not e.g. .open(), which must return synchronously) — anything
   else is passed through bound to the real client so behavior/`this`
   stay correct. */
function instrumentApi(client, log, warn, network) {
  const ASYNC_METHODS = [
    "getLastBlock", "getAccount", "getAccountLite", "getAccountTransactions",
    "getConfig", "runMethod", "sendMessage", "isContractDeployed",
  ];
  return new Proxy(client, {
    get(target, prop, receiver) {
      // isContractDeployed is almost certainly the exact call deployJetton's
      // internal "wait until active" polling uses (this is the standard
      // provider method for that check across TON SDKs). Revision 3 already
      // proved the raw/fallback RPC host can serve a stuck, stale block
      // height for this kind of check — and the trail shows deployJetton
      // failing with "Exceeded number of retries" right after a successful
      // getAccountLite, which matches that exact failure mode. Routing this
      // one specific check through tonapi.io (same reliable source our own
      // waitForActive already uses) fixes deployJetton's internal wait
      // without needing to reverse-engineer or reimplement its send logic.
      if (prop === "isContractDeployed") {
        return async function (address) {
          log("client.isContractDeployed() called (routed via tonapi.io)");
          try {
            const status = await fetchAccountStatusViaTonapi(address, network);
            const deployed = status === "active";
            log(`client.isContractDeployed() OK -> ${deployed} (status: ${status})`);
            return deployed;
          } catch (e) {
            warn(`client.isContractDeployed() via tonapi.io failed: ${describeError(e)}`);
            throw e;
          }
        };
      }
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== "function") return orig;
      if (!ASYNC_METHODS.includes(prop)) return orig.bind(target);
      return async function (...args) {
        log(`client.${String(prop)}() called`);
        try {
          const result = await orig.apply(target, args);
          log(`client.${String(prop)}() OK`);
          return result;
        } catch (e) {
          warn(`client.${String(prop)}() failed: ${describeError(e)}`);
          throw e;
        }
      };
    },
  });
}

async function withRetries(fn, { attempts = 3, delayMs = 2500, label = "", log = console.log, warn = console.warn } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      if (i > 1) log(`${label || "step"}: retry attempt ${i}/${attempts}`);
      return await fn();
    } catch (e) {
      lastErr = e;
      warn(`${label || "step"} attempt ${i}/${attempts} failed: ${describeError(e)}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
  throw lastErr;
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
  // Diagnostic trail shown directly in the error screen — since a
  // Telegram WebView on a phone has no devtools console, every
  // [launch-debug] line also gets pushed here so it reaches the user
  // even without remote debugging.
  const trail = [];
  function log(msg) {
    console.log("[launch-debug]", msg);
    trail.push(msg);
  }
  function warn(msg) {
    console.warn("[launch-debug]", msg);
    trail.push(`⚠ ${msg}`);
  }
  function fail(userMessage, e) {
    const detail = describeError(e);
    console.error("[launch-debug]", userMessage, e);
    trail.push(`✗ ${userMessage}: ${detail}`);
    const err = new Error(`${userMessage}: ${detail}\n\nЛог:\n${trail.join("\n")}`);
    throw err;
  }

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
    log(`metadata uploaded: ${metadataUrl}`);
  } catch (e) {
    fail("Не удалось загрузить метаданные токена", e);
  }

  // TON Access would normally pick a healthy TON API v4 node for us
  // instead of pinning to one hardcoded host. The officially documented
  // way to get this (see ton-community/assets-sdk's own examples) is
  // simply `createApi(network)` — that's what every example in the
  // SDK's docs actually uses. An earlier diagnostic pass found this
  // failing in this environment and worked around it with a manually
  // built TonClient4 pinned to a single community fallback host — but
  // that workaround is itself the likely reason deployJetton kept
  // failing: assets-sdk's internal calls may need endpoints/behavior
  // the fallback host doesn't fully support, even though our own
  // simpler probes (block/latest, getAccountLite) succeeded against it.
  // So: try the documented createApi() first, and only fall back to the
  // manual client if that genuinely throws.
  let client, sender, sdk;
  try {
    client = await createApi(network);
    log(`createApi(${network}) succeeded — using the SDK's own documented client`);
  } catch (e) {
    warn(`createApi(${network}) failed, falling back to a manually-built TonClient4: ${describeError(e)}`);
    let taEndpoint = null;
    try {
      taEndpoint = await getHttpV4Endpoint({ network });
      log(`TON Access suggested endpoint: ${taEndpoint} (network: ${network})`);
    } catch (e2) {
      warn(`getHttpV4Endpoint failed too, relying on hardcoded fallback list: ${describeError(e2)}`);
    }
    let endpoint;
    try {
      endpoint = await pickWorkingEndpoint(taEndpoint, network, log, warn);
      log(`using RPC endpoint: ${endpoint}`);
    } catch (e2) {
      fail("Не удалось найти рабочий TON RPC-узел ни через createApi(), ни через фоллбэк-список", e2);
    }
    try {
      client = new TonClient4({ endpoint });
      log("TonClient4 initialized (fallback path)");
    } catch (e2) {
      fail("Не удалось инициализировать TON-клиент", e2);
    }
  }

  try {
    sender = tonConnectSender(tonConnectUI, walletAddress, log, warn);
  } catch (e) {
    fail("Не удалось инициализировать sender", e);
  }

  // Instrumented (see instrumentApi above) so the next failure's trail
  // shows exactly which underlying RPC call was made — the raw client is
  // kept as `client` for our own direct calls (the getAccountLite probe
  // below, the STON.fi router later), only the copy handed to AssetsSDK
  // is wrapped.
  const sdkApi = instrumentApi(client, log, warn, network);
  try {
    sdk = AssetsSDK.create({ api: sdkApi, sender, storage: null });
    log("AssetsSDK initialized");
  } catch (e) {
    fail("Не удалось инициализировать AssetsSDK", e);
  }


  // Direct low-level probe: deployJetton likely needs to read the
  // sender wallet's on-chain account state internally (to size the
  // deploy message / check balance) via calls like getAccountLite.
  // Testing that exact call path here — separately from the generic
  // /block/latest probe above — tells us whether the failure is at
  // the basic TonClient4 method level (would fail here too) or purely
  // inside AssetsSDK's own deployJetton implementation (this succeeds,
  // deployJetton still fails).
  try {
    const seq = (await client.getLastBlock()).last.seqno;
    await client.getAccountLite(seq, Address.parse(walletAddress));
    log(`low-level getAccountLite check OK (block seqno ${seq})`);
  } catch (e) {
    warn(`low-level getAccountLite check failed: ${describeError(e)}`);
  }

  // ---- Stage 1: deploy jetton minter ----
  onStage?.(1);
  let jettonMasterAddress;
  try {
    // Matches the official SDK example
    // (ton-community/assets-sdk/examples/use-tonconnect.ts). deployJetton
    // sends the deploy message via `sender`, then internally polls to
    // confirm the contract went active — that internal poll (almost
    // certainly client.isContractDeployed()) is what was throwing
    // "Exceeded number of retries" against the flaky fallback RPC host.
    // It's now transparently routed through tonapi.io instead (see
    // instrumentApi's isContractDeployed override above), so this same
    // call should now succeed without needing to reimplement send/wait
    // separately.
    const jetton = await withRetries(
      () => sdk.deployJetton(
        { uri: metadataUrl },
        {
          adminAddress: Address.parse(walletAddress),
          premintAmount: totalSupply * 10n ** decimals,
        }
      ),
      { attempts: 3, delayMs: 3000, label: "deployJetton", log, warn }
    );
    jettonMasterAddress = jetton.address;
    log(`jetton deployed at: ${jettonMasterAddress.toString()}`);
  } catch (e) {
    fail(
      "Не удалось задеплоить jetton-контракт после нескольких попыток (проверьте версию @ton-community/assets-sdk — метод deployJetton мог измениться, либо RPC-узел временно перегружен)",
      e
    );
  }

  // ---- Stage 2: wait for jetton minter to go active ----
  onStage?.(2);
  try {
    await waitForActive(jettonMasterAddress, network, { label: "jetton minter", log, warn });
  } catch (e) {
    fail("Токен отправлен в сеть, но контракт не подтвердился вовремя", e);
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

    log(`sending liquidity tx to: ${to.toString()}, value: ${value.toString()}`);
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
    log(`pool address: ${poolAddress.toString()}`);
  } catch (e) {
    fail(
      `Токен создан (${jettonMasterAddress.toString()}), но не удалось создать пул ликвидности на STON.fi`,
      e
    );
  }

  // ---- Stage 4: wait for pool to go active ----
  try {
    await waitForActive(poolAddress, network, { label: "STON.fi pool", log, warn });
  } catch (e) {
    fail(
      `Пул отправлен в сеть, но не подтвердился вовремя. Токен уже задеплоен по адресу ${jettonMasterAddress.toString()} — проверьте пул вручную в STON.fi позже`,
      e
    );
  }

  return {
    jettonMasterAddress: jettonMasterAddress.toString(),
    poolAddress: poolAddress.toString(),
    explorerUrl: `https://tonscan.org/address/${jettonMasterAddress.toString()}`,
  };
}
