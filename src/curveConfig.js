// Параметры бондинг-кривой и сборка сообщений к ней.
//
// Кривая — это рынок токена, запущенного в приложении: она сама вторая
// сторона сделки, поэтому торговать можно с первой секунды, не дожидаясь,
// пока кто-то заведёт ликвидность. Исходник контракта и объяснение
// формулы — в contracts/README.md.
//
// src/contracts/BondingCurve.ts сгенерирован компилятором Tact из
// contracts/src/bonding_curve.tact и содержит код контракта вместе с
// точной раскладкой init-данных. Править его руками нельзя — он
// перегенерируется командой `npm run build` в папке contracts и
// копируется сюда.

import { Address, beginCell, toNano } from "@ton/core";
import { BondingCurve, storeBuy, storeSetJettonWallet } from "./contracts/BondingCurve";

// Одни и те же числа должны стоять и в деплое, и в предпросчёте цены в
// интерфейсе, иначе показанное «вы получите» разойдётся с тем, что
// реально вернёт контракт.
// Числа подобраны так, чтобы полная распродажа доступного выпуска
// собрала около 1515 TON — столько нужно на заведение пары на DEX.
// Потолок сбора считается как virtualTon × tokensForSale ÷
// (virtualTokens − tokensForSale): при этих значениях выходит ровно
// 1515. Порог выпуска чуть ниже потолка, иначе он был бы недостижим —
// контракт такое сочетание отвергает при создании.
export const CURVE_PARAMS = {
  virtualTon: toNano("291.217"),
  virtualTokens: toNano("1073000000"),
  tokensForSale: toNano("900000000"),
  graduationTon: toNano("1500"),
  // Ноль: покупка и продажа идут без комиссии платформы, поэтому первый
  // покупатель, продав всё обратно, получает ровно внесённое за вычетом
  // сетевого газа. Убрать газ нельзя — его берёт сеть, не мы.
  // Платформа при этом ничего не зарабатывает на сделках; заработок
  // остаётся только на выпуске токена, когда кривая доходит до порога.
  feeBps: 0n,
};

// Весь выпуск токена. Чеканится целиком и целиком уходит на кривую:
// tokensForSale она продаёт, остаток (100 млн) держит до выпуска на DEX
// и отправляет его вместе с собранными TON — из этой пары и собирается
// ликвидность. Раньше чеканился только торговый запас, поэтому общее
// предложение выходило 900 млн вместо миллиарда.
export const CURVE_TOTAL_SUPPLY = toNano("1000000000");

// Контракт удерживает это из каждой покупки на газ: перевод жетонов
// покупателю, отправку комиссии и собственное хранение. Значение обязано
// совпадать с GasBuyOverhead в bonding_curve.tact.
export const CURVE_GAS_BUY_OVERHEAD = toNano("0.12");

// Сколько прикладывать к переводу жетонов при продаже, чтобы кошелёк
// кривой успел прислать ей уведомление. Без forwardTonAmount уведомление
// не отправляется вовсе, и жетоны просто осядут на кривой.
export const CURVE_SELL_FORWARD_TON = toNano("0.08");
export const CURVE_SELL_VALUE = toNano("0.2");

const SELL_OP = 0x53454c4c; // "SELL"

// Адрес кривой считается детерминированно из её параметров, поэтому
// известен ещё до развёртывания — это позволяет в одной транзакции и
// создать жетон, и сразу отправить весь запас на будущий кошелёк кривой.
export async function curveContract({ admin, jettonMaster, feeWallet, graduationDestination }) {
  return await BondingCurve.fromInit(
    typeof admin === "string" ? Address.parse(admin) : admin,
    typeof jettonMaster === "string" ? Address.parse(jettonMaster) : jettonMaster,
    typeof feeWallet === "string" ? Address.parse(feeWallet) : feeWallet,
    typeof graduationDestination === "string" ? Address.parse(graduationDestination) : graduationDestination,
    CURVE_PARAMS.virtualTon,
    CURVE_PARAMS.virtualTokens,
    CURVE_PARAMS.tokensForSale,
    CURVE_PARAMS.graduationTon,
    CURVE_PARAMS.feeBps,
  );
}

export function buildBuyBody({ queryId = 0n, minTokensOut = 0n } = {}) {
  const builder = beginCell();
  storeBuy({ $$type: "Buy", queryId, minTokensOut })(builder);
  return builder.endCell();
}

export function buildSetJettonWalletBody(wallet) {
  const builder = beginCell();
  storeSetJettonWallet({
    $$type: "SetJettonWallet",
    wallet: typeof wallet === "string" ? Address.parse(wallet) : wallet,
  })(builder);
  return builder.endCell();
}

// Полезная нагрузка продажи. Стандарт кладёт forwardPayload как
// Either Cell ^Cell, поэтому перед содержимым идёт бит-признак — кривая
// читает его первым. Без нагрузки продажа тоже пройдёт, просто без
// защиты от проскальзывания.
export function buildSellPayload(minTonOut = 0n) {
  return beginCell()
    .storeBit(false)
    .storeUint(SELL_OP, 32)
    .storeCoins(minTonOut)
    .endCell();
}

// --- предпросчёт цены на клиенте -------------------------------------
// Повторяет математику контракта один в один, включая направление
// округления: контракт округляет в свою пользу, и предпросмотр обязан
// показывать то же самое, иначе сделка будет отклоняться по minTokensOut.

export function tokensOutFor({ realTon, tokensSold }, tonIn) {
  if (tonIn <= 0n) return 0n;
  const tonReserve = CURVE_PARAMS.virtualTon + realTon;
  const tokenReserve = CURVE_PARAMS.virtualTokens - tokensSold;
  const k = tonReserve * tokenReserve;
  const out = tokenReserve - k / (tonReserve + tonIn);
  return out > 0n ? out : 0n;
}

export function tonOutFor({ realTon, tokensSold }, tokensIn) {
  if (tokensIn <= 0n) return 0n;
  const tonReserve = CURVE_PARAMS.virtualTon + realTon;
  const tokenReserve = CURVE_PARAMS.virtualTokens - tokensSold;
  const k = tonReserve * tokenReserve;
  const newTokenReserve = tokenReserve + tokensIn;
  const newTonReserve = (k + newTokenReserve - 1n) / newTokenReserve;
  const out = tonReserve - newTonReserve;
  return out > 0n ? out : 0n;
}

// Цена одного токена в TON при текущем состоянии кривой.
export function curvePriceTon({ realTon, tokensSold }) {
  const tonReserve = CURVE_PARAMS.virtualTon + realTon;
  const tokenReserve = CURVE_PARAMS.virtualTokens - tokensSold;
  if (tokenReserve <= 0n) return 0;
  return Number(tonReserve) / Number(tokenReserve);
}
