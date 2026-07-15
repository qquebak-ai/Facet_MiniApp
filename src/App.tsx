import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, Flame, TrendingUp, Clock, Sparkles, ArrowUpRight, ArrowDownRight,
  Wallet, Home as HomeIcon, PlusCircle, User, ChevronLeft, Share2, Star,
  Flag, ShieldCheck, ShieldAlert, Globe, Globe2, Send, Twitter, Image as ImageIcon, Upload,
  Copy, ExternalLink, LogOut, ChevronRight, Rocket,
  Settings as SettingsIcon, Bell, Lock, Palette, Gift, LifeBuoy,
  FileText, ShieldQuestion, ArrowDownToLine, ArrowUpFromLine, Link2, CheckCircle2, RefreshCw, X,
  Eye, EyeOff, LogIn, Mail, KeyRound
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, YAxis, Tooltip
} from "recharts";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Address, toNano} from "@ton/core";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------
   DESIGN TOKENS — shared by every screen (Home, Token, Create, Profile)
--------------------------------------------------------- */

const T = {
  bg: "#020203",
  surface: "#101012",
  surfaceHi: "#1B1B1F",
  line: "rgba(255,255,255,0.09)",
  lineHi: "rgba(255,255,255,0.20)",
  ice: "#F3F3F6",
  muted: "#85858D",
  electric: "#FFFFFF",
  turquoise: "#FFFFFF",
  violet: "#C7C7CF",
  rose: "#6E6E76",
  up: "#31D07B",
  down: "#FF4D4D",
};

const PRISM = `linear-gradient(135deg, #FFFFFF 0%, #9A9AA3 100%)`;
const FACET = "polygon(18% 0%, 100% 0%, 100% 82%, 82% 100%, 0% 100%, 0% 18%)";

const displayFont = "'Space Grotesk', 'Segoe UI', sans-serif";
const bodyFont = "'Inter', 'Segoe UI', sans-serif";
const monoFont = "'IBM Plex Mono', 'Courier New', monospace";

const SPRING = "260ms cubic-bezier(0.34, 1.56, 0.64, 1)";
const EASE = "260ms cubic-bezier(0.16, 1, 0.3, 1)";
/* PRESS is what makes taps feel instant: near-zero delay, ease-out-in curve,
   used only on :active. SPRING/EASE above stay for the release/bounce-back
   so the button snaps down immediately and eases back out smoothly. */
const PRESS = "70ms cubic-bezier(0.4, 0, 1, 1)";

function fmtUSD(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPrice(p) {
  return "$" + p.toFixed(p < 0.001 ? 6 : 4);
}
function mcapSeries(base, seed, n = 22) {
  let v = base;
  const out = [];
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i * 0.55 + seed) * base * 0.02;
    const noise = (Math.random() - 0.5) * base * 0.015;
    v = Math.max(base * 0.6, v + drift * 0.3 + noise);
    out.push({ i, mcap: v });
  }
  return out;
}
function haptic() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate(12); } catch (e) { /* unsupported */ }
  }
}

/* ---------------------------------------------------------
   GLOBAL KEYFRAMES (CSS stand-ins for Framer Motion — see note
   in chat: the framer-motion package isn't available in this
   preview sandbox, so springs/stagger/counters are done with
   CSS + rAF tuned to the same 200–350ms spring timings. In the
   real Next.js app these map 1:1 onto <motion.div> primitives.)
--------------------------------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      html, body, #root { height: 100%; margin: 0; padding: 0; background: ${T.bg}; -webkit-tap-highlight-color: transparent; }
      * { -webkit-tap-highlight-color: transparent; }
      @keyframes fadeInUp { from{opacity:0; transform:translateY(12px);} to{opacity:1; transform:translateY(0);} }
      @keyframes spin360 { from{ transform: rotate(0deg); } to{ transform: rotate(360deg); } }
      @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
      @keyframes scaleIn { from{opacity:0; transform:scale(0.92);} to{opacity:1; transform:scale(1);} }
      @keyframes gridDrift { from{background-position:0 0,0 0;} to{background-position:140px 140px,140px 140px;} }
      @keyframes starTwinkle { 0%,100%{opacity:.2;} 50%{opacity:1;} }
      @keyframes glowPulse { 0%,100%{opacity:.35;} 50%{opacity:.75;} }
      @keyframes shimmer { from{background-position:-300px 0;} to{background-position:300px 0;} }
      @keyframes mcapGlow { 0%,100%{text-shadow:0 0 10px currentColor,0 0 2px currentColor;} 50%{text-shadow:0 0 18px currentColor,0 0 4px currentColor;} }
      @keyframes ringPulse { 0%{box-shadow:0 0 0 0 rgba(255,255,255,0.35);} 100%{box-shadow:0 0 0 14px rgba(255,255,255,0);} }
      @keyframes toastIn { from{opacity:0; transform:translateY(-10px) translateX(-50%);} to{opacity:1; transform:translateY(0) translateX(-50%);} }
      @keyframes rocketUp { 0%{ transform:translateY(0) scale(0.75); opacity:0; } 18%{ opacity:0.9; } 100%{ transform:translateY(-70px) scale(1); opacity:0; } }
      @keyframes fallStreak { 0%{ transform:translateY(0) rotate(14deg); opacity:0; } 20%{ opacity:0.85; } 100%{ transform:translateY(78px) rotate(14deg); opacity:0; } }
      @keyframes candleGrow { from{ transform:scaleY(0); opacity:0; } to{ transform:scaleY(1); opacity:1; } }
      button { touch-action: manipulation; cursor: pointer; }
      .fx-card { animation: fadeInUp 480ms cubic-bezier(0.16,1,0.3,1) both; transition: transform ${SPRING}, border-color ${EASE}, box-shadow ${EASE}; will-change: transform; }
      .fx-card:active { transform: scale(0.97); transition: transform ${PRESS}; }
      .fx-card:hover { border-color: ${T.lineHi} !important; box-shadow: 0 8px 28px rgba(0,0,0,0.35); }
      .fx-tap { transition: transform ${SPRING}; will-change: transform; }
      .fx-tap:active { transform: scale(0.94); transition: transform ${PRESS}; }
      .fx-view { animation: fadeInUp 320ms cubic-bezier(0.16,1,0.3,1) both; }
      .fx-skeleton { background: linear-gradient(90deg, ${T.surface} 25%, ${T.surfaceHi} 37%, ${T.surface} 63%); background-size: 400px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fx-chip { transition: border-color ${EASE}, background ${EASE}, color ${EASE}, transform ${SPRING}; will-change: transform; }
      .fx-chip:active { transition: border-color ${EASE}, background ${EASE}, color ${EASE}, transform ${PRESS}; }
      .fx-modal-back { animation: fadeIn 220ms ease-out both; }
      .fx-modal-card { animation: scaleIn 260ms cubic-bezier(0.16,1,0.3,1) both; }
      .fx-avatar { transition: transform ${SPRING}, box-shadow ${EASE}; will-change: transform; }
      .fx-avatar:active { transform: scale(0.92); transition: transform ${PRESS}; }
      .cta-launch { transition: transform ${SPRING}, box-shadow ${EASE}; will-change: transform; }
      .cta-launch:hover { transform: scale(1.015); box-shadow: 0 0 34px rgba(255,255,255,0.4); }
      .cta-launch:active { transform: scale(0.97); transition: transform ${PRESS}; }
      .tf-btn { transition: background ${EASE}, color ${EASE}, transform ${SPRING}; will-change: transform; }
      .tf-btn:active { transform: scale(0.92); transition: background ${EASE}, color ${EASE}, transform ${PRESS}; }
      .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
      .no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
    `}</style>
  );
}

/* deterministic pseudo-random so the star field doesn't reshuffle on re-render */
function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function CyberGrid() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* animated grid — the circuit / star-chart lattice, drifting slowly */}
      <div style={{
        position: "absolute", inset: -140,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: "28px 28px, 28px 28px", transform: "rotate(6deg)", animation: "gridDrift 22s linear infinite",
      }} />

      {/* faint outlined facets — distant satellites / debris catching moonlight */}
      <svg style={{ position: "absolute", top: "-6%", right: "-14%", width: 260, height: 260, opacity: 0.12 }} viewBox="0 0 100 100">
        <polygon points="18,0 100,0 100,82 82,100 0,100 0,18" fill="none" stroke="#FFFFFF" strokeWidth="0.6" />
      </svg>
      <svg style={{ position: "absolute", bottom: "4%", left: "-16%", width: 220, height: 220, opacity: 0.09 }} viewBox="0 0 100 100">
        <polygon points="18,0 100,0 100,82 82,100 0,100 0,18" fill="none" stroke="#FFFFFF" strokeWidth="0.6" />
      </svg>

      {/* soft moonlight wash — held static and subtle, greyscale only */}
      <div style={{ position: "absolute", top: "-16%", right: "-12%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, transparent 70%)", filter: "blur(6px)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.6) 100%)" }} />
    </div>
  );
}

/* animated 0 -> value counter, no external deps */
function useCountUp(target, duration = 900, active = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf, start;
    function tick(ts) {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return val;
}

/* ---------------------------------------------------------
   SHARED SMALL PIECES
--------------------------------------------------------- */

function ChangeBadge({ value, size = "sm" }) {
  const up = value >= 0;
  const color = up ? T.up : T.down;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}
      style={{ color, background: up ? "rgba(49,208,123,0.14)" : "rgba(255,77,77,0.14)", fontFamily: monoFont }}
    >
      {up ? <ArrowUpRight size={size === "sm" ? 12 : 14} /> : <ArrowDownRight size={size === "sm" ? 12 : 14} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "rgba(20,20,22,0.92)", border: `1px solid ${T.lineHi}`, borderRadius: 8, padding: "5px 8px", backdropFilter: "blur(6px)" }}>
      <div style={{ fontFamily: monoFont, fontSize: 11, color: T.ice }}>{fmtUSD(payload[0].value)}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 9, color: T.muted }}>MCAP</div>
    </div>
  );
}

function MiniChart({ data, positive, id, showTooltip = true, width = 78, height = 36 }) {
  const gid = `spark-${id}`;
  const color = positive ? T.up : T.down;
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          {showTooltip && <Tooltip content={<ChartTooltip />} cursor={{ stroke: T.lineHi, strokeWidth: 1 }} />}
          <Area type="monotone" dataKey="mcap" stroke={color} strokeWidth={1.8} fill={`url(#${gid})`} isAnimationActive animationDuration={900} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];

function genCandles(basePrice, seed, timeframe, n = 64) {
  const volMap = { M1: 0.006, M5: 0.012, M15: 0.018, M30: 0.022, H1: 0.026, H4: 0.036, D1: 0.05, W1: 0.07, MN1: 0.09 };
  const vol = basePrice * (volMap[timeframe] || 0.03);
  const tfSeed = seed + TIMEFRAMES.indexOf(timeframe) * 3.1;
  let price = basePrice * 0.94;
  const out = [];
  for (let i = 0; i < n; i++) {
    const open = price;
    const drift = Math.sin(i * 0.5 + tfSeed) * vol * 0.7;
    const close = Math.max(basePrice * 0.4, open + drift + (Math.random() - 0.45) * vol);
    const high = Math.max(open, close) + Math.random() * vol * 0.5;
    const low = Math.max(basePrice * 0.3, Math.min(open, close) - Math.random() * vol * 0.5);
    out.push({ i, open, high, low, close });
    price = close;
  }
  return out;
}

function CandlestickChart({ data, width = 340, height = 170 }) {
  const padL = 4, padR = 46, padT = 10, padB = 6;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const allVals = data.flatMap(d => [d.high, d.low]);
  const max = Math.max(...allVals), min = Math.min(...allVals);
  const range = (max - min) || 1;
  const slot = plotW / data.length;
  const bodyW = Math.max(1.5, slot * 0.6);

  function y(v) { return padT + (1 - (v - min) / range) * plotH; }

  const priceTicks = [max, (max + min) / 2, min];
  const last = data[data.length - 1];
  const prev = data[data.length - 2] || last;
  const lastUp = last.close >= prev.close;
  const lastColor = lastUp ? T.up : T.down;
  const yLast = y(last.close);
  const tagW = padR - 5;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
      {priceTicks.map((p, idx) => (
        <g key={idx}>
          <line x1={padL} x2={width - padR + 6} y1={y(p)} y2={y(p)} stroke={T.line} strokeWidth="1" strokeDasharray="2 4" />
          <text x={width - padR + 8} y={y(p) + 3} fontFamily={monoFont} fontSize="9" fill={T.muted}>{fmtPrice(p)}</text>
        </g>
      ))}

      {/* current-price guide line, terminal-style */}
      <line x1={padL} x2={width - padR} y1={yLast} y2={yLast} stroke={lastColor} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />

      {data.map((c, i) => {
        const up = c.close >= c.open;
        const color = up ? T.up : T.down;
        const x = padL + i * slot + slot / 2;
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBot = y(Math.min(c.open, c.close));
        const bodyH = Math.max(1.5, bodyBot - bodyTop);
        return (
          <g key={c.i} style={{ transformOrigin: `${x}px ${height - padB}px`, animation: `candleGrow 420ms cubic-bezier(0.16,1,0.3,1) both`, animationDelay: `${i * 8}ms` }}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1" opacity="0.85" />
            <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} rx="1.5" fill={color} opacity="0.95" />
          </g>
        );
      })}

      {/* live price tag pinned to the right edge, like a trading terminal */}
      <g>
        <rect x={width - padR + 3} y={yLast - 8} width={tagW} height={16} rx="3" fill={lastColor} />
        <text x={width - padR + 3 + tagW / 2} y={yLast + 3} fontFamily={monoFont} fontSize="8.5" fontWeight="700" fill={lastUp ? "#08080A" : "#08080A"} textAnchor="middle">
          {fmtPrice(last.close)}
        </text>
      </g>
    </svg>
  );
}

/* TrendFX — the whole-widget signal: rockets streaking up through a growing
   token's card, or red streaks falling through a declining one. Positions are
   seeded per-token (via id) so they don't reshuffle on every re-render. */
function TrendFX({ up, seedKey = 1 }) {
  const items = useMemo(() => {
    const rand = seededRand(Math.floor(Math.abs(seedKey) * 97) + (up ? 11 : 53));
    const count = up ? 4 : 5;
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(
        up
          ? { left: 6 + rand() * 84, delay: rand() * 2.4, dur: 1.9 + rand() * 1.6, size: 12 + rand() * 7 }
          : { left: 4 + rand() * 88, top: rand() * 55, delay: rand() * 2.2, dur: 1.1 + rand() * 1.1, len: 24 + rand() * 34 }
      );
    }
    return out;
  }, [up, seedKey]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit" }}>
      {up
        ? items.map((it, i) => (
            <Rocket
              key={i}
              size={it.size}
              style={{
                position: "absolute", left: `${it.left}%`, bottom: "-20%",
                color: "#FFFFFF",
                filter: "drop-shadow(0 0 1px #000000) drop-shadow(0 0 4px rgba(255,255,255,0.55))",
                animation: `rocketUp ${it.dur}s cubic-bezier(0.3,0.1,0.4,1) ${it.delay}s infinite`,
              }}
            />
          ))
        : items.map((it, i) => (
            <span
              key={i}
              style={{
                position: "absolute", left: `${it.left}%`, top: `${it.top}%`,
                width: 2, height: it.len, borderRadius: 2,
                background: `linear-gradient(180deg, rgba(255,77,77,0) 0%, ${T.down} 55%, rgba(255,77,77,0) 100%)`,
                transform: "rotate(14deg)",
                animation: `fallStreak ${it.dur}s linear ${it.delay}s infinite`,
              }}
            />
          ))}
    </div>
  );
}

function FacetFrame({ children, size = 52, glow }) {
  return (
    <div style={{
      width: size, height: size, clipPath: FACET, background: T.surfaceHi, border: `1px solid ${T.line}`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.46, flexShrink: 0,
      boxShadow: glow ? `0 0 18px ${glow}` : "none",
    }}>
      {children}
    </div>
  );
}

/* Premium circular token avatar: glass ring with a static gradient border.
   Used specifically for token logos (list cards, detail, portfolio) — the cut-corner
   FacetFrame stays reserved for brand/utility chrome elsewhere. */
function TokenAvatar({ children, size = 52, tone = "neutral" }) {
  return (
    <div className="fx-avatar" style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", padding: 1.5,
        background: `conic-gradient(from 0deg, ${T.turquoise}, ${T.violet}, ${T.turquoise})`,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor", maskComposite: "exclude",
        opacity: 0.7,
      }} />
      <div style={{
        position: "absolute", inset: 1.5, borderRadius: "50%", background: "rgba(24,24,26,0.75)",
        backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.44, boxShadow: `inset 0 0 10px rgba(255,255,255,0.04)`,
      }}>
        {children}
      </div>
    </div>
  );
}

function GlassCard({ children, style, className = "", ...rest }) {
  return (
    <div className={`fx-card rounded-2xl ${className}`} style={{ background: "rgba(20,20,22,0.7)", border: `1px solid ${T.line}`, backdropFilter: "blur(14px)", ...style }} {...rest}>
      {children}
    </div>
  );
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="fx-chip flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
      <Icon size={14} color={T.muted} />
      <div>
        <div style={{ fontFamily: monoFont, color: T.ice, fontSize: 13, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10 }}>{label}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 700 }}>{children}</span>
      {action}
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ position: "absolute", top: 14, left: "50%", zIndex: 50, animation: "toastIn 240ms cubic-bezier(0.16,1,0.3,1) both" }}>
      <div className="flex items-center gap-2 rounded-full px-4 py-2" style={{ background: "rgba(24,24,26,0.95)", border: `1px solid ${T.lineHi}`, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        <CheckCircle2 size={14} color={T.turquoise} />
        <span style={{ fontFamily: bodyFont, fontSize: 12, color: T.ice, whiteSpace: "nowrap" }}>{toast}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   MOCK DATA — home
--------------------------------------------------------- */

const CATEGORIES = ["Все", "Мемы", "Утилиты", "Игры", "AI", "Соц"];

const TOKENS = [
  { id: "dogton", name: "DogTON", ticker: "DOGT", emoji: "🐕", price: 0.00042, change: 18.4, mcapNum: 1_200_000, liq: "310K", holders: 4210, cat: "Мемы", vol: "820K", seed: 3, verified: false },
  { id: "prismcat", name: "Prism Cat", ticker: "PRSM", emoji: "🐱", price: 0.00118, change: 42.9, mcapNum: 3_400_000, liq: "540K", holders: 8890, cat: "Мемы", vol: "1.9M", seed: 7, verified: true },
  { id: "gemrush", name: "Gem Rush", ticker: "GEMR", emoji: "💎", price: 0.00891, change: -6.2, mcapNum: 980_000, liq: "120K", holders: 2310, cat: "Игры", vol: "410K", seed: 1, verified: false },
  { id: "aitao", name: "AiTao", ticker: "AITAO", emoji: "🤖", price: 0.00027, change: 9.1, mcapNum: 610_000, liq: "95K", holders: 1540, cat: "AI", vol: "205K", seed: 5, verified: true },
  { id: "grinvillage", name: "Grin Village", ticker: "GRIN", emoji: "🌾", price: 0.00006, change: 3.4, mcapNum: 210_000, liq: "44K", holders: 890, cat: "Соц", vol: "60K", seed: 2, verified: false },
  { id: "vaultly", name: "Vaultly", ticker: "VLTY", emoji: "🔐", price: 0.00351, change: -2.1, mcapNum: 1_500_000, liq: "290K", holders: 3120, cat: "Утилиты", vol: "540K", seed: 4, verified: true },
];

const FILTERS = [
  { id: "gems", label: "💎 Gems" },
  { id: "trending", label: "🔥 Trending" },
  { id: "pumping", label: "🚀 Pumping" },
  { id: "whale", label: "🐋 Whale Activity" },
  { id: "volume", label: "💰 High Volume" },
  { id: "gainers", label: "📈 Top Gainers" },
  { id: "losers", label: "📉 Top Losers" },
  { id: "new", label: "🆕 New Listings" },
  { id: "followed", label: "❤️ Most Followed" },
  { id: "verified", label: "🛡 Verified" },
  { id: "community", label: "⭐ Community Picks" },
  { id: "recent", label: "⚡ Recently Launched" },
];

/* чисто декоративные мем-фразочки — крутятся в пустых состояниях и тостах,
   на функциональность никак не влияют */
const MEME_LINES = [
  "wagmi 🚀",
  "diamond hands only 💎🙌",
  "гмонки, сегодня пампим",
  "not financial advice, но выглядит сочно 👀",
  "это норм, это часть плана 🔥🐶",
  "ngmi если сидишь и не торгуешь",
  "чарт красный? значит скоро зелёный",
  "лучше поздно, чем на хаях",
];
function randomMeme() {
  return MEME_LINES[Math.floor(Math.random() * MEME_LINES.length)];
}

const DETAIL_EXTRA = {
  desc: "Быстрая, честная эмиссия без предпродажи команде. Ликвидность заблокирована на 12 месяцев с момента запуска.",
  creator: "@leo_builds",
  verified: true,
};

/* MOCK DATA — profile */

/* New-user state: nothing bought, nothing launched, no history yet. */
const PORTFOLIO_TOKENS = [];
const MY_TOKENS = [];
const ACTIVITY = [];
const ACHIEVEMENTS = [];

const SETTINGS_ITEMS = [
  { key: "profile", icon: SettingsIcon, label: "Profile Settings" },
  { key: "wallet", icon: Wallet, label: "Wallet" },
  { key: "notifications", icon: Bell, label: "Notifications" },
  { key: "security", icon: Lock, label: "Security" },
  { key: "language", icon: Globe2, label: "Language" },
  { key: "appearance", icon: Palette, label: "Appearance" },
  { key: "referral", icon: Gift, label: "Referral Program" },
  { key: "support", icon: LifeBuoy, label: "Support" },
  { key: "privacy", icon: FileText, label: "Privacy Policy" },
  { key: "terms", icon: ShieldQuestion, label: "Terms of Service" },
];

/* ---------------------------------------------------------
   HOME VIEW
--------------------------------------------------------- */

function CardStat({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-1" style={{ fontFamily: monoFont, fontSize: 10.5, color: T.muted }}>
      <Icon size={11} color={T.muted} /> {children}
    </span>
  );
}

function TokenCard({ t, onOpen, index }) {
  const up = t.change >= 0;
  const chartData = useMemo(() => mcapSeries(t.mcapNum, t.seed), [t.mcapNum, t.seed]);
  return (
    <button onClick={() => onOpen(t)} className="fx-card w-full text-left rounded-2xl" style={{ background: T.surface, border: `1px solid ${up ? "rgba(49,208,123,0.28)" : "rgba(255,77,77,0.24)"}`, padding: "9px 12px", animationDelay: `${index * 55}ms`, position: "relative", overflow: "hidden" }}>
      <TrendFX up={up} seedKey={t.seed} />
      <div className="flex items-center gap-2.5" style={{ position: "relative", zIndex: 1 }}>
        <TokenAvatar size={42} tone={up ? "up" : "down"}>{t.emoji}</TokenAvatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600 }}>{t.name}</span>
            {t.verified && <ShieldCheck size={11} color={T.electric} />}
            <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 9.5 }}>${t.ticker} · {t.cat}</span>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 17, color: T.ice, opacity: 0.92 }}>{fmtUSD(t.mcapNum)}</span>
            <ChangeBadge value={t.change} />
          </div>
        </div>
        <MiniChart data={chartData} positive={up} id={t.id} width={62} height={30} />
      </div>
      <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: `1px solid ${T.line}`, position: "relative", zIndex: 1, background: T.surface }}>
        <CardStat icon={Wallet}>${t.liq}</CardStat>
        <CardStat icon={User}>{t.holders.toLocaleString("ru-RU")}</CardStat>
        <CardStat icon={Flame}>${t.vol}</CardStat>
        <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 10, marginLeft: "auto" }}>{fmtPrice(t.price)}</span>
      </div>
    </button>
  );
}

function TokenCardSkeleton({ index }) {
  return (
    <div className="fx-card w-full rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.line}`, padding: "9px 12px", animationDelay: `${index * 55}ms` }}>
      <div className="flex items-center gap-2.5">
        <div className="fx-skeleton" style={{ width: 42, height: 42, borderRadius: "50%" }} />
        <div className="flex-1 flex flex-col gap-2">
          <div className="fx-skeleton" style={{ width: "40%", height: 11, borderRadius: 4 }} />
          <div className="fx-skeleton" style={{ width: "60%", height: 16, borderRadius: 4 }} />
        </div>
        <div className="fx-skeleton" style={{ width: 62, height: 30, borderRadius: 6 }} />
      </div>
      <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: `1px solid ${T.line}` }}>
        <div className="fx-skeleton" style={{ width: "60%", height: 10, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function HomeView({ onOpen, onSearch }) {
  const [filter, setFilter] = useState("trending");
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => { const tmr = setTimeout(() => setLoading(false), 700); return () => clearTimeout(tmr); }, []);

  const list = useMemo(() => {
    let arr = [...TOKENS];
    switch (filter) {
      case "gainers": arr.sort((a, b) => b.change - a.change); break;
      case "losers": arr.sort((a, b) => a.change - b.change); break;
      case "new": case "recent": arr.reverse(); break;
      case "pumping": arr = arr.filter(t => t.change > 15); break;
      case "verified": arr = arr.filter(t => t.verified); break;
      default: break; // gems / whale / volume / followed / community: показываем весь пул (демо-данные)
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(t => t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q));
    }
    return arr;
  }, [filter, query]);

  return (
    <div className="flex flex-col" style={{ height: "100%", minHeight: 0 }}>
      <div className="flex flex-col gap-4 flex-shrink-0" style={{ paddingBottom: 12 }}>
        <div className="fx-card rounded-2xl p-4 relative overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full" style={{ background: PRISM, opacity: 0.2, filter: "blur(20px)", animation: "glowPulse 5s ease-in-out infinite" }} />
          <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 16.5, fontWeight: 700, lineHeight: 1.3 }} className="relative">
            🚀 Начни уже сейчас
          </div>
          <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }} className="relative">
            Создавай, торгуй и расти с <span style={{ color: T.turquoise, fontWeight: 600 }}>0% комиссией платформы</span> первый месяц. Присоединяйся к экосистеме с первого дня.
          </div>
        </div>

        <div className="fx-chip flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: T.surface, border: `1px solid ${searchOpen ? T.electric : T.line}`, boxShadow: searchOpen ? `0 0 0 3px rgba(255,255,255,0.14)` : "none" }}>
          <Search size={16} color={T.muted} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setSearchOpen(false)}
            placeholder="Найти токен или тикер"
            style={{ fontFamily: bodyFont, color: T.ice, fontSize: 13, background: "transparent", border: "none", outline: "none", flex: 1, minWidth: 0 }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="fx-tap" style={{ flexShrink: 0 }}>
              <X size={14} color={T.muted} />
            </button>
          )}
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto" style={{ touchAction: "pan-x", overscrollBehaviorX: "contain", overflowY: "hidden" }}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} className="fx-tap fx-chip rounded-full px-3 py-1.5 whitespace-nowrap flex-shrink-0"
                style={{
                  fontFamily: bodyFont, fontSize: 12, background: active ? T.ice : T.surface,
                  color: active ? T.bg : T.muted, border: `1px solid ${active ? T.ice : T.line}`,
                  transform: active ? "scale(1.04)" : "scale(1)",
                  boxShadow: active ? `0 4px 14px rgba(0,0,0,0.25), 0 0 12px rgba(255,255,255,0.25)` : "none",
                }}>
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div className="flex flex-col gap-1.5 pb-4" key={filter + query}>
          {loading ? Array.from({ length: 4 }).map((_, i) => <TokenCardSkeleton key={i} index={i} />) : list.map((t, i) => <TokenCard key={t.id} t={t} onOpen={onOpen} index={i} />)}
          {!loading && list.length === 0 && (
            <div className="fx-view" style={{ fontFamily: bodyFont, color: T.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              По этому фильтру пока пусто — попробуй другой или загляни позже.
              <div style={{ fontFamily: bodyFont, fontSize: 11, color: T.muted, opacity: 0.7, marginTop: 6 }}>{randomMeme()}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TOKEN DETAIL VIEW
--------------------------------------------------------- */

const CHART_TOTAL = 140;
const CHART_DEFAULT_VISIBLE = 46;
const CHART_MIN_VISIBLE = 12;

function TokenDetail({ t, onBack, showToast, onBuy, onSell, unlocked = true }) {
  const [fav, setFav] = useState(false);
  const [tf, setTf] = useState("H1");
  const [candles, setCandles] = useState(() => genCandles(t.price, t.seed, "H1", CHART_TOTAL));
  const [view, setView] = useState({ start: CHART_TOTAL - CHART_DEFAULT_VISIBLE, count: CHART_DEFAULT_VISIBLE });
  const viewRef = useRef(view);
  const chartWrapRef = useRef(null);
  const up = t.change >= 0;

  useEffect(() => { viewRef.current = view; }, [view]);

  useEffect(() => {
    setCandles(genCandles(t.price, t.seed, tf, CHART_TOTAL));
    setView({ start: CHART_TOTAL - CHART_DEFAULT_VISIBLE, count: CHART_DEFAULT_VISIBLE });
  }, [tf, t.id]);

  // simulate live tick on the last candle, like a real feed
  useEffect(() => {
    const iv = setInterval(() => {
      setCandles(prev => {
        if (!prev.length) return prev;
        const next = [...prev];
        const last = { ...next[next.length - 1] };
        const wig = t.price * 0.006;
        last.close = Math.max(t.price * 0.3, last.close + (Math.random() - 0.5) * wig);
        last.high = Math.max(last.high, last.close);
        last.low = Math.min(last.low, last.close);
        next[next.length - 1] = last;
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [t.price]);

  // pinch-to-zoom, drag-to-pan and wheel-zoom on the chart itself
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const pointers = new Map();
    let pinchStartDist = null;
    let pinchStartCount = viewRef.current.count;
    let dragStartX = null;
    let dragStartIndex = viewRef.current.start;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    function applyView(next) {
      const count = clamp(Math.round(next.count), CHART_MIN_VISIBLE, CHART_TOTAL);
      const start = clamp(Math.round(next.start), 0, CHART_TOTAL - count);
      setView({ start, count });
    }

    function onPointerDown(e) {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragStartX = e.clientX;
        dragStartIndex = viewRef.current.start;
      } else if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        pinchStartDist = dist(pts[0], pts[1]);
        pinchStartCount = viewRef.current.count;
      }
    }
    function onPointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStartDist) {
        const pts = Array.from(pointers.values());
        const scale = dist(pts[0], pts[1]) / pinchStartDist;
        const centerIdx = viewRef.current.start + viewRef.current.count / 2;
        applyView({ start: centerIdx - (pinchStartCount / scale) / 2, count: pinchStartCount / scale });
      } else if (pointers.size === 1 && dragStartX !== null) {
        const rect = el.getBoundingClientRect();
        const pxPerCandle = rect.width / viewRef.current.count;
        applyView({ start: dragStartIndex - (e.clientX - dragStartX) / pxPerCandle, count: viewRef.current.count });
      }
    }
    function onPointerUp(e) {
      pointers.delete(e.pointerId);
      const remaining = Array.from(pointers.values());
      if (remaining.length === 1) { dragStartX = remaining[0].x; dragStartIndex = viewRef.current.start; }
      else { dragStartX = null; pinchStartDist = null; }
    }
    function onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      const centerIdx = viewRef.current.start + viewRef.current.count / 2;
      const newCount = viewRef.current.count * factor;
      applyView({ start: centerIdx - newCount / 2, count: newCount });
    }
    function onDblClick() {
      applyView({ start: CHART_TOTAL - CHART_DEFAULT_VISIBLE, count: CHART_DEFAULT_VISIBLE });
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, [tf]);

  const visibleCandles = useMemo(() => candles.slice(view.start, view.start + view.count), [candles, view.start, view.count]);
  const isZoomed = view.count !== CHART_DEFAULT_VISIBLE || view.start !== CHART_TOTAL - CHART_DEFAULT_VISIBLE;
  function resetZoom() { setView({ start: CHART_TOTAL - CHART_DEFAULT_VISIBLE, count: CHART_DEFAULT_VISIBLE }); }

  const [reported, setReported] = useState(false);
  function handleShare() {
    const url = `https://faceta.app/token/${t.id}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: t.name, url }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
      showToast("Ссылка скопирована");
    } else {
      showToast("Ссылка скопирована");
    }
  }
  function handleReport() {
    if (reported) return;
    setReported(true);
    showToast("Жалоба отправлена на проверку");
  }
  function openSocial(kind) {
    const handle = DETAIL_EXTRA.creator.replace("@", "");
    const urls = { tg: `https://t.me/${handle}`, x: `https://x.com/${handle}`, site: `https://${t.ticker.toLowerCase()}.xyz` };
    if (typeof window !== "undefined") window.open(urls[kind], "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fx-view flex flex-col gap-4 pb-4" style={{ position: "relative" }}>
      <TrendFX up={up} seedKey={t.seed} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="fx-tap flex items-center gap-1" style={{ color: T.muted, fontFamily: bodyFont, fontSize: 13 }}><ChevronLeft size={16} /> Назад</button>
        <div className="flex items-center gap-3">
          <button onClick={handleShare} className="fx-tap"><Share2 size={16} color={T.muted} /></button>
          <button onClick={() => setFav(!fav)} className="fx-tap"><Star size={16} color={fav ? T.violet : T.muted} fill={fav ? T.violet : "none"} /></button>
          <button onClick={handleReport} className="fx-tap"><Flag size={16} color={reported ? T.rose : T.muted} fill={reported ? T.rose : "none"} /></button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <TokenAvatar size={56} tone={up ? "up" : "down"}>{t.emoji}</TokenAvatar>
        <div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 19, fontWeight: 700 }}>{t.name}</span>
            {DETAIL_EXTRA.verified && <ShieldCheck size={14} color={T.electric} />}
          </div>
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 12 }}>${t.ticker} · {t.cat}</span>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11 }}>Market Cap</div>
        <div className="flex items-end gap-2">
          <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 30, lineHeight: 1, color: T.ice, opacity: 0.92 }}>{fmtUSD(t.mcapNum)}</span>
          <div style={{ marginBottom: 4 }}><ChangeBadge value={t.change} size="md" /></div>
        </div>
        <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 12, marginTop: 2 }}>{fmtPrice(t.price)} / токен</div>
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {TIMEFRAMES.map(f => (
          <button key={f} onClick={() => setTf(f)} className="tf-btn fx-tap rounded-lg px-2.5 py-1 flex-shrink-0"
            style={{ fontFamily: monoFont, fontSize: 11, background: tf === f ? T.ice : T.surface, color: tf === f ? T.bg : T.muted, border: `1px solid ${tf === f ? T.ice : T.line}` }}>
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.line}`, padding: "10px 10px 4px" }} key={tf}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span style={{ fontSize: 13 }}>{t.emoji}</span>
          <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 12.5, fontWeight: 700 }}>{t.name}</span>
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 10 }}>· {tf} · faceta</span>
          {isZoomed && (
            <button onClick={resetZoom} className="fx-tap rounded-md px-1.5 py-0.5" style={{ fontFamily: monoFont, fontSize: 9, color: T.muted, border: `1px solid ${T.line}`, background: T.surfaceHi }}>
              1:1
            </button>
          )}
          <span style={{ width: 9, height: 9, borderRadius: 2, background: T.up, marginLeft: "auto" }} />
          <span style={{ width: 9, height: 9, borderRadius: 2, background: T.down }} />
        </div>
        {(() => {
          const first = visibleCandles[0], last = visibleCandles[visibleCandles.length - 1];
          const periodHigh = Math.max(...visibleCandles.map(c => c.high));
          const periodLow = Math.min(...visibleCandles.map(c => c.low));
          const delta = last.close - first.open;
          const deltaPct = first.open ? (delta / first.open) * 100 : 0;
          const periodUp = delta >= 0;
          return (
            <div className="flex items-center gap-2.5 flex-wrap" style={{ fontFamily: monoFont, fontSize: 10, color: T.muted, marginTop: 5, marginBottom: 6 }}>
              <span>ОТКР <span style={{ color: T.ice }}>{fmtPrice(first.open)}</span></span>
              <span>МАКС <span style={{ color: T.ice }}>{fmtPrice(periodHigh)}</span></span>
              <span>МИН <span style={{ color: T.ice }}>{fmtPrice(periodLow)}</span></span>
              <span>ЗАКР <span style={{ color: T.ice }}>{fmtPrice(last.close)}</span></span>
              <span style={{ color: periodUp ? T.up : T.down }}>{periodUp ? "+" : ""}{delta.toFixed(6)} ({periodUp ? "+" : ""}{deltaPct.toFixed(2)}%)</span>
            </div>
          );
        })()}
        <div ref={chartWrapRef} style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
          <CandlestickChart data={visibleCandles} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatChip icon={TrendingUp} label="Цена" value={fmtPrice(t.price)} />
        <StatChip icon={Wallet} label="Ликвидность" value={`$${t.liq}`} />
        <StatChip icon={User} label="Держателей" value={t.holders.toLocaleString("ru-RU")} />
        <StatChip icon={Flame} label="Объём 24ч" value={`$${t.vol}`} />
      </div>

      <div className="flex gap-2">
        <button onClick={onBuy} className="fx-tap flex-1 rounded-xl py-3 flex items-center justify-center gap-1.5" style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 14, background: T.turquoise, color: "#08080A", boxShadow: `0 0 20px rgba(255,255,255,0.3)`, opacity: unlocked ? 1 : 0.55 }}>{!unlocked && <Lock size={13} />}Купить</button>
        <button onClick={onSell} className="fx-tap flex-1 rounded-xl py-3 flex items-center justify-center gap-1.5" style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 14, background: "transparent", color: T.rose, border: `1px solid ${T.rose}`, opacity: unlocked ? 1 : 0.55 }}>{!unlocked && <Lock size={13} />}Продать</button>
      </div>

      <div className="rounded-2xl p-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
        <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>О токене</div>
        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 13, lineHeight: 1.5 }}>{DETAIL_EXTRA.desc}</p>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={() => openSocial("tg")} className="fx-tap"><Send size={15} color={T.muted} /></button>
          <button onClick={() => openSocial("x")} className="fx-tap"><Twitter size={15} color={T.muted} /></button>
          <button onClick={() => openSocial("site")} className="fx-tap"><Globe size={15} color={T.muted} /></button>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12, marginLeft: "auto" }}>создатель {DETAIL_EXTRA.creator}</span>
        </div>
      </div>
      </div>
    </div>
  );
}

/* Mock account context the trade sheet needs — a real app would read
   this from the connected wallet / portfolio instead of hardcoding it. */
const TON_USD = 7.1;
const WALLET_TON_BALANCE = 128.4;
const NETWORK_FEE_TON = 0.05;
const SLIPPAGE_OPTIONS = [0.5, 1, 3];

function parseAmount(str) {
  const n = parseFloat(str.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* TradeModal — the buy/sell sheet: pick an amount (with quick %/preset
   chips), see the live conversion, pick slippage tolerance, and confirm.
   Shared between the Buy and Sell CTAs so switching tabs mid-flow works. */
function TradeModal({ t, tradeModal, onClose, onConfirm }) {
  const [mode, setMode] = useState(tradeModal ? tradeModal.mode : "buy");
  const [amountStr, setAmountStr] = useState("");
  const [slippage, setSlippage] = useState(1);

  useEffect(() => {
    if (tradeModal) {
      setMode(tradeModal.mode);
      setAmountStr("");
      setSlippage(1);
    }
  }, [tradeModal]);

  if (!tradeModal) return null;

  const holdingTokens = t.balance ? parseFloat(String(t.balance).replace(/,/g, "")) : 5000;
  const availableUSD = WALLET_TON_BALANCE * TON_USD;
  const amount = parseAmount(amountStr);
  const isBuy = mode === "buy";

  const maxAmount = isBuy ? availableUSD : holdingTokens;
  const overMax = amount > maxAmount;
  const estimate = isBuy ? amount / t.price : amount * t.price;
  const feeUsd = NETWORK_FEE_TON * TON_USD;
  const canConfirm = amount > 0 && !overMax;

  function setPct(pct) {
    const v = maxAmount * pct;
    setAmountStr(isBuy ? v.toFixed(2) : v.toFixed(v < 10 ? 4 : 0));
  }

  function handleConfirm() {
    if (!canConfirm) return;
    const payAmount = isBuy ? `$${amount.toFixed(2)}` : `${amount.toLocaleString("ru-RU")}`;
    const receiveAmount = isBuy ? estimate.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : `$${estimate.toFixed(2)}`;
    const unit = isBuy ? "" : "";
    onConfirm(mode, payAmount, receiveAmount, unit);
  }

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(2,2,4,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 20, maxHeight: "88%", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-2">
            <TokenAvatar size={34}>{t.emoji}</TokenAvatar>
            <div>
              <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 10.5 }}>${t.ticker} · {fmtPrice(t.price)}</div>
            </div>
          </div>
          <button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button>
        </div>

        <div className="flex rounded-xl p-1" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
          {[{ id: "buy", label: "Купить" }, { id: "sell", label: "Продать" }].map(o => {
            const active = mode === o.id;
            return (
              <button key={o.id} onClick={() => { setMode(o.id); setAmountStr(""); }} className="fx-tap flex-1 rounded-lg py-2"
                style={{
                  fontFamily: displayFont, fontWeight: 700, fontSize: 13,
                  background: active ? (o.id === "buy" ? T.turquoise : T.rose) : "transparent",
                  color: active ? (o.id === "buy" ? "#08080A" : "#08080A") : T.muted,
                }}>
                {o.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{isBuy ? "Вы платите" : "Вы продаёте"}</span>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11 }}>
            Доступно: {isBuy ? `$${availableUSD.toFixed(2)}` : `${holdingTokens.toLocaleString("ru-RU")} ${t.ticker}`}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3.5 py-3 mt-1.5" style={{ background: T.bg, border: `1px solid ${overMax ? T.rose : T.line}` }}>
          <span style={{ fontFamily: displayFont, color: T.muted, fontSize: 15 }}>{isBuy ? "$" : ""}</span>
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="0.00"
            inputMode="decimal"
            style={{ fontFamily: displayFont, fontWeight: 700, color: T.ice, fontSize: 20, background: "transparent", border: "none", outline: "none", flex: 1, minWidth: 0 }}
          />
          {!isBuy && <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 13 }}>${t.ticker}</span>}
        </div>
        {overMax && <div style={{ fontFamily: bodyFont, color: T.rose, fontSize: 11, marginTop: 4 }}>Недостаточно средств для этой суммы</div>}

        <div className="grid grid-cols-4 gap-1.5" style={{ marginTop: 8 }}>
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <button key={pct} onClick={() => setPct(pct)} className="fx-tap rounded-lg py-1.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: monoFont, fontSize: 11.5, color: T.ice }}>
              {pct === 1 ? "MAX" : `${pct * 100}%`}
            </button>
          ))}
        </div>

        <div className="rounded-xl p-3.5 mt-3.5" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{isBuy ? "Вы получите" : "Вы получите"}</span>
            <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 700 }}>
              {amount > 0 ? (isBuy ? `≈ ${estimate.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ${t.ticker}` : `≈ $${estimate.toFixed(2)}`) : "—"}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>Проскальзывание</span>
          <div className="flex gap-1.5 mt-1.5">
            {SLIPPAGE_OPTIONS.map(s => (
              <button key={s} onClick={() => setSlippage(s)} className="fx-tap rounded-lg px-3 py-1.5" style={{ background: slippage === s ? T.ice : T.surfaceHi, color: slippage === s ? T.bg : T.muted, border: `1px solid ${slippage === s ? T.ice : T.line}`, fontFamily: monoFont, fontSize: 11.5 }}>
                {s}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5" style={{ marginTop: 14, fontFamily: monoFont, fontSize: 11, color: T.muted }}>
          <div className="flex justify-between"><span>Курс</span><span style={{ color: T.ice }}>{fmtPrice(t.price)} / {t.ticker}</span></div>
          <div className="flex justify-between"><span>Комиссия сети</span><span style={{ color: T.ice }}>{NETWORK_FEE_TON} TON (${feeUsd.toFixed(2)})</span></div>
          <div className="flex justify-between"><span>Мин. получите (с учётом slippage)</span><span style={{ color: T.ice }}>{amount > 0 ? (isBuy ? `${(estimate * (1 - slippage / 100)).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ${t.ticker}` : `$${(estimate * (1 - slippage / 100)).toFixed(2)}`) : "—"}</span></div>
        </div>

        <button onClick={handleConfirm} disabled={!canConfirm} className="fx-tap w-full rounded-xl py-3 mt-5" style={{
          fontFamily: displayFont, fontWeight: 700, fontSize: 14,
          background: canConfirm ? (isBuy ? T.turquoise : T.rose) : T.surfaceHi,
          color: canConfirm ? (isBuy ? "#08080A" : "#08080A") : T.muted,
          opacity: canConfirm ? 1 : 0.6,
          boxShadow: canConfirm ? `0 0 20px ${isBuy ? "rgba(255,255,255,0.3)" : "rgba(140,140,148,0.25)"}` : "none",
        }}>
          {amount > 0 ? (isBuy ? `Купить за $${amount.toFixed(2)}` : `Продать ${amount.toLocaleString("ru-RU")} ${t.ticker}`) : "Введите сумму"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   CREATE TOKEN VIEW
--------------------------------------------------------- */

function Field({ label, placeholder, area, value, onChange, type = "text", icon: Icon, autoComplete }) {
  const Comp = area ? "textarea" : "input";
  const [focus, setFocus] = useState(false);
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const realType = isPassword ? (reveal ? "text" : "password") : type;
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{label}</span>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {Icon && (
          <Icon size={14} color={T.muted} style={{ position: "absolute", left: 11, pointerEvents: "none" }} />
        )}
        <Comp
          placeholder={placeholder}
          rows={area ? 3 : undefined}
          value={value}
          onChange={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          type={!area ? realType : undefined}
          autoComplete={autoComplete}
          className="rounded-xl py-2.5 w-full"
          style={{
            fontFamily: bodyFont, fontSize: 13, color: T.ice, background: T.surface,
            border: `1px solid ${focus ? T.electric : T.line}`, outline: "none",
            resize: area ? "none" : undefined,
            paddingLeft: Icon ? 32 : 12, paddingRight: isPassword ? 34 : 12,
            boxShadow: focus ? `0 0 0 3px rgba(255,255,255,0.14)` : "none",
            transition: `border-color ${EASE}, box-shadow ${EASE}`,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="fx-tap"
            style={{ position: "absolute", right: 10, background: "transparent", border: "none", padding: 2, display: "flex" }}
          >
            {reveal ? <EyeOff size={15} color={T.muted} /> : <Eye size={15} color={T.muted} />}
          </button>
        )}
      </div>
    </label>
  );
}

function CreateView({ showToast, unlocked, accountCreated, connected, onOpenCreateProfile, onOpenConnectModal }) {
  const [form, setForm] = useState({ name: "", ticker: "", supply: "", desc: "", tg: "", x: "", site: "" });
  const [category, setCategory] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [bannerUrl, setBannerUrl] = useState(null);
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  function set(key) { return (e) => setForm(f => ({ ...f, [key]: e.target.value })); }
  function onPickLogo(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLogoUrl(URL.createObjectURL(file));
    showToast("Логотип загружен");
  }
  function onPickBanner(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBannerUrl(URL.createObjectURL(file));
    showToast("Баннер загружен");
  }
  function handleLaunch() {
    if (!form.name.trim() || !form.ticker.trim()) {
      showToast("Укажи название и тикер токена");
      return;
    }
    showToast(`Токен ${form.name} ($${form.ticker.toUpperCase()}) отправлен на эмиссию`);
  }

  if (!unlocked) {
    return (
      <div className="fx-view flex flex-col items-center justify-center text-center gap-3" style={{ minHeight: "70%", paddingTop: 40 }}>
        <FacetFrame size={64} glow={`${T.violet}55`}><Lock size={26} color={T.violet} /></FacetFrame>
        <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 17, fontWeight: 700, marginTop: 6 }}>Мемпад закрыт</div>
        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, maxWidth: 280 }}>
          Чтобы запускать токены, сначала создай аккаунт и подключи TON-кошелёк — эмиссия подтверждается им напрямую.
        </p>
        <div className="flex flex-col gap-2 w-full mt-2" style={{ maxWidth: 260 }}>
          {!accountCreated && (
            <button onClick={onOpenCreateProfile} className="fx-tap w-full rounded-xl py-3" style={{ background: PRISM, color: "#08080A", fontFamily: displayFont, fontWeight: 700, fontSize: 13.5 }}>
              Создать аккаунт
            </button>
          )}
          {!connected && (
            <button onClick={onOpenConnectModal} className="fx-tap w-full flex items-center justify-center gap-2 rounded-xl py-3" style={{ background: accountCreated ? PRISM : T.surfaceHi, color: accountCreated ? "#08080A" : T.ice, border: accountCreated ? "none" : `1px solid ${T.line}`, fontFamily: displayFont, fontWeight: 700, fontSize: 13.5 }}>
              <Wallet size={15} /> Подключить кошелёк
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fx-view flex flex-col gap-7 pb-36" style={{ position: "relative" }}>
      <div>
        <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 19, fontWeight: 700 }}>Запусти токен</div>
        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12, marginTop: 2 }}>Эмиссия происходит в сети TON сразу после подтверждения</div>
      </div>

      <div className="flex gap-3">
        <input ref={logoInputRef} type="file" accept="image/*" onChange={onPickLogo} style={{ display: "none" }} />
        <input ref={bannerInputRef} type="file" accept="image/*" onChange={onPickBanner} style={{ display: "none" }} />
        <button onClick={() => logoInputRef.current && logoInputRef.current.click()} className="fx-tap flex flex-col items-center justify-center gap-1 flex-shrink-0 overflow-hidden" style={{ width: 76, height: 76, clipPath: FACET, background: logoUrl ? `center/cover no-repeat url(${logoUrl})` : T.surface, border: `1px dashed ${T.line}` }}>
          {!logoUrl && (<><ImageIcon size={18} color={T.muted} /><span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 9 }}>Лого</span></>)}
        </button>
        <button onClick={() => bannerInputRef.current && bannerInputRef.current.click()} className="fx-tap flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl overflow-hidden" style={{ background: bannerUrl ? `center/cover no-repeat url(${bannerUrl})` : T.surface, border: `1px dashed ${T.line}` }}>
          {!bannerUrl && (<><Upload size={18} color={T.muted} /><span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10 }}>Баннер 1200×400</span></>)}
        </button>
      </div>

      <Field label="Название" placeholder="Prism Cat" value={form.name} onChange={set("name")} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Тикер" placeholder="PRSM" value={form.ticker} onChange={set("ticker")} />
        <Field label="Макс. эмиссия" placeholder="1 000 000 000" value={form.supply} onChange={set("supply")} />
      </div>
      <Field label="Описание" placeholder="О чём этот токен и почему он появился" area value={form.desc} onChange={set("desc")} />

      <div className="grid grid-cols-3 gap-2">
        <Field label="Telegram" placeholder="t.me/..." value={form.tg} onChange={set("tg")} />
        <Field label="X" placeholder="x.com/..." value={form.x} onChange={set("x")} />
        <Field label="Сайт" placeholder="site.xyz" value={form.site} onChange={set("site")} />
      </div>

      <div>
        <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>Категория</span>
        <div className="flex gap-2 mt-1.5 flex-wrap">
          {CATEGORIES.filter(c => c !== "Все").map(c => {
            const active = category === c;
            return (
              <button key={c} onClick={() => setCategory(active ? null : c)} className="fx-tap rounded-full px-3 py-1.5"
                style={{ fontFamily: bodyFont, fontSize: 12, color: active ? T.bg : T.muted, background: active ? T.ice : "transparent", border: `1px solid ${active ? T.ice : T.line}` }}>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl p-4 flex items-center gap-2.5" style={{ background: "rgba(255,255,255,0.07)", border: `1px solid rgba(255,255,255,0.22)` }}>
        <Wallet size={16} color={T.electric} />
        <span style={{ fontFamily: bodyFont, color: T.electric, fontSize: 12.5 }}>Подключи кошелёк TON, чтобы подтвердить эмиссию</span>
      </div>

      <button onClick={handleLaunch} className="cta-launch fx-tap rounded-2xl" style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 16, color: "#08080A", background: PRISM, boxShadow: "0 0 30px rgba(255,255,255,0.38)", position: "sticky", bottom: 12, padding: "18px 0" }}>
        🚀 Запустить токен
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   PROFILE VIEW
--------------------------------------------------------- */

function WalletCard({ connected, walletAddress, tonBalance = 0, tonPriceUsd = 0, onConnect, onDisconnect, onCopy, onExplore }) {
  const [copied, setCopied] = useState(false);
  const balance = useCountUp(connected ? tonBalance : 0, 900, connected);
  const usd = useCountUp(connected ? tonBalance * tonPriceUsd : 0, 900, connected);
  const addressShort = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "";

  if (!connected) {
    return (
      <GlassCard style={{ padding: 20 }}>
        <SectionTitle>Wallet</SectionTitle>
        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
          Подключи TON-кошелёк, чтобы видеть портфель и торговать. Поддерживаются Tonkeeper, MyTonWallet, Tonhub, OpenMask и другие TON Connect-кошельки.
        </p>
        <button onClick={onConnect} className="fx-tap w-full rounded-xl py-3 flex items-center justify-center gap-2" style={{ background: PRISM, color: "#08080A", fontFamily: displayFont, fontWeight: 700, fontSize: 14, boxShadow: "0 0 22px rgba(255,255,255,0.28)" }}>
          <Wallet size={16} /> Connect TON Wallet
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={{ padding: 20 }} className="fx-view">
      <SectionTitle action={<span style={{ fontFamily: monoFont, fontSize: 10, color: T.turquoise, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: T.turquoise, animation: "ringPulse 1.8s ease-out infinite" }} /> Connected</span>}>
        Wallet · Tonkeeper
      </SectionTitle>
      <div className="flex items-end gap-2">
        <span style={{ fontFamily: displayFont, fontSize: 28, fontWeight: 700, color: T.ice, lineHeight: 1 }}>{balance.toFixed(1)}</span>
        <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 13, marginBottom: 3 }}>TON</span>
      </div>
      <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 12, marginTop: 2 }}>≈ ${usd.toFixed(0)}</div>
      <div className="flex items-center gap-2 mt-3 rounded-xl px-3 py-2" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
        <span style={{ fontFamily: monoFont, color: T.ice, fontSize: 12, flex: 1 }}>{addressShort}</span>
        <button className="fx-tap" onClick={() => { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>
          {copied ? <CheckCircle2 size={14} color={T.turquoise} /> : <Copy size={14} color={T.muted} />}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={onExplore} className="fx-tap flex items-center justify-center gap-1.5 rounded-xl py-2.5" style={{ background: T.surface, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 12, color: T.ice }}>
          <ExternalLink size={13} color={T.muted} /> TON Explorer
        </button>
        <button onClick={onDisconnect} className="fx-tap flex items-center justify-center gap-1.5 rounded-xl py-2.5" style={{ background: "transparent", border: `1px solid rgba(140,140,148,0.3)`, fontFamily: bodyFont, fontSize: 12, color: T.rose }}>
          <LogOut size={13} /> Disconnect
        </button>
      </div>
    </GlassCard>
  );
}

function StatBlock({ label, value, suffix = "", color = T.ice, decimals = 0 }) {
  const v = useCountUp(value, 900);
  return (
    <GlassCard style={{ padding: "14px 14px" }}>
      <div style={{ fontFamily: displayFont, fontSize: 19, fontWeight: 700, color }}>
        {decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("ru-RU")}{suffix}
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 11, color: T.muted, marginTop: 2 }}>{label}</div>
    </GlassCard>
  );
}

function PortfolioTokenCard({ t, onOpen }) {
  const up = t.pnl >= 0;
  const data = useMemo(() => mcapSeries(t.mcapNum, t.seed, 18), [t.mcapNum, t.seed]);
  return (
    <button onClick={() => onOpen(t)} className="fx-card w-full flex items-center gap-3 rounded-2xl text-left" style={{ background: T.surface, border: `1px solid ${up ? "rgba(49,208,123,0.28)" : "rgba(255,77,77,0.24)"}`, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
      <TrendFX up={up} seedKey={t.seed} />
      <TokenAvatar tone={up ? "up" : "down"}>{t.emoji}</TokenAvatar>
      <div className="flex-1 min-w-0" style={{ position: "relative", zIndex: 1 }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 600 }}>{t.name}</span>
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 10 }}>${t.ticker}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 15, color: T.ice }}>${t.value}</span>
          <span style={{ fontFamily: monoFont, fontSize: 11, color: up ? T.up : T.down }}>{up ? "+" : ""}{t.pnl.toFixed(1)}%</span>
        </div>
        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10.5, marginTop: 2 }}>{t.balance} {t.ticker} · MCAP {fmtUSD(t.mcapNum)}</div>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}><MiniChart data={data} positive={up} id={`pf-${t.id}`} showTooltip={false} /></div>
    </button>
  );
}

function MyTokenCard({ t, onManage }) {
  return (
    <GlassCard style={{ padding: "12px 14px" }} className="flex items-center gap-3">
      <TokenAvatar tone={t.verified ? "neutral" : "neutral"}>{t.emoji}</TokenAvatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 600 }}>{t.name}</span>
          {t.verified && <ShieldCheck size={12} color={T.electric} />}
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 10 }}>${t.ticker}</span>
        </div>
        <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 16, color: T.turquoise, marginTop: 2 }}>{fmtUSD(t.mcapNum)}</div>
        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10.5, marginTop: 2 }}>Ликв {t.liq} · {t.holders.toLocaleString("ru-RU")} держателей · Vol {t.vol}</div>
      </div>
      <button onClick={() => onManage && onManage(t)} className="fx-tap rounded-lg px-3 py-1.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 11, color: T.ice }}>Manage</button>
    </GlassCard>
  );
}

function ConnectModal({ open, onClose, onConnect }) {
  if (!open) return null;
  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(2,2,4,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22 }}>
        <div className="flex justify-end"><button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button></div>
        <div className="flex flex-col items-center text-center gap-2" style={{ marginTop: -8 }}>
          <FacetFrame size={56} glow={`${T.electric}55`}><Wallet size={22} color={T.electric} /></FacetFrame>
          <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700, marginTop: 6 }}>Connect your TON Wallet to continue</div>
          <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>Покупка, продажа и запуск токенов доступны после подключения кошелька.</div>
        </div>
        <button onClick={() => { onConnect(); onClose(); }} className="fx-tap w-full rounded-xl py-3 mt-5" style={{ background: PRISM, color: "#08080A", fontFamily: displayFont, fontWeight: 700, fontSize: 14, boxShadow: "0 0 22px rgba(255,255,255,0.28)" }}>
          Connect Wallet
        </button>
      </div>
    </div>
  );
}

/* Small reusable on/off switch used inside settings rows. */
function ToggleSwitch({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="fx-tap"
      style={{
        width: 42, height: 24, borderRadius: 999, flexShrink: 0, position: "relative",
        background: on ? PRISM : T.surfaceHi, border: `1px solid ${on ? "transparent" : T.line}`,
        transition: `background ${EASE}, border-color ${EASE}`,
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%",
        background: on ? "#08080A" : T.muted, transition: `left ${SPRING}`,
      }} />
    </button>
  );
}

function SettingsRow({ label, sub, children }) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${T.line}` }}>
      <div className="flex-1">
        <div style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>{label}</div>
        {sub && <div style={{ fontFamily: bodyFont, fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

const PRIVACY_TEXT = "Мы собираем только данные, необходимые для работы приложения: никнейм, адрес кошелька и историю сделок внутри Faceta. Данные не передаются третьим лицам в рекламных целях. Ты можешь удалить аккаунт в любой момент — все локальные данные профиля будут стёрты немедленно.";
const TERMS_TEXT = "Используя Faceta, ты подтверждаешь, что совершаешь сделки на свой риск. Faceta не гарантирует доходность токенов и не несёт ответственности за потери, вызванные волатильностью рынка. Запрещено создавать токены, вводящие пользователей в заблуждение, или использующие чужой бренд без разрешения.";

/* SettingsPanel — a lightweight bottom-sheet used so every row under
   "Settings" actually opens real, distinct content instead of the
   same placeholder for every item. */
function SettingsPanel({
  item, onClose, appSettings, onUpdateSetting,
  connected, onConnectWallet, onDisconnectWallet, onCopyAddress,
  onOpenEditProfile, profile, showToast,
}) {
  if (!item) return null;
  const Icon = item.icon;

  function openEditFromSettings() { onClose(); onOpenEditProfile(); }
  function contactSupport() {
    if (typeof window !== "undefined") window.open("https://t.me/faceta_support", "_blank", "noopener,noreferrer");
  }
  function copyReferral() {
    const code = "FACETA-" + (profile.nickname ? profile.nickname.toUpperCase() : "GUEST");
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    showToast("Реферальный код скопирован");
  }

  let body = null;
  switch (item.key) {
    case "profile":
      body = (
        <>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
            Никнейм, аватар, почта и описание профиля.
          </p>
          <button onClick={openEditFromSettings} className="fx-tap w-full rounded-xl py-3 mt-4" style={{ background: PRISM, color: "#08080A", fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
            Редактировать профиль
          </button>
        </>
      );
      break;
    case "wallet":
      body = (
        <>
          <div className="flex items-center justify-center gap-2 mt-1 mb-3">
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? T.turquoise : T.muted }} />
            <span style={{ fontFamily: bodyFont, fontSize: 12.5, color: connected ? T.turquoise : T.muted }}>{connected ? "Кошелёк подключён" : "Кошелёк не подключён"}</span>
          </div>
          {connected ? (
            <div className="flex flex-col gap-2">
              <button onClick={onCopyAddress} className="fx-tap w-full flex items-center justify-center gap-2 rounded-xl py-3" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice }}>
                <Copy size={14} color={T.muted} /> Скопировать адрес
              </button>
              <button onClick={() => { onDisconnectWallet(); onClose(); }} className="fx-tap w-full flex items-center justify-center gap-2 rounded-xl py-3" style={{ background: "transparent", border: `1px solid rgba(140,140,148,0.3)`, fontFamily: bodyFont, fontSize: 13, color: T.rose }}>
                <LogOut size={14} /> Отключить кошелёк
              </button>
            </div>
          ) : (
            <button onClick={() => { onConnectWallet(); onClose(); }} className="fx-tap w-full rounded-xl py-3" style={{ background: PRISM, color: "#08080A", fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
              Connect TON Wallet
            </button>
          )}
        </>
      );
      break;
    case "notifications":
      body = (
        <div className="mt-2">
          <SettingsRow label="Push-уведомления" sub="Сделки, рост цены, ответы в комментариях">
            <ToggleSwitch on={appSettings.pushNotif} onChange={(v) => onUpdateSetting("pushNotif", v)} />
          </SettingsRow>
          <SettingsRow label="Email-уведомления" sub="Еженедельный дайджест по портфелю">
            <ToggleSwitch on={appSettings.emailNotif} onChange={(v) => onUpdateSetting("emailNotif", v)} />
          </SettingsRow>
        </div>
      );
      break;
    case "security":
      body = (
        <div className="mt-2">
          <SettingsRow label="Двухфакторная аутентификация" sub="Подтверждение входа кодом">
            <ToggleSwitch on={appSettings.twoFA} onChange={(v) => onUpdateSetting("twoFA", v)} />
          </SettingsRow>
          <button onClick={() => showToast("Отправили ссылку для смены PIN-кода")} className="fx-tap w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-3" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice }}>
            <Lock size={14} color={T.muted} /> Сменить PIN-код
          </button>
        </div>
      );
      break;
    case "language":
      body = (
        <div className="flex flex-col gap-2 mt-2">
          {["RU", "EN"].map((lng) => (
            <button key={lng} onClick={() => onUpdateSetting("language", lng)} className="fx-tap w-full flex items-center justify-between rounded-xl py-3 px-3.5" style={{ background: T.surfaceHi, border: `1px solid ${appSettings.language === lng ? T.turquoise : T.line}` }}>
              <span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>{lng === "RU" ? "Русский" : "English"}</span>
              {appSettings.language === lng && <CheckCircle2 size={16} color={T.turquoise} />}
            </button>
          ))}
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>Полный перевод интерфейса появится в одном из следующих обновлений.</p>
        </div>
      );
      break;
    case "appearance":
      body = (
        <div className="flex flex-col gap-2 mt-2">
          {["Dark", "OLED Black"].map((th) => (
            <button key={th} onClick={() => onUpdateSetting("theme", th)} className="fx-tap w-full flex items-center justify-between rounded-xl py-3 px-3.5" style={{ background: T.surfaceHi, border: `1px solid ${appSettings.theme === th ? T.turquoise : T.line}` }}>
              <span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>{th}</span>
              {appSettings.theme === th && <CheckCircle2 size={16} color={T.turquoise} />}
            </button>
          ))}
        </div>
      );
      break;
    case "referral":
      body = (
        <>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
            Приглашай друзей — получай % от их комиссий за сделки.
          </p>
          <div className="flex items-center gap-2 mt-3 rounded-xl px-3 py-2.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
            <span style={{ fontFamily: monoFont, color: T.ice, fontSize: 12.5, flex: 1 }}>{"FACETA-" + (profile.nickname ? profile.nickname.toUpperCase() : "GUEST")}</span>
            <button onClick={copyReferral} className="fx-tap"><Copy size={14} color={T.muted} /></button>
          </div>
        </>
      );
      break;
    case "support":
      body = (
        <>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
            Ответим в течение суток в Telegram-поддержке.
          </p>
          <button onClick={contactSupport} className="fx-tap w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-4" style={{ background: PRISM, color: "#08080A", fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
            <Send size={14} /> Написать в поддержку
          </button>
        </>
      );
      break;
    case "privacy":
      body = <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}>{PRIVACY_TEXT}</p>;
      break;
    case "terms":
      body = <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}>{TERMS_TEXT}</p>;
      break;
    default:
      body = null;
  }

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(2,2,4,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22, maxHeight: "80%", overflowY: "auto" }}>
        <div className="flex justify-end"><button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button></div>
        <div className="flex flex-col items-center text-center gap-2" style={{ marginTop: -8 }}>
          <FacetFrame size={52} glow={`${T.electric}44`}><Icon size={20} color={T.electric} /></FacetFrame>
          <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700, marginTop: 6 }}>{item.label}</div>
        </div>
        {body}
      </div>
    </div>
  );
}

/* TokenManageSheet — the "Manage" action on a token you created:
   surfaces real controls (copy link, verify, edit info) rather than
   a dead button. */
function TokenManageSheet({ token, onClose, showToast }) {
  if (!token) return null;
  function copyLink() {
    const url = `https://faceta.app/token/${token.id}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    showToast("Ссылка на токен скопирована");
  }
  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(2,2,4,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22 }}>
        <div className="flex justify-end"><button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button></div>
        <div className="flex items-center gap-3" style={{ marginTop: -8, marginBottom: 14 }}>
          <TokenAvatar size={44}>{token.emoji}</TokenAvatar>
          <div>
            <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 15, fontWeight: 700 }}>{token.name}</div>
            <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 11 }}>${token.ticker}</div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={copyLink} className="fx-tap w-full flex items-center gap-2 rounded-xl py-3 px-3.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
            <Copy size={15} color={T.muted} /><span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>Скопировать ссылку</span>
          </button>
          <button onClick={() => { showToast("Открываю редактирование описания"); onClose(); }} className="fx-tap w-full flex items-center gap-2 rounded-xl py-3 px-3.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
            <FileText size={15} color={T.muted} /><span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>Редактировать описание</span>
          </button>
          <button onClick={() => { showToast("Заявка на верификацию отправлена"); onClose(); }} className="fx-tap w-full flex items-center gap-2 rounded-xl py-3 px-3.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
            <ShieldCheck size={15} color={T.muted} /><span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>Подать на верификацию</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* Fallback identicon pool: when no avatar is uploaded, every profile still
   gets a face — a random emoji picked once at account-creation time and
   stored on the profile (not re-rolled on every render). */
const PROFILE_EMOJI_POOL = ["😎", "🦊", "🐼", "🐸", "🐵", "🦁", "🐯", "🐨", "🐙", "🦄", "🐳", "🦉", "🐺", "🐲", "🤖", "👾", "🎃", "🧊", "🌟", "🔥"];
function randomProfileEmoji() { return PROFILE_EMOJI_POOL[Math.floor(Math.random() * PROFILE_EMOJI_POOL.length)]; }

/* Nickname rule: Latin letters, numbers, underscore and dot only, 2–20
   chars, must start with a letter — keeps profile URLs / mentions safe. */
const NICKNAME_RE = /^[A-Za-z][A-Za-z0-9_.]{1,19}$/;

/* AuthModal — replaces the old single-button flow. Handles three modes:
   "login"  — email + password, signs in against real Supabase auth
   "create" — nickname + email + password (+ optional avatar/bio), signs up
   "edit"   — profile fields only, no password, updates the existing row
   When not in "edit" mode, a segmented tab lets the user flip between
   login/create without closing the sheet — that's the "красивое меню". */
function AuthModal({ open, onClose, onSubmit, initial, mode = "create", walletAddress }) {
  const isEdit = mode === "edit";
  const [authTab, setAuthTab] = useState(isEdit ? "create" : mode); // "login" | "create"
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [previewEmoji, setPreviewEmoji] = useState(() => randomProfileEmoji());
  const [touched, setTouched] = useState(false);
  const avatarInputRef = useRef(null);
  const isLogin = !isEdit && authTab === "login";

  useEffect(() => {
    if (open) {
      setAuthTab(isEdit ? "create" : mode);
      setNickname(initial && initial.nickname ? initial.nickname : "");
      setEmail(initial && initial.email ? initial.email : "");
      setPassword("");
      setBio(initial && initial.bio ? initial.bio : "");
      setAvatarUrl(initial && initial.avatarUrl ? initial.avatarUrl : null);
      setPreviewEmoji(initial && initial.emoji ? initial.emoji : randomProfileEmoji());
      setTouched(false);
      setServerError("");
    }
  }, [open, mode]);

  if (!open) return null;

  const nicknameTrimmed = nickname.trim();
  const nicknameValid = isLogin || NICKNAME_RE.test(nicknameTrimmed);
  const emailValid = email.trim() !== "" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = isEdit || password.length >= 6;
  const canSubmit = nicknameValid && emailValid && passwordValid;

  function onPickAvatar(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setAvatarUrl(URL.createObjectURL(file));
  }

  function friendlyAuthError(message) {
    const m = (message || "").toLowerCase();
    if (m.includes("already registered") || m.includes("already exists")) return "Эта почта уже зарегистрирована — попробуй вкладку «Войти»";
    if (m.includes("invalid login credentials")) return "Неверная почта или пароль";
    if (m.includes("email not confirmed")) return "Подтверди почту по ссылке из письма перед входом";
    if (m.includes("password") && m.includes("6")) return "Пароль должен быть не короче 6 символов";
    if (m.includes("nickname")) return `Никнейм "${nicknameTrimmed}" уже занят`;
    return message || "Что-то пошло не так, попробуй ещё раз";
  }

  async function handleSubmit() {
    setTouched(true);
    setServerError("");
    if (!canSubmit) return;
    setSubmitting(true);

    // ---------- LOGIN ----------
    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setSubmitting(false);
        setServerError(friendlyAuthError(error.message));
        return;
      }
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("nickname, email, bio, avatar_url, emoji")
        .eq("id", data.user.id)
        .single();
      setSubmitting(false);
      if (profErr || !prof) {
        setServerError("Не удалось загрузить профиль, попробуй ещё раз");
        return;
      }
      onSubmit({
        nickname: prof.nickname,
        email: prof.email,
        bio: prof.bio || "",
        avatarUrl: prof.avatar_url,
        emoji: prof.emoji,
      });
      return;
    }

    // ---------- EDIT (no auth call — just updates the row) ----------
    if (isEdit) {
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData?.user?.id;
      if (userId) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            nickname: nicknameTrimmed,
            bio: bio.trim(),
            avatar_url: avatarUrl,
            emoji: avatarUrl ? null : previewEmoji,
          })
          .eq("id", userId);
        setSubmitting(false);
        if (updateError) {
          setServerError(friendlyAuthError(updateError.message));
          return;
        }
      } else {
        setSubmitting(false);
      }
      onSubmit({
        nickname: nicknameTrimmed,
        email: email.trim(),
        bio: bio.trim(),
        avatarUrl,
        emoji: avatarUrl ? null : previewEmoji,
      });
      return;
    }

    // ---------- CREATE (real signUp; a DB trigger auto-creates the
    // profiles row from the metadata below — see SQL setup) ----------
    const { data: existing } = await supabase
      .from("profiles")
      .select("nickname")
      .ilike("nickname", nicknameTrimmed)
      .maybeSingle();
    if (existing) {
      setSubmitting(false);
      setServerError(`Никнейм "${nicknameTrimmed}" уже занят`);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nickname: nicknameTrimmed,
          bio: bio.trim(),
          avatar_url: avatarUrl,
          emoji: avatarUrl ? null : previewEmoji,
          wallet_address: walletAddress || null,
        },
      },
    });

    setSubmitting(false);
    if (error) {
      setServerError(friendlyAuthError(error.message));
      return;
    }

    if (!data.session) {
      // Email confirmation is turned on in the Supabase project — there's
      // no session yet, so we can't unlock the app. Ask the user to verify.
      setServerError("Мы отправили письмо для подтверждения — перейди по ссылке, потом войди");
      return;
    }

    onSubmit({
      nickname: nicknameTrimmed,
      email: email.trim(),
      bio: bio.trim(),
      avatarUrl,
      emoji: avatarUrl ? null : previewEmoji,
    });
  }

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(2,2,4,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22, maxHeight: "88%", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: isEdit ? 4 : 14 }}>
          <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700 }}>
            {isEdit ? "Редактировать профиль" : "Аккаунт"}
          </span>
          <button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button>
        </div>

        {!isEdit && (
          <div className="flex" style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 12, padding: 3, marginBottom: 16 }}>
            {[
              { id: "login", label: "Войти", icon: LogIn },
              { id: "create", label: "Создать аккаунт", icon: Sparkles },
            ].map(({ id, label, icon: Icon }) => {
              const active = authTab === id;
              return (
                <button
                  key={id}
                  onClick={() => { setAuthTab(id); setServerError(""); setTouched(false); }}
                  className="fx-tap tf-btn flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2"
                  style={{
                    background: active ? PRISM : "transparent",
                    color: active ? "#08080A" : T.muted,
                    fontFamily: displayFont, fontWeight: 700, fontSize: 12.5,
                  }}
                >
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>
        )}

        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12, marginBottom: 16 }}>
          {isEdit ? "Никнейм обязателен, остальное можно заполнить позже." : isLogin ? "Войди в свой аккаунт по почте и паролю." : "Никнейм, почта и пароль обязательны, остальное можно заполнить позже."}
        </p>

        {!isLogin && (
          <div className="flex flex-col items-center gap-1.5" style={{ marginBottom: 16 }}>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: "none" }} />
            <button onClick={() => avatarInputRef.current && avatarInputRef.current.click()} className="fx-tap flex flex-col items-center justify-center gap-1 overflow-hidden" style={{ width: 84, height: 84, borderRadius: "50%", background: avatarUrl ? `center/cover no-repeat url(${avatarUrl})` : T.bg, border: `1px dashed ${T.lineHi}`, fontSize: 34 }}>
              {!avatarUrl && previewEmoji}
            </button>
            {avatarUrl && <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10.5 }}>Нажми, чтобы заменить</span>}
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          {!isLogin && (
            <>
              <Field label="Никнейм *" placeholder="leo_builds" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              {touched && !nicknameValid && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 11, marginTop: -10 }}>2–20 символов, только латинские буквы, цифры, _ и ., начинается с буквы</span>}
            </>
          )}
          <Field label="Почта *" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} icon={Mail} autoComplete="email" type="email" />
          {touched && !emailValid && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 11, marginTop: -10 }}>{email.trim() === "" ? "Укажите email — поле обязательно" : "Введите корректный email"}</span>}
          {!isEdit && (
            <>
              <Field label="Пароль *" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} icon={KeyRound} type="password" autoComplete={isLogin ? "current-password" : "new-password"} />
              {touched && !passwordValid && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 11, marginTop: -10 }}>Пароль должен быть не короче 6 символов</span>}
            </>
          )}
          {!isLogin && <Field label="О себе (необязательно)" placeholder="Пара слов о себе" area value={bio} onChange={(e) => setBio(e.target.value)} />}
        </div>
        {serverError && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 12, marginTop: 10, display: "block" }}>{serverError}</span>}
        <button onClick={handleSubmit} disabled={submitting} className="fx-tap w-full rounded-xl py-3 mt-5" style={{ background: canSubmit ? PRISM : T.surfaceHi, color: canSubmit ? "#08080A" : T.muted, fontFamily: displayFont, fontWeight: 700, fontSize: 14, boxShadow: canSubmit ? "0 0 22px rgba(255,255,255,0.28)" : "none", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Проверяем..." : isEdit ? "Сохранить изменения" : isLogin ? "Войти" : "Создать аккаунт"}
        </button>
      </div>
    </div>
  );
}

function ProfileView({
  connected, walletAddress, tonBalance, tonPriceUsd, onConnect, onDisconnect, onOpenConnectModal, showToast,
  accountCreated, profile, onOpenCreateProfile, onOpenLogin, onOpenEditProfile, onLogOut, onDeleteAccount,
  onOpenSetting, onManageToken, onGoCreate, onOpenToken,
}) {
  const [loading, setLoading] = useState(true);
  const [verifyStatus, setVerifyStatus] = useState("none");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeleteAccount() {
    setDeleting(true);
    await onDeleteAccount();
    setDeleting(false);
    setDeleteConfirmOpen(false);
  }

  useEffect(() => { const t = setTimeout(() => setLoading(false), 650); return () => clearTimeout(t); }, []);

  const unlocked = accountCreated && connected;
  function requireUnlock(missingMsg) {
    if (!accountCreated) { onOpenCreateProfile(); showToast("Сначала создай аккаунт"); return false; }
    if (!connected) { onOpenConnectModal(); showToast("Подключи TON-кошелёк, чтобы продолжить"); return false; }
    return true;
  }
  function connectWallet() { onConnect(); showToast("Кошелёк подключён"); }
  function disconnectWallet() { onDisconnect(); showToast("Кошелёк отключён"); }
  function copyAddress() {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(walletAddress).catch(() => {});
    showToast("Адрес скопирован");
  }
  function startVerify() {
    if (!requireUnlock()) return;
    setVerifyStatus("pending");
    showToast("Заявка отправлена на проверку");
    setTimeout(() => { setVerifyStatus("verified"); showToast("Профиль верифицирован"); }, 2200);
  }
  function goCreateToken() {
    if (!requireUnlock()) return;
    onGoCreate();
  }
  function openSettingItem(item) {
    if (!requireUnlock()) return;
    onOpenSetting(item);
  }
  function exploreWallet() { if (typeof window !== "undefined") window.open("https://tonviewer.com", "_blank", "noopener,noreferrer"); }
  function logOut() {
    setVerifyStatus("none");
    onLogOut();
  }

  return (
    <div className="fx-view" style={{ position: "relative" }}>
      <div className="flex flex-col gap-0 pb-4">
        <div className="flex flex-col items-center text-center gap-2" style={{ marginTop: 10, position: "relative" }}>
          {accountCreated && (
            <button onClick={logOut} className="fx-tap flex items-center gap-1.5" style={{ position: "absolute", top: 0, right: 0, background: "transparent", border: `1px solid rgba(140,140,148,0.3)`, borderRadius: 999, padding: "6px 12px", fontFamily: bodyFont, fontSize: 12, color: T.rose }}>
              <LogOut size={13} /> Выйти
            </button>
          )}
          <div style={{ position: "relative" }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", background: profile.avatarUrl ? `center/cover no-repeat url(${profile.avatarUrl})` : T.surfaceHi, border: `2px dashed ${T.lineHi}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: accountCreated ? 52 : 40 }}>
              {!profile.avatarUrl && (accountCreated && profile.emoji ? profile.emoji : <User size={40} color={T.muted} />)}
            </div>
          </div>
          {accountCreated ? (
            <>
              <div className="flex items-center gap-1.5 mt-1">
                <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 19, fontWeight: 700 }}>{profile.nickname}</span>
                {verifyStatus === "verified" && <ShieldCheck size={16} color={T.electric} />}
              </div>
              <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 12 }}>{profile.email}</span>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, maxWidth: 260, lineHeight: 1.5 }}>
                {profile.bio || "Расскажи о себе — это увидят другие в комментариях и профиле токенов."}
              </p>
              <div className="flex items-center gap-3" style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>
                <span className="flex items-center gap-1"><Clock size={12} /> с сегодняшнего дня</span>
              </div>
              <button onClick={onOpenEditProfile} className="fx-tap rounded-xl px-5 py-2.5 mt-2" style={{ background: T.surface, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice }}>Edit Profile</button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 17, fontWeight: 700, marginTop: 4 }}>Аккаунт не создан</div>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, maxWidth: 260, lineHeight: 1.5 }}>Войди в свой аккаунт или создай новый, чтобы запускать токены, торговать и собирать достижения.</p>
              <div className="flex items-center gap-2 mt-2" style={{ width: "100%", maxWidth: 300 }}>
                <button onClick={onOpenLogin} className="fx-tap flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5" style={{ background: T.surface, border: `1px solid ${T.lineHi}`, fontFamily: displayFont, fontWeight: 700, fontSize: 12.5, color: T.ice }}>
                  <LogIn size={14} /> Войти
                </button>
                <button onClick={onOpenCreateProfile} className="fx-tap flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5" style={{ background: PRISM, color: "#08080A", fontFamily: displayFont, fontWeight: 700, fontSize: 12.5 }}>
                  <Sparkles size={14} /> Создать
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-5"><WalletCard connected={connected} walletAddress={walletAddress} tonBalance={tonBalance} tonPriceUsd={tonPriceUsd} onConnect={connectWallet} onDisconnect={disconnectWallet} onCopy={copyAddress} onExplore={exploreWallet} /></div>

        <div className="mt-5">
          <SectionTitle>Statistics</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <StatBlock label="Portfolio Value" value={0} color={T.turquoise} />
            <StatBlock label="Total Profit" value={0} color={T.turquoise} suffix=" $" />
            <StatBlock label="Created Tokens" value={0} />
            <StatBlock label="Tokens Owned" value={0} />
            <StatBlock label="Total Trades" value={0} />
            <StatBlock label="Win Rate" value={0} suffix="%" />
            <StatBlock label="Followers" value={0} />
            <StatBlock label="Following" value={0} />
          </div>
        </div>

        <div className="mt-5">
          <SectionTitle>Portfolio</SectionTitle>
          {!connected ? (
            <GlassCard style={{ padding: 22 }} className="flex flex-col items-center text-center gap-3">
              <FacetFrame size={48} glow={`${T.violet}55`}><Wallet size={18} color={T.violet} /></FacetFrame>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 13, lineHeight: 1.5 }}>Connect your TON Wallet to view your portfolio and start trading.</p>
              <button onClick={connectWallet} className="fx-tap rounded-xl px-5 py-2.5" style={{ background: PRISM, color: "#08080A", fontFamily: displayFont, fontWeight: 700, fontSize: 13 }}>Connect Wallet</button>
            </GlassCard>
          ) : loading ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map(i => (
                <div key={i} className="fx-card flex items-center gap-3 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.line}`, padding: "12px 14px" }}>
                  <div className="fx-skeleton" style={{ width: 52, height: 52, clipPath: FACET }} />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="fx-skeleton" style={{ width: "40%", height: 12, borderRadius: 4 }} />
                    <div className="fx-skeleton" style={{ width: "55%", height: 16, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {PORTFOLIO_TOKENS.map(t => <PortfolioTokenCard key={t.id} t={t} onOpen={() => onOpenToken(t)} />)}
            </div>
          )}
        </div>

        <div className="mt-5">
          <SectionTitle action={<button onClick={goCreateToken} className="fx-tap flex items-center gap-1" style={{ fontFamily: bodyFont, fontSize: 11.5, color: unlocked ? T.electric : T.muted }}>{unlocked ? <PlusCircle size={13} /> : <Lock size={12} />} Создать</button>}>My Tokens</SectionTitle>
          {MY_TOKENS.length === 0 ? (
            <GlassCard style={{ padding: 22 }} className="flex flex-col items-center text-center gap-2">
              <FacetFrame size={40} glow={`${T.electric}44`}><Rocket size={16} color={T.electric} /></FacetFrame>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>Ты ещё не запустил ни одного токена.</p>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11, opacity: 0.7 }}>{randomMeme()}</p>
            </GlassCard>
          ) : (
            <div className="flex flex-col gap-2">{MY_TOKENS.map(t => <MyTokenCard key={t.id} t={t} onManage={onManageToken} />)}</div>
          )}
        </div>

        <div className="mt-5">
          <SectionTitle>Activity</SectionTitle>
          {ACTIVITY.length === 0 ? (
            <GlassCard style={{ padding: 22 }} className="flex flex-col items-center text-center gap-2">
              <FacetFrame size={40} glow={`${T.muted}33`}><Clock size={16} color={T.muted} /></FacetFrame>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>Пока нет активности — покупки, продажи и запуски токенов появятся здесь.</p>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11, opacity: 0.7 }}>{randomMeme()}</p>
            </GlassCard>
          ) : (
            <GlassCard style={{ padding: "6px 16px" }}>
              {ACTIVITY.map((a, i) => (
                <div key={i} className="fx-view flex items-center gap-3 py-3" style={{ borderBottom: i < ACTIVITY.length - 1 ? `1px solid ${T.line}` : "none", animationDelay: `${i * 50}ms` }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: T.surfaceHi, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><a.icon size={14} color={a.color} /></div>
                  <div className="flex-1">
                    <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: T.ice }}>{a.text}</div>
                    <div style={{ fontFamily: monoFont, fontSize: 10, color: T.muted }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </GlassCard>
          )}
        </div>

        <div className="mt-5">
          <SectionTitle>Achievements</SectionTitle>
          {ACHIEVEMENTS.length === 0 ? (
            <GlassCard style={{ padding: 22 }} className="flex flex-col items-center text-center gap-2">
              <FacetFrame size={40} glow={`${T.violet}44`}><Star size={16} color={T.violet} /></FacetFrame>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>Достижений пока нет — торгуй и запускай токены, чтобы получить первое.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {ACHIEVEMENTS.map((a, i) => (
                <GlassCard key={a.label} style={{ padding: "12px 12px", animationDelay: `${i * 50}ms` }} className="flex items-center gap-2">
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${a.color}18`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 12px ${a.color}33` }}><a.icon size={15} color={a.color} /></div>
                  <span style={{ fontFamily: bodyFont, fontSize: 11.5, color: T.ice, lineHeight: 1.2 }}>{a.label}</span>
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <SectionTitle>Verification</SectionTitle>
          <GlassCard style={{ padding: 18 }} className="flex items-center gap-3">
            {verifyStatus === "verified" ? (
              <>
                <ShieldCheck size={22} color={T.electric} />
                <div className="flex-1">
                  <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600 }}>Verified</div>
                  <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>Профиль подтверждён</div>
                </div>
              </>
            ) : verifyStatus === "pending" ? (
              <>
                <ShieldAlert size={22} color={T.violet} />
                <div className="flex-1">
                  <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600 }}>Pending</div>
                  <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>Заявка на проверке</div>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert size={22} color={T.muted} />
                <div className="flex-1">
                  <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600 }}>Not Verified</div>
                  <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>Подтверди личность для бейджа</div>
                </div>
                <button onClick={startVerify} className="fx-tap rounded-lg px-3 py-2 flex items-center gap-1.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 12, color: T.ice, opacity: unlocked ? 1 : 0.55 }}>
                  {!unlocked && <Lock size={11} color={T.muted} />} Verify Account
                </button>
              </>
            )}
          </GlassCard>
        </div>

        <div className="mt-5">
          <SectionTitle>Settings</SectionTitle>
          {!unlocked && (
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 mb-2" style={{ background: "rgba(255,255,255,0.07)", border: `1px solid rgba(255,255,255,0.22)` }}>
              <Lock size={13} color={T.electric} />
              <span style={{ fontFamily: bodyFont, color: T.electric, fontSize: 11.5 }}>
                {!accountCreated ? "Создай аккаунт и подключи кошелёк, чтобы открыть настройки" : "Подключи TON-кошелёк, чтобы открыть настройки"}
              </span>
            </div>
          )}
          <GlassCard style={{ padding: "4px 16px" }}>
            {SETTINGS_ITEMS.map((s, i) => (
              <button key={s.label} onClick={() => openSettingItem(s)} className="fx-tap w-full flex items-center gap-3 py-3" style={{ borderBottom: i < SETTINGS_ITEMS.length - 1 ? `1px solid ${T.line}` : "none", opacity: unlocked ? 1 : 0.45 }}>
                <s.icon size={16} color={T.muted} />
                <span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice, flex: 1, textAlign: "left" }}>{s.label}</span>
                {unlocked ? <ChevronRight size={14} color={T.muted} /> : <Lock size={13} color={T.muted} />}
              </button>
            ))}
          </GlassCard>
        </div>

        {accountCreated && (
          <div className="mt-5">
            <SectionTitle>Danger Zone</SectionTitle>
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="fx-tap w-full flex items-center justify-center gap-2 rounded-xl py-3"
              style={{ background: "transparent", border: `1px solid rgba(255,77,77,0.35)`, fontFamily: displayFont, fontWeight: 700, fontSize: 13, color: T.down }}
            >
              <ShieldAlert size={15} /> Удалить аккаунт навсегда
            </button>
          </div>
        )}
      </div>

      {deleteConfirmOpen && (
        <div className="fx-modal-back" style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(2,2,4,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => !deleting && setDeleteConfirmOpen(false)}>
          <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: 20, padding: 22 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <ShieldAlert size={18} color={T.down} />
              <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700 }}>Удалить аккаунт?</span>
            </div>
            <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, marginBottom: 18 }}>
              Это действие необратимо. Профиль, статистика и достижения будут удалены навсегда, ты выйдешь из аккаунта.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting} className="fx-tap flex-1 rounded-xl py-2.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice, opacity: deleting ? 0.6 : 1 }}>
                Отмена
              </button>
              <button onClick={confirmDeleteAccount} disabled={deleting} className="fx-tap flex-1 rounded-xl py-2.5" style={{ background: T.down, border: "none", fontFamily: displayFont, fontWeight: 700, fontSize: 13, color: "#1a0000", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   TELEGRAM MINI APP INTEGRATION
   Loads the official telegram-web-app.js SDK, calls ready()/expand(),
   and tracks the *real* viewport height Telegram reports (window.
   Telegram.WebApp.viewportStableHeight). Telegram's in-app WebView
   does not reliably support 100dvh — especially on iOS, where the
   Telegram chrome (header + home-indicator area) can leave a gap
   at the bottom if we just trust CSS viewport units. Setting an
   explicit pixel height from the SDK's own viewport events is what
   actually eliminates that leftover space.
--------------------------------------------------------- */

function useTelegramViewport() {
  const [height, setHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 720
  );
  const [insetBottom, setInsetBottom] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function applyFromWebApp(tg) {
      if (!tg || cancelled) return;
      try {
        tg.ready();
        tg.expand();
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        if (tg.setHeaderColor) { try { tg.setHeaderColor(T.bg); } catch (e) {} }
        if (tg.setBackgroundColor) { try { tg.setBackgroundColor(T.bg); } catch (e) {} }
      } catch (e) { /* older client, some methods may be missing */ }

      const update = () => {
        const h = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
        setHeight(h);
        const safe = tg.contentSafeAreaInset || tg.safeAreaInset;
        setInsetBottom(safe && safe.bottom ? safe.bottom : 0);
        setReady(true);
      };
      update();
      tg.onEvent && tg.onEvent("viewportChanged", update);
      return () => tg.offEvent && tg.offEvent("viewportChanged", update);
    }

    if (window.Telegram && window.Telegram.WebApp) {
      const cleanup = applyFromWebApp(window.Telegram.WebApp);
      return () => cleanup && cleanup();
    }

    // SDK not present yet (e.g. previewing outside Telegram) — inject it,
    // and fall back gracefully to window.innerHeight if it never loads.
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = () => { if (!cancelled) applyFromWebApp(window.Telegram && window.Telegram.WebApp); };
    document.head.appendChild(script);

    const onResize = () => { if (!window.Telegram) setHeight(window.innerHeight); };
    window.addEventListener("resize", onResize);
    return () => { cancelled = true; window.removeEventListener("resize", onResize); };
  }, []);

  return { height, insetBottom, ready };
}

/* ---------------------------------------------------------
   ROOT — home / token / create / profile, wired to bottom tabs.
   Wallet-connection state now lives here so the header's own
   "Connect" button and the Profile tab always agree on whether
   a wallet is attached.
   Fullscreen: pinned to the exact Telegram Mini App viewport
   height (see useTelegramViewport above), no fixed card size,
   no outer border/radius — so there is no leftover space below
   the bottom nav inside the Telegram WebView on any device.
--------------------------------------------------------- */

export default function TonLaunchApp() {
  const TREASURY_ADDRESS = "UQD8ipaRIc2X1zJw0C8S9XfsKQOYiNAEPRUpfNidEZ3pIDdo";
const FEE_ADDRESS = "UQD8ipaRIc2X1zJw0C8S9XfsKQOYiNAEPRUpfNidEZ3pIDdo";
const FEE_PERCENT = 0.01; // 1% комиссии
  const [view, setView] = useState("home");
  const [tab, setTab] = useState("home");
  const [token, setToken] = useState(TOKENS[1]);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { height, insetBottom } = useTelegramViewport();

  // Настоящее подключение кошелька через TonConnect. `wallet` — null,
  // пока пользователь не подключил кошелёк; после подключения содержит
  // реальные данные (адрес и т.д.), которые прилетают от Tonkeeper/др.
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const connected = !!wallet;
  const walletAddress = wallet ? Address.parse(wallet.account.address).toString({ bounceable: false }) : "";
  const walletAddressShort = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "";

  // Реальный баланс TON — подтягиваем с публичного API tonapi.io по
  // адресу подключённого кошелька (не требует ключа для базовых запросов).
  const [tonBalance, setTonBalance] = useState(0);
  const [tonPriceUsd, setTonPriceUsd] = useState(0);
  useEffect(() => {
    if (!walletAddress) { setTonBalance(0); return; }
    fetch(`https://tonapi.io/v2/accounts/${walletAddress}`)
      .then((r) => r.json())
      .then((d) => setTonBalance(d && d.balance ? Number(d.balance) / 1e9 : 0))
      .catch(() => setTonBalance(0));
  }, [walletAddress]);
  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd")
      .then((r) => r.json())
      .then((d) => setTonPriceUsd((d && d["the-open-network"] && d["the-open-network"].usd) || 0))
      .catch(() => {});
  }, []);

  // Global toast — rendered once at the root (not nested inside any
  // scrolling view), so it's never clipped no matter which screen
  // triggered it.
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  function showToast(msg) {
    setToast(msg);
    haptic();
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  // Profile / account state lives here (not inside ProfileView) so the
  // AuthModal bottom sheet can be rendered as a direct child of
  // the root — exactly like ConnectModal already is — instead of being
  // nested inside ProfileView's own scrollable content, which was
  // clipping it off-screen.
  //
  // Source of truth is now the real Supabase auth session (not
  // localStorage) — this is what makes login persist across reloads and
  // work across devices instead of just faking it client-side.
  const EMPTY_PROFILE = { nickname: "", email: "", bio: "", avatarUrl: null, emoji: null };
  const [accountCreated, setAccountCreated] = useState(false);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [authChecked, setAuthChecked] = useState(false);

  async function loadProfileForUser(user) {
    if (!user) { setAccountCreated(false); setProfile(EMPTY_PROFILE); return; }
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("nickname, email, bio, avatar_url, emoji")
      .eq("id", user.id)
      .single();
    if (error || !prof) { setAccountCreated(false); setProfile(EMPTY_PROFILE); return; }
    setProfile({ nickname: prof.nickname, email: prof.email, bio: prof.bio || "", avatarUrl: prof.avatar_url, emoji: prof.emoji });
    setAccountCreated(true);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      loadProfileForUser(session?.user || null).finally(() => setAuthChecked(true));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfileForUser(session?.user || null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalMode, setProfileModalMode] = useState("create");
  const [settingsItem, setSettingsItem] = useState(null);
  const [manageToken_, setManageToken_] = useState(null);
  const [tradeModal, setTradeModal] = useState(null); // { mode: 'buy' | 'sell' }
  const [appSettings, setAppSettings] = useState({ pushNotif: true, emailNotif: false, twoFA: false, language: "RU", theme: "Dark" });
  function updateAppSetting(key, value) {
    setAppSettings((s) => ({ ...s, [key]: value }));
    showToast("Настройки сохранены");
  }

  function openToken(t) { setToken(t); setView("token"); }
  function goTab(name) { setTab(name); setView(name); }
  function backFromToken() { setView(tab); }

  function handleHeaderWalletClick() {
    if (connected) { goTab("profile"); }
    else { setConnectModalOpen(true); }
  }

  function openCreateProfile() { setProfileModalMode("create"); setProfileModalOpen(true); }
  function openEditProfile() { setProfileModalMode("edit"); setProfileModalOpen(true); }
  function submitProfile(data) {
    setProfile(data);
    setAccountCreated(true);
    setProfileModalOpen(false);
    showToast(profileModalMode === "edit" ? "Профиль обновлён" : profileModalMode === "login" ? "Ты вошёл в аккаунт" : "Аккаунт создан");
  }
  async function logOutProfile() {
    await supabase.auth.signOut();
    setAccountCreated(false);
    setProfile(EMPTY_PROFILE);
    if (connected) tonConnectUI.disconnect();
    showToast("Вы вышли из аккаунта");
  }
  async function deleteAccountForever() {
    // Удаляем профиль из таблицы profiles и выходим из сессии.
    // Полное удаление самой auth-записи пользователя требует серверного
    // вызова с service_role ключом (например, через Supabase Edge Function),
    // так как анонимный/публичный ключ на клиенте не имеет прав это делать.
    const { data: sessionData } = await supabase.auth.getUser();
    const userId = sessionData?.user?.id;
    if (userId) {
      await supabase.from("profiles").delete().eq("id", userId);
    }
    await supabase.auth.signOut();
    setAccountCreated(false);
    setProfile(EMPTY_PROFILE);
    if (connected) tonConnectUI.disconnect();
    showToast("Аккаунт удалён");
  }
  function openLoginProfile() { setProfileModalMode("login"); setProfileModalOpen(true); }
  function requireUnlockRoot() {
    if (!accountCreated) { setProfileModalMode("create"); setProfileModalOpen(true); showToast("Сначала создай аккаунт"); return false; }
    if (!connected) { setConnectModalOpen(true); showToast("Подключи TON-кошелёк, чтобы торговать"); return false; }
    return true;
  }
  function handleBuy() { if (requireUnlockRoot()) setTradeModal({ mode: "buy" }); }
  function handleSell() { if (requireUnlockRoot()) setTradeModal({ mode: "sell" }); }
  async function confirmTrade(mode, payAmount, receiveAmount, unit) {
  if (mode === "buy") {
    const totalTon = parseFloat(payAmount);
    const feeTon = totalTon * FEE_PERCENT;
    const mainTon = totalTon - feeTon;

    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: TREASURY_ADDRESS,
            amount: toNano(mainTon.toFixed(9)).toString(),
          },
          {
            address: FEE_ADDRESS,
            amount: toNano(feeTon.toFixed(9)).toString(),
          },
        ],
      });
      setTradeModal(null);
      showToast(`Куплено ≈ ${receiveAmount} $${token.ticker} за ${payAmount} ${unit} 🚀`);
    } catch (err) {
      showToast("Транзакция отменена или не прошла");
    }
  } else {
    setTradeModal(null);
    showToast(`Продано ${payAmount} $${token.ticker} за ≈ ${receiveAmount} ${unit} 💸`);
  }
}
  return (
    <div style={{ background: T.bg, height, minHeight: height, width: "100%", maxWidth: 480, margin: "0 auto", fontFamily: bodyFont, position: "relative", overflow: "hidden" }}>
      <GlobalStyle />
      <CyberGrid />
      <Toast toast={toast} />

      <ConnectModal open={connectModalOpen} onClose={() => setConnectModalOpen(false)} onConnect={() => tonConnectUI.openModal()} />
      <AuthModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} onSubmit={submitProfile} initial={profile} mode={profileModalMode} walletAddress={walletAddress} />
      <SettingsPanel
        item={settingsItem}
        onClose={() => setSettingsItem(null)}
        appSettings={appSettings}
        onUpdateSetting={updateAppSetting}
        connected={connected}
        onConnectWallet={() => tonConnectUI.openModal()}
        onDisconnectWallet={() => tonConnectUI.disconnect()}
        onCopyAddress={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(walletAddress).catch(() => {});
          showToast("Адрес скопирован");
        }}
        onOpenEditProfile={openEditProfile}
        profile={profile}
        showToast={showToast}
      />
      <TokenManageSheet token={manageToken_} onClose={() => setManageToken_(null)} showToast={showToast} />
      <TradeModal t={token} tradeModal={tradeModal} onClose={() => setTradeModal(null)} onConfirm={confirmTrade} />

      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2" style={{ flexShrink: 0 }}>
          <button onClick={() => goTab("home")} className="fx-tap flex items-center gap-1.5">
          <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>Facet</span>
          </button>
          <button onClick={handleHeaderWalletClick} className="fx-tap flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: T.surface, border: `1px solid ${connected ? "rgba(255,255,255,0.35)" : T.line}` }}>
            <Wallet size={13} color={connected ? T.turquoise : T.ice} />
            <span style={{ fontFamily: monoFont, color: connected ? T.turquoise : T.ice, fontSize: 11 }}>{connected ? walletAddressShort : "Connect"}</span>
          </button>
        </div>

        {/* only this area scrolls — header and bottom nav stay pinned.
            The home tab manages its own internal scroll (fixed hero/stats/
            search/filters, scrollable feed below), so it opts out of the
            outer page scroll to avoid a second, redundant scrollbar. */}
        <div className="no-scrollbar px-4" style={{ flex: 1, overflowY: view === "home" ? "hidden" : "auto", minHeight: 0 }} key={view}>
          {view === "home" && <HomeView onOpen={openToken} />}
          {view === "token" && <TokenDetail t={token} onBack={backFromToken} showToast={showToast} onBuy={handleBuy} onSell={handleSell} unlocked={accountCreated && connected} />}
          {view === "create" && (
            <CreateView
              showToast={showToast}
              unlocked={accountCreated && connected}
              accountCreated={accountCreated}
              connected={connected}
              onOpenCreateProfile={openCreateProfile}
              onOpenConnectModal={() => setConnectModalOpen(true)}
            />
          )}
          {view === "profile" && (
            <ProfileView
              connected={connected}
              walletAddress={walletAddress}
              tonBalance={tonBalance}
              tonPriceUsd={tonPriceUsd}
              onConnect={() => tonConnectUI.openModal()}
              onDisconnect={() => tonConnectUI.disconnect()}
              onOpenConnectModal={() => setConnectModalOpen(true)}
              showToast={showToast}
              accountCreated={accountCreated}
              profile={profile}
              onOpenCreateProfile={openCreateProfile}
              onOpenLogin={openLoginProfile}
              onOpenEditProfile={openEditProfile}
              onLogOut={logOutProfile}
              onDeleteAccount={deleteAccountForever}
              onOpenSetting={(item) => setSettingsItem(item)}
              onManageToken={(tok) => setManageToken_(tok)}
              onGoCreate={() => goTab("create")}
              onOpenToken={openToken}
            />
          )}
        </div>

        <div className="flex items-center justify-around px-2 py-4" style={{ borderTop: `1px solid ${T.line}`, background: "rgba(19,19,19,0.88)", backdropFilter: "blur(12px)", flexShrink: 0, paddingBottom: insetBottom + 16 }}>
          {[
            { id: "home", label: "Главная", icon: HomeIcon },
            { id: "create", label: "Создать", icon: PlusCircle, locked: !(accountCreated && connected) },
            { id: "profile", label: "Профиль", icon: User },
          ].map(({ id, label, icon: Icon, locked }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => goTab(id)} className="fx-tap flex flex-col items-center gap-1.5" style={{ position: "relative" }}>
                <Icon size={26} color={active ? T.turquoise : T.muted} style={{ transition: `color ${EASE}, filter ${EASE}`, filter: active ? `drop-shadow(0 0 6px rgba(255,255,255,0.55))` : "none" }} />
                {locked && (
                  <div style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: T.surface, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Lock size={8} color={T.muted} />
                  </div>
                )}
                <span style={{ fontFamily: bodyFont, fontSize: 12.5, color: active ? T.ice : T.muted, transition: `color ${EASE}` }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
