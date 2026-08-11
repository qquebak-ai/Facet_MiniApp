import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search, Flame, TrendingUp, Clock, Sparkles, ArrowUpRight, ArrowDownRight,
  Wallet, Home as HomeIcon, PlusCircle, User, ChevronLeft, Share2, Star,
  ShieldCheck, ShieldAlert, Globe, Globe2, Send, Twitter, Image as ImageIcon, Upload,
  Copy, ExternalLink, LogOut, ChevronRight, ChevronDown, Rocket, MoreHorizontal, HeartCrack,
  Settings as SettingsIcon, Lock, Gift, LifeBuoy,
  FileText, CheckCircle2, RefreshCw, X,
  Eye, EyeOff, LogIn, ShoppingBag, Trash2, Crown
} from "lucide-react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Address, beginCell, toNano } from "@ton/core";
import { supabase } from "./supabaseClient";
import {
  CURVE_PARAMS,
  CURVE_TOTAL_SUPPLY,
  curveParamsOf,
  tokensOutFor,
  tonOutFor,
  curvePriceTon,
  buildBuyBody,
  buildSellPayload,
  CURVE_GAS_BUY_OVERHEAD,
  CURVE_SELL_FORWARD_TON,
  CURVE_SELL_VALUE,
} from "./curveConfig";
import { launchRealToken } from "./tonLaunch";
/* ---------------------------------------------------------
   DESIGN TOKENS — shared by every screen (Home, Token, Create, Profile)
--------------------------------------------------------- */

const DARK_THEME = {
  bg: "#000000",
  surface: "#0A0A0B",
  surfaceHi: "#121214",
  line: "#1C1C1F",
  lineHi: "#28282C",
  ice: "#FFFFFF",
  paper: "#EAEAEA",
  muted: "#7C828B",
  electric: "#FF6B35",
  turquoise: "#FF6B35",
  violet: "#FF6B35",
  rose: "#7C828B",
  up: "#38D39F",
  down: "#FF4D5A",
  warning: "#F5B041",
};

/* White theme: same structural logic, inverted — a paper-white canvas,
   near-black ink, identical Ember accent so the brand reads the same in
   either mode. Kept flat (no translucency), same reason as Dark below. */
const WHITE_THEME = {
  bg: "#FAFAF9",
  surface: "#FFFFFF",
  surfaceHi: "#F2F1EE",
  line: "#E4E2DD",
  lineHi: "#D4D1CA",
  ice: "#14151A",
  paper: "#14151A",
  muted: "#6B6F76",
  electric: "#FF6B35",
  turquoise: "#FF6B35",
  violet: "#FF6B35",
  rose: "#6B6F76",
  up: "#1C9A6C",
  down: "#D93A49",
  warning: "#C77A16",
};

const THEMES = { Dark: DARK_THEME, White: WHITE_THEME };

/* hexA(hex, alpha) -> "rgba(r,g,b,alpha)". Lets glow/ring/shadow effects
   that used to be hardcoded to white (e.g. "rgba(255,255,255,0.3)")
   instead track whatever the current theme's accent or ink color is,
   so they still make sense once the palette flips. */
function hexA(hex, alpha) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* T is intentionally a mutable object (not reassigned) so that every
   component in this file — which reads T.xxx directly at render time —
   picks up new colors the instant the theme changes, without needing to
   thread theme props through the whole tree. applyTheme() mutates T's
   own keys in place; React's normal re-render (triggered by the
   appSettings state update in App()) then repaints everything with the
   fresh values. glow(alpha) is the accent-based replacement for the old
   hardcoded white glows; ink(alpha) is the same idea for structural
   (grid line / vignette) effects that used to assume a dark backdrop. */
let T = { ...DARK_THEME };
function applyTheme(mode) {
  Object.assign(T, THEMES[mode] || DARK_THEME);
  PRISM = mode === "White" ? LIGHT_PRISM : DARK_PRISM;
  PRISM_TEXT = "#0D1117";
}
function glow(alpha) { return hexA(T.turquoise, alpha); }
function ink(alpha) { return hexA(T.ice, alpha); }


/* ---------------------------------------------------------
   LANGUAGE / TRANSLATIONS
   Same pattern as the theme above: `lang` is a mutable module
   variable, t(key) looks a string up in the current language and
   falls back to Russian (then to the key itself) if missing.
   setLang() just updates the variable — the actual re-paint happens
   because changing appSettings.language re-renders the whole tree.
--------------------------------------------------------- */
let lang = "RU";
function setLang(v) { lang = v === "EN" ? "EN" : "RU"; }

const STR = {
  RU: {
    navHome: "Главная", navMempad: "Мемпад", navCreate: "Создать", navProfile: "Профиль", navShop: "Магазин",
    shopTitle: "Магазин", shopComingSoon: "Магазин скоро откроется. Загляни позже — здесь появится что-то интересное.",
    shopIntro: "Рамки для аватарки и карточки профиля. Нажми, чтобы примерить — применится сразу.",
    tgAuthTitle: "Вход через Telegram",
    tgAuthCta: "Войти через Telegram",
    tgAuthHint: "Аккаунт создастся из твоего профиля Telegram — почта и пароль не нужны.",
    tgAuthOutside: "Открой приложение внутри Telegram, чтобы войти.",
    tgAuthFailed: "Не удалось войти через Telegram. Попробуй ещё раз.",
    tgAuthNotConfigured: "Вход через Telegram пока не настроен на сервере.",
    bootStepAuth: "Вход в аккаунт", bootStepFeed: "Лента покупок",
    bootStepTokens: "Токены сообщества", bootStepRate: "Курс TON",
    shopTabFrames: "Рамки", shopTabCards: "Карточки",
    shopEquip: "Надеть", shopEquipped: "Надето",
    cosmeticApplied: "Применено", cosmeticRemoved: "Снято", connected: "Подключён",
    settingsSaved: "Настройки сохранены",
    langTitle: "Язык", themeTitle: "Оформление", themeWhite: "Светлая",
    langFullNote: "Интерфейс переведён на выбранный язык.",
    buy: "Купить", sell: "Продать", cancel: "Отмена", confirm: "Подтвердить", following: "Вы подписаны", share: "Поделиться", disconnectWallet: "Отключить кошелёк",
    disconnectShort: "Отключить", tonExplorerBtn: "Обозреватель TON", walletProvider: "Кошелёк",
    connectWallet: "Подключить TON-кошелёк",
    editProfile: "Редактировать профиль", deleteAccount: "Удалить аккаунт",
    settings: "Настройки", security: "Безопасность",
    wallet: "Кошелёк", profileSettings: "Профиль", referral: "Реферальная программа",
    privacy: "Конфиденциальность", terms: "Условия использования", support: "Поддержка",
    launchPreparing: "Подготовка метаданных…",
    launchGenerating: "Генерация токена…",
    launchDeploying: "Деплой…",
    launchConfirming: "Подтверждение…",
    launchSuccessSub: "Токен успешно выпущен и готов к торгам",
    tokenCreatedStatus: "Токен создан",
    contractAddress: "Адрес контракта",
    totalSupply: "Общий выпуск",
    initialBuy: "Стартовая покупка",
    doneClose: "Готово",
    launchingWait: "Не закрывай экран, это займёт пару секунд…",
    heroTitle: "Начни уже сейчас",
    heroBodyLead: "Создавай, торгуй и расти с ",
    heroBodyTail: " на сделку. Присоединяйся к экосистеме с первого дня.",
    heroFee: "комиссией 1%",
    mempadSpotlight: "В центре внимания",
    mempadLaunchToken: "Запустить токен",
    tickerBought: "купил", tickerSold: "продал",
    sinceSec: "с", sinceMin: "м", sinceHour: "ч", mempadFilterNew: "Новые", mempadFilterHot: "Горячие", mempadFilterBluming: "В росте", mempadFilterDex: "DEX", homeActionLaunch: "Создать токен", homeActionMempad: "Мемпад", homeActionWallet: "Кошелёк",
    homeUpdatesComingSoon: "Здесь скоро появятся новости и обновления платформы.",
    emptyFilter: "По этому фильтру пока пусто — попробуй другой или загляни позже.", catMemes: "Мемы", catUtility: "Утилиты", catGames: "Игры", catAI: "AI", catSocial: "Соц",
    linkCopied: "Ссылка скопирована",
    tokenLinkCopied: "Ссылка на токен скопирована",
    reportSent: "Жалоба отправлена на проверку",
    back: "Назад",
    perToken: "/ токен",
    chartLoading: "загрузка графика…", chartNoData: "Истории торгов пока нет", ohlcHigh: "В", ohlcLow: "Н", ohlcClose: "З",
    statPrice: "Цена", statLiquidity: "Ликвидность", statHolders: "Держателей", statVolume24h: "Объём 24ч",
    trustTitle: "Проверка токена",
    trustCreatorHolds: "У создателя на руках",
    trustCreatorBought: "Купил при запуске",
    trustSold: "Создатель уже продавал",
    trustNotSold: "Создатель ничего не продавал",
    trustHolders: "Держателей",
    trustUnknown: "Нет данных: токен запущен до этой проверки",
    trustOfSupply: "% выпуска",
    gradTitle: "До листинга на бирже",
    gradLeft: "осталось {left} TON",
    gradDone: "Кривая закрыта — токен уходит на биржу",
    gradNote: "Когда в кривой наберётся {target} TON, торговля здесь закроется. Собранные TON и оставшийся выпуск уйдут на кошелёк площадки — из них заводится пара на бирже.",
    gradClosedTitle: "Кривая закрыта",
    gradClosedBody: "Токен набрал {target} TON. Здесь он больше не торгуется: ликвидность уходит на биржу, дальше торговля идёт там.",
    tabChart: "График", tabInfo: "Инфо", tabTx: "Транзакции", chartModePrice: "Цена",
    tokenNoAddress: "Адрес недоступен",
    txUnavailable: "Список транзакций пока недоступен для этого пула",
    txEmpty: "По этому пулу пока нет сделок",
    balanceLoading: "Баланс ещё загружается — секунду",
    infoEmpty: "У этого токена пока нет описания и ссылок",
    launchBuyCta: "Купить свой токен",
    creatorLabel: "Создатель", creatorYou: "Это ты",
    creatorTokens: "Его токены", creatorNoTokens: "Пока не запускал токены",
    profileNotFound: "Профиль не найден",
    followCta: "Подписаться", unfollowCta: "Вы подписаны",
    followedToast: "Подписка оформлена", unfollowedToast: "Подписка отменена",
    followFailed: "Не получилось — попробуй ещё раз",
    txLoadFailed: "Не удалось загрузить сделки — обновим через несколько секунд",
    aboutToken: "О токене",
    youPay: "Вы платите", youSell: "Вы продаёте", youReceive: "Вы получите",
    available: "Доступно",
    insufficientFunds: "Недостаточно средств для этой суммы",
    slippage: "Проскальзывание",
    rate: "Курс",
    networkFee: "Комиссия сети",
    minReceive: "Мин. получите (с учётом slippage)",
    buyFor: "Купить за", sellFor: "Продать",
    rateLoading: "Загрузка курса…",
    nothingToSell: "Нечего продавать",
    enterAmount: "Введите сумму",
    logoUploaded: "Логотип загружен",
    bannerUploaded: "Баннер загружен",
    cropImageTitle: "Обрежь изображение",
    cropConfirm: "Применить",
    logoRequired: "Загрузи логотип токена — это обязательно",
    nameTickerRequired: "Укажи название и тикер токена",
    descRequiredWarning: "Опиши токен — после запуска описание изменить будет нельзя",
    buyAmountRequired: "Укажи сумму для запуска — на неё будут выкуплены первые токены",
    initialBuyHint: "На эту сумму ты выкупишь первые токены в той же транзакции — размер покупки и задаёт стартовую цену.",
    buyAmountTooLow: "Минимальная сумма запуска — ${min} (≈{tons} TON)",
    deleteToken: "Удалить токен из списка",
    confirmDelete: "Точно удалить?",
    clearAllTokens: "Очистить тестнет",
    deleteFailedToast: "Не удалось удалить — попробуйте ещё раз",
    tokenCreatedToast: "Токен {name} (${ticker}) создан ✅",
    padClosedTitle: "Мемпад закрыт",
    padClosedBody: "Чтобы запускать токены, сначала создай аккаунт и подключи TON-кошелёк — эмиссия подтверждается им напрямую.",
    createAccount: "Создать аккаунт",
    connectWalletCta: "Подключить кошелёк",
    launchTokenTitle: "Запусти токен",
    launchTokenSub: "Эмиссия происходит в сети TON сразу после подтверждения",
    logoLabel: "Логотип",
    logoShort: "Лого",
    bannerOptional: "Баннер 1200×400 (необязательно)",
    logoRequiredShort: "Логотип обязателен",
    nameLabel: "Название",
    tickerLabel: "Тикет",
    descLabel: "Описание",
    descPlaceholder: "О чём этот токен и почему он появился",
    descRequiredShort: "Описание обязательно — после запуска изменить его будет нельзя",
    siteLabel: "Сайт",
    launchAmountLabel: "Сумма для запуска (TON)",
    launchAmountNote: "На эту сумму сразу после запуска будут выкуплены первые токены — это стартовая ликвидность и первая цена токена.",
    youWillGet: "Ты получишь ≈",
    supplyShare: "выпуска",
    connectToConfirm: "Подключи кошелёк TON, чтобы подтвердить эмиссию",
    launchTokenCta: "Запустить токен",
    connectWalletNote: "Подключи TON-кошелёк, чтобы видеть портфель и торговать. Поддерживаются Tonkeeper, MyTonWallet, Tonhub, OpenMask и другие TON Connect-кошельки.",
    liqShort: "Ликв", volShort: "Об.", holdersShort: "держателей", maxLabel: "МАКС",
    wrongCurrentPin: "Неверный текущий PIN-код",
    pinMismatch: "PIN-коды не совпадают, начни заново",
    pinEnterCurrent: "Введи текущий PIN-код",
    pinEnterNew: "Придумай новый PIN-код",
    pinConfirmNew: "Повтори новый PIN-код",
    greetingBack: "С возвращением",
    greetingHi: "Привет, {name}",
    pinContinueNote: "Введи PIN-код, чтобы продолжить",
    pinForgot: "Забыл(а) PIN-код?",
    walletRequiredNote: "Покупка, продажа и запуск токенов доступны после подключения кошелька.",
    refCodeCopied: "Ссылка приглашения скопирована",
    refInvited: "Приглашено",
    refShare: "Поделиться ссылкой",
    refShareText: "Запускай мемкоины на TON вместе со мной в Mintly",
    editProfileDesc: "Никнейм, аватар, почта и описание профиля.",
    pinRow: "PIN-код",
    pinRowSub: "Запрашивать код при каждом открытии Mintly",
    enablePinFirst: "Сначала включи PIN-код",
    changePinCta: "Сменить PIN-код",
    referralDesc: "Приглашай друзей — получай % от их комиссий за сделки.",
    supportDesc: "Ответим в течение суток в Telegram-поддержке.",
    contactSupport: "Написать в поддержку",
    copyLink: "Скопировать ссылку",
    privacyText: "Мы собираем только данные, необходимые для работы приложения: никнейм, адрес кошелька и историю сделок внутри Mintly. Данные не передаются третьим лицам в рекламных целях. Ты можешь удалить аккаунт в любой момент — все локальные данные профиля будут стёрты немедленно.",
    accountLabel: "Аккаунт",
    loginTab: "Войти", createTab: "Создать аккаунт",
    changeAvatarHint: "Нажми, чтобы заменить",
    editHint: "Никнейм обязателен, остальное можно заполнить позже.",
    loginHint: "Войди в свой аккаунт по почте и паролю.",
    createHint: "Никнейм, почта и пароль обязательны, остальное можно заполнить позже.",
    nicknameLabel: "Никнейм",
    nicknameError: "2–20 символов, только латинские буквы, цифры, _ и ., начинается с буквы",
    bioLabel: "О себе (необязательно)",
    bioPlaceholder: "Пара слов о себе",
    submittingText: "Проверяем...",
    saveChanges: "Сохранить изменения",
    createAccountShort: "Создать",
    firstAccountFirst: "Сначала создай аккаунт",
    connectWalletContinue: "Подключи TON-кошелёк, чтобы продолжить",
    walletConnectedToast: "Кошелёк подключён",
    walletDisconnectedToast: "Кошелёк отключён",
    addressCopied: "Адрес скопирован",
    verifyRequestSent: "Заявка отправлена на проверку",
    profileVerified: "Профиль верифицирован",
    logOutShort: "Выйти",
    bioEmptyPlaceholder: "Расскажи о себе — это увидят другие в комментариях и профиле токенов.",
    memberSince: "с сегодняшнего дня",
    accountNotCreated: "Аккаунт не создан",
    accountNotCreatedBody: "Войди в свой аккаунт или создай новый, чтобы запускать токены, торговать и собирать достижения.",
    loginCta: "Войти",
    myTokensCreate: "Создать",
    myTokensTitle: "Мои токены",
    unnamedToken: "Токен без названия",
    noTokensYet: "Ты ещё не запустил ни одного токена.",
    noActivityYet: "Пока нет активности — покупки, продажи и запуски токенов появятся здесь.",
    profileConfirmed: "Профиль подтверждён",
    verifyPending: "Заявка на проверке",
    verifyCta: "Подтверди личность для бейджа",
    deleteAccountForever: "Удалить аккаунт навсегда",
    editProfileBtn: "Редактировать профиль",
    statsTitle: "Статистика",
    statTotalProfit: "Общая прибыль",
    statCreatedTokens: "Создано токенов",
    statTokensOwned: "Токенов в портфеле",
    statTotalTrades: "Всего сделок",
    statFollowers: "Подписчики",
    statFollowing: "Подписки",
    portfolioTitle: "Портфель",
    portfolioConnectBody: "Подключи TON-кошелёк, чтобы видеть портфель и начать торговать.",
    activityTitle: "Активность",
    achievementsTitle: "Достижения",
    achUnlockedOf: "{done} из {total}",
    achievementsIntro: "За простые достижения открываются рамки и карточки из магазина.",
    achProgress: "Прогресс",
    achRewardOpened: "Открыто",
    achRewardLocked: "Награда",
    achGoShop: "Открыть магазин",
    achAll: "Все",
    shopLocked: "Предмет откроется за достижение",
    achFirstLaunch: "Первый запуск", achFirstLaunchHint: "Запустить свой первый токен",
    wreathBadgeTitle: "Знак создателя", wreathClose: "Закрыть",
    verifiedBadgeTitle: "Подтверждённый аккаунт",
    verifiedBadgeBody: "Приложение проверило, что этот профиль принадлежит своему владельцу.",
    wreathBadgeBody: "Выдан за то, что токен этого человека дорос до капитализации {sum}.",
    wreathTier1: "Первая тысяча", wreathTier2: "Десять тысяч", wreathTier3: "Сто тысяч",
    achMcap1k: "Первая тысяча", achMcap1kHint: "Довести свой токен до $1K капитализации",
    achMcap10k: "Десять тысяч", achMcap10kHint: "Довести свой токен до $10K капитализации",
    achMcap100k: "Сто тысяч", achMcap100kHint: "Довести свой токен до $100K капитализации",
    achWallet: "Кошелёк на месте", achWalletHint: "Подключить кошелёк TON",
    achFace: "Лицо профиля", achFaceHint: "Поставить аватарку и написать о себе",
    achStyle: "Со вкусом", achStyleHint: "Надеть рамку и карточку из магазина",
    achInvite1: "Первый приглашённый", achInvite1Hint: "Пригласить друга по своей ссылке",
    achInvite5: "Свой круг", achInvite5Hint: "Пригласить пятерых",
    achInvite10: "Десятка", achInvite10Hint: "Пригласить десятерых",
    achInvite25: "Сарафанное радио", achInvite25Hint: "Пригласить двадцать пять человек",
    verificationTitle: "Верификация",
    verifiedStatus: "Подтверждён",
    pendingStatus: "На проверке",
    notVerifiedStatus: "Не подтверждён",
    verifyAccountBtn: "Подтвердить аккаунт",
    marketCapLabel: "Маркеткап",
    manageBtn: "Управлять",
    connectWalletModalTitle: "Подключи TON-кошелёк, чтобы продолжить",
    deleteAccountQ: "Удалить аккаунт?",
    deleteAccountBody: "Это действие необратимо. Профиль, статистика и достижения будут удалены навсегда, ты выйдешь из аккаунта.",
    deletingText: "Удаляем...",
    deleteShort: "Удалить",
    themeChangedWhite: "Тема изменена: Белая",
    themeChangedDark: "Тема изменена: Тёмная",
    launchFailedTitle: "Не удалось запустить токен",
    retry: "Повторить",
    viewOnExplorer: "Открыть в обозревателе",
    pinChanged: "PIN-код изменён",
    pinEnabled: "PIN-код включён",
    pinDisabled: "PIN-код отключён",
    pinResetToast: "PIN-код сброшен — включи новый в настройках безопасности",
    profileUpdated: "Профиль обновлён",
    loggedIn: "Ты вошёл в аккаунт",
    accountCreatedToast: "Аккаунт создан",
    loggedOut: "Вы вышли из аккаунта",
    accountDeleted: "Аккаунт удалён",
    connectWalletTrade: "Подключи TON-кошелёк, чтобы торговать",
    rateLoadingRetry: "Курс TON ещё загружается, попробуй через секунду",
    insufficientTon: "Недостаточно TON на кошельке для этой суммы",
    boughtToast: "Куплено ≈ {receive} ${ticker} за {pay} {unit}",
    txCancelled: "Транзакция отменена или не прошла",
    insufficientSellAmount: "Недостаточно токенов для продажи этой суммы",
    connectWalletSell: "Подключи TON-кошелёк, чтобы продать",
    soldToast: "Продано {pay} ${ticker} за ≈ {receive} {unit} 💸",
    authErrAlreadyRegistered: "Эта почта уже зарегистрирована — попробуй вкладку «Войти»",
    authErrInvalidCreds: "Неверная почта или пароль",
    authErrNotConfirmed: "Подтверди почту по ссылке из письма перед входом",
    authErrPasswordShort: "Пароль должен быть не короче 6 символов",
    authErrNicknameTaken: "Никнейм \"{name}\" уже занят",
    authErrGeneric: "Что-то пошло не так, попробуй ещё раз",
    authErrAvatarUpload: "Не удалось загрузить аватар: {msg}",
  },
  EN: {
    navHome: "Home", navMempad: "Mempad", navCreate: "Create", navProfile: "Profile", navShop: "Shop",
    shopTitle: "Shop", shopComingSoon: "The shop is coming soon. Check back later — something interesting will show up here.",
    shopIntro: "Avatar frames and profile cards. Tap one to try it — it applies right away.",
    tgAuthTitle: "Sign in with Telegram",
    tgAuthCta: "Sign in with Telegram",
    tgAuthHint: "Your account is created from your Telegram profile — no email, no password.",
    tgAuthOutside: "Open the app inside Telegram to sign in.",
    tgAuthFailed: "Telegram sign-in failed. Try again.",
    tgAuthNotConfigured: "Telegram sign-in is not configured on the server yet.",
    bootStepAuth: "Signing in", bootStepFeed: "Buy feed",
    bootStepTokens: "Community tokens", bootStepRate: "TON rate",
    shopTabFrames: "Frames", shopTabCards: "Cards",
    shopEquip: "Equip", shopEquipped: "Equipped",
    cosmeticApplied: "Applied", cosmeticRemoved: "Removed", connected: "Connected",
    settingsSaved: "Settings saved",
    langTitle: "Language", themeTitle: "Appearance", themeWhite: "White",
    langFullNote: "The interface is translated into the selected language.",
    buy: "Buy", sell: "Sell", cancel: "Cancel", confirm: "Confirm", following: "Following", share: "Share", disconnectWallet: "Disconnect wallet",
    disconnectShort: "Disconnect", tonExplorerBtn: "TON Explorer", walletProvider: "Wallet",
    connectWallet: "Connect TON Wallet",
    editProfile: "Edit profile", deleteAccount: "Delete account",
    settings: "Settings", security: "Security",
    wallet: "Wallet", profileSettings: "Profile", referral: "Referral program",
    privacy: "Privacy", terms: "Terms of use", support: "Support",
    launchPreparing: "Preparing metadata…",
    launchGenerating: "Generating token…",
    launchDeploying: "Deploying…",
    launchConfirming: "Confirming…",
    launchSuccessSub: "Your token has been created and is ready to trade",
    tokenCreatedStatus: "Token Created",
    contractAddress: "Contract address",
    totalSupply: "Total supply",
    initialBuy: "Initial buy",
    doneClose: "Done",
    launchingWait: "Don't close this screen, this'll just take a second…",
    heroTitle: "Start right now",
    heroBodyLead: "Create, trade and grow with ",
    heroBodyTail: " per trade. Join the ecosystem from day one.",
    heroFee: "a 1% fee",
    mempadSpotlight: "Spotlight",
    mempadLaunchToken: "Launch token",
    tickerBought: "bought", tickerSold: "sold",
    sinceSec: "s", sinceMin: "m", sinceHour: "h", mempadFilterNew: "New", mempadFilterHot: "Hot", mempadFilterBluming: "Bluming", mempadFilterDex: "DEX", homeActionLaunch: "Launch token", homeActionMempad: "Mempad", homeActionWallet: "Wallet",
    homeUpdatesComingSoon: "News and platform updates are coming here soon.",
    emptyFilter: "Nothing here for this filter yet — try another or check back later.", catMemes: "Memes", catUtility: "Utility", catGames: "Games", catAI: "AI", catSocial: "Social",
    linkCopied: "Link copied",
    tokenLinkCopied: "Token link copied",
    reportSent: "Report sent for review",
    back: "Back",
    perToken: "/ token",
    chartLoading: "loading chart…", chartNoData: "No trading history yet", ohlcHigh: "H", ohlcLow: "L", ohlcClose: "C",
    statPrice: "Price", statLiquidity: "Liquidity", statHolders: "Holders", statVolume24h: "24h Volume",
    trustTitle: "Token check",
    trustCreatorHolds: "Creator still holds",
    trustCreatorBought: "Bought at launch",
    trustSold: "The creator has sold",
    trustNotSold: "The creator has not sold",
    trustHolders: "Holders",
    trustUnknown: "No data: launched before this check existed",
    trustOfSupply: "% of supply",
    gradTitle: "Until the exchange listing",
    gradLeft: "{left} TON to go",
    gradDone: "Curve closed — the token is heading to an exchange",
    gradNote: "Once the curve holds {target} TON, trading here closes. The collected TON and the remaining supply go to the platform wallet — the exchange pair is created from them.",
    gradClosedTitle: "Curve closed",
    gradClosedBody: "The token reached {target} TON. It no longer trades here: the liquidity is moving to an exchange, and trading continues there.",
    tabChart: "Chart", tabInfo: "Info", tabTx: "Transactions", chartModePrice: "Price",
    tokenNoAddress: "Address unavailable",
    txUnavailable: "Transaction list isn't available for this pool yet",
    txEmpty: "No trades on this pool yet",
    balanceLoading: "Still loading your balance — one moment",
    infoEmpty: "This token has no description or links yet",
    launchBuyCta: "Buy your token",
    creatorLabel: "Creator", creatorYou: "That's you",
    creatorTokens: "Their tokens", creatorNoTokens: "No tokens launched yet",
    profileNotFound: "Profile not found",
    followCta: "Follow", unfollowCta: "Following",
    followedToast: "Followed", unfollowedToast: "Unfollowed",
    followFailed: "Didn't work — try again",
    txLoadFailed: "Couldn't load trades — retrying in a few seconds",
    aboutToken: "About the token",
    youPay: "You pay", youSell: "You sell", youReceive: "You receive",
    available: "Available",
    insufficientFunds: "Not enough funds for this amount",
    slippage: "Slippage",
    rate: "Rate",
    networkFee: "Network fee",
    minReceive: "Min. received (incl. slippage)",
    buyFor: "Buy for", sellFor: "Sell",
    rateLoading: "Loading rate…",
    nothingToSell: "Nothing to sell",
    enterAmount: "Enter amount",
    logoUploaded: "Logo uploaded",
    bannerUploaded: "Banner uploaded",
    cropImageTitle: "Crop image",
    cropConfirm: "Apply",
    logoRequired: "Upload a token logo — it's required",
    nameTickerRequired: "Enter a token name and ticker",
    descRequiredWarning: "Describe the token — the description can't be changed after launch",
    buyAmountRequired: "Enter an amount for the launch — it buys the first tokens",
    initialBuyHint: "Buys the first tokens in the same transaction — the size of this buy sets the starting price.",
    buyAmountTooLow: "Minimum launch amount is ${min} (≈{tons} TON)",
    deleteToken: "Delete token from list",
    confirmDelete: "Delete for sure?",
    clearAllTokens: "Clear testnet",
    deleteFailedToast: "Couldn't delete — try again",
    tokenCreatedToast: "Token {name} (${ticker}) created ✅",
    padClosedTitle: "Memepad closed",
    padClosedBody: "To launch tokens, first create an account and connect a TON wallet — the mint is confirmed directly through it.",
    createAccount: "Create account",
    connectWalletCta: "Connect wallet",
    launchTokenTitle: "Launch a token",
    launchTokenSub: "Minting happens on the TON network right after confirmation",
    logoLabel: "Logo",
    logoShort: "Logo",
    bannerOptional: "Banner 1200×400 (optional)",
    logoRequiredShort: "Logo is required",
    nameLabel: "Name",
    tickerLabel: "Ticker",
    descLabel: "Description",
    descPlaceholder: "What this token is about and why it exists",
    descRequiredShort: "Description is required — it can't be changed after launch",
    siteLabel: "Website",
    launchAmountLabel: "Launch amount (TON)",
    launchAmountNote: "This amount buys the first tokens right after launch — it's the starting liquidity and initial price.",
    youWillGet: "You'll get ≈",
    supplyShare: "of supply",
    connectToConfirm: "Connect a TON wallet to confirm the mint",
    launchTokenCta: "Launch token",
    connectWalletNote: "Connect a TON wallet to see your portfolio and trade. Tonkeeper, MyTonWallet, Tonhub, OpenMask and other TON Connect wallets are supported.",
    liqShort: "Liq", volShort: "Vol", holdersShort: "holders", maxLabel: "MAX",
    wrongCurrentPin: "Wrong current PIN",
    pinMismatch: "PINs don't match, try again",
    pinEnterCurrent: "Enter your current PIN",
    pinEnterNew: "Choose a new PIN",
    pinConfirmNew: "Repeat the new PIN",
    greetingBack: "Welcome back",
    greetingHi: "Hi, {name}",
    pinContinueNote: "Enter your PIN to continue",
    pinForgot: "Forgot PIN?",
    walletRequiredNote: "Buying, selling and launching tokens are available once a wallet is connected.",
    refCodeCopied: "Invite link copied",
    refInvited: "Invited",
    refShare: "Share the link",
    refShareText: "Launch memecoins on TON with me on Mintly",
    editProfileDesc: "Nickname, avatar, email and profile bio.",
    pinRow: "PIN code",
    pinRowSub: "Require a code every time Mintly opens",
    enablePinFirst: "Enable PIN code first",
    changePinCta: "Change PIN code",
    referralDesc: "Invite friends — earn a % of their trading fees.",
    supportDesc: "We'll reply within a day on Telegram support.",
    contactSupport: "Message support",
    copyLink: "Copy link",
    privacyText: "We only collect data needed to run the app: nickname, wallet address, and your trade history within Mintly. Data is never shared with third parties for advertising. You can delete your account at any time — all local profile data is erased immediately.",
    accountLabel: "Account",
    loginTab: "Log in", createTab: "Create account",
    changeAvatarHint: "Tap to replace",
    editHint: "Nickname is required, everything else can be filled in later.",
    loginHint: "Log in to your account with email and password.",
    createHint: "Nickname, email and password are required, everything else can be filled in later.",
    nicknameLabel: "Nickname",
    nicknameError: "2–20 characters, Latin letters, digits, _ and . only, must start with a letter",
    bioLabel: "Bio (optional)",
    bioPlaceholder: "A few words about yourself",
    submittingText: "Checking...",
    saveChanges: "Save changes",
    createAccountShort: "Create",
    firstAccountFirst: "Create an account first",
    connectWalletContinue: "Connect a TON wallet to continue",
    walletConnectedToast: "Wallet connected",
    walletDisconnectedToast: "Wallet disconnected",
    addressCopied: "Address copied",
    verifyRequestSent: "Request sent for review",
    profileVerified: "Profile verified",
    logOutShort: "Log out",
    bioEmptyPlaceholder: "Tell others about yourself — it'll show in comments and token profiles.",
    memberSince: "since today",
    accountNotCreated: "No account yet",
    accountNotCreatedBody: "Log in or create an account to launch tokens, trade and earn achievements.",
    loginCta: "Log in",
    myTokensCreate: "Create",
    myTokensTitle: "My Tokens",
    unnamedToken: "Unnamed Token",
    noTokensYet: "You haven't launched any tokens yet.",
    noActivityYet: "No activity yet — buys, sells and launches will show up here.",
    profileConfirmed: "Profile verified",
    verifyPending: "Review pending",
    verifyCta: "Verify your identity for a badge",
    deleteAccountForever: "Delete account forever",
    editProfileBtn: "Edit Profile",
    statsTitle: "Statistics",
    statTotalProfit: "Total Profit",
    statCreatedTokens: "Created Tokens",
    statTokensOwned: "Tokens Owned",
    statTotalTrades: "Total Trades",
    statFollowers: "Followers",
    statFollowing: "Following",
    portfolioTitle: "Portfolio",
    portfolioConnectBody: "Connect your TON Wallet to view your portfolio and start trading.",
    activityTitle: "Activity",
    achievementsTitle: "Achievements",
    achUnlockedOf: "{done} of {total}",
    achievementsIntro: "Simple achievements unlock frames and cards from the shop.",
    achProgress: "Progress",
    achRewardOpened: "Unlocked",
    achRewardLocked: "Reward",
    achGoShop: "Open shop",
    achAll: "All",
    shopLocked: "This item unlocks with an achievement",
    achFirstLaunch: "First launch", achFirstLaunchHint: "Launch your first token",
    wreathBadgeTitle: "Creator badge", wreathClose: "Close",
    verifiedBadgeTitle: "Verified account",
    verifiedBadgeBody: "The app confirmed this profile belongs to its owner.",
    wreathBadgeBody: "Awarded for taking their token to a {sum} market cap.",
    wreathTier1: "First thousand", wreathTier2: "Ten thousand", wreathTier3: "Hundred thousand",
    achMcap1k: "First thousand", achMcap1kHint: "Take one of your tokens to a $1K market cap",
    achMcap10k: "Ten thousand", achMcap10kHint: "Take one of your tokens to a $10K market cap",
    achMcap100k: "Hundred thousand", achMcap100kHint: "Take one of your tokens to a $100K market cap",
    achWallet: "Wallet ready", achWalletHint: "Connect a TON wallet",
    achFace: "A face to the name", achFaceHint: "Add an avatar and a bio",
    achStyle: "Good taste", achStyleHint: "Equip a frame and a card from the shop",
    achInvite1: "First invite", achInvite1Hint: "Invite a friend with your link",
    achInvite5: "Your crowd", achInvite5Hint: "Invite five people",
    achInvite10: "Ten strong", achInvite10Hint: "Invite ten people",
    achInvite25: "Word of mouth", achInvite25Hint: "Invite twenty five people",
    verificationTitle: "Verification",
    verifiedStatus: "Verified",
    pendingStatus: "Pending",
    notVerifiedStatus: "Not Verified",
    verifyAccountBtn: "Verify Account",
    marketCapLabel: "Market Cap",
    manageBtn: "Manage",
    connectWalletModalTitle: "Connect your TON Wallet to continue",
    deleteAccountQ: "Delete account?",
    deleteAccountBody: "This action is irreversible. Your profile, stats and achievements will be permanently deleted, and you'll be signed out.",
    deletingText: "Deleting...",
    deleteShort: "Delete",
    themeChangedWhite: "Theme changed: White",
    themeChangedDark: "Theme changed: Dark",
    launchFailedTitle: "Couldn't launch the token",
    retry: "Retry",
    viewOnExplorer: "View on explorer",
    pinChanged: "PIN changed",
    pinEnabled: "PIN enabled",
    pinDisabled: "PIN disabled",
    pinResetToast: "PIN reset — enable a new one in security settings",
    profileUpdated: "Profile updated",
    loggedIn: "You're logged in",
    accountCreatedToast: "Account created",
    loggedOut: "You've logged out",
    accountDeleted: "Account deleted",
    connectWalletTrade: "Connect a TON wallet to trade",
    rateLoadingRetry: "TON rate is still loading, try again in a second",
    insufficientTon: "Not enough TON in wallet for this amount",
    boughtToast: "Bought ≈ {receive} ${ticker} for {pay} {unit}",
    txCancelled: "Transaction cancelled or failed",
    insufficientSellAmount: "Not enough tokens to sell this amount",
    connectWalletSell: "Connect a TON wallet to sell",
    soldToast: "Sold {pay} ${ticker} for ≈ {receive} {unit} 💸",
    authErrAlreadyRegistered: "This email is already registered — try the \"Log in\" tab",
    authErrInvalidCreds: "Invalid email or password",
    authErrNotConfirmed: "Confirm your email via the link in the message before logging in",
    authErrPasswordShort: "Password must be at least 6 characters",
    authErrNicknameTaken: "Nickname \"{name}\" is already taken",
    authErrGeneric: "Something went wrong, try again",
    authErrAvatarUpload: "Couldn't upload avatar: {msg}",
  },
};
function t(key) {
  return (STR[lang] && STR[lang][key]) || STR.RU[key] || key;
}
/* Many components use `t` as a prop name for "token", which shadows the
   global t() translation function inside their scope. tr()/trf() are
   plain aliases to t()/tf() for use inside exactly those components. */
function tr(key) { return t(key); }
function trf(key, vars) { return tf(key, vars); }
/* tf: same as t() but substitutes {placeholders} with values from vars,
   e.g. tf("greetingHi", { name: "Leo" }) -> "Привет, Leo" / "Hi, Leo" */
function tf(key, vars) {
  let s = t(key);
  Object.keys(vars || {}).forEach((k) => { s = s.replace(new RegExp(`\\{${k}\\}`, "g"), vars[k]); });
  return s;
}

/* Flat, not gradient — the brief is explicit that the accent should read
   as confident and solid, not decorative. Both themes share one Ember so
   the brand doesn't shift when the user switches appearance. */
const DARK_PRISM = "#FF6B35";
const LIGHT_PRISM = "#FF6B35";
let PRISM = DARK_PRISM;
let PRISM_TEXT = "#0D1117"; // Midnight ink reads best set on solid Ember in both themes
const FACET = "polygon(18% 0%, 100% 0%, 100% 82%, 82% 100%, 0% 100%, 0% 18%)";

/* Editorial serif for display type (hero numbers, page titles, section
   titles) paired with Inter for everything functional — body copy, labels,
   controls. Loaded via GlobalStyle's @import below. Numeric/on-chain data
   (prices, addresses, hashes) keeps a monospace face, which is the one
   place a "technical" register is appropriate and expected. */
const displayFont = "'Futura XP', 'Futura', 'Century Gothic', 'Segoe UI', sans-serif";
const bodyFont = "'Futura XP', 'Futura', 'Century Gothic', -apple-system, sans-serif";
const monoFont = "'Futura XP', 'Futura', 'Century Gothic', 'Courier New', monospace";

/* Motion stays quiet: no overshoot/bounce, 200–300ms, ease-out. */
const SPRING = "240ms cubic-bezier(0.16, 1, 0.3, 1)";
const EASE = "240ms cubic-bezier(0.16, 1, 0.3, 1)";
/* PRESS is what makes taps feel instant: near-zero delay, ease-out-in curve,
   used only on :active. SPRING/EASE above stay for the release/bounce-back
   so the button snaps down immediately and eases back out smoothly. */
const PRESS = "70ms cubic-bezier(0.4, 0, 1, 1)";

function fmtUSD(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
/* generateFakeContractAddress — purely cosmetic, client-side only.
   Produces a string shaped like a real TON address (EQ-prefixed,
   base64url alphabet, 48 chars) so the mock "success" screen looks
   legitimate. This is NEVER sent anywhere, checked against any chain,
   or used to construct a real transaction — it exists only to be
   displayed and copied by the user in this local simulation. */
function generateFakeContractAddress() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let body = "";
  for (let i = 0; i < 46; i++) body += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `EQ${body}`;
}

/* generateFakeTxHash — same idea as above, shaped like a TON transaction
   hash (64 hex chars). Cosmetic only, generated entirely client-side. */
function generateFakeTxHash() {
  const hex = "0123456789abcdef";
  let h = "";
  for (let i = 0; i < 64; i++) h += hex[Math.floor(Math.random() * hex.length)];
  return h;
}

function fmtPrice(p) {
  return "$" + p.toFixed(p < 0.001 ? 6 : 4);
}
function fmtCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v) => String(v).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* ---------------------------------------------------------
   LIVE PULSE — a single shared interval drives every sparkline in
   the app (feed cards, portfolio rows) instead of each card running
   its own timer, which is what would actually cause scroll jank with
   a long list. Components subscribe with useLiveTick() and read the
   current phase; the ticker itself auto-pauses when the tab/app is
   backgrounded (screen off / switched away) so it doesn't burn
   battery or CPU for nothing.
--------------------------------------------------------- */
let livePulse = 0;
const livePulseSubs = new Set();
if (typeof window !== "undefined" && typeof document !== "undefined") {
  let pulseIv = null;
  const startPulse = () => {
    if (pulseIv) return;
    pulseIv = setInterval(() => {
      livePulse += 1;
      livePulseSubs.forEach((fn) => fn(livePulse));
    }, 2000);
  };
  const stopPulse = () => { if (pulseIv) { clearInterval(pulseIv); pulseIv = null; } };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPulse(); else startPulse();
  });
  startPulse();
}
function useLiveTick() {
  const [tick, setTick] = useState(livePulse);
  useEffect(() => {
    livePulseSubs.add(setTick);
    return () => livePulseSubs.delete(setTick);
  }, []);
  return tick;
}
/* Отклик на нажатие. Внутри Telegram просим у него — это родная
   вибрация клиента, и на iPhone работает только она: navigator.vibrate
   там не поддерживается вовсе, поэтому раньше на айфоне отклика не было
   нигде. Снаружи Telegram остаётся обычный вибромотор. */
function haptic(kind = "light") {
  if (typeof window === "undefined") return;
  const h = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback;
  try {
    if (h) {
      if ((kind === "error" || kind === "success" || kind === "warning") && h.notificationOccurred) {
        h.notificationOccurred(kind);
        return;
      }
      if (h.impactOccurred) { h.impactOccurred(kind); return; }
    }
  } catch (e) { /* старый клиент Telegram — метода может не быть */ }
  try {
    if (navigator.vibrate) navigator.vibrate(kind === "error" ? 40 : 12);
  } catch (e) { /* вибрация запрещена настройками */ }
}

// Local, per-device reaction counters (⭐/🔥/💔 on the token screen).
// There's no social backend here, so these are honestly just "how many
// times you tapped this on this device" — persisted so it survives a
// reload, not a fake global community count.
function useLocalCounter(storageKey, capAtOne = false) {
  const [count, setCount] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        return parseInt(window.localStorage.getItem(storageKey) || "0", 10) || 0;
      }
    } catch (e) { /* localStorage unavailable */ }
    return 0;
  });
  function bump() {
    setCount(prev => {
      if (capAtOne && prev >= 1) return prev;
      const next = prev + 1;
      try { if (typeof window !== "undefined") window.localStorage.setItem(storageKey, String(next)); } catch (e) { /* unavailable */ }
      return next;
    });
  }
  return [count, bump];
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
      /* Futura XP isn't a webfont available from a CDN — this relies on it
         being installed locally (or falls back to Futura / Century Gothic,
         the closest common system fonts) rather than fetching a Google
         Fonts family that's no longer used anywhere in the app. */
      html, body, #root { height: 100%; margin: 0; padding: 0; background: ${T.bg}; -webkit-tap-highlight-color: transparent; }
      /* Страница зафиксирована: сам документ не прокручивается и не
         оттягивается резинкой, иначе в Telegram из-под приложения
         вылезают чёрные поля сверху и снизу. Прокрутка живёт только
         внутри контентных контейнеров ниже. */
      html { overflow: hidden; overscroll-behavior: none; }
      body { position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; overscroll-behavior: none; }
      * { -webkit-tap-highlight-color: transparent; }
      /* Щипок двумя пальцами ломал вёрстку: интерфейс рассчитан на
         ширину экрана и при масштабировании разъезжается. Одного
         user-scalable=no в мета-теге мало — iOS его игнорирует, поэтому
         жест масштабирования гасится и на уровне стилей. Этим же
         правилом отключается и приближение по двойному тапу: любое
         значение кроме auto его снимает. Гасить двойной тап вручную,
         отменяя touchend, нельзя — вместе с ним отменяется и нажатие. */
      html, body { touch-action: pan-x pan-y; }
      /* iOS Safari (incl. Telegram's in-app WebView) auto-zooms the whole
         viewport when a focused input/textarea/select has a computed
         font-size under 16px. Forcing a 16px floor here — on top of the
         per-field fontSize already set to 16 in the Field component —
         is what actually stops the screen from zooming in while typing. */
      input, textarea, select { font-size: 16px; }
      @keyframes fadeInUp { from{opacity:0; transform:translateY(12px);} to{opacity:1; transform:translateY(0);} }
      @keyframes spin360 { from{ transform: rotate(0deg); } to{ transform: rotate(360deg); } }
      @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
      @keyframes scaleIn { from{opacity:0; transform:scale(0.92);} to{opacity:1; transform:scale(1);} }
      @keyframes gridDrift { from{background-position:0 0,0 0;} to{background-position:140px 140px,140px 140px;} }
      @keyframes starTwinkle { 0%,100%{opacity:.2;} 50%{opacity:1;} }
      @keyframes starPulse { 0%,100%{opacity:0;} 50%{opacity:var(--o);} }
      @keyframes gridRunToward { from{ background-position: 0 0, 0 0; } to{ background-position: 0 44px, 0 0; } }
      @keyframes spotlightSweep { 0%{ transform: translateX(-120%); } 55%,100%{ transform: translateX(320%); } }
      @keyframes candleBreathe { 0%,100%{ transform: scaleY(0.72); } 50%{ transform: scaleY(1); } }
      @keyframes tickerSwap { 0%{opacity:0; transform:translateY(6px);} 12%,88%{opacity:1; transform:translateY(0);} 100%{opacity:0; transform:translateY(-6px);} }
      @media (prefers-reduced-motion: reduce) {
        [data-bg-fx] * { animation: none !important; }
      }
      @keyframes starDriftRight { from{ transform: translateX(-24px); } to{ transform: translateX(560px); } }
      @keyframes starDriftLeft { from{ transform: translateX(560px); } to{ transform: translateX(-24px); } }
      @keyframes glowPulse { 0%,100%{opacity:.35;} 50%{opacity:.75;} }
      @keyframes shimmer { from{background-position:-300px 0;} to{background-position:300px 0;} }
      @keyframes textSweep { 0%{background-position:150% 0;} 100%{background-position:-150% 0;} }
      .fx-shine-text {
        background-image: linear-gradient(100deg, ${T.turquoise} 0%, ${T.turquoise} 40%, #ffffff 50%, ${T.turquoise} 60%, ${T.turquoise} 100%);
        background-size: 220% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: textSweep 5s linear infinite;
      }
      @keyframes mcapGlow { 0%,100%{text-shadow:0 0 10px currentColor,0 0 2px currentColor;} 50%{text-shadow:0 0 18px currentColor,0 0 4px currentColor;} }
      @keyframes ringPulse { 0%{box-shadow:0 0 0 0 ${glow(0.35)};} 100%{box-shadow:0 0 0 14px ${glow(0)};} }
      /* Появляется на месте — только проявлением и лёгким укрупнением,
         без наезда сверху. Уходит вверх и растворяется. */
      /* Лист падает сверху вниз, покачиваясь и поворачиваясь, и
         растворяется на обоих концах пути — так не видно, как он
         возвращается наверх.
         Углы поворота приходят переменными, чтобы каждый лист летел
         по-своему, а само правило было одно на всех. */
      @keyframes leafFall {
        0%   { transform: translate3d(0, -14vh, 0) rotate(var(--r0)); opacity: 0; }
        8%   { opacity: var(--o); }
        88%  { opacity: var(--o); }
        100% { transform: translate3d(var(--dx), 104vh, 0) rotate(var(--r1)); opacity: 0; }
      }
      @keyframes islandGlow { 0%,100%{ opacity:0.75; } 50%{ opacity:1; } }
      /* Окно знака: сам венок медленно вырастает, и только потом
         проявляется подпись — сначала показываем награду, потом
         объясняем её. Лист поднимается снизу вместе со шторкой. */
      @keyframes wreathSheetUp {
        from { opacity: 0; transform: translateY(28px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes wreathGrowIn {
        0%   { opacity: 0; transform: scale(0.34); }
        60%  { opacity: 1; }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes wreathCaptionIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      /* Венок создателя: листья колышутся, как от ветра. Не маятник из
         двух положений — тот читается как подёргивание, — а неровная
         волна: сильный порыв, откат, слабое качание, снова порыв. Углы
         остаются небольшими: знак висит рядом с ником, и заметное
         движение там раздражало бы. */
      @keyframes wreathSway {
        0%   { transform: rotate(-1.8deg); }
        22%  { transform: rotate(1.9deg); }
        41%  { transform: rotate(-0.6deg); }
        58%  { transform: rotate(1.1deg); }
        76%  { transform: rotate(-2.1deg); }
        100% { transform: rotate(-1.8deg); }
      }
      @keyframes wreathStar {
        0%, 100% { opacity: 0.75; transform: scale(0.94); }
        50%      { opacity: 1;    transform: scale(1.06); }
      }
      /* Обрамление проявляется, а не возникает рывком: его показывают
         после заставки, и резкое появление читалось бы как подёргивание. */
      @keyframes frameFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes frameFadeOut { from { opacity: 1; } to { opacity: 0; } }
      /* Пролёт ракеты по кнопке запуска: справа налево, с паузой между
         заходами. Поворот на 135 градусов — картинка нарисована носом
         вверх-вправо, а лететь она должна носом вперёд, то есть влево. */
      @keyframes buttonRocketFly {
        0%   { transform: translateX(220px) rotate(-135deg); opacity: 0; }
        6%   { opacity: 1; }
        34%  { opacity: 1; }
        40%  { transform: translateX(-40px) rotate(-135deg); opacity: 0; }
        100% { transform: translateX(-40px) rotate(-135deg); opacity: 0; }
      }
      /* Реакция острова на прилёт ракеты: две искры бегут от середины
         нижней грани в разные стороны, встречаются наверху, и после
         этого вспыхивает и плавно гаснет весь контур. Смещение штриха
         отрицательное у обеих: каждая идёт по своему пути, а он уже
         задан в нужную сторону. */
      /* Искры гаснут ровно в момент встречи наверху: дальше горит уже
         весь контур, и две яркие точки поверх него читались бы как
         забытый на месте след. */
      @keyframes islandSparkRun {
        0%   { stroke-dashoffset: 0; opacity: 1; }
        94%  { opacity: 1; }
        100% { stroke-dashoffset: -500; opacity: 0; }
      }
      @keyframes islandRingBurst {
        0%   { opacity: 0; filter: drop-shadow(0 0 0 ${T.electric}); }
        3%   { opacity: 1; }
        16%  { opacity: 1; filter: drop-shadow(0 0 20px ${T.electric}); }
        100% { opacity: 0; filter: drop-shadow(0 0 0 ${T.electric}); }
      }
      /* Ракета: строго снизу вверх по центру, к концу — уменьшение и
         растворение внутри острова. Конечная точка приходит переменной
         --fly-to. Сама картинка нарисована носом вверх-вправо, поэтому
         разворачивается на 45 градусов — иначе при вертикальном полёте
         она шла бы боком. */
      @keyframes rocketFly {
        0%   { transform: translate(-50%, calc(100vh + 150px)) rotate(-45deg); opacity: 0; }
        7%   { opacity: 1; }
        /* До самого конца летит в полную величину: уменьшать её на
           подлёте незачем, гаснет она у самой рамки. */
        88%  { transform: translate(-50%, calc(var(--fly-to) + 46px)) rotate(-45deg); opacity: 1; }
        100% { transform: translate(-50%, var(--fly-to)) rotate(-45deg); opacity: 0; }
      }
      @keyframes toastIn { from{opacity:0; transform:translateX(-50%) scale(0.94);} to{opacity:1; transform:translateX(-50%) scale(1);} }
      @keyframes toastOut { from{opacity:1; transform:translateX(-50%) translateY(0) scale(1);} to{opacity:0; transform:translateX(-50%) translateY(-22px) scale(0.98);} }
      @keyframes rocketUp { 0%{ transform:translateY(0) scale(0.75); opacity:0; } 18%{ opacity:0.9; } 100%{ transform:translateY(-70px) scale(1); opacity:0; } }
      @keyframes emberFall { 0%{ transform:translateY(-4px) scale(0.5); opacity:0; } 15%{ opacity:0.9; } 75%{ opacity:0.55; } 100%{ transform:translateY(60px) scale(1.1); opacity:0; } }
      @keyframes candleGrow { from{ transform:scaleY(0); opacity:0; } to{ transform:scaleY(1); opacity:1; } }
      @keyframes spotlightRotate { from{ transform: rotate(0deg); } to{ transform: rotate(360deg); } }
      @keyframes spotlightRotateRev { from{ transform: rotate(360deg); } to{ transform: rotate(0deg); } }
      @keyframes spotlightPulse { 0%,100%{ opacity:0.45; transform:scale(1); } 50%{ opacity:0.85; transform:scale(1.06); } }
      @keyframes spotlightOrbit { from{ transform: rotate(0deg) translateX(var(--orbit-r)) rotate(0deg); } to{ transform: rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg); } }
      @keyframes shake { 0%,100%{ transform:translateX(0); } 20%{ transform:translateX(-8px); } 40%{ transform:translateX(8px); } 60%{ transform:translateX(-6px); } 80%{ transform:translateX(6px); } }
      @keyframes heroRocketFlame { 0%,100%{ opacity:0.55; transform: scaleY(0.85) scaleX(0.9); } 50%{ opacity:1; transform: scaleY(1.15) scaleX(1.05); } }
      @keyframes heroRocketFloat { 0%,100%{ transform: translateY(0) rotate(-3deg); } 50%{ transform: translateY(-5px) rotate(3deg); } }
      @keyframes widgetSparkRise { 0%{ transform:translateY(0) scale(0.7); opacity:0; } 15%{ opacity:0.9; } 85%{ opacity:0.5; } 100%{ transform:translateY(-130px) scale(1.05); opacity:0; } }
      button { touch-action: manipulation; cursor: pointer; }
      /* Заполнение backwards, а не both, и никаких will-change.
         Оставленная после анимации трансформация делает элемент
         системой отсчёта для своего содержимого, и WebKit рисует
         текстовую каретку внутри полей мимо строки — на айфоне она
         уезжала под поле. Конечный кадр здесь и так совпадает с обычным
         состоянием, так что визуально ничего не меняется. */
      .fx-card { animation: fadeInUp 480ms cubic-bezier(0.16,1,0.3,1) backwards; transition: transform ${SPRING}, border-color ${EASE}, box-shadow ${EASE}; }
      .fx-card:active { transform: scale(0.98); transition: transform ${PRESS}; }
      /* Только для настоящей мыши. На тач-экране :hover прилипает после
         касания и не снимается до тапа в стороне, а !important перебивал
         рамку выбранного предмета — выделение выглядело залипшим. */
      @media (hover: hover) and (pointer: fine) {
        .fx-card:not(.fx-picked):hover { border-color: ${T.lineHi}; }
      }
      /* Рамка выбора рисуется тенью, а не border: она не входит в поток и
         не заставляет пересчитывать раскладку карточки при переключении. */
      .fx-picked { border-color: ${T.electric} !important; box-shadow: 0 0 0 1.5px ${T.electric}; }
      .fx-tap { transition: transform ${SPRING}; }
      .fx-tap:active { transform: scale(0.96); transition: transform ${PRESS}; }
      .fx-view { animation: fadeInUp 320ms cubic-bezier(0.16,1,0.3,1) backwards; }
      .fx-skeleton { background: linear-gradient(90deg, ${T.surface} 25%, ${T.surfaceHi} 37%, ${T.surface} 63%); background-size: 400px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fx-chip { transition: border-color ${EASE}, background ${EASE}, color ${EASE}, transform ${SPRING}; }
      .fx-chip:active { transition: border-color ${EASE}, background ${EASE}, color ${EASE}, transform ${PRESS}; }
      .fx-modal-back { animation: fadeIn 220ms ease-out both; }
      .fx-modal-card { animation: scaleIn 260ms cubic-bezier(0.16,1,0.3,1) backwards; }
      .fx-avatar { transition: transform ${SPRING}; }
      .fx-avatar:active { transform: scale(0.96); transition: transform ${PRESS}; }
      .cta-launch { transition: transform ${SPRING}, opacity ${EASE}; }
      .cta-launch:hover { opacity: 0.92; }
      .cta-launch:active { transform: scale(0.98); transition: transform ${PRESS}; }
      .tf-btn { transition: background ${EASE}, color ${EASE}, transform ${SPRING}; }
      .tf-btn:active { transform: scale(0.92); transition: background ${EASE}, color ${EASE}, transform ${PRESS}; }
      /* none, а не contain: contain лишь запрещает утянуть за собой окно,
         но сам список всё равно отскакивает на резинке — и над контентом
         засвечивается фон. none убирает и отскок тоже. */
      .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; overscroll-behavior: none; }
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

/* Три породы листьев для фона: клён, дуб и мята. Контуры построены по
   опорным точкам и зеркальны относительно черешка, поэтому лист не
   «косит» на одну сторону. Прожилки рисуются цветом фона: на почти
   прозрачном листе они не подсвечивают, а прорезают его, и деталь
   видно, не поднимая яркость. */
const LEAF_KINDS = [
  // клён
  {
    // Край не гладкий, а бугристый — как у листа мяты. Бугры посчитаны
    // по прежнему ровному контуру: он разложен по длине на одинаковые
    // куски, и каждый выгнут наружу. У самых острых мест выгиб гаснет,
    // иначе кончики лопастей заплывали бы.
    outline: "M 0.0 -1.0 Q 1.4 -1.0 2.6 -2.9 Q 4.2 -3.1 5.5 -4.2 Q 7.8 -3.6 8.5 -5.3 Q 9.3 -5.4 9.1 -6.7 Q 8.7 -6.4 6.3 -8.3 Q 7.1 -8.5 6.8 -9.8 Q 9.6 -9.5 9.8 -10.8 Q 12.7 -11.0 12.7 -12.2 Q 13.2 -12.5 11.9 -13.2 Q 11.9 -13.5 8.8 -14.1 Q 8.8 -14.7 5.9 -15.3 Q 7.1 -16.4 6.7 -17.2 Q 9.2 -19.0 8.9 -19.5 Q 10.3 -21.1 10.2 -21.8 Q 9.5 -22.8 7.1 -22.4 Q 6.2 -23.8 4.0 -23.2 Q 3.5 -25.3 2.6 -26.0 Q 2.0 -28.8 1.0 -28.7 Q 0.0 -29.5 -1.0 -28.7 Q -2.0 -28.8 -2.6 -26.0 Q -3.5 -25.3 -4.0 -23.2 Q -6.2 -23.8 -7.1 -22.4 Q -9.5 -22.8 -10.2 -21.8 Q -10.3 -21.1 -8.9 -19.5 Q -9.2 -19.0 -6.7 -17.2 Q -7.1 -16.4 -5.9 -15.3 Q -8.8 -14.7 -8.8 -14.1 Q -11.9 -13.5 -11.9 -13.2 Q -13.2 -12.5 -12.7 -12.2 Q -12.7 -11.0 -9.8 -10.8 Q -9.6 -9.5 -6.8 -9.8 Q -7.1 -8.5 -6.3 -8.3 Q -8.7 -6.4 -9.1 -6.7 Q -9.3 -5.4 -8.5 -5.3 Q -7.8 -3.6 -5.5 -4.2 Q -4.2 -3.1 -2.6 -2.9 Q -1.4 -1.0 0.0 -1.0 Z",
    stem: "M 0 -1 Q 0.4 1.6 0.2 4.6",
    // Одна сплошная жилковая система: средняя жилка идёт от черешка
    // до вершины, а боковые отходят от неё — и начинаются ровно в
    // точке на ней, первым куском вдоль неё, поэтому стык не виден.
    // Веером из одной точки лист в мелком размере собирался в тёмное
    // пятно у основания.
    veins: [
      "M 0 -1.40 Q 0.60 -15.40 0 -27.40",
      "M 0.14 -5 Q 5.30 -7.37 9.40 -5.90",
      "M -0.14 -5 Q -5.3 -7.37 -9.4 -5.90",
      "M 0.25 -9.60 Q 7.03 -12.26 12.50 -12",
      "M -0.25 -9.60 Q -7.03 -12.26 -12.5 -12",
      "M 0.30 -15 Q 5.52 -18.26 9.80 -20.50",
      "M -0.3 -15 Q -5.52 -18.26 -9.8 -20.50",
      "M 0.24 -20.40 Q 2.04 -23.14 3.60 -23.20",
      "M -0.24 -20.40 Q -2.04 -23.14 -3.6 -23.20",
    ],
  },
  // дуб
  {
    outline: "M 0.0 -1.0 Q 2.8 -1.6 3.4 -4.4 Q 7.8 -5.0 7.2 -8.0 Q 3.4 -8.6 3.2 -11.2 Q 8.4 -11.8 7.8 -14.8 Q 3.4 -15.4 3.2 -18.0 Q 7.6 -18.4 6.6 -21.4 Q 3.0 -22.0 2.8 -24.4 Q 4.8 -26.6 0.0 -29.0 Q -4.8 -26.6 -2.8 -24.4 Q -3.0 -22.0 -6.6 -21.4 Q -7.6 -18.4 -3.2 -18.0 Q -3.4 -15.4 -7.8 -14.8 Q -8.4 -11.8 -3.2 -11.2 Q -3.4 -8.6 -7.2 -8.0 Q -7.8 -5.0 -3.4 -4.4 Q -2.8 -1.6 -0.0 -1.0 Z",
    stem: "M 0 -1 Q -0.4 1.6 -0.6 4.6",
    veins: [
      "M 0 -1.5 L 0 -26.5",
      "M 0 -6.0 Q 2.4 -7.0 5.4 -8.6",
      "M 0 -6.0 Q -2.4 -7.0 -5.4 -8.6",
      "M 0 -12.6 Q 2.4 -13.6 5.8 -15.2",
      "M 0 -12.6 Q -2.4 -13.6 -5.8 -15.2",
      "M 0 -19.0 Q 2.4 -20.0 4.8 -21.6",
      "M 0 -19.0 Q -2.4 -20.0 -4.8 -21.6",
    ],
  },
  // мята
  {
    outline: "M 0.00 -0.00 Q 4.67 -1.95 5.32 -3.00 Q 8.54 -4.95 8.11 -6.00 Q 10.76 -7.95 9.61 -9.00 Q 11.63 -10.95 10.01 -12.00 Q 11.29 -13.95 9.41 -15.00 Q 9.93 -16.95 7.97 -18.00 Q 7.71 -19.95 5.84 -21.00 Q 4.83 -22.95 3.18 -24.00 Q 1.42 -25.95 0.00 -27.00 Q -1.66 -25.05 -1.90 -24.00 Q -3.71 -22.05 -3.43 -21.00 Q -5.46 -19.05 -4.73 -18.00 Q -6.86 -16.05 -5.73 -15.00 Q -7.78 -13.05 -6.32 -12.00 Q -8.06 -10.05 -6.37 -9.00 Q -7.51 -7.05 -5.70 -6.00 Q -5.88 -4.05 -4.04 -3.00 Q -2.57 -1.05 0.00 -0.00 Z",
    stem: "M 0 0 Q -0.6 2.0 -1.4 4.2",
    veins: [
      "M 0.1 -0.5 Q 1.9 -13.5 0.5 -24.8",
      "M 1.3 -6.5 Q 4.1 -6.9 7.6 -10.3",
      "M 1.3 -6.5 Q -1.2 -6.9 -4.1 -10.3",
      "M 1.8 -12.1 Q 4.2 -12.5 7.0 -15.9",
      "M 1.8 -12.1 Q -0.5 -12.5 -3.4 -15.9",
      "M 1.6 -17.8 Q 2.8 -18.2 4.2 -21.6",
      "M 1.6 -17.8 Q 0.0 -18.2 -2.0 -21.6",
    ],
  },
];

/* Один лист. Компонент отдельный и мемоизированный: разметка у каждого
   в десяток путей, а перерисовывать её незачем — движение целиком на
   CSS. Мелкие листья идут без прожилок: на 20 px они превращаются в
   грязь, а не в деталь. */
const BgLeaf = React.memo(function BgLeaf({ kind, size, flip }) {
  const leaf = LEAF_KINDS[kind % LEAF_KINDS.length];
  const detailed = size >= 30;
  return (
    <g transform={flip ? "scale(-1,1)" : undefined}>
      <path d={leaf.stem} stroke={T.electric} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <path d={leaf.outline} fill={T.electric} />
      {detailed && (
        <g stroke={T.bg} strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.5}>
          {leaf.veins.map((v, i) => <path key={i} d={v} />)}
        </g>
      )}
    </g>
  );
});

/* CyberGrid — живой фон вместо плоской чёрной заливки: падающие мятные
   листья на CSS/SVG, без rAF и канваса, чтобы не жечь батарею в Telegram
   WebView. Всё под pointer-events:none и на zIndex 0 — контент
   приложения лежит выше на zIndex 1.
   Сетка отсюда убрана: её тонкие линии просвечивали рядом с элементами
   и спорили с содержимым. */
const LEAF_COUNT = 33;

function CyberGrid({ showStars = true }) {
  // Листья трёх пород падают сверху вниз, покачиваясь и поворачиваясь.
  // Порода, зеркало и размер у каждого свои — одинаковых силуэтов рядом
  // не встречается.
  //
  // Каждому листу отведена своя вертикальная полоса экрана, и внутри неё
  // он лишь немного смещается. При полностью случайных координатах
  // несколько листьев неизбежно оказывались бы рядом и читались бы как
  // ком; полосы этого не допускают. Задержки тоже разнесены по своему
  // циклу — иначе они падали бы строем.
  const leaves = useMemo(() => {
    const rnd = seededRand(88117);
    const order = Array.from({ length: LEAF_COUNT }, (_, i) => i);
    // Полосы раздаются вперемешку, чтобы соседние по времени листья не
    // шли слева направо по порядку.
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const band = 100 / LEAF_COUNT;
    return order.map((slot, i) => {
      const dur = 15 + rnd() * 20;
      return {
        left: slot * band + rnd() * band * 0.7,
        size: 16 + rnd() * 46,
        kind: Math.floor(rnd() * LEAF_KINDS.length),
        flip: rnd() < 0.5,
        opacity: 0.06 + rnd() * 0.1,
        dur,
        delay: -(i / LEAF_COUNT) * dur - rnd() * 4,
        r0: -60 + rnd() * 120,
        r1: -180 + rnd() * 360,
        dx: -34 + rnd() * 68,
      };
    });
  }, []);

  return (
    <div aria-hidden data-bg-fx style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* листья. В профиле их гасим: там своя карточка-подложка, и два
          слоя фона друг на друге читаются как шум.

          Все листья лежат в одном слое: обёртка вынесена на композицию
          (translateZ) и изолирована, а у самих листьев больше нет
          will-change. С отдельным постоянным слоем на каждый лист
          браузер пересобирал картинку кусками, и на границах элементов
          поверх фона проступали тонкие светлые линии. */}
      {showStars && (
        <div style={{ position: "absolute", inset: 0, transform: "translateZ(0)", isolation: "isolate", contain: "paint" }}>
      {leaves.map((l, i) => (
        <svg
          key={`leaf${i}`}
          // Ширина считается от высоты по пропорциям области рисования:
          // при равных сторонах лист растягивался бы поперёк.
          width={Math.round(l.size * (30 / 38))}
          height={l.size}
          viewBox="-15 -32 30 38"
          style={{
            position: "absolute",
            left: `${l.left}%`,
            top: 0,
            ["--o"]: l.opacity,
            ["--r0"]: `${l.r0}deg`,
            ["--r1"]: `${l.r1}deg`,
            ["--dx"]: `${l.dx}px`,
            opacity: 0,
            animation: `leafFall ${l.dur}s linear ${l.delay}s infinite`,
            backfaceVisibility: "hidden",
          }}
        >
          <BgLeaf kind={l.kind} size={l.size} flip={l.flip} />
        </svg>
      ))}
        </div>
      )}
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

// MiniChart used to be a full recharts <AreaChart> wrapped in a
// <ResponsiveContainer> (which attaches a ResizeObserver) plus a live
// Tooltip listening for pointer move — a lot of machinery for something
// that's always drawn at one fixed pixel size (62×30 / 78×36) inside a
// button that already navigates on tap. With 6+ of these mounted at once
// in a scrolling list, that overhead was a real contributor to the scroll
// stutter. This is a plain SVG path — same look, a fraction of the cost —
// matching the approach already used for the main candlestick chart.
const MiniChart = React.memo(function MiniChart({ base, seed, poolAddress, curveAddress, tokenAddress, positive, id, width = 78, height = 36, length = 22 }) {
  const [closes, setCloses] = useState(null);
  // Источник настоящей истории: пул на DEX или своя кривая. Если нет ни
  // того ни другого, рисовать нечего — раньше здесь начиналась
  // синтетика, теперь остаётся пустое место.
  const source = poolAddress || curveAddress || null;
  const [visible, setVisible] = useState(!source);
  const elRef = useRef(null);

  // Only fetch real candle history once the card actually scrolls into
  // view. With 18+ cards in a feed, kicking off every request up front
  // would mean 18 simultaneous calls on what might be a mobile connection.
  useEffect(() => {
    if (!source || visible) return;
    const el = elRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [source, visible]);

  useEffect(() => {
    if (!source || !visible) return;
    let cancelled = false;
    function load() {
      const p = poolAddress
        ? fetchSparkCloses(poolAddress, length, tokenAddress)
        : fetchCurveSparkCloses(curveAddress, length);
      p.then((res) => {
        if (!cancelled && res) setCloses(res);
      });
    }
    load();
    // Cards can stay mounted a long time in the feed; periodically pull a
    // fresh real shape (throttled by fetchSparkCloses's own TTL/cache, so
    // this doesn't add extra network load beyond what the cache allows).
    const iv = setInterval(load, SPARK_TTL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [source, poolAddress, curveAddress, visible, length]);

  // Real pools: the fetched OHLCV shape is the true recent history, but it
  // only actually refreshes every SPARK_TTL_MS — without this, the line
  // would sit frozen in between even though the feed's price/mcap keeps
  // arriving every 2.5s. Instead we scale that real shape by how much
  // `base` (the live mcap from the current poll) has moved since the shape
  // was last fetched, so the sparkline actually tracks live price changes
  // rather than just wiggling in place. Demo tokens (no pool): fully
  // synthetic, phase-shifted by the same shared tick so those aren't
  // frozen either.
  const fetchBaseRef = useRef(null);
  useEffect(() => {
    if (closes && closes.length > 1) {
      fetchBaseRef.current = base || 1;
    }
  }, [closes]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    // Только настоящие точки. Раньше поверх них подмешивалось
    // синусоидальное дрожание «чтобы линия жила», а при отсутствии
    // ответа рисовался целиком выдуманный ряд — по такому графику
    // человек принимал решение о покупке.
    if (closes && closes.length > 1) {
      const fetchBase = fetchBaseRef.current || base || 1;
      const ratio = fetchBase ? (base || fetchBase) / fetchBase : 1;
      return closes.map((v, i) => ({ i, mcap: v * ratio }));
    }
    // У токена на кривой между сделками цена и правда стоит на месте,
    // поэтому ровная линия — это правда, а не заглушка.
    if (curveAddress && base > 0) {
      return Array.from({ length }, (_, i) => ({ i, mcap: base }));
    }
    return null;
  }, [closes, base, seed, length, curveAddress]);

  // Настоящих точек нет — не рисуем ничего, только держим место, чтобы
  // строка карточки не прыгала.
  if (!data) {
    return <div ref={elRef} style={{ width, height }} />;
  }

  const color = positive ? T.up : T.down;
  const padX = 2, padTop = 4, padBottom = 2;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;
  const values = data.map(d => d.mcap);
  const max = Math.max(...values), min = Math.min(...values);
  const range = (max - min) || 1;
  const step = values.length > 1 ? plotW / (values.length - 1) : 0;

  const points = values.map((v, i) => [
    padX + i * step,
    padTop + (1 - (v - min) / range) * plotH,
  ]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const baseY = height - padBottom;
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${baseY} L${points[0][0].toFixed(1)},${baseY} Z`;
  const gid = `spark-${id}`;

  return (
    <svg ref={elRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} stroke="none" style={{ transition: "d 900ms ease-out" }} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" style={{ transition: "d 900ms ease-out" }} />
    </svg>
  );
});

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];
const TF_SECONDS = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800, MN1: 2592000 };

/* ---------------------------------------------------------
   REAL MARKET DATA — TON meme pools via GeckoTerminal's public
   on-chain API (api.geckoterminal.com, no key required). This is
   the same underlying on-chain DEX data DexScreener itself shows;
   DexScreener's public API doesn't expose a candle/OHLCV endpoint,
   so charts are sourced from GeckoTerminal, token discovery from
   its TON "trending pools" list — real pools, real prices, real
   history, not generated.
--------------------------------------------------------- */

const GT_BASE = "https://api.geckoterminal.com/api/v2";
const GT_NETWORK = "ton";
// Мем-ленту оставляем только для настоящих "мемов" по капитализации —
// токены с капой от 1 млрд $ и выше выглядят как established/blue-chip
// активы, а не как мемкоины, поэтому отсекаем их ещё на этапе фетча.
const MCAP_FEED_CEILING = 1_000_000_000;

// Maps our UI timeframe buttons to GeckoTerminal's actual supported
// granularities (minute: 1/5/15, hour: 1/4/12, day: 1 — nothing else
// is available server-side). Timeframes finer than what GT offers
// natively (M30, W1, MN1) are built by resampling real candles
// client-side (grouping N consecutive real candles into one) rather
// than inventing data.
const GT_TF = {
  M1: { timeframe: "minute", aggregate: 1 },
  M5: { timeframe: "minute", aggregate: 5 },
  M15: { timeframe: "minute", aggregate: 15 },
  M30: { timeframe: "minute", aggregate: 15, resample: 2 },
  H1: { timeframe: "hour", aggregate: 1 },
  H4: { timeframe: "hour", aggregate: 4 },
  D1: { timeframe: "day", aggregate: 1 },
  W1: { timeframe: "day", aggregate: 1, resample: 7 },
  MN1: { timeframe: "day", aggregate: 1, resample: 30 },
};

// "EQAbc...wxYz" style truncation for on-chain addresses.
function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

// "07.23.26 · 03:00" style timestamp for the chart's OHLC readout line.
function fmtCandleStamp(timeSec) {
  if (!Number.isFinite(timeSec)) return "";
  const d = new Date(timeSec * 1000);
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${String(d.getFullYear()).slice(-2)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Сумма в TON для ленты: крупные округляем до целых, мелкие показываем
// с двумя-тремя знаками — «0.12 TON» информативнее, чем «0 TON».
function fmtTon(n) {
  if (!(n > 0)) return "0";
  if (n >= 1000) return fmtCompact(n);
  if (n >= 100) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, "");
  return n.toFixed(3).replace(/\.?0+$/, "");
}

function fmtCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

// Compact "time since pool creation" label — real timestamp from
// GeckoTerminal's pool_created_at, not invented.
function fmtAge(isoDate) {
  if (!isoDate) return null;
  const created = new Date(isoDate).getTime();
  if (!Number.isFinite(created)) return null;
  const diffMin = Math.max(0, Math.floor((Date.now() - created) / 60000));
  if (diffMin < 60) return `${diffMin}M`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}H`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}D`;
  return `${Math.floor(diffD / 30)}MO`;
}

// A small curated emoji set, deterministically assigned per ticker so
// real tokens (which have no emoji of their own) still get a stable
// icon instead of a random one that changes every render.
const TICKER_EMOJI = ["🐸", "🐕", "🐱", "🚀", "💎", "🐋", "🔥", "🌙", "🐹", "🦊", "🐻", "👾", "🎩", "🧊", "⚡", "🍀"];
function emojiForTicker(sym) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0;
  return TICKER_EMOJI[h % TICKER_EMOJI.length];
}
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % 9) + 1;
}

// Groups consecutive real candles into coarser buckets (e.g. 2×15m -> 30m,
// 7×1d -> 1w) so every timeframe button is backed by real trade data even
// where GeckoTerminal doesn't offer that exact granularity natively.
function resampleCandles(candles, groupSize) {
  if (!groupSize || groupSize <= 1) return candles;
  const out = [];
  for (let i = 0; i < candles.length; i += groupSize) {
    const group = candles.slice(i, i + groupSize);
    if (!group.length) continue;
    out.push({
      time: group[0].time,
      open: group[0].open,
      close: group[group.length - 1].close,
      high: Math.max(...group.map(c => c.high)),
      low: Math.min(...group.map(c => c.low)),
      volume: group.reduce((s, c) => s + c.volume, 0),
    });
  }
  return out;
}

// Fetches real trending TON meme pools. Returns tokens shaped to match
// the app's existing token model so every screen (cards, detail, stats)
// keeps working unchanged. Falls back to null on any failure so callers
// can keep showing the bundled fallback list instead of an empty feed.
async function fetchTonMemePools(limit = 18, pages = 1) {
  // Одна страница GeckoTerminal — это 20 пулов, и на «Горячие» с «DEX»
  // такого списка мало. Ходим по нескольким страницам подряд и склеиваем
  // результат, отсеивая повторы по id пула.
  const collected = [];
  const seen = new Set();
  for (let page = 1; page <= pages; page++) {
    const rows = await fetchPoolsPage(page);
    if (!rows) break; // страница не отдалась — довольствуемся тем, что есть
    rows.forEach((tok) => {
      if (seen.has(tok.id)) return;
      seen.add(tok.id);
      collected.push(tok);
    });
    if (collected.length >= limit) break;
  }
  return collected.length ? collected.slice(0, limit) : null;
}

async function fetchPoolsPage(page) {
  try {
    // include=base_token,dex pulls the actual token record (real name,
    // symbol, on-chain address, logo image_url) and the DEX the pool
    // trades on, for every pool in one request.
    const res = await gtFetch(`${GT_BASE}/networks/${GT_NETWORK}/trending_pools?page=${page}&include=base_token,dex`);
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const json = await res.json();
    const rows = json?.data || [];
    const included = json?.included || [];
    const tokensById = new Map(included.filter(x => x.type === "token").map(x => [x.id, x.attributes || {}]));
    const dexById = new Map(included.filter(x => x.type === "dex").map(x => [x.id, x.attributes || {}]));
    return rows.map((row) => {
      const a = row.attributes || {};
      const baseTokenId = row.relationships?.base_token?.data?.id;
      const dexId = row.relationships?.dex?.data?.id;
      const bt = (baseTokenId && tokensById.get(baseTokenId)) || {};
      const dex = (dexId && dexById.get(dexId)) || {};
      const name = bt.name || (a.name || "TOKEN/TON").split("/")[0].trim();
      const ticker = (bt.symbol || name || "TOKEN").toUpperCase().slice(0, 10);
      const price = parseFloat(a.base_token_price_usd) || 0;
      const mcapNum = parseFloat(a.market_cap_usd) || parseFloat(a.fdv_usd) || 0;
      const change = parseFloat(a.price_change_percentage?.h24) || 0;
      const volNum = parseFloat(a.volume_usd?.h24) || 0;
      const liqNum = parseFloat(a.reserve_in_usd) || 0;
      // Сколько сделок прошло по пулу за час и за сутки — по этому
      // считается «в центре внимания»: там должен быть не самый крупный
      // токен, а самый торгуемый прямо сейчас.
      const txns = a.transactions || {};
      const txCount = (win) => {
        const w = txns[win] || {};
        return (Number(w.buys) || 0) + (Number(w.sells) || 0);
      };
      return {
        id: row.id,
        poolAddress: a.address,
        tokenAddress: bt.address || null,
        name,
        ticker,
        logoUrl: bt.image_url && !bt.image_url.includes("missing_small") ? bt.image_url : null,
        emoji: emojiForTicker(ticker),
        price,
        change,
        mcapNum,
        liq: fmtCompact(liqNum),
        vol: fmtCompact(volNum),
        tx1h: txCount("h1"),
        tx6h: txCount("h6"),
        tx24h: txCount("h24"),
        cat: "Мемы",
        seed: hashSeed(row.id),
        verified: liqNum > 50_000,
        live: true,
        dexName: dex.name || (dexId ? dexId.replace(/[-_]/g, ".").replace(/\b\w/g, c => c.toUpperCase()) : null),
        createdAt: a.pool_created_at || null,
      };
    }).filter(t => t.poolAddress && t.price > 0 && t.mcapNum < MCAP_FEED_CEILING);
  } catch (err) {
    return null; // caller keeps showing the last successfully fetched list
  }
}

// Real per-token description + socials, from GeckoTerminal's token-info
// endpoint (name/image/description/website/telegram/twitter). Cached per
// token address and only fetched lazily when a token is actually opened —
// calling this for every card in the feed would blow through the free API's
// rate limit for no benefit, since the list view never shows the description.
const tokenInfoCache = new Map(); // tokenAddress -> info | null
async function fetchTokenInfo(tokenAddress) {
  if (!tokenAddress) return null;
  if (tokenInfoCache.has(tokenAddress)) return tokenInfoCache.get(tokenAddress);
  try {
    const res = await gtFetch(`${GT_BASE}/networks/${GT_NETWORK}/tokens/${tokenAddress}/info`);
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const json = await res.json();
    const a = json?.data?.attributes || {};
    const info = {
      description: a.description || null,
      website: (a.websites && a.websites[0]) || null,
      telegram: a.telegram_handle ? `https://t.me/${a.telegram_handle}` : null,
      twitter: a.twitter_handle ? `https://x.com/${a.twitter_handle}` : null,
      imageUrl: a.image_url && !a.image_url.includes("missing_small") ? a.image_url : null,
    };
    tokenInfoCache.set(tokenAddress, info);
    return info;
  } catch (err) {
    tokenInfoCache.set(tokenAddress, null);
    return null;
  }
}

// Real per-token HOLDER count — genuinely distinct wallet count, not a
// stand-in. GeckoTerminal's free/keyless API doesn't expose this (holder
// counts there sit behind a paid CoinGecko tier), but every jetton on TON
// is indexed by TonAPI, whose public jetton-info endpoint returns a real
// holders_count computed from on-chain jetton-wallet contracts. This is
// intentionally the ONLY holders source in the app now — the old
// "holders" field was actually the 24h buy+sell transaction count
// mislabeled as holders, which is a different (and usually much larger)
// number. Always queried against TON mainnet: the feed's tokens come
// from GeckoTerminal's mainnet trending pools regardless of which
// network the connected wallet happens to be on for launching/trading.
const TONAPI_MAINNET_BASE = "https://tonapi.io";

// Сеть, в которой приложение запускает и торгует своими токенами.
// Отдельно от TONAPI_MAINNET_BASE выше: общая лента всегда читается из
// mainnet, а собственные контракты пока живут в тестнете. Внутри
// компонента есть TON_TESTNET — он берёт значение отсюда, чтобы сеть
// была задана в одном месте.
const TON_TESTNET_NETWORK = true;

// Адрес кошелька жетона у конкретного владельца. Нужен для продажи:
// продать — значит перевести жетоны со своего кошелька на кошелёк
// кривой, а свой адрес заранее неизвестен и выводится мастером жетона.
// testnet приходит параметром: константа сети объявлена внутри
// компонента и на верхнем уровне модуля не видна.
// Состояние кривой прямо из контракта: сколько TON в ней реально лежит
// и сколько токенов продано. Всё остальное — цена, капитализация — это
// производные от этих двух чисел. Считать их из введённой при запуске
// суммы нельзя: если покупка не прошла и деньги вернулись, в ленте
// нарисовалась бы капитализация, которой не существует.
// Запросы к tonapi идут через общий шлюз: бесплатный тариф отвечает 429
// уже на паре запросов подряд, а их тут много — состояние кривой, её
// сделки, метаданные жетона, балансы. Ошибка выглядела как «данных
// нет», и график молча подменялся случайным.
const TONAPI_MIN_GAP_MS = 180;
let tonapiLastRequestAt = 0;
async function tonFetch(url, init) {
  const wait = tonapiLastRequestAt + TONAPI_MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  tonapiLastRequestAt = Date.now();
  const res = await fetch(url, init);
  if (res.status !== 429) return res;
  const retryAfter = Number(res.headers.get("Retry-After")) || 0;
  await sleep(Math.min(6000, retryAfter ? retryAfter * 1000 : 1500));
  tonapiLastRequestAt = Date.now();
  return fetch(url, init);
}

// Один и тот же ответ нужен графику, ленте и окну сделки. Без общего
// кэша это втрое больше запросов на ровном месте — и снова 429.
function cachedFetcher(ttlMs) {
  const cache = new Map();
  const inflight = new Map();
  return function run(key, load) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.value);
    if (inflight.has(key)) return inflight.get(key);
    const p = load().then(
      (value) => {
        inflight.delete(key);
        // Неудачу не кэшируем, но и не теряем прошлый удачный ответ:
        // лучше показать данные десятисекундной давности, чем ничего.
        if (value != null) cache.set(key, { value, ts: Date.now() });
        return value != null ? value : (hit ? hit.value : null);
      },
      () => {
        inflight.delete(key);
        return hit ? hit.value : null;
      },
    );
    inflight.set(key, p);
    return p;
  };
}
const curveStateCached = cachedFetcher(8000);
const curveTradesCached = cachedFetcher(12000);

async function fetchCurveState(curveAddress, testnet) {
  if (!curveAddress) return null;
  return curveStateCached(`${testnet ? "t" : "m"}:${curveAddress}`, () => loadCurveState(curveAddress, testnet));
}

async function loadCurveState(curveAddress, testnet) {
  const host = testnet ? "https://testnet.tonapi.io" : TONAPI_MAINNET_BASE;
  try {
    const res = await tonFetch(`${host}/v2/blockchain/accounts/${curveAddress}/methods/data`, { method: "POST" });
    if (!res.ok) throw new Error(`tonapi ${res.status}`);
    const json = await res.json();
    const stack = json?.stack || [];
    if (stack.length < 7) return null;
    const num = (i) => BigInt(stack[i].num);
    // Порядок полей задан структурой CurveData в контракте. Параметры
    // читаются вместе с резервами намеренно: они зашиты в контракт при
    // запуске и у токенов, созданных до смены настроек, отличаются от
    // текущих. Считать по настройкам приложения — значит показывать
    // цену, которой у этого токена нет.
    return {
      virtualTon: num(0),
      virtualTokens: num(1),
      realTon: num(2),
      tokensSold: num(3),
      tokensForSale: num(4),
      graduationTon: num(5),
      feeBps: num(6),
      // Восьмое поле — признак того, что кривая уже закрыта. С этого
      // момента контракт не принимает ни покупки, ни продажи, поэтому
      // приложение обязано об этом знать: иначе кнопка «Купить» просто
      // молча отбивалась бы сетью.
      graduated: stack[7] ? Number(stack[7].num) !== 0 : false,
    };
  } catch (err) {
    console.error("[mintly] не удалось прочитать состояние кривой:", err);
    return null;
  }
}

// Реальный баланс жетона на кошельке. Локальный счётчик holdings —
// выдумка приложения: он не знает ни о покупках с другого устройства, ни
// о переводах мимо интерфейса. Из-за него кнопка «Продать» была
// заблокирована даже когда токены на кошельке лежали.
async function fetchJettonBalance(jettonMaster, ownerAddress, testnet) {
  const info = await fetchJettonAccount(jettonMaster, ownerAddress, testnet);
  return info ? info.balance : null;
}

async function fetchJettonWalletAddress(jettonMaster, ownerAddress, testnet) {
  const info = await fetchJettonAccount(jettonMaster, ownerAddress, testnet);
  return info ? info.wallet : null;
}

async function fetchJettonAccount(jettonMaster, ownerAddress, testnet) {
  if (!jettonMaster || !ownerAddress) return null;
  const host = testnet ? "https://testnet.tonapi.io" : TONAPI_MAINNET_BASE;
  try {
    const res = await fetch(`${host}/v2/accounts/${ownerAddress}/jettons/${jettonMaster}`);
    if (!res.ok) throw new Error(`tonapi ${res.status}`);
    const json = await res.json();
    const raw = json?.balance;
    const decimals = Number(json?.jetton?.decimals ?? 9);
    return {
      wallet: json?.wallet_address?.address || null,
      balance: raw == null ? 0 : Number(BigInt(raw) / 10n ** BigInt(decimals)),
      // Точное значение в минимальных единицах. Округлённое число токенов
      // годится для показа, но не для продажи: обратное умножение даёт
      // величину, которая может оказаться больше настоящей, и контракт
      // отвергает такой перевод.
      raw: raw == null ? 0n : BigInt(raw),
    };
  } catch (err) {
    console.error("[mintly] не удалось получить данные жетона:", err);
    return null;
  }
}
const HOLDERS_TTL_MS = 60_000;
const holdersCache = new Map(); // сеть+адрес -> { meta, ts }
const holdersInflight = new Map(); // tokenAddress -> Promise, de-dupes concurrent callers
// Метаданные жетона: держатели и выпущенное количество. Обе цифры из
// одного ответа, поэтому запрос один.
//
// Сеть приходит параметром: токены из общей ленты живут в mainnet, а
// запущенные в приложении — там, где работает приложение. Раньше адрес
// всегда спрашивали у mainnet, и для своих токенов ответом был «нет
// такого жетона», то есть прочерк вместо реального числа держателей.
async function fetchJettonMeta(tokenAddress, testnet = false) {
  if (!tokenAddress) return null;
  const key = `${testnet ? "t" : "m"}:${tokenAddress}`;
  const cached = holdersCache.get(key);
  if (cached && Date.now() - cached.ts < HOLDERS_TTL_MS) return cached.meta;
  if (holdersInflight.has(key)) return holdersInflight.get(key);
  const host = testnet ? "https://testnet.tonapi.io" : TONAPI_MAINNET_BASE;
  const p = (async () => {
    try {
      const res = await tonFetch(`${host}/v2/jettons/${tokenAddress}`);
      if (!res.ok) throw new Error(`tonapi ${res.status}`);
      const json = await res.json();
      const decimals = Number(json?.metadata?.decimals ?? 9) || 9;
      const rawSupply = json?.total_supply != null ? String(json.total_supply) : null;
      const meta = {
        holders: typeof json?.holders_count === "number" ? json.holders_count : null,
        // Выпуск читаем с цепочки, а не берём из настроек: у токенов,
        // созданных до смены параметров, он другой.
        supply: rawSupply != null ? Number(rawSupply) / 10 ** decimals : null,
      };
      holdersCache.set(key, { meta, ts: Date.now() });
      holdersInflight.delete(key);
      return meta;
    } catch (err) {
      holdersInflight.delete(key);
      return cached ? cached.meta : null;
    }
  })();
  holdersInflight.set(key, p);
  return p;
}

async function fetchJettonHolders(tokenAddress, testnet = false) {
  const meta = await fetchJettonMeta(tokenAddress, testnet);
  return meta ? meta.holders : null;
}

// Plain hook form of fetchJettonHolders, for spots (token detail header,
// info tab) that lay the number out themselves rather than using the
// icon+value HoldersBadge component. undefined = still loading, null =
// TonAPI has nothing for this address.
function useJettonHolders(tokenAddress, testnet = false) {
  const [count, setCount] = useState(undefined);
  useEffect(() => {
    setCount(undefined);
    if (!tokenAddress) return;
    let cancelled = false;
    fetchJettonHolders(tokenAddress, testnet).then((c) => { if (!cancelled) setCount(c); });
    return () => { cancelled = true; };
  }, [tokenAddress, testnet]);
  return count;
}

// Fetches real OHLCV candles for one pool/timeframe. Returns
// { candles: [{time,open,high,low,close}], volume: [{time,value,color}] }
// in ascending time order, ready for lightweight-charts — or null on failure.
// Real recent trades for a pool (GeckoTerminal's /trades endpoint) — used
// by the Transactions tab on the token screen. Not cached: this is
// explicitly opened by the person to see what's happening right now.
// У бесплатного GeckoTerminal жёсткий лимит (около 30 запросов в минуту
// на адрес): при превышении он отвечает 429, и вызывающий код видит это
// как «данных нет». Раньше именно так пропадал список транзакций.
// gtFetch держит минимальный промежуток между запросами и один раз
// повторяет попытку после 429, дождавшись Retry-After.
const GT_MIN_GAP_MS = 320;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* Очередь запросов к GeckoTerminal.

   Лимит там общий на адрес, а желающих много: свечи открытого токена,
   мини-графики карточек, лента сделок. Раньше они соревновались между
   собой, и первым под 429 попадал как раз график — самое важное на
   экране. Теперь запросы выстраиваются в одну очередь с приоритетом:
   открытый график идёт вперёд ленты и превью, а между запросами
   держится пауза. На 429 попытка повторяется с нарастающей задержкой —
   молча отдавать «данных нет» из-за лимита нельзя. */
const GT_PRIORITY = { chart: 3, trades: 2, spark: 1, feed: 0 };
const gtQueue = [];
let gtBusy = false;
let gtLastRequestAt = 0;

async function gtPump() {
  if (gtBusy) return;
  gtBusy = true;
  try {
    while (gtQueue.length) {
      gtQueue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      const job = gtQueue.shift();
      const wait = gtLastRequestAt + GT_MIN_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      gtLastRequestAt = Date.now();
      try {
        let res = await fetch(job.url);
        for (let attempt = 0; res.status === 429 && job.retries > attempt; attempt++) {
          const retryAfter = Number(res.headers.get("Retry-After")) || 0;
          await sleep(Math.min(9000, retryAfter ? retryAfter * 1000 : 1200 * (attempt + 1) ** 2));
          gtLastRequestAt = Date.now();
          res = await fetch(job.url);
        }
        job.resolve(res);
      } catch (err) {
        job.reject(err);
      }
    }
  } finally {
    gtBusy = false;
  }
}

function gtFetch(url, { retries = 2, priority = GT_PRIORITY.feed } = {}) {
  return new Promise((resolve, reject) => {
    gtQueue.push({ url, retries, priority, resolve, reject, seq: gtQueue.length });
    gtPump();
  });
}

// Последний удачный ответ по каждому пулу. Нужен, чтобы при повторном
// открытии экрана или возврате на вкладку список рисовался сразу, а сеть
// догоняла в фоне — вместо пустого «загружаем».
const tradesCache = new Map(); // poolAddress -> trades[]
function cachedPoolTrades(poolAddress) {
  return (poolAddress && tradesCache.get(poolAddress)) || null;
}

// limit по умолчанию щедрый: эндпоинт отдаёт последние сделки одной
// страницей, и обрезать её незачем — из этих же строк собирается и
// вкладка сделок, и общая лента, а пропущенная сделка обратно уже не
// приедет.
async function fetchPoolTrades(poolAddress, limit = 300, priority = GT_PRIORITY.trades) {
  if (!poolAddress) return null;
  try {
    const res = await gtFetch(`${GT_BASE}/networks/${GT_NETWORK}/pools/${poolAddress}/trades`, { priority });
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const json = await res.json();
    const rows = json?.data || [];
    const trades = rows.slice(0, limit).map(row => {
      const a = row.attributes || {};
      const volUsd = parseFloat(a.volume_in_usd) || 0;
      const rate = tonUsd();
      return {
        id: row.id,
        kind: a.kind, // "buy" | "sell"
        volUsd,
        // Сумма в TON: на бирже сделка считается в долларах, поэтому
        // переводим по текущему курсу. У сделок на своей кривой она
        // известна точно и подставляется без пересчёта.
        volTon: rate > 0 ? volUsd / rate : 0,
        priceUsd: parseFloat(a.price_from_in_usd || a.price_to_in_usd) || 0,
        txHash: a.tx_hash || null,
        from: a.tx_from_address || null,
        at: a.block_timestamp || null,
      };
    });
    tradesCache.set(poolAddress, trades);
    return trades;
  } catch (err) {
    return null;
  }
}

// Последние удачные свечи по паре «пул + таймфрейм». Если очередной
// запрос не прошёл, показываем их, а не пустой экран: свечи
// пятиминутной давности честнее надписи «истории нет» у токена, который
// торгуется прямо сейчас.
const ohlcvCache = new Map();

/* Запасной источник истории цены — tonapi.

   Свечи у GeckoTerminal лучше: там настоящие open/high/low/close и
   объём. Но лимит у него общий на адрес и легко выбирается лентой и
   превью, а тогда на экране оставалась надпись «истории нет». tonapi —
   отдельный сервис со своим лимитом, и он отдаёт историю курса жетона
   точками. Из точек собираются свечи: открытие — предыдущая цена,
   закрытие — текущая, тени по ним же. Это честная история, просто без
   внутренних колебаний свечи; объём оттуда не приходит вовсе.

   Берётся только когда основной источник не ответил. */
const TF_WINDOW_SEC = {
  M1: 3 * 3600, M5: 12 * 3600, M15: 36 * 3600, M30: 3 * 86400,
  H1: 7 * 86400, H4: 21 * 86400, D1: 120 * 86400, W1: 400 * 86400, MN1: 900 * 86400,
};

async function fetchTonapiChart(jettonAddress, tf, testnet = false) {
  if (!jettonAddress) return null;
  const host = testnet ? "https://testnet.tonapi.io" : TONAPI_MAINNET_BASE;
  const now = Math.floor(Date.now() / 1000);
  const start = now - (TF_WINDOW_SEC[tf] || TF_WINDOW_SEC.H1);
  try {
    const res = await tonFetch(
      `${host}/v2/rates/chart?token=${encodeURIComponent(jettonAddress)}&currency=usd&start_date=${start}&end_date=${now}&points_count=200`,
    );
    if (!res.ok) throw new Error(`tonapi ${res.status}`);
    const json = await res.json();
    const points = (json && json.points ? json.points : [])
      .map((pt) => ({ time: Math.floor(Number(pt[0])), price: Number(pt[1]) }))
      .filter((pt) => Number.isFinite(pt.time) && Number.isFinite(pt.price) && pt.price > 0)
      .sort((a, b) => a.time - b.time);
    if (points.length < 2) return null;

    const candles = [];
    const volume = [];
    for (let i = 1; i < points.length; i++) {
      const open = points[i - 1].price;
      const close = points[i].price;
      candles.push({
        time: points[i].time,
        open,
        close,
        high: Math.max(open, close),
        low: Math.min(open, close),
      });
      volume.push({ time: points[i].time, value: 0, color: close >= open ? hexA(T.up, 0.32) : hexA(T.down, 0.32) });
    }
    return { candles, volume };
  } catch (err) {
    return null;
  }
}

async function fetchPoolOHLCV(poolAddress, tf, priority = GT_PRIORITY.chart) {
  const cfg = GT_TF[tf] || GT_TF.H1;
  const fetchLimit = Math.min(1000, 200 * (cfg.resample || 1));
  const url = `${GT_BASE}/networks/${GT_NETWORK}/pools/${poolAddress}/ohlcv/${cfg.timeframe}?aggregate=${cfg.aggregate}&limit=${fetchLimit}&currency=usd&token=base`;
  const cacheKey = `${poolAddress}:${tf}`;
  try {
    const res = await gtFetch(url, { priority, retries: priority >= GT_PRIORITY.chart ? 3 : 1 });
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const json = await res.json();
    const list = json?.data?.attributes?.ohlcv_list || [];
    let candles = list
      .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
      .filter(c => [c.time, c.open, c.high, c.low, c.close].every(v => typeof v === "number" && Number.isFinite(v)))
      .sort((a, b) => a.time - b.time);
    if (cfg.resample) candles = resampleCandles(candles, cfg.resample);
    if (!candles.length) throw new Error("empty ohlcv");
    const result = {
      candles: candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })),
      volume: candles.map(c => ({ time: c.time, value: Number.isFinite(c.volume) ? c.volume : 0, color: c.close >= c.open ? hexA(T.up, 0.32) : hexA(T.down, 0.32) })),
    };
    ohlcvCache.set(cacheKey, result);
    return result;
  } catch (err) {
    // Не вышло — отдаём прошлый удачный ответ, если он есть.
    return ohlcvCache.get(cacheKey) || null;
  }
}

// --- реальный график для токенов, запущенных в приложении -----------
//
// У такого токена нет пары на DEX, поэтому GeckoTerminal о нём ничего не
// знает и рисовать было нечего — вместо цены показывался случайный
// блуждающий график. Но вся история торгов лежит на самой кривой: цена
// в любой момент однозначно определяется тем, сколько TON в ней
// накоплено. Поэтому свечи собираются из списка транзакций кривой.
//
// Считать по TON, а не по количеству токенов, можно потому, что
// произведение резервов сохраняется: k = virtualTon × virtualTokens
// задано при создании и не меняется ни покупкой, ни продажей. Значит
// непроданный остаток выводится из накопленного TON, а цена — это
// отношение резервов. Комиссия площадки при этом снимается до того, как
// деньги попадают в резерв, поэтому её надо вычитать отдельно —
// параметры и её размер берутся у самой кривой.
// tonapi печатает опкоды как строку с ведущими нулями («0x0f8a7ea5»),
// поэтому сравниваем числами, а не текстом. Отсутствие опкода — пустое
// тело, то есть обычный перевод TON.
const CURVE_OP_BUY = 0x42555921;
const CURVE_OP_JETTON_NOTIFY = 0x7362d09c;
function msgOpCode(msg) {
  const raw = msg?.op_code;
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(String(raw), 16);
  return Number.isFinite(n) ? n : null;
}

function curvePriceFromReserve(realTon, params) {
  const tonReserve = params.virtualTon + realTon;
  const tokenReserve = (params.virtualTon * params.virtualTokens) / tonReserve;
  if (tokenReserve <= 0n) return 0;
  return Number(tonReserve) / Number(tokenReserve);
}

// Сделки кривой по возрастанию времени. У покупки берём приложенную
// сумму за вычетом газа, у продажи — сколько TON ушло продавцу: обе
// величины видны в транзакции и не требуют разбора тела сообщения.
async function fetchCurveTrades(curveAddress, testnet, feeBps = 0n) {
  if (!curveAddress) return null;
  return curveTradesCached(
    `${testnet ? "t" : "m"}:${curveAddress}:${feeBps}`,
    () => loadCurveTrades(curveAddress, testnet, feeBps),
  );
}

async function loadCurveTrades(curveAddress, testnet, feeBps) {
  const host = testnet ? "https://testnet.tonapi.io" : TONAPI_MAINNET_BASE;
  try {
    const res = await tonFetch(`${host}/v2/blockchain/accounts/${curveAddress}/transactions?limit=200`);
    if (!res.ok) throw new Error(`tonapi ${res.status}`);
    const json = await res.json();
    const txs = (json?.transactions || []).slice().sort((a, b) => (a.utime || 0) - (b.utime || 0));
    const trades = [];
    let realTon = 0n;
    for (const tx of txs) {
      const inMsg = tx.in_msg;
      if (!inMsg || tx.success === false || tx.aborted) continue;
      const op = msgOpCode(inMsg);
      if (op === CURVE_OP_BUY) {
        // Из приложенной суммы контракт удерживает газ, потом свою
        // комиссию, и только остаток идёт в резерв — считаем так же.
        const tonIn = BigInt(inMsg.value || 0) - CURVE_GAS_BUY_OVERHEAD;
        if (tonIn <= 0n) continue;
        const net = tonIn - tonIn * feeBps / 10000n;
        if (net <= 0n) continue;
        realTon += net;
        trades.push({ time: tx.utime, ton: net, kind: "buy", realTon });
      } else if (op === CURVE_OP_JETTON_NOTIFY) {
        // Продажа — это уведомление, после которого кривая платит TON
        // обычным переводом без опкода. У прихода торгового запаса при
        // запуске таких переводов нет, поэтому он сюда не попадает.
        // Комиссия уходит таким же переводом, поэтому сумма всех таких
        // сообщений — это ровно то, на сколько уменьшился резерв.
        const payout = (tx.out_msgs || []).reduce((sum, m) => {
          const outOp = msgOpCode(m);
          return outOp ? sum : sum + BigInt(m.value || 0);
        }, 0n);
        if (payout <= 0n) continue;
        realTon = realTon > payout ? realTon - payout : 0n;
        trades.push({ time: tx.utime, ton: payout, kind: "sell", realTon });
      }
    }
    return trades;
  } catch (err) {
    console.error("[mintly] не удалось прочитать историю кривой:", err);
    return null;
  }
}

// Свечи из истории сделок. Пустые промежутки заполняются плоскими
// свечами по последней цене: на кривой цена между сделками действительно
// не меняется, поэтому это не выдумка, а честное отображение.
function buildCurveCandles(trades, timeframe, state = null, limit = CHART_TOTAL, rate = tonUsd()) {
  const params = curveParamsOf(state);
  const baseStep = TF_SECONDS[timeframe] || 3600;
  const startPrice = curvePriceFromReserve(0n, params) * rate;
  const now = Math.floor(Date.now() / 1000);

  const points = (trades || []).map((tr) => ({
    time: tr.time,
    price: curvePriceFromReserve(tr.realTon, params) * rate,
    volume: Number(tr.ton) / 1e9 * rate,
  }));

  // Вся история должна попасть на экран. У токена, запущенного пару
  // часов назад, все сделки старше минутного окна, и на графике
  // оставалась одна ровная линия — «ничего не показывает». Поэтому если
  // история не помещается в отведённое число свечей, интервал
  // укрупняется до ближайшего кратного: данные остаются настоящими,
  // грубеет только шаг.
  const spanFrom = points.length ? points[0].time : now;
  const needed = Math.ceil((now - spanFrom) / baseStep) + 12;
  const group = Math.max(1, Math.ceil(needed / limit));
  const step = baseStep * group;
  const bucketOf = (t) => Math.floor(t / step) * step;
  // Последняя точка — состояние прямо из контракта, если оно прочитано:
  // так конец графика совпадает с ценой, по которой идёт сделка.
  const lastPrice = state?.realTon != null
    ? curvePriceFromReserve(state.realTon, params) * rate
    : (points.length ? points[points.length - 1].price : startPrice);

  const firstTime = points.length ? points[0].time : now;
  const lastBucket = bucketOf(now);
  // Окно — последние limit интервалов, но не раньше начала торгов.
  // Без верхней границы на мелком таймфрейме пришлось бы перебирать
  // десятки тысяч пустых интервалов, а на экран попали бы самые старые.
  let bucket = Math.max(
    bucketOf(firstTime) - step * Math.min(limit - 1, 12),
    lastBucket - step * (limit - 1),
  );
  const candles = [];
  const volume = [];
  let price = startPrice;
  let i = 0;
  // Сделки левее окна на экран не попадают, но цену двигают: прокручиваем
  // их, чтобы первая видимая свеча открылась по реальной цене.
  while (i < points.length && points[i].time < bucket) {
    price = points[i].price;
    i++;
  }
  while (bucket <= lastBucket) {
    const open = price;
    let high = open, low = open, close = open, vol = 0;
    while (i < points.length && points[i].time < bucket + step) {
      close = points[i].price;
      high = Math.max(high, close);
      low = Math.min(low, close);
      vol += points[i].volume;
      i++;
    }
    if (bucket === lastBucket) {
      close = lastPrice;
      high = Math.max(high, close);
      low = Math.min(low, close);
    }
    candles.push({ time: bucket, open, high, low, close });
    volume.push({ time: bucket, value: vol, color: close >= open ? hexA(T.up, 0.32) : hexA(T.down, 0.32) });
    price = close;
    bucket += step;
  }
  if (!candles.length) return null;
  return { candles: candles.slice(-limit), volume: volume.slice(-limit) };
}

// Рыночные показатели токена на кривой — все из цепочки, ничего
// придуманного. Цена и капитализация считаются по резервам, объём и
// изменение — по списку сделок самой кривой, выпуск и держатели — по
// мастеру жетона. Раньше здесь стояли ноль или заглушка, потому что
// внешние агрегаторы про такой токен ничего не знают: пары на DEX у него
// ещё нет.
async function fetchCurveMarket(curveAddress, jettonMaster, testnet, rateArg = 0) {
  if (!curveAddress) return null;
  const state = await fetchCurveState(curveAddress, testnet);
  if (!state) return null;
  const params = curveParamsOf(state);
  const [trades, meta] = await Promise.all([
    fetchCurveTrades(curveAddress, testnet, params.feeBps),
    fetchJettonMeta(jettonMaster, testnet),
  ]);
  // Курс приходит параметром там, где он уже известен экрану: иначе
  // числа на соседних экранах считаются по разным курсам и прыгают.
  const rate = rateArg > 0 ? rateArg : tonUsd();
  // Без курса считать нечего: цена в долларах получилась бы нулевой, а
  // капитализация — пустой. Вернём null, вызывающий подождёт.
  if (!(rate > 0)) return null;
  const priceTon = curvePriceFromReserve(state.realTon, params);
  const supply = meta && meta.supply ? meta.supply : Number(CURVE_TOTAL_SUPPLY) / 1e9;

  const list = trades || [];
  const dayAgo = Math.floor(Date.now() / 1000) - 86400;
  const recent = list.filter((tr) => tr.time >= dayAgo);
  const volTon = recent.reduce((sum, tr) => sum + Number(tr.ton) / 1e9, 0);

  // Цена сутки назад — состояние кривой после последней сделки до окна.
  // Если сделок до окна не было, кривая стояла на стартовой цене.
  const before = list.filter((tr) => tr.time < dayAgo);
  const prevReal = before.length ? before[before.length - 1].realTon : 0n;
  const prevPrice = curvePriceFromReserve(prevReal, params);

  return {
    state,
    trades: list,
    priceTon,
    priceUsd: priceTon * rate,
    supply,
    mcapUsd: priceTon * rate * supply,
    // Ликвидность — то, что реально лежит в кривой: именно эти TON
    // выплачиваются продающим.
    liqUsd: (Number(state.realTon) / 1e9) * rate,
    vol24Usd: volTon * rate,
    tx24: recent.length,
    holders: meta ? meta.holders : null,
    change24: prevPrice > 0 ? ((priceTon - prevPrice) / prevPrice) * 100 : 0,
  };
}

// Сделки кривой в том же виде, в каком приходят сделки с DEX, — чтобы
// вкладка «Транзакции» рисовала и те и другие одним кодом.
function curveTradesToFeed(trades, params, limit = 200) {
  const rate = tonUsd();
  return (trades || [])
    .slice(-limit)
    .reverse()
    .map((tr, i) => ({
      id: `curve-${tr.time}-${i}`,
      kind: tr.kind,
      volTon: Number(tr.ton) / 1e9,
      volUsd: (Number(tr.ton) / 1e9) * rate,
      priceUsd: curvePriceFromReserve(tr.realTon, params) * rate,
      txHash: null,
      from: null,
      at: new Date(tr.time * 1000).toISOString(),
    }));
}

// Короткая история цены для мини-графика на карточке токена: те же
// свечи кривой, только пятнадцатиминутные и за небольшое окно.
const curveSparkCache = new Map(); // адрес -> { closes, ts }
async function fetchCurveSparkCloses(curveAddress, n = 24) {
  if (!curveAddress) return null;
  const cached = curveSparkCache.get(curveAddress);
  if (cached && Date.now() - cached.ts < SPARK_TTL_MS) return cached.closes;
  const res = await fetchCurveOHLCV(curveAddress, "M15", TON_TESTNET_NETWORK);
  const closes = res?.candles?.length ? res.candles.slice(-n).map((c) => c.close) : null;
  if (closes && closes.length > 1) curveSparkCache.set(curveAddress, { closes, ts: Date.now() });
  return closes || (cached ? cached.closes : null);
}

// Ровный ряд по известной цене. Нужен, когда история кривой ещё не
// приехала: у токена на кривой цена всё равно между сделками не
// меняется, так что прямая линия — это правда, а случайный график —
// нет.
function flatCandles(price, timeframe, limit = CHART_TOTAL) {
  if (!(price > 0)) return null;
  const step = TF_SECONDS[timeframe] || 3600;
  const last = Math.floor(Date.now() / 1000 / step) * step;
  const candles = [];
  const volume = [];
  for (let i = limit - 1; i >= 0; i--) {
    const time = last - i * step;
    candles.push({ time, open: price, high: price, low: price, close: price });
    volume.push({ time, value: 0, color: hexA(T.up, 0.32) });
  }
  return { candles, volume };
}

async function fetchCurveOHLCV(curveAddress, timeframe, testnet, rate = tonUsd()) {
  if (!(rate > 0)) return null;
  // Состояние нужно не только ради последней точки: в нём лежат
  // параметры, с которыми развёрнута именно эта кривая.
  const state = await fetchCurveState(curveAddress, testnet);
  const trades = await fetchCurveTrades(curveAddress, testnet, curveParamsOf(state).feeBps);
  if (trades == null) return null;
  return buildCurveCandles(trades, timeframe, state, CHART_TOTAL, rate);
}

// Lightweight REAL-price feed for the small sparkline previews (feed
// cards, portfolio rows). Reuses the exact same GeckoTerminal OHLCV
// endpoint as the main candlestick chart — these are real, already-
// trading TON pools, not invented numbers — just at a coarse timeframe
// and short window, since a sparkline only needs the recent shape.
// Cached per pool with a TTL: cheap re-scrolling doesn't re-hit the
// network, but the shape itself still periodically refreshes instead of
// staying frozen on the very first fetch forever (the live "wiggle" +
// base-ratio scaling in MiniChart covers the seconds in between).
const SPARK_TTL_MS = 45_000;
const sparkCache = new Map(); // poolAddress -> { closes, ts }
const sparkInflight = new Map(); // poolAddress -> Promise, to de-dupe concurrent callers
async function fetchSparkCloses(poolAddress, n = 24, jettonAddress = null) {
  if (!poolAddress) return null;
  const cached = sparkCache.get(poolAddress);
  if (cached && Date.now() - cached.ts < SPARK_TTL_MS) return cached.closes;
  if (sparkInflight.has(poolAddress)) return sparkInflight.get(poolAddress);
  const p = (async () => {
    const result = (await fetchPoolOHLCV(poolAddress, "M15", GT_PRIORITY.spark))
      || (jettonAddress ? await fetchTonapiChart(jettonAddress, "M15") : null);
    const closes = result?.candles?.length ? result.candles.slice(-n).map(c => c.close) : null;
    if (closes && closes.length > 1) sparkCache.set(poolAddress, { closes, ts: Date.now() });
    sparkInflight.delete(poolAddress);
    return closes || (cached ? cached.closes : null);
  })();
  sparkInflight.set(poolAddress, p);
  return p;
}

// TerminalChart — our own candlestick renderer on <canvas>: no external
// chart library, no watermark, and no React-state-driven redraws during
// gestures (everything during pan/zoom/inertia is imperative canvas work
// via refs, so dragging never triggers a re-render and stays smooth even
// with hundreds of candles).
//
// Gestures:
//  - one-finger drag  -> pans the visible window, with inertia on release
//  - two-finger pinch -> zooms in/out around the pinch midpoint
//  - a quick tap (no real movement) -> shows a crosshair + reports the
//    tapped candle's OHLC via onHover; a drag clears it
//
// The visible window (which candles are on screen, and how zoomed in) is
// mount-local state in a ref — the caller resets it by changing this
// component's `key` (TokenDetail keys it on token+timeframe), so a live
// data refresh (same key, new candle values) never snaps the view back.
const CHART_MIN_VISIBLE = 12;
const CHART_DEFAULT_VISIBLE = 60;
// Width reserved on the right for the price-axis gutter (labels + the
// live current-price pill) — candles are plotted to the left of this,
// never underneath it.
// Минимальная ширина правой шкалы. Настоящая считается по самой длинной
// подписи: в режиме капитализации там «$32.57M» вместо «0.0000031», и в
// фиксированные пятьдесят восемь точек такая подпись не помещалась —
// упиралась в оба края, а плашка текущей цены казалась раздутой.
const CHART_GUTTER_MIN = 58;
const CHART_GUTTER_MAX = 104;

function TerminalChart({ candles, height = 340, themeKey, onHover, tf, valueFmt }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [widthPx, setWidthPx] = useState(320);

  const n = candles?.length || 0;
  const viewRef = useRef({ start: Math.max(0, n - CHART_DEFAULT_VISIBLE), count: Math.min(n, CHART_DEFAULT_VISIBLE) || 1 });
  // Пока человек не двигал график рукой, окно держится за правый край.
  // Окно задавалось номерами свечей и не пересчитывалось при обновлении,
  // а число свечей меняется на каждом обновлении — от этого график сам
  // уезжал то влево, то вправо.
  const pinnedRef = useRef(true);
  // Время свечи, стоящей у левого края. Окно задано номерами свечей, а
  // ряд пересобирается на каждом обновлении — и шаг в нём зависит от
  // длины истории, то есть номера не значат ничего постоянного. Держим
  // якорь по времени и после обновления возвращаем окно на ту же дату.
  const anchorTimeRef = useRef(null);
  // Трогали ли шкалу цены руками. Пока нет — она подгоняется под данные
  // сама при каждом обновлении.
  const yUserRef = useRef(false);
  // Vertical (price) window — { min, max } in price units. Unlike before,
  // this is NOT recomputed from whatever candles happen to be visible;
  // it's set once (auto-fit on first draw) and from then on only changes
  // when the person actually drags/zooms vertically, so panning left/right
  // no longer rescales the chart under your finger.
  const yViewRef = useRef(null);
  const dragRef = useRef(null);     // { lastX, lastY, lastT, vx, vy, moved, startX, startY }
  const pinchRef = useRef(null);    // { startDist, startCount, anchorIdx }
  const yScaleRef = useRef(null);   // { startY, startMin, startMax } — right-edge scale handle
  const inertiaRaf = useRef(null);
  const hoverIdxRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidthPx(w);
    });
    ro.observe(el);
    setWidthPx(el.clientWidth || 320);
    return () => ro.disconnect();
  }, []);

  // Ширина шкалы считается на весь ряд сразу, ещё до первой отрисовки:
  // см. пояснение в computeLayout. Через эффект было бы поздно — первый
  // кадр успел бы нарисоваться с другой шириной и дёрнуться.
  const gutterWidth = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const c of candles) {
      if (Number.isFinite(c.low) && c.low < lo) lo = c.low;
      if (Number.isFinite(c.high) && c.high > hi) hi = c.high;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return CHART_GUTTER_MIN;
    const longest = [lo, hi]
      .map((v) => (valueFmt ? valueFmt(v) : String(v)))
      .reduce((a, b) => (String(b).length > String(a).length ? b : a), "");
    const want = String(longest).length * 7.2 + 18;
    return Math.max(CHART_GUTTER_MIN, Math.min(CHART_GUTTER_MAX, Math.ceil(want / 8) * 8));
  }, [candles, valueFmt]);
  // Отрисовка идёт из кадровой петли и держит старое замыкание, поэтому
  // значение кладём в ссылку.
  const gutterRef = useRef(CHART_GUTTER_MIN);
  gutterRef.current = gutterWidth;

  function clampView() {
    const v = viewRef.current;
    v.count = Math.max(CHART_MIN_VISIBLE, Math.min(n, v.count || CHART_DEFAULT_VISIBLE));
    // No upper bound on v.start: panning right of the last candle is
    // allowed (empty space beyond it), same as most trading terminals.
    // Only the left edge is clamped, so you can't scroll before candle 0.
    v.start = Math.max(0, v.start);
  }

  function computeLayout() {
    const v = viewRef.current;
    const count = v.count;
    const startI = Math.max(0, Math.floor(v.start));
    const endI = Math.min(n, Math.ceil(v.start + count) + 1);
    const visible = candles.slice(startI, endI);
    if (!visible.length) return null;
    if (!yViewRef.current) {
      // First time we have something to draw: auto-fit the price window
      // to what's currently visible, with a little breathing room. After
      // this it's frozen — only manual vertical drag / the scale handle
      // touch it again, never an automatic recompute. Only finite values
      // count here — a single bad candle (NaN/Infinity from a data
      // hiccup) must never be allowed to blow up the whole scale.
      const highs = visible.map(c => c.high).filter(Number.isFinite);
      const lows = visible.map(c => c.low).filter(Number.isFinite);
      const rawMax = highs.length ? Math.max(...highs) : 1;
      const rawMin = lows.length ? Math.min(...lows) : 0;
      const rawRange = (rawMax - rawMin) || (rawMax * 0.02) || 1;
      const pad = rawRange * 0.08;
      yViewRef.current = { min: rawMin - pad, max: rawMax + pad };
    }
    const { min, max } = yViewRef.current;
    const range = (max - min) || (max * 0.02) || 1;
    const padTop = height * 0.08, padBottom = height * 0.1;
    const drawHeight = height - padTop - padBottom;
    // Ширина шкалы — под самую длинную подпись. Считается по крайним
    // значениям всего ряда, а не текущего окна: при прокрутке окно
    // ползёт, длина подписи то «$32.9M», то «$980.00K», и ширина шкалы
    // прыгала бы вслед за ней. А от неё зависит ширина поля свечей —
    // поэтому график дёргался вбок на каждом кадре прокрутки.
    // Округление до восьми пикселей добавляет запас: подпись меняется
    // на символ, а шкала стоит на месте.
    const gutter = gutterRef.current;
    const plotW = Math.max(1, widthPx - gutter);
    const slot = plotW / count;
    const bodyW = Math.max(2, Math.min(14, slot * 0.7));
    // Clamp so a stray out-of-range price (bad tick, huge wick) draws a
    // flat line pinned at the edge instead of shooting off into a wild
    // diagonal streak or resizing anything else on screen.
    const yFor = (price) => {
      if (!Number.isFinite(price)) price = min;
      const t = padTop + (1 - (price - min) / range) * drawHeight;
      return Math.max(-height, Math.min(height * 2, t));
    };
    const xFor = (idx) => (idx - v.start + 0.5) * slot;
    return { startI, endI, min, max, range, slot, bodyW, yFor, xFor, padTop, padBottom, drawHeight, plotW, gutter };
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas || !n || !widthPx) return;
    clampView();
    const layout = computeLayout();
    if (!layout) return;
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    canvas.width = Math.max(1, Math.round(widthPx * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = "100%";
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, height);

    const { startI, endI, min, max, range, yFor, xFor, bodyW, plotW, padTop, padBottom, drawHeight, gutter } = layout;
    const fmt = valueFmt || fmtPrice;

    // Фоновая сетка — та же идея, что и в CyberGrid на фоне приложения,
    // только статичная и приглушённая, чтобы не спорить со свечами
    ctx.strokeStyle = hexA(T.ice, 0.05);
    ctx.lineWidth = 1;
    const gridTargetLines = Math.max(4, Math.round(drawHeight / 44));
    const gridRawStep = range / gridTargetLines;
    const gridMag = Math.pow(10, Math.floor(Math.log10(gridRawStep || 1)));
    const gridNorm = gridRawStep / (gridMag || 1);
    const gridStep = (gridNorm < 1.5 ? 1 : gridNorm < 3 ? 2 : gridNorm < 7 ? 5 : 10) * gridMag;
    if (gridStep > 0) {
      const gridFirst = Math.ceil(min / gridStep) * gridStep;
      for (let price = gridFirst; price <= max; price += gridStep) {
        const y = yFor(price);
        if (y < padTop - 4 || y > height - padBottom + 4) continue;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(plotW, y + 0.5);
        ctx.stroke();
      }
    }
    const gridColCount = Math.max(1, Math.round(plotW / 70));
    for (let c = 0; c <= gridColCount; c++) {
      const x = (plotW / gridColCount) * c;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, padTop);
      ctx.lineTo(x + 0.5, height - padBottom);
      ctx.stroke();
    }

    // Candles — high-contrast bodies + wicks, sized to fill the available
    // width so they stay readable at any zoom level. Plotted only within
    // plotW, so nothing ever draws underneath the price-axis gutter.
    for (let i = startI; i < endI; i++) {
      const c = candles[i];
      if (!c) continue;
      if (![c.open, c.high, c.low, c.close].every(Number.isFinite)) continue;
      const x = xFor(i);
      if (x < -bodyW || x > plotW + bodyW) continue;
      const up = c.close >= c.open;
      const color = up ? T.up : T.down;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, bodyW * 0.14);
      ctx.beginPath();
      ctx.moveTo(x, yFor(c.high));
      ctx.lineTo(x, yFor(c.low));
      ctx.stroke();
      const yO = yFor(c.open), yC = yFor(c.close);
      const top = Math.min(yO, yC), h = Math.max(1.5, Math.abs(yC - yO));
      ctx.fillRect(x - bodyW / 2, top, bodyW, h);
    }

    const lastCandle = Number.isFinite(candles[n - 1]?.close) ? candles[n - 1] : null;
    let pillTop = null, pillBottom = null; // reserved zone so grid labels don't collide with the pill

    if (lastCandle) {
      const lastUp = lastCandle.close >= lastCandle.open;
      const lastColor = lastUp ? T.up : T.down;
      const y = yFor(lastCandle.close);
      // Dashed guide line at the live price, spanning only the candle area.
      ctx.strokeStyle = lastColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      const pillH = 32;
      pillTop = Math.max(0, Math.min(height - pillH, y - pillH / 2));
      pillBottom = pillTop + pillH;
    }

    // Price axis (right gutter) — evenly spaced "nice" price levels, like
    // a real trading chart's scale, instead of the old 3 faint labels.
    ctx.fillStyle = T.surface;
    ctx.fillRect(plotW, 0, gutter, height);
    const targetLines = Math.max(4, Math.round(drawHeight / 44));
    const rawStep = range / targetLines;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const norm = rawStep / (mag || 1);
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    ctx.font = "10px " + monoFont;
    ctx.fillStyle = T.muted;
    ctx.textAlign = "right";
    if (step > 0) {
      const first = Math.ceil(min / step) * step;
      for (let price = first; price <= max; price += step) {
        const y = yFor(price);
        if (y < padTop - 4 || y > height - padBottom + 4) continue;
        if (pillTop != null && y > pillTop - 2 && y < pillBottom + 2) continue; // don't collide with the pill
        ctx.fillText(fmt(price), widthPx - 8, y + 3);
      }
    }
    ctx.textAlign = "left";

    // Live current-price pill — the highlighted price + a live countdown
    // to when the current (rightmost) bar closes and the next candle
    // starts — e.g. counts down from 60s on the 1-minute timeframe. Ticks
    // every second via the redraw interval below.
    if (lastCandle && pillTop != null) {
      const lastUp = lastCandle.close >= lastCandle.open;
      const lastColor = lastUp ? T.up : T.down;
      const priceLabel = fmt(lastCandle.close);
      const barSec = TF_SECONDS[tf] || 3600;
      const closeAtMs = (lastCandle.time + barSec) * 1000;
      const countdownLabel = fmtCountdown(closeAtMs - Date.now());
      ctx.fillStyle = lastColor;
      ctx.fillRect(widthPx - gutter, pillTop, gutter, 32);
      ctx.fillStyle = T.bg;
      ctx.textAlign = "center";
      ctx.font = "700 11px " + monoFont;
      ctx.fillText(priceLabel, widthPx - gutter / 2, pillTop + 13);
      ctx.font = "9px " + monoFont;
      ctx.fillText(countdownLabel, widthPx - gutter / 2, pillTop + 26);
      ctx.textAlign = "left";
    }

    // Crosshair — only on an explicit tap (see handleTap), not while
    // dragging/panning, so it never fights the pan gesture.
    if (hoverIdxRef.current != null) {
      const x = xFor(hoverIdxRef.current);
      ctx.strokeStyle = T.ice;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Redraw on data refresh (live tick), resize, or theme swap — but this
  // never touches viewRef, so the user's pan/zoom position survives a
  // live update untouched (no snapping back).
  // Пришли новые свечи — если график не сдвигали рукой, окно
  // переставляется на правый край. Иначе при каждом обновлении оно
  // оставалось на прежних номерах свечей, а сами свечи под ним
  // сдвигались: график будто ездил сам по себе.
  useEffect(() => {
    if (!n) return;
    const v = viewRef.current;
    if (pinnedRef.current) {
      v.count = Math.max(CHART_MIN_VISIBLE, Math.min(n, v.count || CHART_DEFAULT_VISIBLE));
      v.start = Math.max(0, n - v.count);
    } else if (anchorTimeRef.current != null) {
      // Ряд мог пересобраться с другим шагом: у свечей другие номера и
      // даже другие границы. Возвращаем окно на ту дату, где человек его
      // оставил, — иначе после каждого обновления график прыгал вбок.
      let best = 0, bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(candles[i].time - anchorTimeRef.current);
        if (d < bestD) { bestD = d; best = i; }
      }
      v.start = Math.max(0, Math.min(best, Math.max(0, n - 1)));
      clampView();
    }
    // Окно цены подгоняется заново. Оно задавалось один раз при первой
    // отрисовке и дальше не менялось: приезжали новые свечи с другим
    // размахом, и они сплющивались в узкую полосу посреди пустого поля.
    // Если шкалу двигали руками — не трогаем, это уже выбор человека.
    //
    // И только пока график держится за правый край. Стоило отлистать в
    // историю, как очередная порция данных сбрасывала окно, оно
    // подгонялось под то, что сейчас на экране, и шкала на глазах
    // разъезжалась — заметнее всего сразу после того, как отпустишь.
    if (!yUserRef.current && pinnedRef.current) yViewRef.current = null;
  }, [n, candles]);

  useEffect(() => { draw(); });

  // The bar-close countdown needs a redraw every second even when nothing
  // else about the data has changed, or it would just sit frozen.
  useEffect(() => {
    const iv = setInterval(() => draw(), 1000);
    return () => clearInterval(iv);
  }, [tf, n]);

  function xFromEvent(clientX) {
    const rect = wrapRef.current?.getBoundingClientRect();
    return rect ? clientX - rect.left : 0;
  }
  function dist(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  }
  function midX(touches) {
    return xFromEvent((touches[0].clientX + touches[1].clientX) / 2);
  }
  function cancelInertia() {
    if (inertiaRaf.current) cancelAnimationFrame(inertiaRaf.current);
    inertiaRaf.current = null;
  }
  function panByPixels(dxScreen) {
    const layout = computeLayout();
    if (!layout) return;
    viewRef.current.start -= dxScreen / layout.slot;
    clampView();
    // Отпустили у самого правого края — снова держимся за него.
    const v = viewRef.current;
    pinnedRef.current = v.start + v.count >= n - 0.75;
    const left = candles[Math.max(0, Math.min(n - 1, Math.floor(v.start)))];
    anchorTimeRef.current = left && Number.isFinite(left.time) ? left.time : null;
    draw();
  }
  // Vertical pan: shifts the frozen price window up/down so the content
  // moves with your finger, exactly like the horizontal pan — this is the
  // "you move it yourself" behavior instead of it auto-fitting.
  function panYByPixels(dyScreen) {
    const layout = computeLayout();
    if (!layout) return;
    yUserRef.current = true;
    const delta = (dyScreen / layout.drawHeight) * layout.range;
    yViewRef.current = { min: layout.min + delta, max: layout.max + delta };
    draw();
  }
  function startInertia(vxPxPerMs, vyPxPerMs = 0) {
    let vx = vxPxPerMs, vy = vyPxPerMs;
    function step() {
      if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) { inertiaRaf.current = null; return; }
      if (Math.abs(vx) >= 0.01) panByPixels(vx * 16);
      if (Math.abs(vy) >= 0.01) panYByPixels(vy * 16);
      vx *= 0.93; vy *= 0.93;
      inertiaRaf.current = requestAnimationFrame(step);
    }
    cancelInertia();
    inertiaRaf.current = requestAnimationFrame(step);
  }
  function indexAtX(clientX) {
    const layout = computeLayout();
    if (!layout) return null;
    const x = xFromEvent(clientX);
    const idx = Math.round(viewRef.current.start + x / layout.slot - 0.5);
    return Math.max(0, Math.min(n - 1, idx));
  }
  function reportHover(idx) {
    hoverIdxRef.current = idx;
    draw();
    onHover && onHover(idx == null ? null : candles[idx]);
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      cancelInertia();
      dragRef.current = null;
      const layout = computeLayout();
      if (!layout) return;
      const mx = midX(e.touches);
      pinchRef.current = { startDist: dist(e.touches), startCount: viewRef.current.count, anchorIdx: viewRef.current.start + mx / layout.slot };
      return;
    }
    cancelInertia();
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    dragRef.current = { lastX: x, lastY: y, lastT: performance.now(), vx: 0, vy: 0, moved: false, startX: x, startY: y };
  }
  function onTouchMove(e) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = dist(e.touches);
      const scale = d / (pinchRef.current.startDist || 1);
      let newCount = pinchRef.current.startCount / scale;
      newCount = Math.max(CHART_MIN_VISIBLE, Math.min(n, newCount));
      const mx = midX(e.touches);
      const newSlot = widthPx / newCount;
      viewRef.current = { start: pinchRef.current.anchorIdx - mx / newSlot, count: newCount };
      clampView();
      draw();
      return;
    }
    if (!dragRef.current || e.touches.length !== 1) return;
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    const totalDx = x - dragRef.current.startX, totalDy = y - dragRef.current.startY;
    if (!dragRef.current.moved && Math.hypot(totalDx, totalDy) > 4) {
      dragRef.current.moved = true;
      hoverIdxRef.current = null; // a real pan cancels any tap crosshair
      onHover && onHover(null);
    }
    if (dragRef.current.moved) {
      e.preventDefault();
      const dx = x - dragRef.current.lastX;
      const dy = y - dragRef.current.lastY;
      const now = performance.now();
      const dt = Math.max(1, now - dragRef.current.lastT);
      dragRef.current.vx = dx / dt;
      dragRef.current.vy = dy / dt;
      dragRef.current.lastX = x; dragRef.current.lastY = y; dragRef.current.lastT = now;
      panByPixels(dx);
      panYByPixels(dy);
    }
  }
  function onTouchEnd(e) {
    if (pinchRef.current) { pinchRef.current = null; return; }
    if (dragRef.current) {
      if (dragRef.current.moved) {
        startInertia(dragRef.current.vx, dragRef.current.vy);
      } else {
        // No meaningful movement -> treat as a tap: show the crosshair.
        reportHover(indexAtX(dragRef.current.startX));
      }
      dragRef.current = null;
    }
  }

  // Desktop-friendly equivalents (mouse drag to pan, wheel to zoom) —
  // harmless extras for previewing outside the Telegram mobile client.
  function onMouseDown(e) {
    cancelInertia();
    dragRef.current = { lastX: e.clientX, lastY: e.clientY, lastT: performance.now(), vx: 0, vy: 0, moved: false, startX: e.clientX, startY: e.clientY };
  }
  function onMouseMove(e) {
    if (!dragRef.current || e.buttons !== 1) return;
    const totalDx = e.clientX - dragRef.current.startX, totalDy = e.clientY - dragRef.current.startY;
    if (!dragRef.current.moved && Math.hypot(totalDx, totalDy) > 4) { dragRef.current.moved = true; hoverIdxRef.current = null; onHover && onHover(null); }
    if (dragRef.current.moved) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      const now = performance.now();
      const dt = Math.max(1, now - dragRef.current.lastT);
      dragRef.current.vx = dx / dt;
      dragRef.current.vy = dy / dt;
      dragRef.current.lastX = e.clientX; dragRef.current.lastY = e.clientY; dragRef.current.lastT = now;
      panByPixels(dx);
      panYByPixels(dy);
    }
  }
  function onMouseUp() {
    if (dragRef.current) {
      if (dragRef.current.moved) startInertia(dragRef.current.vx, dragRef.current.vy);
      else reportHover(indexAtX(dragRef.current.startX));
      dragRef.current = null;
    }
  }
  function onWheel(e) {
    e.preventDefault();
    const layout = computeLayout();
    if (!layout) return;
    const mx = xFromEvent(e.clientX);
    const anchorIdx = viewRef.current.start + mx / layout.slot;
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    let newCount = Math.max(CHART_MIN_VISIBLE, Math.min(n, viewRef.current.count * factor));
    const newSlot = widthPx / newCount;
    viewRef.current = { start: anchorIdx - mx / newSlot, count: newCount };
    clampView();
    draw();
  }

  // Right-edge price-scale handle — drag it up/down to zoom the (now
  // manual) vertical price window, same as the scale gutter on a real
  // trading chart. Kept as its own gesture, separate from panning the
  // chart body, so the two don't fight each other.
  function scaleStart(clientY) {
    cancelInertia();
    const layout = computeLayout();
    if (!layout) return;
    yScaleRef.current = { startY: clientY, startMin: layout.min, startMax: layout.max };
  }
  function scaleMove(clientY) {
    if (!yScaleRef.current) return;
    yUserRef.current = true;
    const { startY, startMin, startMax } = yScaleRef.current;
    const dy = clientY - startY;
    const center = (startMin + startMax) / 2;
    const halfRange = (startMax - startMin) / 2 || 1;
    // Drag down -> zoom out (wider range); drag up -> zoom in (tighter).
    const factor = Math.pow(1.0045, dy);
    const newHalf = Math.max(halfRange * 0.06, halfRange * factor);
    yViewRef.current = { min: center - newHalf, max: center + newHalf };
    draw();
  }
  function scaleEnd() { yScaleRef.current = null; }
  function onScaleTouchStart(e) { e.stopPropagation(); scaleStart(e.touches[0].clientY); }
  function onScaleTouchMove(e) { if (!yScaleRef.current) return; e.preventDefault(); e.stopPropagation(); scaleMove(e.touches[0].clientY); }
  function onScaleMouseDown(e) { e.stopPropagation(); scaleStart(e.clientY); }
  function onScaleMouseMove(e) { if (!yScaleRef.current || e.buttons !== 1) return; e.stopPropagation(); scaleMove(e.clientY); }

  if (!n) return null;
  // Полоса захвата шкалы по ширине совпадает с самой шкалой: иначе
  // тянуть приходится мимо подписей.
  const layoutNow = computeLayout();
  const scaleGutter = (layoutNow && layoutNow.gutter) || CHART_GUTTER_MIN;
  return (
    <div ref={wrapRef} style={{ width: "100%", height, position: "relative", touchAction: "none" }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height }} />
      {/* Invisible drag zone over the price axis: drag up/down to zoom the
          (now manual) vertical scale. The axis itself — labels + the live
          price pill — is drawn on the canvas, so there's no separate
          decorative handle here, just the touch/mouse target for it. */}
      <div
        onTouchStart={onScaleTouchStart} onTouchMove={onScaleTouchMove} onTouchEnd={scaleEnd} onTouchCancel={scaleEnd}
        onMouseDown={onScaleMouseDown} onMouseMove={onScaleMouseMove} onMouseUp={scaleEnd} onMouseLeave={scaleEnd}
        style={{ position: "absolute", right: 0, top: 0, width: scaleGutter, height: "100%", touchAction: "none", cursor: "ns-resize" }}
      />
    </div>
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
          : { left: 4 + rand() * 88, top: rand() * 45, delay: rand() * 2.4, dur: 1.6 + rand() * 1.4, size: 3 + rand() * 3.5 }
      );
    }
    return out;
  }, [up, seedKey]);

  return (
    <div style={{
      position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit",
      /* мягкая маска по верхнему/нижнему краю: ракеты и полосы затухают в прозрачность
         ДО того, как долетят до границы overflow:hidden, поэтому их больше не "срезает"
         жёсткой невидимой линией на краю виджета */
      WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 14%, #000 82%, transparent 100%)",
      maskImage: "linear-gradient(to bottom, transparent 0%, #000 14%, #000 82%, transparent 100%)",
      // With 6+ cards on screen each running continuous animations, an
      // un-contained repaint here forces the browser to recheck layout/paint
      // for the whole scrolling list on every frame — that's the freeze seen
      // while scrolling the feed. `contain` isolates each card's effect to
      // its own box so the compositor doesn't have to touch its neighbors.
      contain: "layout paint style",
      willChange: "transform",
    }}>
      {up && items.map((it, i) => (
            <Rocket
              key={i}
              size={it.size}
              style={{
                position: "absolute", left: `${it.left}%`, bottom: "-20%",
                color: T.ice,
                // A single drop-shadow instead of two chained ones: chained
                // filters roughly double the per-frame paint cost of an
                // already-expensive effect, multiplied by every rocket on
                // every visible card — a real contributor to scroll jank.
                filter: `drop-shadow(0 0 4px ${glow(0.55)})`,
                animation: `rocketUp ${it.dur}s cubic-bezier(0.3,0.1,0.4,1) ${it.delay}s infinite`,
              }}
            />
          ))}
    </div>
  );
}

/* SpotlightFX — a richer, purpose-built animated background just for the
   single featured "Spotlight" widget on the Mempad tab (there's only ever
   one on screen, so it can afford to be heavier than TrendFX, which has
   to run on every card in a scrolling list). No falling/rising motif here
   — a slowly rotating aurora glow, a soft breathing ring, and a handful
   of embers drifting in a slow orbit around the avatar. Color tracks the
   token's direction (up/down) but the motion itself doesn't — nothing
   here "falls". */
function SpotlightFX({ up, seedKey = 1 }) {
  const color = up ? T.up : T.down;
  const orbiters = useMemo(() => {
    const rand = seededRand(Math.floor(Math.abs(seedKey) * 131) + 17);
    return Array.from({ length: 6 }).map((_, i) => ({
      angle: (360 / 6) * i + rand() * 20,
      radius: 78 + rand() * 30,
      size: 2.5 + rand() * 2.5,
      dur: 10 + rand() * 8,
      delay: -rand() * 12,
      reverse: i % 2 === 0,
    }));
  }, [seedKey]);

  return (
    <div style={{
      position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit",
      contain: "layout paint style",
    }}>
      {/* slowly rotating aurora glow, oversized so the rotation never
          reveals a hard edge */}
      <div style={{
        position: "absolute", inset: "-60%",
        background: `conic-gradient(from 0deg, ${hexA(color, 0)}, ${hexA(color, 0.22)} 25%, ${hexA(color, 0)} 55%, ${hexA(color, 0.14)} 80%, ${hexA(color, 0)})`,
        animation: "spotlightRotate 16s linear infinite",
        willChange: "transform",
      }} />
      {/* second, slower counter-rotating layer for depth */}
      <div style={{
        position: "absolute", inset: "-50%",
        background: `conic-gradient(from 90deg, ${hexA(T.ice, 0)}, ${hexA(T.ice, 0.05)} 40%, ${hexA(T.ice, 0)} 70%)`,
        animation: "spotlightRotateRev 24s linear infinite",
        willChange: "transform",
      }} />
      {/* soft breathing ring around the avatar */}
      <div style={{
        position: "absolute", left: "50%", top: "50%", width: 168, height: 168, marginLeft: -84, marginTop: -84,
        borderRadius: "50%", border: `1px solid ${hexA(color, 0.4)}`,
        animation: "spotlightPulse 3.4s ease-in-out infinite",
      }} />
      {/* embers slowly orbiting the avatar, not falling */}
      {orbiters.map((o, i) => (
        <span key={i} style={{
          position: "absolute", left: "50%", top: "50%", width: o.size, height: o.size,
          borderRadius: "50%", background: color, boxShadow: `0 0 6px 1.5px ${hexA(color, 0.55)}`,
          marginLeft: -o.size / 2, marginTop: -o.size / 2,
          "--orbit-r": `${o.radius}px`,
          transform: `rotate(${o.angle}deg) translateX(${o.radius}px)`,
          animation: `spotlightOrbit ${o.dur}s linear ${o.delay}s infinite ${o.reverse ? "reverse" : "normal"}`,
        }} />
      ))}
    </div>
  );
}

// "12с" / "4м" / "2ч" — насколько давно прошла сделка.
function fmtSince(iso) {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (sec < 60) return `${sec}${t("sinceSec")}`;
  if (sec < 3600) return `${Math.floor(sec / 60)}${t("sinceMin")}`;
  return `${Math.floor(sec / 3600)}${t("sinceHour")}`;
}

/* RecentBuysTicker — живая лента последних реальных покупок по самым
   активным пулам ленты. Данные берутся из того же GeckoTerminal /trades,
   что и вкладка транзакций у токена; показываем по одной сделке за раз и
   раз в несколько секунд переключаем — так строка остаётся узкой и не
   отвлекает от виджета под ней. */
function RecentBuysTicker({ tokens, curveTokens, onOpen }) {
  const [buys, setBuys] = useState([]);
  // Пока не пришёл первый ответ, на месте ленты стоит скелет той же
  // высоты: пустого прыгающего места на экране быть не должно.
  const [loaded, setLoaded] = useState(false);

  // Раньше опрашивались только три самых активных пула, и в ленту
  // попадали сделки трёх токенов из всей мемпады. Теперь берутся все, но
  // не разом: у бесплатного GeckoTerminal жёсткий лимит (около тридцати
  // запросов в минуту на адрес), и опрос сорока пулов сразу упёрся бы в
  // 429, то есть лента встала бы совсем.
  //
  // Поэтому список обходится по кругу: за цикл опрашивается небольшая
  // пачка, следующий цикл берёт следующую. Полный круг по сорока токенам
  // занимает пару минут, а сделки не теряются — они копятся в общем
  // списке, а не собираются заново на каждом заходе.
  const pools = useMemo(
    () =>
      [...(tokens || [])]
        .filter((tok) => tok.poolAddress)
        .sort((a, b) => (b.tx1h || b.tx24h || 0) - (a.tx1h || a.tx24h || 0)),
    [tokens]
  );
  // Токены, запущенные в приложении: у них своя кривая вместо пула, и
  // сделки читаются прямо из контракта.
  const curves = useMemo(
    () => (curveTokens || []).filter((tok) => tok.curveAddress),
    [curveTokens]
  );

  const collectedRef = useRef([]);
  const poolCursor = useRef(0);
  const curveCursor = useRef(0);

  useEffect(() => {
    if (!pools.length && !curves.length) { setBuys([]); return; }
    let cancelled = false;

    function mergeIn(rows, token) {
      const into = collectedRef.current;
      (rows || []).forEach((r) => {
        if ((r.kind !== "buy" && r.kind !== "sell") || !r.at) return;
        // Сверяем и по идентификатору, и по самой сделке: одна и та же
        // покупка приходит из разных ответов с разными номерами, и в
        // ленте она мелькала дважды.
        const same = (x) => x.id === r.id
          || (x.txHash && r.txHash && x.txHash === r.txHash && x.kind === r.kind && x.token.id === token.id);
        if (into.some(same)) return;
        into.push({ ...r, token });
      });
      into.sort((a, b) => new Date(b.at) - new Date(a.at));
      // Держим большой запас: за круг по всем токенам набегают сотни
      // сделок, и лента должна показать каждую, а не последние
      // несколько.
      collectedRef.current = into.slice(0, 600);
      if (!cancelled) setBuys(collectedRef.current);
    }

    // Сколько пулов берём за один заход. Около десяти запросов в минуту:
    // остальной лимит оставлен графику открытого токена, он идёт вперёд
    // ленты по приоритету очереди.
    const BATCH = 4;
    const INTERVAL_MS = 25000;

    async function load(first) {
      if (first) {
        // Ответы прошлого захода уже лежат в кэше — рисуем их сразу, не
        // дожидаясь сети.
        pools.forEach((p) => mergeIn(cachedPoolTrades(p.poolAddress), p));
      }

      const slice = [];
      for (let i = 0; i < Math.min(BATCH, pools.length); i++) {
        slice.push(pools[(poolCursor.current + i) % pools.length]);
      }
      if (pools.length) poolCursor.current = (poolCursor.current + slice.length) % pools.length;

      await Promise.all(
        slice.map(async (p) => {
          const rows = await fetchPoolTrades(p.poolAddress, 300, GT_PRIORITY.feed);
          if (cancelled || !rows) return;
          mergeIn(rows, p);
        })
      );

      // И одна своя кривая за цикл — они читаются из другого источника,
      // со своим лимитом, поэтому идут отдельным неспешным потоком.
      if (curves.length) {
        const tok = curves[curveCursor.current % curves.length];
        curveCursor.current += 1;
        const m = await fetchCurveMarket(tok.curveAddress, tok.tokenAddress || tok.address, TON_TESTNET_NETWORK);
        if (!cancelled && m) mergeIn(curveTradesToFeed(m.trades, curveParamsOf(m.state), 200), tok);
      }

      if (!cancelled) setLoaded(true);
    }

    load(true);
    const poll = setInterval(() => load(false), INTERVAL_MS);
    return () => { cancelled = true; clearInterval(poll); };
  }, [pools, curves]);

  // Показанные сделки запоминаются: лента должна идти вперёд, а не
  // крутить по кругу одну и ту же покупку. Когда непоказанных не
  // осталось, строка просто стоит на последней, пока не приедут свежие.
  const shownRef = useRef(new Set());
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    function pickNext(list, prev) {
      const fresh = list.find((x) => !shownRef.current.has(x.id));
      if (fresh) {
        shownRef.current.add(fresh.id);
        // Множество не должно расти бесконечно за долгую сессию.
        if (shownRef.current.size > 400) shownRef.current = new Set([fresh.id]);
        return fresh;
      }
      return prev && list.some((x) => x.id === prev.id) ? prev : list[0] || null;
    }
    setCurrent((prev) => pickNext(buys, prev));
    if (!buys.length) return;
    const swap = setInterval(() => setCurrent((prev) => pickNext(buys, prev)), 2600);
    return () => clearInterval(swap);
  }, [buys]);

  if (!buys.length) {
    // Запросы ещё идут — держим место под ленту, а не схлопываем его.
    if (!loaded) {
      return (
        <div
          className="flex items-center gap-2 rounded-[16px] px-3 py-2 overflow-hidden"
          style={{ background: hexA(T.up, 0.05), border: `1px solid ${hexA(T.up, 0.14)}` }}
        >
          <div className="fx-skeleton" style={{ width: 20, height: 20, borderRadius: "50%" }} />
          <div className="fx-skeleton" style={{ width: "38%", height: 10, borderRadius: 4 }} />
          <div className="fx-skeleton" style={{ width: "22%", height: 10, borderRadius: 4 }} />
        </div>
      );
    }
    return null;
  }
  const b = current || buys[0];
  if (!b) return null;

  return (
    <button
      onClick={() => onOpen && onOpen(b.token)}
      className="fx-tap w-full flex items-center gap-2 rounded-[16px] px-3 py-2 overflow-hidden"
      style={{ background: hexA(b.kind === "sell" ? T.down : T.up, 0.07), border: `1px solid ${hexA(b.kind === "sell" ? T.down : T.up, 0.22)}`, textAlign: "left" }}
    >
      <div key={b.id} className="flex items-center gap-2 min-w-0" style={{ flex: 1, animation: "tickerSwap 2.6s ease-in-out both" }}>
        <TokenAvatar size={20} tone={b.kind === "sell" ? "down" : "up"} src={b.token.logoUrl}>{b.token.emoji}</TokenAvatar>
        <span className="truncate" style={{ fontFamily: monoFont, color: T.muted, fontSize: 11.5 }}>{shortAddr(b.from) || "—"}</span>
        <span style={{ fontFamily: bodyFont, color: b.kind === "sell" ? T.down : T.up, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
          {b.kind === "sell" ? t("tickerSold") : t("tickerBought")} {fmtTon(b.volTon != null ? b.volTon : (tonUsd() > 0 ? b.volUsd / tonUsd() : 0))} TON
        </span>
        <span className="truncate" style={{ fontFamily: displayFont, color: T.ice, fontSize: 12, fontWeight: 700 }}>${b.token.ticker}</span>
      </div>
      <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 10.5, whiteSpace: "nowrap" }}>{fmtSince(b.at)}</span>
    </button>
  );
}

/* SpotlightGrid — фон виджета «В центре внимания». Серая сетка в
   перспективе, поверх неё — цветовая подсветка по направлению цены,
   медленный световой луч и силуэт свечей у нижнего края. Всё на CSS
   трансформах и градиентах, поэтому крутится на GPU и не считает
   ничего в JS. */
function SpotlightGrid({ up = true, seedKey = 1 }) {
  const line = "rgba(255,255,255,0.14)";
  const cell = "44px 44px";
  const grid = `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`;
  const tone = up ? T.up : T.down;

  // Свечи детерминированы по токену: у одного и того же токена силуэт не
  // перетасовывается на каждый ре-рендер ленты.
  const candles = useMemo(() => {
    const rnd = seededRand(Math.floor(Math.abs(seedKey) * 97) + 11);
    return Array.from({ length: 22 }, () => ({
      h: 14 + rnd() * 76,
      up: rnd() > 0.42,
      dur: 3 + rnd() * 3.5,
      delay: -rnd() * 5,
    }));
  }, [seedKey]);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
        borderRadius: "inherit", perspective: 260, perspectiveOrigin: "50% 50%",
        contain: "layout paint style",
      }}
    >
      {/* сплошная подложка в цвет направления: виджет должен читаться
          цветным, а не как чёрный прямоугольник с редкими бликами */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(160deg, ${hexA(tone, 0.22)} 0%, ${hexA(T.electric, 0.12)} 55%, ${hexA(T.bg, 0)} 100%)`,
      }} />

      {/* плоская сетка по всей карточке — задаёт «стены» */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: grid, backgroundSize: cell,
        opacity: 0.85,
        animation: "gridDrift 34s linear infinite",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, #000 20%, transparent 85%)",
        maskImage: "radial-gradient(ellipse at 50% 50%, #000 20%, transparent 85%)",
      }} />

      {/* пол: сетка, убегающая к горизонту */}
      <div style={{
        position: "absolute", left: "-50%", right: "-50%", top: "50%", height: "150%",
        backgroundImage: grid, backgroundSize: cell,
        transform: "rotateX(74deg)", transformOrigin: "50% 0%",
        animation: "gridRunToward 5.5s linear infinite",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 55%)",
        maskImage: "linear-gradient(to bottom, #000 0%, transparent 55%)",
      }} />

      {/* потолок — зеркальная копия пола */}
      <div style={{
        position: "absolute", left: "-50%", right: "-50%", bottom: "50%", height: "150%",
        backgroundImage: grid, backgroundSize: cell,
        transform: "rotateX(-74deg)", transformOrigin: "50% 100%",
        animation: "gridRunToward 5.5s linear infinite",
        WebkitMaskImage: "linear-gradient(to top, #000 0%, transparent 55%)",
        maskImage: "linear-gradient(to top, #000 0%, transparent 55%)",
      }} />

      {/* силуэт свечей вдоль нижнего края — читается как «здесь торгуют» */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 66,
        display: "flex", alignItems: "flex-end", gap: 4, padding: "0 10px", opacity: 0.62,
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 70%)",
        maskImage: "linear-gradient(to bottom, transparent 0%, #000 70%)",
      }}>
        {candles.map((c, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${c.h}%`,
            borderRadius: 2,
            background: c.up ? hexA(T.up, 0.85) : hexA(T.down, 0.8),
            transformOrigin: "bottom",
            animation: `candleBreathe ${c.dur}s ease-in-out ${c.delay}s infinite`,
          }} />
        ))}
      </div>

      {/* цветовая подсветка по направлению цены: зелёная на росте,
          красная на падении — виджет читается ещё до цифр */}
      <div style={{
        position: "absolute", left: "50%", top: "42%", width: 300, height: 300,
        marginLeft: -150, marginTop: -150, borderRadius: "50%", filter: "blur(46px)",
        background: `radial-gradient(circle, ${hexA(tone, 0.6)} 0%, ${hexA(tone, 0)} 70%)`,
        animation: "spotlightPulse 6s ease-in-out infinite",
      }} />

      {/* второе пятно фирменным оранжевым, смещённое в угол: один цвет на
          весь виджет выглядит плоско, два дают глубину */}
      <div style={{
        position: "absolute", left: "12%", top: "72%", width: 220, height: 220,
        marginLeft: -110, marginTop: -110, borderRadius: "50%", filter: "blur(42px)",
        background: `radial-gradient(circle, ${hexA(T.electric, 0.4)} 0%, ${hexA(T.electric, 0)} 70%)`,
        animation: "spotlightPulse 8s ease-in-out -3s infinite",
      }} />

      {/* медленный луч, проходящий по карточке слева направо */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, width: "45%", left: 0,
        background: `linear-gradient(100deg, ${hexA(T.ice, 0)} 0%, ${hexA(T.ice, 0.13)} 50%, ${hexA(T.ice, 0)} 100%)`,
        animation: "spotlightSweep 7s ease-in-out infinite",
        willChange: "transform",
      }} />

      {/* лёгкое затемнение к краям, чтобы фон не спорил с контентом */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 45%, ${hexA(T.bg, 0.5)} 0%, ${hexA(T.bg, 0.12)} 58%, ${hexA(T.bg, 0)} 100%)`,
      }} />
    </div>
  );
}

function MintlyFrame({ children, size = 52, glow }) {
  return (
    <div style={{
      width: size, height: size,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.46, flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

/* Premium circular token avatar: glass ring with a static gradient border.
   Used specifically for token logos (list cards, detail, portfolio) — the cut-corner
   MintlyFrame stays reserved for brand/utility chrome elsewhere. */
function TokenAvatar({ children, size = 52, tone = "neutral", src }) {
  const [broken, setBroken] = useState(false);
  const ringColor = T.lineHi;
  return (
    <div
      className="fx-avatar"
      style={{
        width: size, height: size, position: "relative", flexShrink: 0, borderRadius: "50%",
        border: `1.5px solid ${ringColor}`, background: T.surfaceHi,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.44, overflow: "hidden",
      }}
    >
      {/* Real token logo when GeckoTerminal has one for this pool's base
          token; falls back to the deterministic emoji if there's no image
          or it fails to load (broken CDN link, blocked host, etc). */}
      {src && !broken ? (
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
        />
      ) : children}
    </div>
  );
}

function GlassCard({ children, style, className = "", ...rest }) {
  return (
    <div className={`fx-card rounded-[20px] ${className}`} style={{ background: T.surface, border: `1px solid ${T.line}`, ...style }} {...rest}>
      {children}
    </div>
  );
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="fx-chip flex items-center gap-2 rounded-[20px] px-3 py-2" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
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
      <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{children}</span>
      {action}
    </div>
  );
}

// Сколько длится уход подсказки вверх. Ровно на это время её показ
// продлевается после срока жизни, иначе она пропала бы мгновенно.
const TOAST_OUT_MS = 280;

function Toast({ toast, insetTop = 0, leaving = false }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "absolute", top: insetTop + 14, left: "50%", zIndex: 50,
      willChange: "transform, opacity",
      animation: leaving
        ? `toastOut ${TOAST_OUT_MS}ms cubic-bezier(0.4,0,1,1) both`
        : "toastIn 260ms cubic-bezier(0.16,1,0.3,1) both",
    }}>
      {/* toast intentionally ignores the app theme — like a native OS toast it
          stays a fixed dark pill with light text/icon so it's always legible,
          instead of flipping to (illegible) dark-on-dark under the White theme */}
      <div className="flex items-center gap-2 rounded-full px-4 py-2" style={{ background: "rgba(24,24,26,0.95)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        <CheckCircle2 size={14} color="#31D07B" />
        <span style={{ fontFamily: bodyFont, fontSize: 12, color: "#F3F3F6", whiteSpace: "nowrap" }}>{toast}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   MOCK DATA — home
--------------------------------------------------------- */

const CATEGORIES = ["Все", "Мемы", "Утилиты", "Игры", "AI", "Соц"];
/* CATEGORIES / token.cat stay as fixed Russian ids internally (they're
   used as data keys), catLabel() maps an id to the translated label
   the current language should actually display. */
function catLabel(cat) {
  const map = { "Все": "catAll", "Мемы": "catMemes", "Утилиты": "catUtility", "Игры": "catGames", "AI": "catAI", "Соц": "catSocial" };
  return map[cat] ? t(map[cat]) : cat;
}

/* MOCK DATA — profile */

/* New-user state: nothing bought, nothing launched, no history yet. */
const PORTFOLIO_TOKENS = [];
const MY_TOKENS = [];
const ACTIVITY = [];
/* Достижения. Считаются по тому, что приложение действительно знает:
   сколько токенов человек запустил, сколько у него подписчиков и на
   скольких подписан он сам, подключён ли кошелёк, заполнен ли профиль,
   надета ли косметика. Ничего выдуманного и никаких «очков» — иначе
   значок ничего не значит.

   Каждое достижение возвращает текущее значение и цель, поэтому у
   незакрытых виден прогресс, а не просто замок. */
/* Что открывается за достижение. Часть предметов магазина не выдаётся
   просто так: рамка «Уголёк» приходит за первый запуск, карточка «Жар» —
   за подключённый кошелёк и так далее. Список общий для обоих экранов:
   магазин по нему запирает предметы, страница достижений — показывает
   награду. */
const ACH_REWARDS = {
  firstLaunch: { kind: "frame", id: "ember" },
  wallet: { kind: "card", id: "emberCard" },
  face: { kind: "frame", id: "ice" },
  mcap1k: { kind: "frame", id: "gold" },
  mcap10k: { kind: "frame", id: "toxic" },
  mcap100k: { kind: "frame", id: "spark" },
  invite1: { kind: "card", id: "night" },
  invite5: { kind: "card", id: "mint" },
  invite10: { kind: "frame", id: "orbit" },
  invite25: { kind: "card", id: "sunset" },
};

// Обратная таблица: по предмету — какое достижение его открывает.
const COSMETIC_LOCKS = Object.entries(ACH_REWARDS).reduce((acc, [achId, reward]) => {
  acc[`${reward.kind}:${reward.id}`] = achId;
  return acc;
}, {});

function buildAchievements({ tokensCount = 0, bestMcapUsd = 0, invites = 0, connected = false, profile = {}, cosmetics = {} }) {
  const bioLen = (profile.bio || "").trim().length;
  const hasFace = (profile.avatarUrl ? 1 : 0) + (bioLen >= 10 ? 1 : 0);
  const dressed = ((cosmetics.frame && cosmetics.frame !== "none") ? 1 : 0)
    + ((cosmetics.card && cosmetics.card !== "none") ? 1 : 0);
  return [
    { id: "firstLaunch", icon: Rocket, color: T.electric, value: tokensCount, target: 1 },
    // Не «сколько запустил», а «как высоко забрался»: берётся лучшая
    // капитализация среди своих токенов, считанная с самой кривой.
    { id: "mcap1k", icon: Flame, color: T.electric, value: bestMcapUsd, target: 1000, unit: "usd" },
    { id: "mcap10k", icon: TrendingUp, color: T.electric, value: bestMcapUsd, target: 10000, unit: "usd" },
    { id: "mcap100k", icon: Crown, color: T.electric, value: bestMcapUsd, target: 100000, unit: "usd" },
    { id: "wallet", icon: Wallet, color: T.up, value: connected ? 1 : 0, target: 1 },
    { id: "face", icon: User, color: T.up, value: hasFace, target: 2 },
    { id: "style", icon: ShoppingBag, color: T.up, value: dressed, target: 2 },
    // Приглашения по своей ссылке. Считаются по профилям, у которых в
    // поле «кто пригласил» стоит этот человек, — то есть по людям,
    // которые действительно зашли и завели аккаунт, а не по переходам.
    { id: "invite1", icon: Gift, color: T.violet, value: invites, target: 1 },
    { id: "invite5", icon: Gift, color: T.violet, value: invites, target: 5 },
    { id: "invite10", icon: Star, color: T.violet, value: invites, target: 10 },
    { id: "invite25", icon: ShieldCheck, color: T.violet, value: invites, target: 25 },
  ].map((a) => ({
    ...a,
    done: a.value >= a.target,
    label: t(`ach${a.id.charAt(0).toUpperCase()}${a.id.slice(1)}`),
    hint: t(`ach${a.id.charAt(0).toUpperCase()}${a.id.slice(1)}Hint`),
    reward: ACH_REWARDS[a.id] || null,
  }));
}

// Прогресс строкой. Деньги показываем в долларах и сокращённо, иначе
// «332/100000» читается как ошибка.
function achProgressText(a) {
  const now = Math.min(a.value, a.target);
  if (a.unit === "usd") return `$${fmtCompact(now)}/$${fmtCompact(a.target)}`;
  return `${now}/${a.target}`;
}

// Открыт ли предмет магазина. Незапертые доступны всегда.
function cosmeticUnlocked(kind, id, achievements) {
  const achId = COSMETIC_LOCKS[`${kind}:${id}`];
  if (!achId) return true;
  const ach = (achievements || []).find((a) => a.id === achId);
  return !!(ach && ach.done);
}

const SETTINGS_ITEMS = [
  { key: "profile", icon: SettingsIcon, tKey: "profileSettings" },
  { key: "security", icon: Lock, tKey: "security" },
  { key: "language", icon: Globe2, tKey: "langTitle" },
  { key: "referral", icon: Gift, tKey: "referral" },
  { key: "support", icon: LifeBuoy, tKey: "support" },
  { key: "privacy", icon: FileText, tKey: "privacy" },
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

// Real holder count, fetched lazily (only once actually scrolled into
// view, same IntersectionObserver pattern as MiniChart above) so a long
// feed doesn't fire 18+ TonAPI requests up front. Shows a dash while
// loading and stays a dash if TonAPI has nothing for this address —
// never falls back to a fabricated number.
const HoldersBadge = React.memo(function HoldersBadge({ tokenAddress, testnet = false, icon: Icon = User }) {
  const [count, setCount] = useState(undefined);
  const [visible, setVisible] = useState(!tokenAddress);
  const elRef = useRef(null);

  useEffect(() => {
    if (!tokenAddress || visible) return;
    const el = elRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [tokenAddress, visible]);

  useEffect(() => {
    if (!tokenAddress || !visible) return;
    let cancelled = false;
    fetchJettonHolders(tokenAddress, testnet).then((c) => { if (!cancelled) setCount(c); });
    return () => { cancelled = true; };
  }, [tokenAddress, visible, testnet]);

  return (
    <span ref={elRef} className="flex items-center gap-1" style={{ fontFamily: monoFont, fontSize: 10.5, color: T.muted }}>
      <Icon size={11} color={T.muted} />
      {count == null
        ? <span className="fx-skeleton" style={{ width: 26, height: 9, borderRadius: 3, display: "inline-block" }} />
        : count.toLocaleString("ru-RU")}
    </span>
  );
});

// Real tokens only — no bundled/demo list. The feed starts empty and
// fills in as soon as the first live GeckoTerminal fetch resolves.
// 2.5 секунды на опрос ленты сжигали почти весь лимит бесплатного
// GeckoTerminal (24 запроса в минуту из ~30), и всем остальным — графику,
// транзакциям, ленте покупок — доставались 429. Цены на мемкоинах не
// меняются настолько быстро, чтобы это того стоило.
const TOKEN_REFRESH_MS = 15000;

// Сколько пулов держим в ленте и с какой глубины их собираем. Одна
// страница GeckoTerminal — 20 пулов; пяти страниц хватает, чтобы во
// вкладках «Горячие» и «DEX» был длинный список, а не десяток строк.
const FEED_PAGES = 5;
const FEED_LIMIT = 100;
// Каждый N-й опрос ходит вглубь; остальные обновляют только первую
// страницу, чтобы не жечь лимит запросов.
const FEED_DEEP_EVERY = 8;

// Сколько токенов крутится в «центре внимания» и как часто меняется.
const SPOTLIGHT_COUNT = 5;
const SPOTLIGHT_ROTATE_MS = 8000;

/* RocketIconFX — the "Создать токен" icon in the corner: same rocket
   glyph, gently bobbing in place, with a small flickering flame
   underneath it (no glow behind the rocket itself). */
function RocketIconFX() {
  return (
    <div style={{ position: "relative", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Rocket
        size={27}
        strokeWidth={1.6}
        color={T.electric}
        style={{ position: "relative", transformOrigin: "center" }}
      />
    </div>
  );
}

/* WidgetSparks — orange embers rising from the bottom edge all the way
   up through the whole "Создать токен" card, spread across its width. */
function WidgetSparks() {
  const items = useMemo(() => {
    const rand = seededRand(1 + Math.floor(Math.random() * 999999));
    return Array.from({ length: 5 }).map(() => ({
      left: 6 + rand() * 88,
      delay: rand() * 2.6,
      dur: 3.6 + rand() * 2.2,
      size: 2 + rand() * 2.2,
    }));
  }, []);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit" }}>
      {items.map((it, i) => (
        <span
          key={i}
          style={{
            position: "absolute", left: `${it.left}%`, bottom: -6,
            width: it.size, height: it.size, borderRadius: "50%",
            background: T.electric,
            filter: `drop-shadow(0 0 3px ${T.electric})`,
            animation: `widgetSparkRise ${it.dur}s cubic-bezier(0.3,0.1,0.4,1) ${it.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function HomeHero({ onGoTab }) {
  const actions = [
    { icon: Rocket, key: "homeActionLaunch", onClick: () => onGoTab("create") },
    { icon: Flame, key: "homeActionMempad", onClick: () => onGoTab("mempad") },
    { icon: Wallet, key: "homeActionWallet", onClick: () => onGoTab("profile") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative pt-2 pb-1">
        <div className="relative" style={{ fontFamily: displayFont, color: T.ice, fontSize: 32, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
          {t("heroTitle")}
        </div>
        <div className="relative" style={{ fontFamily: bodyFont, color: T.muted, fontSize: 14, marginTop: 12, lineHeight: 1.6, maxWidth: 320 }}>
          {t("heroBodyLead")}<span className="fx-shine-text" style={{ fontWeight: 600 }}>{t("heroFee")}</span>{t("heroBodyTail")}
        </div>
      </div>

      <div className="flex items-start justify-around gap-2">
        {actions.map(a => {
          const isLaunch = a.key === "homeActionLaunch";
          return (
            <button
              key={a.key}
              onClick={a.onClick}
              className="fx-tap flex flex-col items-center gap-2"
              style={{ background: "transparent", border: "none" }}
            >
              <div
                className="fx-card"
                style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "#000000", border: `1px solid ${T.line}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", overflow: "hidden",
                }}
              >
                <WidgetSparks />
                {isLaunch ? (
                  <RocketIconFX />
                ) : (
                  <a.icon size={24} strokeWidth={1.6} color={T.turquoise} style={{ position: "relative", zIndex: 1 }} />
                )}
              </div>
              <span style={{ fontFamily: bodyFont, fontSize: 11.5, fontWeight: 500, color: T.ice, textAlign: "center", lineHeight: 1.25, maxWidth: 76 }}>{t(a.key)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   МЕМПАД — separate tab (between Home and Create). Layout: a title
   row with a launch-token CTA, a big "spotlight" card for the top
   token, a row of quick filters, and a compact list of tokens below —
   all built from the same real `tokens` feed the Home tab uses, just
   arranged differently.
--------------------------------------------------------- */
const MEMPAD_FILTERS = [
  { id: "new", labelKey: "mempadFilterNew" },
  { id: "dex", labelKey: "mempadFilterDex" },
  { id: "hot", labelKey: "mempadFilterHot" },
];

function MempadRow({ t: tok, onOpen, index }) {
  return (
    <button onClick={() => onOpen(tok)} className="fx-tap w-full flex items-center gap-3 py-3 text-left" style={{ animationDelay: `${index * 55}ms` }}>
      <TokenAvatar size={44} tone={tok.change >= 0 ? "up" : "down"} src={tok.logoUrl}>{tok.emoji}</TokenAvatar>
      <div className="flex-1 min-w-0">
        <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tok.ticker}</div>
        <div className="flex items-center gap-2.5">
          <HoldersBadge tokenAddress={tok.tokenAddress} testnet={!!tok.curveAddress && TON_TESTNET_NETWORK} />
          <CardStat icon={Flame}>${tok.vol}</CardStat>
        </div>
        {/* Насколько токен близок к листингу — видно прямо в списке, не
            открывая карточку. Ради этого числа уже едут вместе с ценой. */}
        <GraduationBar raisedTon={tok.raisedTon} targetTon={tok.graduationTon} compact />
      </div>
      <div className="text-right flex-shrink-0">
        <div style={{ fontFamily: displayFont, color: T.up, fontSize: 13, fontWeight: 700 }}>{fmtUSD(tok.mcapNum)}</div>
        {fmtAge(tok.createdAt) && (
          <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 10, marginTop: 2 }}>{fmtAge(tok.createdAt)}</div>
        )}
      </div>
    </button>
  );
}

function MempadRowSkeleton({ index }) {
  return (
    <div className="w-full flex items-center gap-3 py-3" style={{ animationDelay: `${index * 55}ms` }}>
      <div className="fx-skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
      <div className="flex-1 flex flex-col gap-2">
        <div className="fx-skeleton" style={{ width: "35%", height: 12, borderRadius: 4 }} />
        <div className="fx-skeleton" style={{ width: "50%", height: 9, borderRadius: 4 }} />
      </div>
      <div className="fx-skeleton" style={{ width: 44, height: 22, borderRadius: 6 }} />
    </div>
  );
}

// Приводит токен, запущенный в приложении, к тому же виду, в котором
// приходит внешняя лента, — чтобы карточка и экран токена рисовали и то
// и другое одним кодом.
//
// Цена, капитализация, объём и изменение приезжают из состояния кривой
// (см. fetchCurveMarket) и подставляются сюда как есть. Пока их нет —
// нули и прочерки: выдуманное число на экране торговли хуже пустого
// места. poolAddress остаётся пустым, пары на DEX у такого токена ещё
// нет; график при этом рисуется по истории самой кривой.
function localTokenToFeedShape(entry) {
  // priceTon приходит из состояния кривой, если оно уже прочитано;
  // иначе честнее показать ноль, чем выдуманное число.
  const price = entry.priceTon != null
    ? entry.priceTon * tonUsd()
    : (entry.mcapNum ? entry.mcapNum / 1_000_000_000 : 0);
  return {
    id: entry.id,
    tokenAddress: entry.address,
    poolAddress: null,
    name: entry.name,
    ticker: entry.ticker,
    logoUrl: entry.logoUrl,
    emoji: entry.emoji,
    price,
    change: entry.change || 0,
    mcapNum: entry.mcapNum,
    liq: entry.liq,
    vol: entry.vol,
    tx24h: entry.tx24h || 0,
    cat: "Мемы",
    seed: hashSeed(entry.id),
    verified: entry.verified,
    live: false,
    dexName: null,
    ownerId: entry.ownerId || null,
    curveAddress: entry.curveAddress || null,
    curveJettonWallet: entry.curveJettonWallet || null,
    createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
  };
}

/* ---------------------------------------------------------
   СОЗДАТЕЛЬ ТОКЕНА И ПОДПИСКИ
   У токенов, запущенных внутри приложения, известен owner_id, значит на
   карточке можно показать, кто его сделал, и дать подписаться. Токены из
   внешней ленты (GeckoTerminal) владельца не имеют — там блок просто не
   рисуется.
--------------------------------------------------------- */

// «1 подписчик», «2 подписчика», «5 подписчиков» — в русском без
// склонения по числу выглядит неряшливо.
function followersWord(n) {
  if (lang === "EN") return n === 1 ? "follower" : "followers";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "подписчик";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "подписчика";
  return "подписчиков";
}

// Профиль по id пользователя. Кэшируем: одна и та же карточка
// открывается по многу раз, а профиль меняется редко.
const creatorCache = new Map(); // userId -> profile | null
async function fetchCreatorProfile(userId) {
  if (!userId) return null;
  if (creatorCache.has(userId)) return creatorCache.get(userId);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, bio, avatar_url, emoji, frame_id, card_id, creator_tier, verified")
    .eq("id", userId)
    .maybeSingle();
  const profile = error ? null : data;
  creatorCache.set(userId, profile);
  return profile;
}

/* TokenCreatorCard — блок «создатель» на экране токена: аватарка, ник,
   описание, число подписчиков и кнопка подписки. Подписка живёт в
   таблице follows (см. supabase_follows.sql) и требует входа. */
function TokenCreatorCard({ ownerId, currentUserId, onNeedAuth, showToast, onOpenProfile }) {
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const follow = useFollow(ownerId, currentUserId, showToast);

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) { setLoading(false); return; }
    setLoading(true);
    fetchCreatorProfile(ownerId).then((profile) => {
      if (cancelled) return;
      setCreator(profile);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [ownerId]);

  if (!ownerId) return null;
  if (loading && !creator) {
    return (
      <div className="rounded-[22px] p-4 flex items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
        <div className="fx-skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
        <div className="flex-1 flex flex-col gap-2">
          <div className="fx-skeleton" style={{ width: "45%", height: 12, borderRadius: 4 }} />
          <div className="fx-skeleton" style={{ width: "70%", height: 10, borderRadius: 4 }} />
        </div>
      </div>
    );
  }
  if (!creator) return null;

  return (
    <div className="rounded-[22px] p-4 flex items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
      {/* Аватарка с ником — переход на профиль создателя. Кнопка подписки
          рядом отдельная, чтобы не приходилось открывать профиль ради
          одного нажатия. */}
      <button
        onClick={() => onOpenProfile && onOpenProfile(ownerId)}
        className="fx-tap flex items-center gap-3 flex-1 min-w-0"
        style={{ background: "transparent", border: "none", padding: 0, textAlign: "left" }}
      >
        <TokenAvatar size={44} src={creator.avatar_url}>{creator.emoji || "🚀"}</TokenAvatar>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{tr("creatorLabel")}</span>
          <div className="flex items-center gap-1 min-w-0">
            <span className="truncate" style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 700 }}>{creator.nickname}</span>
            <CreatorWreathBadge tier={Number(creator.creator_tier) || 0} size={16} />
            <ChevronRight size={14} color={T.muted} />
          </div>
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 11 }}>
            {follow.followers} {followersWord(follow.followers)}
          </span>
        </div>
      </button>

      <FollowButton follow={follow} onNeedAuth={onNeedAuth} />
    </div>
  );
}

/* useFollow — подписка на одного человека: сколько у него подписчиков,
   подписан ли текущий пользователь, и переключатель. Логика одинаковая
   и в блоке создателя на карточке токена, и на его публичном профиле,
   поэтому живёт в одном месте. */
function useFollow(ownerId, currentUserId, showToast) {
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const isSelf = !!currentUserId && currentUserId === ownerId;

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", ownerId);
        if (cancelled) return;
        setFollowers(count || 0);

        if (currentUserId && currentUserId !== ownerId) {
          const { data: mine } = await supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", ownerId)
            .eq("follower_id", currentUserId)
            .maybeSingle();
          if (!cancelled) setFollowing(!!mine);
        } else if (!cancelled) {
          setFollowing(false);
        }
      } catch (err) {
        // Таблицы follows может ещё не быть — это не повод ломать экран.
        console.warn("[mintly] follows unavailable:", err && err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [ownerId, currentUserId]);

  async function toggle(onNeedAuth) {
    if (!currentUserId) { onNeedAuth && onNeedAuth(); return; }
    if (isSelf || busy) return;
    setBusy(true);

    // Счётчик двигаем сразу, а при ошибке возвращаем назад: сеть тут
    // медленнее, чем ожидание от нажатия.
    const next = !following;
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));

    const query = next
      ? supabase.from("follows").insert({ follower_id: currentUserId, following_id: ownerId })
      : supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", ownerId);
    const { error } = await query;

    if (error) {
      setFollowing(!next);
      setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
      showToast && showToast(tr("followFailed"));
    } else {
      showToast && showToast(next ? tr("followedToast") : tr("unfollowedToast"));
    }
    setBusy(false);
  }

  return { followers, following, busy, isSelf, toggle };
}

/* FollowButton — одна кнопка на оба экрана. */
function FollowButton({ follow, onNeedAuth, size = "sm" }) {
  const pad = size === "lg" ? "12px 26px" : "8px 16px";
  const font = size === "lg" ? 13.5 : 12;
  if (follow.isSelf) {
    return <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>{tr("creatorYou")}</span>;
  }
  return (
    <button
      onClick={() => follow.toggle(onNeedAuth)}
      disabled={follow.busy}
      className="fx-tap rounded-full flex-shrink-0"
      style={{
        padding: pad,
        background: follow.following ? "transparent" : PRISM,
        color: follow.following ? T.muted : PRISM_TEXT,
        border: follow.following ? `1px solid ${T.lineHi}` : "none",
        fontFamily: displayFont, fontWeight: 700, fontSize: font,
        opacity: follow.busy ? 0.6 : 1,
      }}
    >
      {follow.following ? tr("unfollowCta") : tr("followCta")}
    </button>
  );
}

/* PublicProfileView — профиль чужого пользователя: кто он, сколько у
   него подписчиков и какие токены он запускал. Открывается по нажатию
   на создателя на карточке токена. */
function PublicProfileView({ userId: ownerId, currentUserId, onBack, onOpenToken, onNeedAuth, showToast, insetTop = 0 }) {
  const [profile, setProfile] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const follow = useFollow(ownerId, currentUserId, showToast);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const prof = await fetchCreatorProfile(ownerId);
      if (cancelled) return;
      setProfile(prof);

      const { data } = await supabase
        .from("tokens")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setTokens(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ownerId]);

  if (loading && !profile) {
    return (
      <div className="fx-view flex flex-col items-center gap-3" style={{ marginTop: 24 }}>
        <div className="fx-skeleton" style={{ width: 128, height: 128, borderRadius: "50%" }} />
        <div className="fx-skeleton" style={{ width: 120, height: 14, borderRadius: 4 }} />
        <div className="fx-skeleton" style={{ width: 200, height: 10, borderRadius: 4 }} />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="fx-view flex flex-col gap-4">
        <button onClick={onBack} className="fx-tap self-start flex items-center gap-1 rounded-full px-3 py-1.5" style={{ color: T.ice, fontFamily: bodyFont, fontSize: 13, background: T.surface, border: `1px solid ${T.line}` }}>
          <ChevronLeft size={16} /> {tr("back")}
        </button>
        <div className="rounded-[22px] p-6 flex items-center justify-center text-center" style={{ background: T.surface, border: `1px dashed ${T.line}` }}>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{tr("profileNotFound")}</span>
        </div>
      </div>
    );
  }

  const frame = FRAME_BY_ID[profile.frame_id] ? profile.frame_id : "none";
  const card = CARD_BY_ID[profile.card_id] ? profile.card_id : "none";
  const creatorTier = Number(profile.creator_tier) || 0;

  return (
    <div className="fx-view" style={{ position: "relative" }}>
      {/* Шапка ровно та же, что и у своего профиля: подложка во всю
          ширину и рамка вокруг аватарки. Ради этого предметы из магазина
          и покупаются — их должно быть видно со стороны. */}
      <div className="flex flex-col items-center text-center gap-2" style={{ marginTop: 10, position: "relative", zIndex: 0 }}>
        <ProfileCardBg cardId={card} height={320} radius={0} bleed={16} top={PROFILE_CARD_TOP(insetTop)} />

        {/* Кнопка занимает свою строку над аватаркой: раньше она висела
            абсолютом в углу и налезала на рамку. */}
        <div className="flex" style={{ position: "relative", zIndex: 2, width: "100%", justifyContent: "flex-start", marginBottom: 6 }}>
          <button onClick={onBack} className="fx-tap flex items-center gap-1 rounded-full px-3 py-1.5" style={{ background: T.surface, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice }}>
            <ChevronLeft size={16} /> {tr("back")}
          </button>
        </div>

        <div style={{ position: "relative", zIndex: 1, lineHeight: 0 }}>
            <AvatarFrame frameId={frame} size={128}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: profile.avatar_url ? `center/cover no-repeat url(${profile.avatar_url})` : T.surfaceHi,
                border: frame === "none" ? `2px solid ${T.lineHi}` : "none",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52,
              }}>
                {!profile.avatar_url && (profile.emoji || <User size={40} color={T.muted} />)}
              </div>
            </AvatarFrame>
        </div>

        <div className="flex flex-col items-center gap-2" style={{ position: "relative", zIndex: 1, width: "100%" }}>
          <span className="flex items-center gap-1.5" style={{ fontFamily: displayFont, color: T.ice, fontSize: 19, fontWeight: 700, marginTop: 4 }}>
            {profile.nickname}
            <VerifiedBadge verified={!!profile.verified} size={16} />
            <CreatorWreathBadge tier={creatorTier} size={19} />
          </span>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, maxWidth: 260, lineHeight: 1.5 }}>
            {profile.bio || tr("bioEmptyPlaceholder")}
          </p>
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 12 }}>
            {follow.followers} {followersWord(follow.followers)}
          </span>
          <div style={{ marginTop: 4 }}>
            <FollowButton follow={follow} onNeedAuth={onNeedAuth} size="lg" />
          </div>
        </div>
      </div>

      <div className="mt-5 pb-4" style={{ position: "relative", zIndex: 1 }}>
        <SectionTitle>{tr("creatorTokens")}</SectionTitle>
        {tokens.length === 0 ? (
          <div className="rounded-[22px] p-5 flex items-center justify-center text-center" style={{ background: T.surface, border: `1px dashed ${T.line}` }}>
            <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{tr("creatorNoTokens")}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tokens.map((row) => (
              <button
                key={row.id}
                onClick={() => onOpenToken(row)}
                className="fx-card flex items-center gap-3 rounded-[22px] w-full"
                style={{ background: T.surface, border: `1px solid ${T.line}`, padding: "12px 14px" }}
              >
                <TokenAvatar size={40} src={row.logo_url}>🚀</TokenAvatar>
                <div className="flex-1 min-w-0 flex flex-col items-start">
                  <span className="truncate" style={{ fontFamily: displayFont, color: T.ice, fontSize: 13.5, fontWeight: 700 }}>{row.ticker}</span>
                  <span className="truncate" style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>{row.name}</span>
                </div>
                <ChevronRight size={16} color={T.muted} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   КОСМЕТИКА: рамки для аватарки и карточки-подложки профиля.
   Каталоги — обычные данные, чтобы добавить новый предмет можно было
   одной строкой, без правок в рендере. Всё рисуется CSS-градиентами и
   трансформами: никаких картинок, значит ничего не грузится по сети и
   тема (Dark/White) не ломает предметы.
--------------------------------------------------------- */

// Подписи предметов лежат прямо в каталоге, а не в общем словаре —
// их много и они нужны только здесь.
function pickLabel(obj) {
  if (!obj) return "";
  return obj[lang] || obj.RU || "";
}

const AVATAR_FRAMES = [
  { id: "none", label: { RU: "Без рамки", EN: "No frame" } },
  {
    id: "ember", label: { RU: "Уголёк", EN: "Ember" },
    colors: ["#FF6B35", "#FFC46B", "#FF3D00", "#FF6B35"], spin: 7, glow: "#FF6B35",
  },
  {
    id: "aurora", label: { RU: "Полярное сияние", EN: "Aurora" },
    colors: ["#38D39F", "#2E6BFF", "#B14CFF", "#38D39F"], spin: 11, glow: "#2E6BFF",
  },
  {
    id: "gold", label: { RU: "Золото", EN: "Gold" },
    colors: ["#7A5B15", "#FFE9A8", "#C9A227", "#FFF6D5", "#7A5B15"], spin: 13, glow: "#FFD86B",
  },
  {
    id: "ice", label: { RU: "Лёд", EN: "Ice" },
    colors: ["rgba(255,255,255,0.12)", "#FFFFFF", "rgba(255,255,255,0.12)", "#9FD8FF", "rgba(255,255,255,0.12)"],
    spin: 16, glow: "#9FD8FF",
  },
  {
    id: "orbit", label: { RU: "Орбита", EN: "Orbit" },
    colors: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.28)", "rgba(255,255,255,0.06)"],
    spin: 20, glow: "#FFFFFF", orbiters: 3, orbitColor: "#FF6B35",
  },
  {
    id: "spark", label: { RU: "Искры", EN: "Sparks" },
    colors: ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.4)", "rgba(255,255,255,0.1)"],
    spin: 24, glow: "#FFFFFF", sparks: 6,
  },
  {
    id: "toxic", label: { RU: "Токсик", EN: "Toxic" },
    colors: ["#0F3D2A", "#5BFF9F", "#0F3D2A", "#B6FF3D", "#0F3D2A"], spin: 6, glow: "#5BFF9F",
  },
];

const PROFILE_CARDS = [
  { id: "none", label: { RU: "Без карточки", EN: "No card" } },
  {
    id: "grid", label: { RU: "Сетка", EN: "Grid" },
    base: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0))",
    grid: "rgba(255,255,255,0.10)", floor: true,
  },
  {
    id: "night", label: { RU: "Ночь", EN: "Night" },
    base: "linear-gradient(180deg, #101A3A 0%, #0A0A14 70%, rgba(0,0,0,0) 100%)",
    stars: 26,
  },
  {
    id: "emberCard", label: { RU: "Жар", EN: "Heat" },
    base: "linear-gradient(180deg, rgba(255,107,53,0.30) 0%, rgba(255,61,0,0.08) 55%, rgba(0,0,0,0) 100%)",
    blobs: [["#FF6B35", 0.35], ["#FFB35C", 0.22]],
  },
  {
    id: "auroraCard", label: { RU: "Сияние", EN: "Aurora" },
    base: "linear-gradient(180deg, rgba(46,107,255,0.22) 0%, rgba(177,76,255,0.12) 50%, rgba(0,0,0,0) 100%)",
    blobs: [["#2E6BFF", 0.4], ["#B14CFF", 0.3], ["#38D39F", 0.22]],
  },
  {
    id: "mint", label: { RU: "Мята", EN: "Mint" },
    base: "linear-gradient(180deg, rgba(56,211,159,0.26) 0%, rgba(56,211,159,0.05) 60%, rgba(0,0,0,0) 100%)",
    grid: "rgba(56,211,159,0.16)",
  },
  {
    id: "sunset", label: { RU: "Закат", EN: "Sunset" },
    base: "linear-gradient(180deg, #FF6B35 0%, #B14CFF 45%, rgba(0,0,0,0) 100%)",
    floor: true, grid: "rgba(255,255,255,0.16)",
  },
];

const FRAME_BY_ID = Object.fromEntries(AVATAR_FRAMES.map(f => [f.id, f]));
const CARD_BY_ID = Object.fromEntries(PROFILE_CARDS.map(c => [c.id, c]));

/* Знак создателя — лавровый венок за капитализацию своего токена.

   Ступени: 1 — контур ($1K), 2 — заливка ($10K), 3 — заливка со звездой
   и свечением ($100K). Цифру внутрь не ставим: рядом с ником знак живёт
   в 16–20px, и любой текст там превращается в кашу — уровень читается
   по заливке и звезде.

   Венок рисуется из двух веток по пять листиков. Листики расставлены по
   дуге и к концу ветки мельчают — так растёт настоящий лавр, и без этого
   венок выглядит штампованным. */
const WREATH_LEAVES = 5;
const WREATH_FROM = 34;   // угол первого листика от вертикали
const WREATH_TO = 152;    // угол последнего — ветка почти смыкается внизу

function wreathLeafPositions() {
  const out = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < WREATH_LEAVES; i++) {
      const a = WREATH_FROM + ((WREATH_TO - WREATH_FROM) * i) / (WREATH_LEAVES - 1);
      out.push({ side, deg: side * a, scale: 1 - i * 0.09, i });
    }
  }
  return out;
}
const WREATH_POS = wreathLeafPositions();

/* Ветер не дует по расписанию: у каждого листа своя длительность и своя
   фаза. Задержка отрицательная — иначе первые секунды все листья стоят
   ровно и трогаются разом, что и выглядит как рывок. */
function wreathSwayTime(p) {
  return `${(4.9 + p.i * 0.63 + (p.side > 0 ? 0.42 : 0)).toFixed(2)}s`;
}
function wreathSwayDelay(p) {
  return `${-(p.i * 1.37 + (p.side > 0 ? 0.81 : 0)).toFixed(2)}s`;
}

// Дуга самой ветки — от первого листика к последнему.
function wreathBranchPath(side) {
  const cx = 30, cy = 32, r = 17;
  const p = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + side * r * Math.sin(a), cy - r * Math.cos(a)];
  };
  const [x1, y1] = p(WREATH_FROM);
  const [x2, y2] = p(WREATH_TO);
  return `M${x1} ${y1} A ${r} ${r} 0 0 ${side > 0 ? 1 : 0} ${x2} ${y2}`;
}

function starPath(cx, cy, r) {
  let d = "";
  for (let i = 0; i < 5; i++) {
    const ao = ((i * 72 - 90) * Math.PI) / 180;
    const ai = ((i * 72 - 54) * Math.PI) / 180;
    d += `${i ? "L" : "M"}${cx + r * Math.cos(ao)} ${cy + r * Math.sin(ao)} `;
    d += `L${cx + r * 0.45 * Math.cos(ai)} ${cy + r * 0.45 * Math.sin(ai)} `;
  }
  return d + "Z";
}

const CreatorWreath = React.memo(function CreatorWreath({ tier = 0, size = 20, animate = true }) {
  if (!tier) return null;
  const filled = tier >= 2;
  const fill = filled ? T.electric : "none";
  const glow = tier >= 3 ? `drop-shadow(0 0 ${Math.max(3, size * 0.09)}px ${hexA(T.electric, 0.85)})` : "none";
  return (
    <svg
      width={size} height={size} viewBox="0 0 60 60"
      style={{ display: "block", overflow: "visible", filter: glow, flexShrink: 0 }}
      aria-hidden="true"
    >
      {[-1, 1].map((side) => (
        <path
          key={side} d={wreathBranchPath(side)} fill="none"
          stroke={T.electric} strokeWidth={1.6} strokeLinecap="round" opacity={0.85}
        />
      ))}
      {WREATH_POS.map((p, idx) => (
        // Качание висит на отдельной обёртке: css-свойство transform
        // перебивает одноимённый атрибут целиком, и анимация прямо на
        // этой группе сбила бы весь разворот листика по дуге.
        <g key={idx} transform={`rotate(${p.deg} 30 32) translate(30 15) rotate(${p.side * -26})`}>
          <g style={animate ? {
            transformBox: "fill-box", transformOrigin: "50% 100%",
            animation: `wreathSway ${wreathSwayTime(p)} ease-in-out ${wreathSwayDelay(p)} infinite`,
          } : undefined}>
            <g transform={`scale(${p.scale})`}>
              <path
                d="M0 0 C 4.2 -2.6 5 -7.4 0 -12 C -5 -7.4 -4.2 -2.6 0 0 Z"
                fill={fill} stroke={filled ? "none" : T.electric} strokeWidth={1.5} strokeLinejoin="round"
              />
              <path d="M0 -0.6 L0 -11" stroke={filled ? T.bg : T.electric} strokeWidth={0.9} opacity={filled ? 0.45 : 0.9} />
            </g>
          </g>
        </g>
      ))}
      {tier >= 3 && (
        <path
          d={starPath(30, 6.5, 6)} fill={T.electric}
          style={animate ? {
            transformBox: "fill-box", transformOrigin: "50% 50%",
            animation: "wreathStar 4.5s ease-in-out infinite",
          } : undefined}
        />
      )}
    </svg>
  );
});

/* Венок вокруг аватарки — из настоящих листьев с фона.

   Рядом с ником знак живёт в 16–20px, там нужен простой силуэт, а вот
   вокруг аватарки места хватает на клён, дуб и мяту со всеми прожилками.
   Какой из трёх — выбирается в магазине, поэтому вид приходит снаружи. */
const WREATH_LEAF_KINDS = [
  // Порядок важен: номер в этом списке и есть то, что лежит в профиле.
  { id: "mix", leaf: -1, label: { RU: "Все три", EN: "All three" } },
  { id: "maple", leaf: 0, label: { RU: "Клён", EN: "Maple" } },
  { id: "oak", leaf: 1, label: { RU: "Дуб", EN: "Oak" } },
  { id: "mint", leaf: 2, label: { RU: "Мята", EN: "Mint" } },
];
const WREATH_LEAF_BY_ID = Object.fromEntries(WREATH_LEAF_KINDS.map((k) => [k.id, k]));

// Расстановка та же, что у малого знака: пять листьев на ветку по дуге,
// к верхнему разрыву мельчают. Размеры — в единицах картинки 200×200.
const WREATH_BIG_R = 62;
function wreathBigBranchPath(side) {
  const cx = 100, cy = 100, r = WREATH_BIG_R;
  const p = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + side * r * Math.sin(a), cy - r * Math.cos(a)];
  };
  const [x1, y1] = p(WREATH_FROM);
  const [x2, y2] = p(WREATH_TO);
  return `M${x1} ${y1} A ${r} ${r} 0 0 ${side > 0 ? 1 : 0} ${x2} ${y2}`;
}

const AvatarWreathArt = React.memo(function AvatarWreathArt({ tier = 0, kindId = "mix", size = 200, animate = true }) {
  const glowId = React.useId();
  if (!tier) return null;
  // Вид листа берётся на каждый листик отдельно: в смешанном венке они
  // чередуются клён — дуб — мята, причём по номеру места на ветке, так
  // что левая и правая половины остаются зеркальными.
  const pick = (WREATH_LEAF_BY_ID[kindId] || WREATH_LEAF_KINDS[0]).leaf;
  const leafAt = (i) => LEAF_KINDS[pick < 0 ? i % LEAF_KINDS.length : pick];
  const filled = tier >= 2;
  const veinColor = filled ? T.bg : T.electric;

  // Сам венок — без черенков: они торчали внутрь и ложились палками на
  // аватарку. Лист крепится прямо к ветке, этого достаточно.
  const renderBody = (moving) => (
    <>
      {[-1, 1].map((side) => (
        <path
          key={side} d={wreathBigBranchPath(side)} fill="none"
          stroke={T.electric} strokeWidth={2.6} strokeLinecap="round" opacity={0.8}
        />
      ))}
      {WREATH_POS.map((p, idx) => {
        const kind = leafAt(p.i);
        return (
          <g key={idx} transform={`rotate(${p.deg} 100 100) translate(100 ${100 - WREATH_BIG_R})`}>
            <g style={moving ? {
              transformBox: "fill-box", transformOrigin: "50% 100%",
              animation: `wreathSway ${wreathSwayTime(p)} ease-in-out ${wreathSwayDelay(p)} infinite`,
              willChange: "transform",
            } : undefined}>
              <g transform={`rotate(${p.side * -14}) scale(${(1.12 * p.scale).toFixed(3)})`}>
                <path d={kind.outline} fill={filled ? T.electric : "none"} stroke={T.electric} strokeWidth={filled ? 0.8 : 1.5} strokeLinejoin="round" />
                {kind.veins.map((v, vi) => (
                  <path key={vi} d={v} fill="none" stroke={veinColor} strokeWidth={0.8} opacity={filled ? 0.32 : 0.55} strokeLinecap="round" />
                ))}
              </g>
            </g>
          </g>
        );
      })}
      {tier >= 3 && (
        <path
          d={starPath(100, 21, 19)} fill={T.electric}
          style={moving ? {
            transformBox: "fill-box", transformOrigin: "50% 50%",
            animation: "wreathStar 4.5s ease-in-out infinite",
          } : undefined}
        />
      )}
    </>
  );

  return (
    <svg
      width={size} height={size} viewBox="0 0 200 200"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {/* Свечение — отдельным размытым слоем снизу, а не фильтром на всей
          картинке: drop-shadow размывал и сами листья, и венок выглядел
          мутным. Так гало есть, а края остаются острыми.

          Слой свечения намеренно неподвижен. Пока он повторял анимацию,
          браузер каждый кадр пересчитывал размытие и подгонял область
          фильтра к целым пикселям — от этого вся конструкция чуть
          подрагивала вверх-вниз. Неподвижное гало этого не делает, а на
          глаз размытое пятно и не должно качаться вместе с листьями. */}
      {tier >= 3 && (
        <>
          <defs>
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4.5" />
            </filter>
          </defs>
          <g filter={`url(#${glowId})`} opacity={0.7} aria-hidden="true">{renderBody(false)}</g>
        </>
      )}
      {renderBody(animate)}
    </svg>
  );
});

/* Значки рядом с ником — венок создателя и подтверждение аккаунта.

   Оба объясняют себя по нажатию, поэтому окно у них одно на двоих:
   отличаются только картинкой и текстом. Значки висят и на чужих
   профилях, где догадаться об их смысле неоткуда.

   Окно уходит в портал: значок нередко лежит внутри кнопки перехода на
   профиль и внутри блоков с обрезкой. */
const WREATH_TIER_SUM = ["", "$1K", "$10K", "$100K"];

/* BadgeSheet — карточка снизу: картинка вырастает, подпись проявляется
   вместе с ней. Не впритык к краям экрана, иначе читается как обрезанная
   полоса, а не как отдельное окно. */
function BadgeSheet({ onClose, art, title, subtitle, text }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fx-modal-back"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 12px calc(12px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, background: T.surface,
          border: `1px solid ${T.lineHi}`, borderRadius: 26,
          padding: "26px 22px 22px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          animation: "wreathSheetUp 340ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div style={{
          width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center",
          animation: "wreathGrowIn 1100ms cubic-bezier(0.22,1,0.28,1) 120ms both",
        }}>
          {art}
        </div>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", width: "100%",
          animation: "wreathCaptionIn 520ms ease-out 160ms both",
        }}>
          <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 18, fontWeight: 700, marginTop: 12 }}>{title}</span>
          {subtitle && (
            <span style={{ fontFamily: displayFont, color: T.electric, fontSize: 13, fontWeight: 700, marginTop: 2 }}>{subtitle}</span>
          )}
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, marginTop: 8, maxWidth: 280 }}>{text}</p>
          <button
            onClick={onClose}
            className="fx-tap w-full rounded-[20px] py-3"
            style={{ marginTop: 18, maxWidth: 320, background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice }}
          >
            {tr("wreathClose")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* BadgeTap — область нажатия вокруг значка. Палец толще самого значка
   (16–19px), поэтому область расширена отступом и тут же убрана
   отрицательным полем: на раскладку это не влияет. zIndex поднят —
   венок вокруг аватарки заходит своим слоем на строку с ником. */
function BadgeTap({ label, onOpen, children }) {
  return (
    <span
      role="button" tabIndex={0} aria-label={label}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", lineHeight: 0, padding: 13, margin: -13, borderRadius: 999,
        position: "relative", zIndex: 3, pointerEvents: "auto", touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </span>
  );
}

function CreatorWreathBadge({ tier = 0, kindId = "mix", size = 19 }) {
  const [open, setOpen] = useState(false);
  if (!tier) return null;
  const close = (e) => { if (e) { e.stopPropagation(); e.preventDefault(); } setOpen(false); };
  return (
    <>
      <BadgeTap label={tr("wreathBadgeTitle")} onOpen={() => setOpen(true)}>
        <CreatorWreath tier={tier} size={size} />
      </BadgeTap>
      {open && (
        <BadgeSheet
          onClose={close}
          art={<AvatarWreathArt tier={tier} kindId={kindId} size={160} />}
          title={tr("wreathBadgeTitle")}
          subtitle={tr(`wreathTier${tier}`)}
          text={trf("wreathBadgeBody", { sum: WREATH_TIER_SUM[tier] || "" })}
        />
      )}
    </>
  );
}

/* VerifiedBadge — щит подтверждения. Окно то же, что у венка: человек
   уже знает, что значок можно нажать, и ждёт такого же объяснения. */
function VerifiedBadge({ verified = false, size = 16 }) {
  const [open, setOpen] = useState(false);
  if (!verified) return null;
  const close = (e) => { if (e) { e.stopPropagation(); e.preventDefault(); } setOpen(false); };
  return (
    <>
      <BadgeTap label={tr("verifiedBadgeTitle")} onOpen={() => setOpen(true)}>
        <ShieldCheck size={size} color={T.electric} />
      </BadgeTap>
      {open && (
        <BadgeSheet
          onClose={close}
          art={(
            <div style={{
              width: 132, height: 132, borderRadius: "50%",
              background: hexA(T.electric, 0.12),
              border: `1px solid ${hexA(T.electric, 0.35)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              filter: `drop-shadow(0 0 14px ${hexA(T.electric, 0.45)})`,
            }}>
              <ShieldCheck size={68} color={T.electric} />
            </div>
          )}
          title={tr("verifiedBadgeTitle")}
          text={tr("verifiedBadgeBody")}
        />
      )}
    </>
  );
}

// Ступень по лучшей капитализации своего токена. Пороги те же, что у
// достижений, — знак и достижение всегда приходят вместе.
function creatorTierOf(mcapUsd) {
  const v = Number(mcapUsd) || 0;
  if (v >= 100000) return 3;
  if (v >= 10000) return 2;
  if (v >= 1000) return 1;
  return 0;
}

/* TrustPanel — то, на что смотрят перед покупкой: сколько выпуска
   осталось у создателя и трогал ли он его вообще.

   Всё считается по цепочке. Сколько он купил при запуске, приложение
   знает из своей записи, сколько лежит сейчас — спрашивает у сети.
   Разница между этими числами и есть ответ на вопрос «продавал ли».
   У токенов, запущенных до появления этой проверки, кошелька создателя
   в записи нет — тогда честнее сказать «нет данных», чем додумывать. */
function TrustPanel({ token, testnet = false, holders = null }) {
  const [held, setHeld] = useState(undefined); // undefined — ещё грузим
  const wallet = token.creatorWallet;
  const supply = Number(token.supply) || 0;
  const bought = Number(token.buyTokens) || 0;

  useEffect(() => {
    if (!wallet || !token.address) { setHeld(null); return; }
    let cancelled = false;
    fetchJettonBalance(token.address, wallet, testnet)
      .then((b) => { if (!cancelled) setHeld(b); })
      .catch(() => { if (!cancelled) setHeld(null); });
    return () => { cancelled = true; };
  }, [wallet, token.address, testnet]);

  const pct = supply > 0 && held != null ? (held / supply) * 100 : null;
  // Порог в 1% — против пыли: остаток в несколько токенов после продажи
  // всего мешка не должен читаться как «ничего не продавал».
  const sold = held != null && bought > 0 && held < bought * 0.99;

  const rows = [];
  if (holders != null) rows.push([tr("trustHolders"), holders.toLocaleString("ru-RU"), T.ice]);
  if (bought > 0) rows.push([tr("trustCreatorBought"), `${fmtCompact(bought)} ${token.ticker ? "$" + token.ticker : ""}`, T.ice]);
  if (pct != null) rows.push([tr("trustCreatorHolds"), `${pct.toFixed(pct < 10 ? 1 : 0)}${tr("trustOfSupply")}`, pct > 20 ? T.down : T.ice]);

  return (
    <div className="rounded-[22px] p-3.5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
      <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tr("trustTitle")}</div>
      {rows.map(([label, value, color]) => (
        <div key={label} className="flex items-center justify-between" style={{ padding: "3px 0" }}>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{label}</span>
          <span style={{ fontFamily: monoFont, color, fontSize: 12, fontWeight: 700 }}>{value}</span>
        </div>
      ))}
      {!wallet ? (
        <div className="flex items-center gap-1.5" style={{ marginTop: 6 }}>
          <ShieldAlert size={13} color={T.muted} />
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>{tr("trustUnknown")}</span>
        </div>
      ) : held === undefined ? (
        <div className="fx-skeleton" style={{ width: "60%", height: 10, borderRadius: 4, marginTop: 8 }} />
      ) : (
        <div className="flex items-center gap-1.5" style={{ marginTop: 6 }}>
          {sold ? <ShieldAlert size={13} color={T.down} /> : <ShieldCheck size={13} color={T.up} />}
          <span style={{ fontFamily: bodyFont, color: sold ? T.down : T.up, fontSize: 11.5 }}>
            {sold ? tr("trustSold") : tr("trustNotSold")}
          </span>
        </div>
      )}
    </div>
  );
}

/* GraduationBar — сколько TON собрала кривая и сколько осталось до
   закрытия торгов и перехода на биржу.

   Оба числа берутся у самой кривой: цель зашита в контракт при запуске,
   и у токенов, созданных до смены настроек, она своя. Считать по
   настройкам приложения нельзя — покажем чужую цель. */
function GraduationBar({ raisedTon = 0, targetTon = 0, compact = false }) {
  if (!(targetTon > 0)) return null;
  const pct = Math.max(0, Math.min(100, (raisedTon / targetTon) * 100));
  const left = Math.max(0, targetTon - raisedTon);
  const done = left <= 0;
  if (compact) {
    return (
      <div style={{ height: 3, borderRadius: 2, background: T.surfaceHi, overflow: "hidden", marginTop: 6 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: done ? T.up : T.electric }} />
      </div>
    );
  }
  return (
    <div className="rounded-[22px] p-3.5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>{tr("gradTitle")}</span>
        <span style={{ fontFamily: monoFont, color: done ? T.up : T.ice, fontSize: 12, fontWeight: 700 }}>
          {done ? tr("gradDone") : `${pct.toFixed(0)}%`}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: T.surfaceHi, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: done ? T.up : T.electric, transition: `width ${EASE}` }} />
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: 7 }}>
        <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 11 }}>
          {fmtTon(raisedTon)} / {fmtTon(targetTon)} TON
        </span>
        {!done && (
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11 }}>{trf("gradLeft", { left: fmtTon(left) })}</span>
        )}
      </div>
      <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11, lineHeight: 1.45, marginTop: 8 }}>
        {trf("gradNote", { target: fmtTon(targetTon) })}
      </p>
    </div>
  );
}

/* AvatarFrame — круглая рамка вокруг аватарки. Толщина считается от
   размера, чтобы предмет одинаково смотрелся и на 120px в профиле, и на
   64px в превью магазина. */
// Мемоизация не украшение: и рамка, и подложка — это десятки
// анимированных слоёв с размытием. Без неё любое обновление состояния
// приложения (например всплывающая подсказка после выбора) заставляло
// браузер заново раскладывать всю витрину, и выделение появлялось с
// заметной задержкой.
const AvatarFrame = React.memo(function AvatarFrame({ frameId, size = 120, children }) {
  const f = FRAME_BY_ID[frameId] || FRAME_BY_ID.none;
  const ring = Math.max(2, Math.round(size * 0.035));
  const inner = (
    <div style={{ position: "absolute", inset: ring, borderRadius: "50%", overflow: "hidden", background: T.bg }}>
      {children}
    </div>
  );

  if (f.id === "none") {
    return <div style={{ position: "relative", width: size, height: size }}>{inner}</div>;
  }

  const orbitR = size / 2 + ring * 1.5;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* дышащее свечение под рамкой */}
      <div style={{
        position: "absolute", inset: -ring, borderRadius: "50%",
        boxShadow: `0 0 ${size * 0.18}px ${ring}px ${hexA(f.glow, 0.35)}`,
        animation: "glowPulse 3.2s ease-in-out infinite",
      }} />
      {/* само кольцо — вращающийся конический градиент */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: `conic-gradient(from 0deg, ${f.colors.join(", ")})`,
        animation: `spin360 ${f.spin}s linear infinite`,
        willChange: "transform",
      }} />
      {inner}
      {/* точки, вращающиеся по орбите вокруг рамки */}
      {Array.from({ length: f.orbiters || 0 }).map((_, i) => (
        <span key={`o${i}`} style={{
          position: "absolute", left: "50%", top: "50%",
          width: ring * 1.6, height: ring * 1.6, marginLeft: -ring * 0.8, marginTop: -ring * 0.8,
          borderRadius: "50%", background: f.orbitColor,
          boxShadow: `0 0 ${ring * 3}px ${ring * 0.6}px ${hexA(f.orbitColor, 0.6)}`,
          ["--orbit-r"]: `${orbitR}px`,
          animation: `spotlightOrbit ${9 + i * 2}s linear ${-i * 3}s infinite`,
        }} />
      ))}
      {/* мерцающие звёздочки по краю */}
      {Array.from({ length: f.sparks || 0 }).map((_, i) => {
        const a = (360 / (f.sparks || 1)) * i;
        const px = Math.cos((a * Math.PI) / 180) * orbitR;
        const py = Math.sin((a * Math.PI) / 180) * orbitR;
        const s = ring * 2.6;
        return (
          <svg key={`s${i}`} width={s} height={s} viewBox="0 0 10 10" style={{
            position: "absolute", left: "50%", top: "50%",
            transform: `translate(${px - s / 2}px, ${py - s / 2}px)`,
            ["--o"]: 0.9,
            opacity: 0,
            animation: `starPulse ${2.6 + i * 0.3}s ease-in-out ${-i * 0.4}s infinite`,
          }}>
            <path d="M5 0 C5.4 3.2 6.8 4.6 10 5 C6.8 5.4 5.4 6.8 5 10 C4.6 6.8 3.2 5.4 0 5 C3.2 4.6 4.6 3.2 5 0 Z" fill="#FFFFFF" />
          </svg>
        );
      })}
    </div>
  );
});

/* ProfileCardBg — подложка, которая рисуется за аватаркой и шапкой
   профиля. Абсолютная, ничего не ловит по клику и обрезается по своему
   контейнеру. */
const ProfileCardBg = React.memo(function ProfileCardBg({ cardId, height = 260, radius = 24, bleed = 0, top = 0 }) {
  const c = CARD_BY_ID[cardId] || CARD_BY_ID.none;
  const blobs = useMemo(() => {
    const rnd = seededRand(hashSeed(cardId || "none"));
    return (c.blobs || []).map(([color, opacity], i) => ({
      color, opacity,
      size: 180 + rnd() * 140,
      left: `${5 + rnd() * 70}%`,
      top: `${rnd() * 55}%`,
      dur: 18 + rnd() * 14,
      delay: -i * 6,
    }));
  }, [cardId]);
  const stars = useMemo(() => {
    const rnd = seededRand(hashSeed(`${cardId}-stars`));
    return Array.from({ length: c.stars || 0 }, () => ({
      left: rnd() * 100, top: rnd() * 100, size: 4 + rnd() * 4,
      opacity: 0.35 + rnd() * 0.5, dur: 3 + rnd() * 4, delay: -rnd() * 6,
    }));
  }, [cardId]);

  if (c.id === "none") return null;
  const gridImg = c.grid
    ? `linear-gradient(${c.grid} 1px, transparent 1px), linear-gradient(90deg, ${c.grid} 1px, transparent 1px)`
    : null;

  return (
    <div aria-hidden style={{
      position: "absolute", left: -bleed, right: -bleed, top,
      height: height - Math.min(0, top),
      borderRadius: radius, overflow: "hidden", pointerEvents: "none", zIndex: 0,
      contain: "layout paint style",
    }}>
      <div style={{ position: "absolute", inset: 0, background: c.base }} />

      {blobs.map((b, i) => (
        <div key={i} style={{
          position: "absolute", left: b.left, top: b.top, width: b.size, height: b.size,
          borderRadius: "50%", filter: "blur(34px)",
          background: `radial-gradient(circle, ${hexA(b.color, b.opacity)} 0%, ${hexA(b.color, 0)} 70%)`,
          animation: `spotlightPulse ${b.dur}s ease-in-out ${b.delay}s infinite`,
          willChange: "transform",
        }} />
      ))}

      {gridImg && !c.floor && (
        <div style={{
          position: "absolute", inset: 0, backgroundImage: gridImg, backgroundSize: "38px 38px",
          animation: "gridDrift 26s linear infinite",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 90%)",
          maskImage: "linear-gradient(to bottom, #000 0%, transparent 90%)",
        }} />
      )}

      {c.floor && (
        <div style={{ position: "absolute", inset: 0, perspective: 220, perspectiveOrigin: "50% 0%" }}>
          <div style={{
            position: "absolute", left: "-50%", right: "-50%", top: "45%", height: "160%",
            backgroundImage: gridImg || `linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)`,
            backgroundSize: "38px 38px",
            transform: "rotateX(76deg)", transformOrigin: "50% 0%",
            animation: "gridRunToward 6s linear infinite",
            WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 60%)",
            maskImage: "linear-gradient(to bottom, #000 0%, transparent 60%)",
          }} />
        </div>
      )}

      {stars.map((s, i) => (
        <svg key={i} width={s.size} height={s.size} viewBox="0 0 10 10" style={{
          position: "absolute", left: `${s.left}%`, top: `${s.top}%`,
          ["--o"]: s.opacity, opacity: 0,
          animation: `starPulse ${s.dur}s ease-in-out ${s.delay}s infinite`,
        }}>
          <path d="M5 0 C5.4 3.2 6.8 4.6 10 5 C6.8 5.4 5.4 6.8 5 10 C4.6 6.8 3.2 5.4 0 5 C3.2 4.6 4.6 3.2 5 0 Z" fill="#FFFFFF" />
        </svg>
      ))}

      {/* низ подложки растворяется в фоне приложения, чтобы она читалась
          как фон экрана, а не как обрезанный прямоугольник; по бокам
          карточка идёт до самых краёв */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: "62%",
        background: `linear-gradient(to bottom, ${hexA(T.bg, 0)} 0%, ${hexA(T.bg, 0.55)} 45%, ${T.bg} 100%)`,
      }} />
    </div>
  );
});

/* BootSplash — стартовая заставка. Перекрывает весь интерфейс, пока идут
   первые запросы, и показывает, что именно ещё грузится: так пустые
   экраны не мелькают до прихода данных. */
function BootSplash({ steps, done, insetTop = 0 }) {
  const readyCount = steps.filter((s) => s.done).length;
  const progress = steps.length ? readyCount / steps.length : 1;

  return (
    <div
      style={{
        position: "absolute", inset: 0, zIndex: 900,
        background: T.bg,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 22, paddingTop: insetTop,
        opacity: done ? 0 : 1,
        transition: "opacity 420ms ease-out",
      }}
    >
      <CyberGrid />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: "100%", padding: "0 32px" }}>
        {/* логотип в фирменной вращающейся рамке */}
        <AvatarFrame frameId="ember" size={112}>
          <div style={{ width: "100%", height: "100%", background: `center/cover no-repeat url(/icon.PNG)` }} />
        </AvatarFrame>

        <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Mintly</span>

        {/* полоса прогресса — заполняется по мере готовности шагов */}
        <div style={{ width: "100%", maxWidth: 240, height: 4, borderRadius: 999, background: T.surfaceHi, overflow: "hidden" }}>
          <div style={{
            width: `${Math.round(progress * 100)}%`, height: "100%", borderRadius: 999,
            background: T.electric, transition: "width 420ms cubic-bezier(0.16,1,0.3,1)",
          }} />
        </div>

        <div className="flex flex-col gap-1.5" style={{ minWidth: 200 }}>
          {steps.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              {s.done
                ? <CheckCircle2 size={14} color={T.up} />
                : <RefreshCw size={14} color={T.muted} style={{ animation: "spin360 1.1s linear infinite" }} />}
              <span style={{ fontFamily: bodyFont, fontSize: 12.5, color: s.done ? T.paper : T.muted }}>{t(s.key)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Одна карточка витрины. Отдельный мемоизированный компонент: при выборе
   предмета меняются ровно две карточки из десятка, а остальные — со всеми
   своими размытиями и анимациями — вообще не перерисовываются. Раньше
   перерисовывались все, и оранжевая рамка появлялась с задержкой. */
const ShopItem = React.memo(function ShopItem({ item, kind, equipped, locked, lockHint, onEquip, onLocked }) {
  const handle = useCallback(
    () => (locked ? onLocked && onLocked(lockHint) : onEquip(kind, item.id)),
    [locked, lockHint, onLocked, onEquip, kind, item.id],
  );
  return (
    <button
      onClick={handle}
      className={`fx-card flex flex-col items-center gap-2.5 rounded-[22px] p-3${equipped ? " fx-picked" : ""}`}
      style={{ background: T.surface, border: `1px solid ${T.line}`, position: "relative", overflow: "hidden", contain: "paint", opacity: locked ? 0.55 : 1 }}
    >
      <div style={{ position: "relative", width: "100%", height: 96, borderRadius: 16, overflow: "hidden", background: T.surfaceHi, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {kind === "card" && <ProfileCardBg cardId={item.id} height={96} radius={16} />}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Внутри рамки — просто чёрный кружок: витрина про сам
              предмет, а своя аватарка тут только отвлекает. */}
          <AvatarFrame frameId={kind === "frame" ? item.id : "none"} size={62}>
            <div style={{ width: "100%", height: "100%", background: T.bg }} />
          </AvatarFrame>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 12.5, fontWeight: 700 }}>{pickLabel(item.label)}</span>
        {equipped && <CheckCircle2 size={13} color={T.electric} />}
        {locked && <Lock size={12} color={T.muted} />}
      </div>
      <span style={{ fontFamily: bodyFont, fontSize: 11, color: equipped ? T.electric : T.muted, textAlign: "center", lineHeight: 1.3 }}>
        {locked ? lockHint : equipped ? t("shopEquipped") : t("shopEquip")}
      </span>
    </button>
  );
});

/* AchievementsView — отдельная страница достижений.

   На ней видно и что уже закрыто, и что за это даётся: у награды
   рисуется сам предмет — рамка кружком, карточка полоской подложки, —
   чтобы не гадать по названию. */
function AchievementsView({ achievements = [], onGoShop, onBack }) {
  const done = achievements.filter((a) => a.done).length;
  return (
    <div className="fx-view flex flex-col gap-4 pt-2">
      {onBack && (
        <button onClick={onBack} className="fx-tap flex items-center gap-1 self-start" style={{ fontFamily: bodyFont, fontSize: 13, color: T.muted }}>
          <ChevronLeft size={16} /> {t("back")}
        </button>
      )}
      <div>
        <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("achievementsTitle")}</span>
        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, marginTop: 4 }}>{t("achievementsIntro")}</p>
      </div>

      {/* Общий прогресс */}
      <div className="rounded-[22px] p-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{t("achProgress")}</span>
          <span style={{ fontFamily: monoFont, color: T.ice, fontSize: 13, fontWeight: 700 }}>{tf("achUnlockedOf", { done, total: achievements.length })}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: T.surfaceHi, overflow: "hidden" }}>
          <div style={{ width: `${achievements.length ? (done / achievements.length) * 100 : 0}%`, height: "100%", background: T.electric, transition: `width ${EASE}` }} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {achievements.map((a, i) => {
          const frame = a.reward && a.reward.kind === "frame" ? a.reward.id : null;
          const card = a.reward && a.reward.kind === "card" ? a.reward.id : null;
          const rewardLabel = frame
            ? pickLabel((FRAME_BY_ID[frame] || {}).label || { RU: frame, EN: frame })
            : card ? pickLabel((CARD_BY_ID[card] || {}).label || { RU: card, EN: card }) : null;
          return (
            <div
              key={a.id}
              className="fx-card rounded-[22px] p-3.5 flex items-center gap-3"
              style={{
                background: T.surface,
                border: `1px solid ${a.done ? hexA(a.color, 0.45) : T.line}`,
                animationDelay: `${i * 40}ms`,
                position: "relative", overflow: "hidden",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: a.done ? hexA(a.color, 0.16) : T.surfaceHi,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <a.icon size={18} color={a.done ? a.color : T.muted} />
              </div>

              <div className="min-w-0" style={{ flex: 1 }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 13.5, fontWeight: 700 }}>{a.label}</span>
                  {a.done && <CheckCircle2 size={13} color={a.color} />}
                </div>
                <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5, lineHeight: 1.35, marginTop: 2 }}>{a.hint}</div>
                {!a.done && a.target > 1 && (
                  <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.surfaceHi, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, (a.value / a.target) * 100)}%`, height: "100%", background: hexA(a.color, 0.65) }} />
                    </div>
                    <span style={{ fontFamily: monoFont, fontSize: 10.5, color: T.muted }}>{achProgressText(a)}</span>
                  </div>
                )}
                {rewardLabel && (
                  <div className="flex items-center gap-1.5" style={{ marginTop: 6 }}>
                    <Gift size={11} color={a.done ? a.color : T.muted} />
                    <span style={{ fontFamily: bodyFont, fontSize: 10.5, color: a.done ? T.ice : T.muted }}>
                      {a.done ? t("achRewardOpened") : t("achRewardLocked")}: {rewardLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Сам предмет — видно, за что стараться */}
              {frame && (
                <div style={{ flexShrink: 0, opacity: a.done ? 1 : 0.45 }}>
                  <AvatarFrame frameId={frame} size={46}>
                    <div style={{ width: "100%", height: "100%", background: T.bg }} />
                  </AvatarFrame>
                </div>
              )}
              {card && (
                <div style={{ width: 60, height: 46, borderRadius: 12, overflow: "hidden", position: "relative", flexShrink: 0, background: T.surfaceHi, opacity: a.done ? 1 : 0.45 }}>
                  <ProfileCardBg cardId={card} height={46} radius={12} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onGoShop && (
        <button
          onClick={onGoShop}
          className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3"
          style={{ background: T.surface, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice }}
        >
          <ShoppingBag size={15} color={T.electric} /> {t("achGoShop")}
        </button>
      )}
    </div>
  );
}

/* ShopView — витрина косметики: рамки для аватарки и карточки профиля.
   Предметы применяются мгновенно и запоминаются на устройстве, поэтому
   «купить» здесь — это «надеть»: отдельного баланса у магазина нет. */
function ShopView({ cosmetics, onEquip, achievements = [], onOpenAchievements, showToast }) {
  const [tab, setTab] = useState("frames");
  // Нажатие отмечается сразу здесь, не дожидаясь, пока выбор дойдёт до
  // состояния всего приложения и вернётся обратно пропсом. Рамка при
  // этом появляется в том же кадре, что и само нажатие.
  const [pending, setPending] = useState(null); // { kind, id }
  // Обработчик через ссылку: сам onEquip создаётся заново при каждой
  // перерисовке приложения, и мемоизация карточек была бы бесполезна.
  const equipRef = useRef(onEquip);
  useEffect(() => { equipRef.current = onEquip; });
  const equip = useCallback((kind, id) => {
    setPending({ kind, id });
    equipRef.current(kind, id);
  }, []);
  const items = tab === "frames" ? AVATAR_FRAMES : PROFILE_CARDS;
  const kind = tab === "frames" ? "frame" : "card";
  const equippedId = pending && pending.kind === kind ? pending.id : cosmetics[kind];
  // Выбор доехал — своя пометка больше не нужна, дальше показываем то,
  // что действительно надето.
  useEffect(() => {
    if (pending && cosmetics[pending.kind] === pending.id) setPending(null);
  }, [cosmetics, pending]);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("shopTitle")}</span>
      <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>{t("shopIntro")}</p>

      <div className="flex items-center gap-2">
        {[["frames", t("shopTabFrames")], ["cards", t("shopTabCards")]].map(([id, label]) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} className="fx-tap fx-chip rounded-full px-3.5 py-1.5"
              style={{
                fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600,
                background: active ? T.ice : "transparent", color: active ? T.bg : T.muted,
                border: `1px solid ${active ? T.ice : T.line}`,
              }}>
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5" key={tab}>
        {items.map((item) => {
          const unlocked = cosmeticUnlocked(kind, item.id, achievements);
          const achId = COSMETIC_LOCKS[`${kind}:${item.id}`];
          const ach = achId ? achievements.find((a) => a.id === achId) : null;
          return (
            <ShopItem
              key={item.id}
              item={item}
              kind={kind}
              equipped={equippedId === item.id}
              locked={!unlocked}
              lockHint={ach ? ach.hint : ""}
              onEquip={equip}
              onLocked={(hint) => {
                if (showToast) showToast(hint || t("shopLocked"));
                if (onOpenAchievements) onOpenAchievements();
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function MempadView({ tokens, loading, myTokens, onOpen, onLaunch }) {
  const [filter, setFilter] = useState("new");

  // «В центре внимания» — пятёрка токенов, по которым прошло больше всего
  // сделок за последний час, и она прокручивается по кругу. Час берём как
  // основное окно: он показывает, где движение прямо сейчас, а не кто
  // крупнее по капитализации. Если за час везде тихо (ночь, выходные),
  // окно расширяется до 6 часов, потом до суток — так карточка никогда не
  // остаётся пустой.
  const spotlightTop = useMemo(() => {
    if (!tokens.length) return [];
    const ranked = (win) =>
      [...tokens]
        .filter((tok) => (tok[win] || 0) > 0)
        .sort((a, b) => (b[win] || 0) - (a[win] || 0));
    const byActivity = ["tx1h", "tx6h", "tx24h"].map(ranked).find((list) => list.length);
    const list = byActivity || [...tokens].sort((a, b) => b.mcapNum - a.mcapNum);
    return list.slice(0, SPOTLIGHT_COUNT);
  }, [tokens]);

  const [spotIdx, setSpotIdx] = useState(0);
  useEffect(() => {
    if (spotlightTop.length < 2) return;
    const iv = setInterval(() => setSpotIdx((i) => i + 1), SPOTLIGHT_ROTATE_MS);
    return () => clearInterval(iv);
  }, [spotlightTop.length]);

  // Индекс намеренно растёт без ограничения, а по кругу гоняем здесь:
  // так смена ленты не сбрасывает позицию на первый токен.
  const spotlight = spotlightTop.length ? spotlightTop[spotIdx % spotlightTop.length] : null;

  const localTokens = useMemo(() => (myTokens || []).map(localTokenToFeedShape), [myTokens]);

  const list = useMemo(() => {
    // "New" now means what it literally says: tokens launched through
    // this app, not the newest items in the external real-market feed.
    if (filter === "new") return localTokens;
    const featured = new Set(spotlightTop.map((tok) => tok.id));
    let arr = tokens.filter((tok) => !featured.has(tok.id));
    switch (filter) {
      case "hot": arr = [...arr].sort((a, b) => b.change - a.change); break;
      case "dex": arr = arr.filter(tok => tok.verified); break;
      default: break;
    }
    return arr;
  }, [tokens, filter, spotlightTop, localTokens]);

  return (
    <div className="flex flex-col gap-5" style={{ paddingBottom: 12 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("navMempad")}</span>
        {/* Кнопка в цвете приложения: зелёный здесь был из набора
            «рост цены», к запуску токена отношения не имеющего. Фирменный
            оранжевый, лист тем же цветом. */}
        <button
          onClick={onLaunch}
          className="fx-tap flex items-center gap-1.5 rounded-full px-3.5 py-2"
          style={{
            background: hexA(T.electric, 0.13),
            border: `1px solid ${hexA(T.electric, 0.4)}`,
            boxShadow: `0 0 14px ${hexA(T.electric, 0.18)}`,
            position: "relative", overflow: "hidden",
          }}
        >
          <ButtonRocketFlyby size={34} />
          <LeafIcon size={17} color={T.electric} />
          <span style={{ fontFamily: bodyFont, color: T.electric, fontSize: 12.5, fontWeight: 700, position: "relative", zIndex: 1 }}>{t("mempadLaunchToken")}</span>
        </button>
      </div>

      <RecentBuysTicker tokens={tokens} curveTokens={myTokens} onOpen={onOpen} />

      {loading && !spotlight ? (
        <div className="fx-card rounded-[22px] p-6 flex flex-col items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <div className="fx-skeleton" style={{ width: 92, height: 92, borderRadius: "50%" }} />
          <div className="fx-skeleton" style={{ width: 90, height: 16, borderRadius: 4 }} />
          <div className="fx-skeleton" style={{ width: 130, height: 24, borderRadius: 4 }} />
        </div>
      ) : spotlight && (
        <div>
          <SectionTitle>{t("mempadSpotlight")}</SectionTitle>
          {/* key по токену — карточка переигрывает своё появление на каждой
              смене, поэтому подмена не выглядит как рывок. */}
          <button key={spotlight.id} onClick={() => onOpen(spotlight)} className="fx-card w-full flex flex-col items-center text-center gap-2.5 rounded-[22px] p-6" style={{ border: `1px solid ${T.line}`, position: "relative", overflow: "hidden" }}>
            <SpotlightGrid up={spotlight.change >= 0} seedKey={spotlight.seed} />
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <TokenAvatar size={92} tone={spotlight.change >= 0 ? "up" : "down"} src={spotlight.logoUrl}>{spotlight.emoji}</TokenAvatar>
              <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 20, fontWeight: 800 }}>{spotlight.ticker}</span>
              <div className="flex items-center gap-3">
                <HoldersBadge tokenAddress={spotlight.tokenAddress} testnet={!!spotlight.curveAddress && TON_TESTNET_NETWORK} />
                <CardStat icon={Flame}>${spotlight.vol}</CardStat>
              </div>
              <span style={{ fontFamily: displayFont, color: T.up, fontSize: 27, fontWeight: 800, lineHeight: 1 }}>{fmtUSD(spotlight.mcapNum)}</span>
              {fmtAge(spotlight.createdAt) && (
                <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 11 }}>{fmtAge(spotlight.createdAt)}</span>
              )}
            </div>
          </button>

          {/* Точки показывают, что токен здесь не один: их столько же,
              сколько в подборке, и по ним можно переключиться руками. */}
          {spotlightTop.length > 1 && (
            <div className="flex items-center justify-center gap-1.5" style={{ marginTop: 10 }}>
              {spotlightTop.map((tok, i) => {
                const active = i === spotIdx % spotlightTop.length;
                return (
                  <button
                    key={tok.id}
                    onClick={() => setSpotIdx(i)}
                    aria-label={tok.ticker}
                    className="fx-tap"
                    style={{
                      width: active ? 18 : 6, height: 6, borderRadius: 999,
                      background: active ? T.electric : T.lineHi,
                      border: "none", padding: 0,
                      transition: `width ${EASE}, background ${EASE}`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto" style={{ touchAction: "pan-x", overscrollBehaviorX: "contain", overflowY: "hidden" }}>
        {MEMPAD_FILTERS.map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} className="fx-tap fx-chip rounded-full px-3.5 py-1.5 whitespace-nowrap flex-shrink-0"
              style={{
                fontFamily: bodyFont, fontSize: 12.5, fontWeight: 600, background: active ? T.ice : "transparent",
                color: active ? T.bg : T.muted, border: `1px solid ${active ? T.ice : "transparent"}`,
              }}>
              {t(f.labelKey)}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button className="fx-tap flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: "50%", background: T.surface, border: `1px solid ${T.line}` }}>
          <Search size={14} color={T.muted} />
        </button>
      </div>

      <div className="flex flex-col gap-2" key={filter}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <MempadRowSkeleton key={i} index={i} />)
          : list.map((tok, i) => <MempadRow key={tok.id} t={tok} onOpen={onOpen} index={i} />)}
        {!loading && list.length === 0 && (
          <div className="fx-view" style={{ fontFamily: bodyFont, color: T.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
            {t("emptyFilter")}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeView({ onGoTab }) {
  return (
    <div className="flex flex-col gap-4" style={{ paddingBottom: 12 }}>
      <HomeHero onGoTab={onGoTab} />

      <div className="fx-view rounded-[22px] p-5 flex flex-col items-center text-center gap-2" style={{ background: T.surface, border: `1px dashed ${T.line}` }}>
        <Sparkles size={20} color={T.muted} />
        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 13, lineHeight: 1.5 }}>
          {t("homeUpdatesComingSoon")}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TOKEN DETAIL VIEW
--------------------------------------------------------- */

const CHART_TOTAL = 140;

function TokenDetail({ t: token, onBack, showToast, onBuy, onSell, unlocked = true, connected = true, onConnectWallet, themeKey, currentUserId = null, onNeedAuth, onOpenProfile, tonPriceUsd = 0 }) {
  const [tab, setTab] = useState("chart"); // chart | info | tx
  const [chartMode] = useState("mcap"); // always market cap — price toggle removed
  const [tf, setTf] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("mintly_chart_tf");
        if (saved && TIMEFRAMES.includes(saved)) return saved;
      }
    } catch (e) { /* localStorage unavailable */ }
    return "H1";
  });
  const [tfExpanded, setTfExpanded] = useState(false);
  function changeTf(next) {
    setTf(next);
    try { if (typeof window !== "undefined") window.localStorage.setItem("mintly_chart_tf", next); } catch (e) { /* localStorage unavailable */ }
  }
  const [chartData, setChartData] = useState(null); // { candles, volume, isLive }
  const [chartLoading, setChartLoading] = useState(true);
  const chartSrcRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const up = token.change >= 0;
  // У токена на кривой жетон живёт в той же сети, что и приложение.
  const holdersCount = useJettonHolders(token.tokenAddress, !!token.curveAddress && TON_TESTNET_NETWORK);

  // Состояние кривой нужно ради шкалы до листинга: сколько TON уже
  // собрано и сколько зашито целью в самом контракте.
  const [curve, setCurve] = useState(null);
  useEffect(() => {
    if (!token.curveAddress) { setCurve(null); return; }
    let cancelled = false;
    const load = () => fetchCurveState(token.curveAddress, TON_TESTNET_NETWORK).then((st) => {
      if (!cancelled && st) setCurve(st);
    });
    load();
    const iv = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [token.curveAddress]);

  // Real OHLCV (via GeckoTerminal's data API — no iframe, no branding) when
  // the token is backed by a live on-chain pool; a synthetic random-walk
  // chart otherwise (bundled demo tokens, or if the fetch fails) so the
  // screen never shows a blank chart. We render everything ourselves with
  // TerminalChart, so there's no external widget or watermark involved.
  // Токен, запущенный здесь же, торгуется на своей кривой, а не на DEX:
  // для него история берётся прямо из транзакций контракта. Случайный
  // график остаётся только там, где реальных данных нет вовсе.
  const curveChart = !token.poolAddress && !!token.curveAddress;
  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    (async () => {
      let result = null;
      let src = null;
      if (token.poolAddress) {
        result = await fetchPoolOHLCV(token.poolAddress, tf);
        if (result) src = "pool";
      }
      // Основной источник не ответил — берём историю курса у tonapi.
      if (!result && token.tokenAddress && !token.curveAddress) {
        result = await fetchTonapiChart(token.tokenAddress, tf);
        if (result) src = "tonapi";
      }
      // Курс передаём тот же, по которому посчитана цена в шапке. Раньше
      // график брал его сам, и пока настоящий курс не приехал, строился
      // по запасному — цифры на графике и над ним расходились в разы.
      else if (token.curveAddress) result = await fetchCurveOHLCV(token.curveAddress, tf, TON_TESTNET_NETWORK, tonPriceUsd > 0 ? tonPriceUsd : tonUsd());
      // Выдуманных свечей больше нет ни для кого. У токена на кривой
      // история есть всегда, и если запрос не прошёл (у бесплатного
      // tonapi жёсткий лимит), рисуется ровная линия по текущей цене —
      // между сделками цена и правда стоит. У токена с биржи данные
      // либо пришли, либо нет: во втором случае показываем «нет
      // данных», а не случайное движение.
      if (!result && curveChart) { result = flatCandles(token.price, tf, CHART_TOTAL); src = "curve"; }
      if (cancelled) return;
      // Источник запоминается: обновлять график надо из того же места.
      // Иначе свечи биржи и точки tonapi сменяли друг друга — сетка
      // времени у них разная, и картинка дёргалась вбок.
      chartSrcRef.current = src;
      if (result) { setChartData({ ...result, isLive: true }); setChartLoading(false); }
      else { setChartData(null); setChartLoading(false); }
    })();
    return () => { cancelled = true; };
    // priceKnown в зависимостях намеренно: пока цена не приехала, ровную
    // линию строить не из чего, и попытку нужно повторить.
    // tonPriceUsd в зависимостях: график считается в долларах, и при
    // смене курса его нужно пересобрать, иначе он повиснет на старом.
  }, [tf, token.id, token.poolAddress, token.curveAddress, token.price > 0, tonPriceUsd]);

  // Обновление открытого графика. Крутится и тогда, когда данных ещё
  // нет: первый запрос мог не пройти из-за лимита, и без повторов на
  // экране навсегда оставалась бы надпись «истории нет». Дорисовывать
  // дрожание последней свече, как раньше, больше не нужно — выдуманных
  // движений на графике нет вовсе.
  useEffect(() => {
    if (!token.poolAddress && !curveChart) return;
    let cancelled = false;
    async function refresh() {
      const src = chartSrcRef.current;
      let fresh = null;
      if (curveChart) {
        fresh = await fetchCurveOHLCV(token.curveAddress, tf, TON_TESTNET_NETWORK, tonPriceUsd > 0 ? tonPriceUsd : tonUsd());
      } else if (src === "tonapi") {
        fresh = token.tokenAddress ? await fetchTonapiChart(token.tokenAddress, tf) : null;
      } else {
        fresh = token.poolAddress ? await fetchPoolOHLCV(token.poolAddress, tf) : null;
        // Ни разу не получилось — пробуем запасной источник и с этого
        // момента держимся его.
        if (!fresh && !src && token.tokenAddress) {
          fresh = await fetchTonapiChart(token.tokenAddress, tf);
          if (fresh) chartSrcRef.current = "tonapi";
        } else if (fresh && !src) {
          chartSrcRef.current = "pool";
        }
      }
      if (cancelled || !fresh?.candles?.length) return;
      setChartData((prev) => (prev
        ? { ...prev, candles: fresh.candles, volume: fresh.volume }
        : { ...fresh, isLive: true }));
      setChartLoading(false);
    }
    const iv = setInterval(refresh, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [token.id, token.poolAddress, token.curveAddress, curveChart, tf, tonPriceUsd]);

  // Real supply estimate (mcap / price) derived from the same live data —
  // used only to scale the chart between "price" and "market cap" display,
  // exactly like GeckoTerminal/STON.fi's own MCap/Price toggle.
  const supplyEst = token.price > 0 ? token.mcapNum / token.price : 0;
  const scaledCandles = useMemo(() => {
    if (!chartData?.candles) return null;
    if (chartMode === "price" || !supplyEst) return chartData.candles;
    return chartData.candles.map(c => ({ ...c, open: c.open * supplyEst, high: c.high * supplyEst, low: c.low * supplyEst, close: c.close * supplyEst }));
  }, [chartData, chartMode, supplyEst]);

  function handleShare() {
    const url = `https://mintly.app/token/${token.id}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: token.name, url }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
      showToast(tr("linkCopied"));
    } else {
      showToast(tr("linkCopied"));
    }
  }
  function copyContract() {
    if (!token.tokenAddress) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(token.tokenAddress).catch(() => {});
      showToast(tr("addressCopied"));
    }
  }

  // Honest, local-only reaction counters (no social backend here — see
  // useLocalCounter). ⭐ favorite / 🔥 hype / 💔 rug-report, each capped at
  // one tap per device so they read as a toggle, not a spam counter.
  const [favCount, bumpFav] = useLocalCounter(`mintly_fav_${token.id}`, true);
  const [hypeCount, bumpHype] = useLocalCounter(`mintly_hype_${token.id}`, true);
  const [rugCount, bumpRug] = useLocalCounter(`mintly_rug_${token.id}`, true);
  function handleRug() {
    if (rugCount < 1) showToast(tr("reportSent"));
    bumpRug();
  }

  // Real description + social links for this token, fetched once per
  // token address from GeckoTerminal's info endpoint (cached — see
  // fetchTokenInfo). null while loading or if GeckoTerminal has nothing
  // on file for this token, in which case the About card is simply
  // omitted instead of showing an invented bio.
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setInfoLoading(!!token.tokenAddress);
    if (token.tokenAddress) {
      fetchTokenInfo(token.tokenAddress).then((res) => {
        if (cancelled) return;
        setInfo(res);
        setInfoLoading(false);
      });
    }
    return () => { cancelled = true; };
  }, [token.tokenAddress]);

  // Real recent trades for the Transactions tab — only fetched once that
  // tab is actually opened (no point spending API calls on tabs nobody
  // looked at), refreshed while it stays open.
  const [infoLoading, setInfoLoading] = useState(false);
  const [trades, setTrades] = useState(() => cachedPoolTrades(token.poolAddress));
  const [tradesLoading, setTradesLoading] = useState(false);
  // У токена на кривой сделок в агрегаторах нет: список собирается из
  // транзакций самого контракта.
  useEffect(() => {
    if (tab !== "tx" || token.poolAddress || !token.curveAddress) return;
    let cancelled = false;
    setTradesLoading(true);
    async function load() {
      const m = await fetchCurveMarket(token.curveAddress, token.tokenAddress, TON_TESTNET_NETWORK);
      if (cancelled) return;
      if (m) setTrades(curveTradesToFeed(m.trades, curveParamsOf(m.state)));
      else setTrades((prev) => (prev && prev.length ? prev : null));
      setTradesLoading(false);
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tab, token.curveAddress, token.tokenAddress, token.poolAddress]);

  useEffect(() => {
    if (tab !== "tx" || !token.poolAddress) return;
    let cancelled = false;
    // Есть что показать из прошлого захода — рисуем немедленно и не
    // включаем «загружаем»: обновление приедет через секунду поверх.
    const cached = cachedPoolTrades(token.poolAddress);
    if (cached) setTrades(cached);
    setTradesLoading(!cached);
    async function load() {
      const res = await fetchPoolTrades(token.poolAddress, 300, GT_PRIORITY.trades);
      if (cancelled) return;
      // null = запрос не прошёл. Уже показанный список в этом случае
      // оставляем на месте: мигать пустым экраном из-за одного 429 хуже,
      // чем показать данные пятнадцатисекундной давности.
      if (res) setTrades(res);
      else setTrades((prev) => (prev && prev.length ? prev : null));
      setTradesLoading(false);
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tab, token.poolAddress]);

  // Ссылки на сайт и соцсети приходят из внешнего источника, то есть их
  // содержимое мы не контролируем. Открываем только http и https:
  // javascript:-адрес, попавший в такое поле, выполнился бы в окне
  // приложения со всеми его правами.
  function openSocial(url) {
    if (typeof window === "undefined" || !url) return;
    let parsed;
    try {
      parsed = new URL(String(url), window.location.origin);
    } catch (e) {
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    window.open(parsed.href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fx-view flex flex-col gap-4 pb-4" style={{ position: "relative" }}>
      <TrendFX up={up} seedKey={token.seed} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Top bar: back pill + a couple of glass icon buttons on the right */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="fx-tap flex items-center gap-1 rounded-full px-3 py-1.5" style={{ color: T.ice, fontFamily: bodyFont, fontSize: 13, background: T.surface, border: `1px solid ${T.line}` }}><ChevronLeft size={16} /> {tr("back")}</button>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="fx-tap rounded-full p-2" style={{ background: T.surface, border: `1px solid ${T.line}` }}><Share2 size={15} color={T.muted} /></button>
          <button onClick={() => setTfExpanded(v => !v)} className="fx-tap rounded-full p-2" style={{ background: T.surface, border: `1px solid ${T.line}` }}><MoreHorizontal size={15} color={T.muted} /></button>
        </div>
      </div>

      {/* Header: avatar, name, verified badge, age • dex — plus the
          contract-address chip, matching a DEX-scanner style header but
          in Mintly's own glass/gradient language. */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <TokenAvatar size={52} tone={up ? "up" : "down"} src={token.logoUrl}>{token.emoji}</TokenAvatar>
          <div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 18, fontWeight: 700 }}>{token.name}</span>
              {token.verified && <ShieldCheck size={14} color={T.electric} />}
            </div>
            <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 11.5 }}>
              ${token.ticker} · {fmtAge(token.createdAt) ? `${fmtAge(token.createdAt)} · ` : ""}{token.dexName || catLabel(token.cat)}
            </span>
          </div>
        </div>
        {token.tokenAddress ? (
          <button onClick={copyContract} className="fx-tap flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
            <span style={{ fontFamily: monoFont, color: T.ice, fontSize: 12 }}>{shortAddr(token.tokenAddress)}</span>
            <Copy size={12} color={T.muted} />
          </button>
        ) : (
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 11 }}>{tr("tokenNoAddress")}</span>
        )}
      </div>

      {/* Stats: big Market Cap on the left, compact real Holders/Volume
          column on the right. The old "Transactions" row showed the 24h
          buy+sell count mislabeled — dropped rather than fixed, since
          it duplicated what the Transactions tab already shows for real. */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11 }}>{t("marketCapLabel")}</div>
          <div className="flex items-end gap-2">
            <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 30, lineHeight: 1, color: T.ice, opacity: 0.92 }}>{fmtUSD(token.mcapNum)}</span>
            <div style={{ marginBottom: 4 }}><ChangeBadge value={token.change} size="md" /></div>
          </div>
          <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 12, marginTop: 2 }}>{fmtPrice(token.price)} {tr("perToken")}</div>
        </div>
        <div className="flex flex-col items-end gap-1" style={{ fontFamily: bodyFont, fontSize: 12, paddingTop: 2 }}>
          <div className="flex items-center gap-2"><span style={{ color: T.muted }}>{tr("statHolders")}</span><span style={{ fontFamily: monoFont, color: T.ice }}>{holdersCount == null ? "—" : holdersCount.toLocaleString("ru-RU")}</span></div>
          <div className="flex items-center gap-2"><span style={{ color: T.muted }}>{tr("statVolume24h")}</span><span style={{ fontFamily: monoFont, color: T.ice }}>${token.vol}</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4" style={{ borderBottom: `1px solid ${T.line}` }}>
        {[["chart", tr("tabChart")], ["info", tr("tabInfo")], ["tx", tr("tabTx")]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="fx-tap" style={{
            fontFamily: displayFont, fontSize: 13.5, fontWeight: 700, padding: "0 0 9px",
            color: tab === id ? T.ice : T.muted, borderBottom: `2px solid ${tab === id ? T.turquoise : "transparent"}`,
          }}>{label}</button>
        ))}
      </div>

      {tab === "chart" && (
        <>
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto" style={{ flex: 1, justifyContent: "flex-end" }}>
              {(tfExpanded ? TIMEFRAMES : TIMEFRAMES.slice(0, 4)).map(f => (
                <button key={f} onClick={() => changeTf(f)} className="tf-btn fx-tap rounded-[16px] px-2.5 py-1 flex-shrink-0"
                  style={{ fontFamily: monoFont, fontSize: 11, background: tf === f ? T.ice : T.surface, color: tf === f ? T.bg : T.muted, border: `1px solid ${tf === f ? T.ice : T.line}` }}>
                  {f}
                </button>
              ))}
              <button onClick={() => setTfExpanded(v => !v)} className="fx-tap rounded-[16px] p-1 flex-shrink-0" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
                <ChevronDown size={14} color={T.muted} style={{ transform: tfExpanded ? "rotate(180deg)" : "none", transition: `transform ${EASE}` }} />
              </button>
            </div>
          </div>

          {/* График идёт во всю ширину страницы, а не лежит в карточке:
              рамка и скругление вокруг него мешали читать свечи у краёв,
              а места под сам график оставалось меньше. Отрицательные
              поля ровно на отступ страницы — так он доходит до краёв
              экрана. */}
          <div style={{ position: "relative", marginLeft: -16, marginRight: -16, background: T.bg, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
            {chartLoading ? (
              <div className="flex items-center justify-center" style={{ height: 340, fontFamily: monoFont, fontSize: 11, color: T.muted }}>
                {tr("chartLoading")}
              </div>
            ) : !chartData ? (
              <div className="flex items-center justify-center" style={{ height: 340, fontFamily: monoFont, fontSize: 11, color: T.muted, textAlign: "center", padding: "0 20px" }}>
                {tr("chartNoData")}
              </div>
            ) : (
              <TerminalChart key={`${token.id}-${tf}-${chartMode}`} candles={scaledCandles} height={340} themeKey={themeKey} onHover={setHovered} tf={tf} valueFmt={chartMode === "price" ? fmtPrice : fmtUSD} />
            )}
          </div>

          {/* Honest local reaction pills — not global social counts, see useLocalCounter above */}
          <div className="flex items-center gap-2">
            <button onClick={bumpFav} className="fx-tap flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <Star size={14} color={favCount ? T.violet : T.muted} fill={favCount ? T.violet : "none"} />
              <span style={{ fontFamily: monoFont, fontSize: 12, color: T.ice }}>{favCount}</span>
            </button>
            <button onClick={bumpHype} className="fx-tap flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <Flame size={14} color={hypeCount ? T.turquoise : T.muted} fill={hypeCount ? T.turquoise : "none"} />
              <span style={{ fontFamily: monoFont, fontSize: 12, color: T.ice }}>{hypeCount}</span>
            </button>
            <button onClick={handleRug} className="fx-tap flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <HeartCrack size={14} color={rugCount ? T.rose : T.muted} />
              <span style={{ fontFamily: monoFont, fontSize: 12, color: T.ice }}>{rugCount}</span>
            </button>
          </div>

          {/* Кто запустил токен. Есть только у токенов из приложения —
              у внешних пулов владельца нет, блок сам себя не рисует. */}
          <TokenCreatorCard
            ownerId={token.ownerId}
            currentUserId={currentUserId}
            onNeedAuth={onNeedAuth}
            showToast={showToast}
            onOpenProfile={onOpenProfile}
          />

          {curve && curve.graduated ? (
            // Контракт с этого момента отбивает и покупку, и продажу.
            // Показывать кнопки, которые заведомо не сработают, — врать.
            <div className="rounded-[22px] p-4 flex items-start gap-3" style={{ background: T.surface, border: `1px solid ${hexA(T.up, 0.4)}` }}>
              <ShieldCheck size={18} color={T.up} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13.5, fontWeight: 700 }}>{tr("gradClosedTitle")}</div>
                <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>
                  {trf("gradClosedBody", { target: fmtTon(Number(curve.graduationTon) / 1e9) })}
                </p>
              </div>
            </div>
          ) : curve ? (
            <GraduationBar
              raisedTon={Number(curve.realTon) / 1e9}
              targetTon={Number(curve.graduationTon) / 1e9}
            />
          ) : null}

          {token.curveAddress && (
            <TrustPanel token={token} testnet={TON_TESTNET_NETWORK} holders={holdersCount} />
          )}

          {curve && curve.graduated ? null : connected ? (
            <div className="flex gap-2">
              <button onClick={onBuy} className="fx-tap flex-1 rounded-[20px] py-3 flex items-center justify-center gap-1.5" style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 14, background: PRISM, color: PRISM_TEXT, opacity: unlocked ? 1 : 0.55 }}>{!unlocked && <Lock size={13} />}{tr("buy")}</button>
              <button onClick={onSell} className="fx-tap flex-1 rounded-[20px] py-3 flex items-center justify-center gap-1.5" style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 14, background: "transparent", color: T.rose, border: `1px solid ${T.rose}`, opacity: unlocked ? 1 : 0.55 }}>{!unlocked && <Lock size={13} />}{tr("sell")}</button>
            </div>
          ) : (
            <button onClick={onConnectWallet} className="fx-tap w-full rounded-[20px] py-3.5 flex items-center justify-center gap-2" style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 14.5, background: T.ice, color: T.bg }}>
              <Wallet size={15} /> {tr("connectWalletCta")}
            </button>
          )}
        </>
      )}

      {tab === "info" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <StatChip icon={TrendingUp} label={tr("statPrice")} value={fmtPrice(token.price)} />
            <StatChip icon={Wallet} label={tr("statLiquidity")} value={`$${token.liq}`} />
            <StatChip icon={User} label={tr("statHolders")} value={holdersCount == null ? "…" : holdersCount.toLocaleString("ru-RU")} />
            <StatChip icon={Flame} label={tr("statVolume24h")} value={`$${token.vol}`} />
          </div>
          {infoLoading && !info ? (
            <div className="rounded-[22px] p-4 flex flex-col gap-2" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <div className="fx-skeleton" style={{ width: "35%", height: 11, borderRadius: 4 }} />
              <div className="fx-skeleton" style={{ width: "100%", height: 10, borderRadius: 4 }} />
              <div className="fx-skeleton" style={{ width: "80%", height: 10, borderRadius: 4 }} />
            </div>
          ) : (info?.description || info?.telegram || info?.twitter || info?.website) ? (
            <div className="rounded-[22px] p-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{tr("aboutToken")}</div>
              {info.description && (
                <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 13, lineHeight: 1.5 }}>{info.description}</p>
              )}
              {(info.telegram || info.twitter || info.website) && (
                <div className="flex items-center gap-4 mt-3">
                  {info.telegram && <button onClick={() => openSocial(info.telegram)} className="fx-tap"><Send size={15} color={T.muted} /></button>}
                  {info.twitter && <button onClick={() => openSocial(info.twitter)} className="fx-tap"><Twitter size={15} color={T.muted} /></button>}
                  {info.website && <button onClick={() => openSocial(info.website)} className="fx-tap"><Globe size={15} color={T.muted} /></button>}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[22px] p-4 flex items-center justify-center text-center" style={{ background: T.surface, border: `1px dashed ${T.line}`, minHeight: 80 }}>
              <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{tr("infoEmpty")}</span>
            </div>
          )}
        </div>
      )}

      {tab === "tx" && (
        <div className="flex flex-col gap-1.5">
          {/* Пустой список и неудавшийся запрос — разные вещи, и раньше
              оба показывали «недоступно». Теперь видно, где сделок правда
              нет, а где просто не достучались до API. */}
          {!token.poolAddress && !token.curveAddress ? (
            <div className="rounded-[22px] p-4 flex items-center justify-center text-center" style={{ background: T.surface, border: `1px dashed ${T.line}`, minHeight: 80 }}>
              <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{tr("txUnavailable")}</span>
            </div>
          ) : tradesLoading && !trades ? (
            <div className="flex items-center justify-center" style={{ height: 120, fontFamily: monoFont, fontSize: 11, color: T.muted }}>{tr("chartLoading")}</div>
          ) : !trades ? (
            <div className="rounded-[22px] p-4 flex items-center justify-center text-center" style={{ background: T.surface, border: `1px dashed ${T.line}`, minHeight: 80 }}>
              <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{tr("txLoadFailed")}</span>
            </div>
          ) : trades.length === 0 ? (
            <div className="rounded-[22px] p-4 flex items-center justify-center text-center" style={{ background: T.surface, border: `1px dashed ${T.line}`, minHeight: 80 }}>
              <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{tr("txEmpty")}</span>
            </div>
          ) : (
            trades.map(tx => (
              <div key={tx.id} className="fx-chip flex items-center justify-between rounded-[20px] px-3 py-2" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
                <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 12.5, color: tx.kind === "buy" ? T.up : T.down, textTransform: "uppercase" }}>{tx.kind === "buy" ? tr("buy") : tr("sell")}</span>
                <span style={{ fontFamily: monoFont, fontSize: 12, color: T.ice }}>${tx.volUsd < 1000 ? tx.volUsd.toFixed(2) : fmtCompact(tx.volUsd)}</span>
                <span style={{ fontFamily: monoFont, fontSize: 11, color: T.muted }}>{tx.at ? fmtCandleStamp(Math.floor(new Date(tx.at).getTime() / 1000)) : ""}</span>
              </div>
            ))
          )}
        </div>
      )}

      </div>
    </div>
  );
}

/* Mock account context the trade sheet needs — a real app would read
   this from the connected wallet / portfolio instead of hardcoding it. */
// Курс TON. Только настоящий, с биржи: запасное «примерно столько»
// здесь стоять не может — по нему считаются цена, капитализация и ось
// графика, и разойтись они могут в разы (зашито было 7.1 при реальных
// 1.3, то есть впятеро). Пока курс не приехал, функция возвращает ноль,
// и всё, что от него зависит, честно ждёт, а не рисует выдуманное.
// Хранится вне React намеренно: курс читают и функции вне компонентов
// (график, пересчёт ленты), которым пропсы недоступны.
let tonUsdLive = 0;
function tonUsd() {
  return tonUsdLive > 0 ? tonUsdLive : 0;
}
// Минимальная стартовая покупка. В тестнете её нет: там TON ничего не
// стоят, порог в долларах не имеет смысла и только мешает проверять.
const MIN_LAUNCH_USD = 5;
const MIN_LAUNCH_ENFORCED = !TON_TESTNET_NETWORK;
const NETWORK_FEE_TON = 0.05;
const SLIPPAGE_OPTIONS = [0.5, 1, 3];

function parseAmount(str) {
  const n = parseFloat(str.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* TradeModal — the buy/sell sheet: pick an amount (with quick %/preset
   chips), see the live conversion, pick slippage tolerance, and confirm.
   Shared between the Buy and Sell CTAs so switching tabs mid-flow works. */
function TradeModal({ t: token, tradeModal, onClose, onConfirm, walletTonBalance = 0, tonPriceUsd = 0, heldAmount = null, curveState = null }) {
  const [mode, setMode] = useState(tradeModal ? tradeModal.mode : "buy");
  // Сумму можно подставить снаружи — так после запуска токена открывается
  // готовая покупка ровно на то, что человек ввёл в форме создания.
  const [amountStr, setAmountStr] = useState(tradeModal?.prefill ? String(tradeModal.prefill) : "");
  const [slippage, setSlippage] = useState(1);

  useEffect(() => {
    if (tradeModal) {
      setMode(tradeModal.mode);
      setAmountStr(tradeModal.prefill ? String(tradeModal.prefill) : "");
      setSlippage(1);
    }
  }, [tradeModal]);

  if (!tradeModal) return null;

  // null означает «баланс ещё не пришёл из сети». Подставлять сюда
  // локальный счётчик нельзя: он копит оценки по каждой сделке и
  // расходится с настоящим балансом — из-за этого в окне продажи
  // показывалось вдвое больше, чем есть, и продажа уходила в никуда.
  const balanceKnown = heldAmount != null;
  const holdingTokens = balanceKnown ? heldAmount : 0;
  // Leave one network fee's worth of TON unspent so the buy transaction
  // itself doesn't fail for insufficient gas, and don't let anyone "buy"
  // before the real wallet balance/price have actually loaded.
  const spendableTon = Math.max(0, walletTonBalance - NETWORK_FEE_TON);
  const amount = parseAmount(amountStr);
  const isBuy = mode === "buy";

  // Покупка теперь считается в TON, а не в долларах: пользователь вводит
  // сумму в TON, и она напрямую ограничена доступным балансом кошелька.
  const maxAmount = isBuy ? spendableTon : holdingTokens;
  const overMax = amount > maxAmount;
  // Курс токена (token.price) хранится в USD, поэтому для оценки
  // количества токенов TON всё ещё конвертируется через tonPriceUsd —
  // но это только для отображения "вы получите", сама сделка идёт в TON.
  // У токенов на кривой цена в ленте ещё нулевая, а делить на ноль
  // нельзя: раньше отсюда приходила Infinity, она уезжала в локальный
  // счётчик, и в окне продажи значилось «Доступно: ∞».
  const priceUsd = token.price > 0 ? token.price : 0;
  // У токенов на кривой сумма считается её же формулой — той самой, что
  // применит контракт. По цене из ленты считать нельзя: она обновляется
  // редко, а для свежего токена её просто нет.
  let estimate;
  if (curveState) {
    // Комиссию берём из самой кривой: у токенов, запущенных до её
    // введения, она нулевая и такой останется навсегда.
    const feeBps = curveParamsOf(curveState).feeBps;
    if (isBuy) {
      const tonIn = toNano(amount.toFixed(9));
      const netTon = tonIn - tonIn * feeBps / 10000n;
      estimate = Number(tokensOutFor(curveState, netTon) / 1000000000n);
    } else {
      const gross = tonOutFor(curveState, toNano(amount.toFixed(9)));
      const net = gross - gross * feeBps / 10000n;
      estimate = (Number(net) / 1e9) * tonPriceUsd;
    }
  } else {
    estimate = isBuy
      ? (priceUsd > 0 ? (amount * tonPriceUsd) / priceUsd : 0)
      : amount * priceUsd;
  }
  const feeUsd = NETWORK_FEE_TON * tonPriceUsd;
  const canConfirm = amount > 0 && !overMax && (isBuy ? tonPriceUsd > 0 : balanceKnown);

  function setPct(pct) {
    const v = maxAmount * pct;
    setAmountStr(isBuy ? v.toFixed(v < 10 ? 4 : 2) : v.toFixed(v < 10 ? 4 : 0));
  }

  function handleConfirm() {
    if (!canConfirm) return;
    const payAmount = isBuy ? `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} TON` : `${amount.toLocaleString("ru-RU")}`;
    const receiveAmount = isBuy ? estimate.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : `$${estimate.toFixed(2)}`;
    const unit = isBuy ? "" : "";
    onConfirm(mode, payAmount, receiveAmount, unit, amount, estimate);
  }

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 20, maxHeight: "88%", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-2">
            <TokenAvatar size={34} src={token.logoUrl}>{token.emoji}</TokenAvatar>
            <div>
              <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 700 }}>{token.name}</div>
              <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 10.5 }}>${token.ticker} · {fmtPrice(token.price)}</div>
            </div>
          </div>
          <button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button>
        </div>

        <div className="flex rounded-[20px] p-1" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
          {[{ id: "buy", label: t("buy") }, { id: "sell", label: t("sell") }].map(o => {
            const active = mode === o.id;
            return (
              <button key={o.id} onClick={() => { setMode(o.id); setAmountStr(""); }} className="fx-tap flex-1 rounded-[16px] py-2"
                style={{
                  fontFamily: displayFont, fontWeight: 700, fontSize: 13,
                  background: active ? (o.id === "buy" ? T.turquoise : T.rose) : "transparent",
                  color: active ? PRISM_TEXT : T.muted,
                }}>
                {o.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{isBuy ? t("youPay") : t("youSell")}</span>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11 }}>
            {t("available")}: {isBuy
              ? `${spendableTon.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} TON`
              : balanceKnown ? `${holdingTokens.toLocaleString("ru-RU")} ${token.ticker}` : "…"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-[20px] px-3.5 py-3 mt-1.5" style={{ background: T.bg, border: `1px solid ${overMax ? T.rose : T.line}` }}>
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="0.00"
            inputMode="decimal"
            style={{ fontFamily: displayFont, fontWeight: 700, color: T.ice, fontSize: 20, background: "transparent", border: "none", outline: "none", flex: 1, minWidth: 0 }}
          />
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 13 }}>{isBuy ? "TON" : `$${token.ticker}`}</span>
        </div>
        {overMax && <div style={{ fontFamily: bodyFont, color: T.rose, fontSize: 11, marginTop: 4 }}>{t("insufficientFunds")}</div>}

        <div className="grid grid-cols-4 gap-1.5" style={{ marginTop: 8 }}>
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <button key={pct} onClick={() => setPct(pct)} className="fx-tap rounded-[16px] py-1.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: monoFont, fontSize: 11.5, color: T.ice }}>
              {pct === 1 ? t("maxLabel") : `${pct * 100}%`}
            </button>
          ))}
        </div>

        <div className="rounded-[20px] p-3.5 mt-3.5" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{t("youReceive")}</span>
            <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 700 }}>
              {amount > 0 ? (isBuy ? `≈ ${estimate.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ${token.ticker}` : `≈ $${estimate.toFixed(2)}`) : "—"}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{t("slippage")}</span>
          <div className="flex gap-1.5 mt-1.5">
            {SLIPPAGE_OPTIONS.map(s => (
              <button key={s} onClick={() => setSlippage(s)} className="fx-tap rounded-[16px] px-3 py-1.5" style={{ background: slippage === s ? T.ice : T.surfaceHi, color: slippage === s ? T.bg : T.muted, border: `1px solid ${slippage === s ? T.ice : T.line}`, fontFamily: monoFont, fontSize: 11.5 }}>
                {s}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5" style={{ marginTop: 14, fontFamily: monoFont, fontSize: 11, color: T.muted }}>
          <div className="flex justify-between"><span>{t("rate")}</span><span style={{ color: T.ice }}>{fmtPrice(token.price)} / {token.ticker}</span></div>
          <div className="flex justify-between"><span>{t("networkFee")}</span><span style={{ color: T.ice }}>{NETWORK_FEE_TON} TON (${feeUsd.toFixed(2)})</span></div>
          <div className="flex justify-between"><span>{t("minReceive")}</span><span style={{ color: T.ice }}>{amount > 0 ? (isBuy ? `${(estimate * (1 - slippage / 100)).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ${token.ticker}` : `$${(estimate * (1 - slippage / 100)).toFixed(2)}`) : "—"}</span></div>
        </div>

        <button onClick={handleConfirm} disabled={!canConfirm} className="fx-tap w-full rounded-[20px] py-3 mt-5" style={{
          fontFamily: displayFont, fontWeight: 700, fontSize: 14,
          background: canConfirm ? (isBuy ? T.turquoise : T.rose) : T.surfaceHi,
          color: canConfirm ? PRISM_TEXT : T.muted,
          opacity: canConfirm ? 1 : 0.6,
          boxShadow: canConfirm ? `0 0 20px ${isBuy ? glow(0.3) : hexA(T.rose, 0.25)}` : "none",
        }}>
          {amount > 0 ? (isBuy ? `${t("buyFor")} ${amount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} TON` : `${t("sellFor")} ${amount.toLocaleString("ru-RU")} ${token.ticker}`) : (isBuy && tonPriceUsd <= 0 ? t("rateLoading") : !isBuy && holdingTokens <= 0 ? t("nothingToSell") : t("enterAmount"))}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   CREATE TOKEN VIEW
--------------------------------------------------------- */

function Field({ label, placeholder, area, value, onChange, type = "text", icon: Icon, autoComplete, error = false }) {
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
          className="rounded-[20px] py-2.5 w-full"
          style={{
            fontFamily: bodyFont, fontSize: 16, color: T.ice, background: T.surface,
            border: `1px solid ${error ? T.down : focus ? T.electric : T.line}`, outline: "none",
            resize: area ? "none" : undefined,
            paddingLeft: Icon ? 32 : 12, paddingRight: isPassword ? 34 : 12,
            boxShadow: focus ? `0 0 0 3px ${glow(0.14)}` : "none",
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

/* ---------------------------------------------------------
   IMAGE CROP MODAL — used for both the token logo and the profile
   avatar (both end up displayed as circles via TokenAvatar / the
   profile picture), so this always crops to a square/circle at a
   fixed output resolution. Pure canvas + pointer events, no external
   cropper library: drag to pan, the range slider to zoom, "cover"-fit
   on load so there's never empty space around the crop circle.
--------------------------------------------------------- */
const CROP_BOX = 280;      // on-screen viewport size (css px)
const CROP_OUTPUT = 512;   // exported image size (px)

function ImageCropModal({ file, shape = "circle", onCancel, onConfirm }) {
  const [imgEl, setImgEl] = useState(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    if (!file) { setImgEl(null); return; }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      const cover = Math.max(CROP_BOX / img.naturalWidth, CROP_BOX / img.naturalHeight);
      const w = img.naturalWidth * cover, h = img.naturalHeight * cover;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setBaseScale(cover);
      setZoom(1);
      setPos({ x: (CROP_BOX - w) / 2, y: (CROP_BOX - h) / 2 });
      setImgEl(img);
    };
    img.src = url;
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [file]);

  const scale = baseScale * zoom;

  function clampPos(x, y, s) {
    const w = natural.w * s, h = natural.h * s;
    const minX = Math.min(0, CROP_BOX - w), minY = Math.min(0, CROP_BOX - h);
    return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
  }

  // Re-clamp whenever zoom changes so the image can never drift outside
  // the crop box after zooming out.
  useEffect(() => {
    setPos((p) => clampPos(p.x, p.y, scale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, natural.w, natural.h]);

  function pointFromEvent(e) { return e.touches ? e.touches[0] : e; }
  function onPointerDown(e) {
    const p = pointFromEvent(e);
    dragRef.current = { startX: p.clientX, startY: p.clientY, origX: pos.x, origY: pos.y };
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    if (e.touches) e.preventDefault();
    const p = pointFromEvent(e);
    const dx = p.clientX - dragRef.current.startX;
    const dy = p.clientY - dragRef.current.startY;
    setPos(clampPos(dragRef.current.origX + dx, dragRef.current.origY + dy, scale));
  }
  function onPointerUp() { dragRef.current = null; }

  function handleConfirm() {
    if (!imgEl) return;
    const cropX = -pos.x / scale;
    const cropY = -pos.y / scale;
    const cropSize = CROP_BOX / scale;
    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT;
    canvas.height = CROP_OUTPUT;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, cropX, cropY, cropSize, cropSize, 0, 0, CROP_OUTPUT, CROP_OUTPUT);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const baseName = (file.name || "image").replace(/\.[^.]+$/, "");
      const croppedFile = new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" });
      const url = URL.createObjectURL(croppedFile);
      onConfirm(croppedFile, url);
    }, "image/jpeg", 0.92);
  }

  if (!file) return null;

  // Окно кадрирования выносится порталом прямо в документ. Оно вставлено
  // внутрь прокручиваемого содержимого (форма создания токена, экран
  // профиля), и раньше позиционировалось относительно него: выезжало
  // вместе с прокруткой, затемнение накрывало не весь экран, а кнопки
  // уходили под нижнее меню. Одного position: fixed мало — экраны
  // появляются с анимацией, а элемент с transform становится системой
  // отсчёта и для fixed-потомков тоже.
  const modal = (
    <div
      className="fx-modal-back"
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={(e) => { e.stopPropagation(); onCancel(); }}
    >
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, maxHeight: "100%", overflowY: "auto", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: 24, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 15, fontWeight: 700 }}>{t("cropImageTitle")}</div>
        <div
          onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp} onTouchCancel={onPointerUp}
          style={{
            width: CROP_BOX, height: CROP_BOX, position: "relative", overflow: "hidden",
            borderRadius: shape === "circle" ? "50%" : 16,
            border: `1px solid ${T.lineHi}`, touchAction: "none", cursor: "grab", background: "#050505",
          }}
        >
          {imgEl && (
            <img
              src={imgEl.src}
              alt=""
              draggable={false}
              style={{
                position: "absolute", left: pos.x, top: pos.y,
                width: natural.w * scale, height: natural.h * scale,
                maxWidth: "none", userSelect: "none", pointerEvents: "none",
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-2.5 w-full">
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 13 }}>–</span>
          <input
            type="range" min={1} max={4} step={0.01} value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: T.turquoise }}
          />
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 13 }}>+</span>
        </div>
        <div className="flex items-center gap-2 w-full">
          <button onClick={onCancel} className="fx-tap flex-1 rounded-[20px] py-2.5" style={{ background: "transparent", border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.muted }}>{t("cancel")}</button>
          <button onClick={handleConfirm} className="fx-tap flex-1 rounded-[20px] py-2.5" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 13 }}>{t("cropConfirm")}</button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
}

/* ---------------------------------------------------------
   TOKEN LAUNCH OVERLAY — fully local simulation of "creating" a token.
   IMPORTANT: this never touches the network. No RPC call, no smart
   contract, no TonConnect transaction, no API request is made anywhere
   in this component. It only runs a timed sequence of UI states
   (Preparing → Generating → Deploying → Confirming → Success) and,
   once "done", renders a locally generated fake contract address and
   a "Token Created" badge. All resulting data lives purely in this
   component's state / the caller's in-memory state — it is cosmetic
   only and must never be mistaken for a real on-chain asset.
--------------------------------------------------------- */
/* Total supply is fixed for every token created through this flow — it's
   not a field the user edits. Shown as a read-only line in the form and
   baked into the simulated result. */
const TOKEN_FIXED_SUPPLY = 1_000_000_000;
const TOKEN_FIXED_SUPPLY_LABEL = TOKEN_FIXED_SUPPLY.toLocaleString("ru-RU");
// Сколько токенов даст стартовая покупка. Считается ровно той же
// формулой, что и в контракте, по свежей кривой: до этого здесь стояла
// линейная прикидка «столько-то токенов за TON», и она обещала втрое
// больше, чем кривая выдаёт на самом деле.
function tokensForTon(tonAmount) {
  const n = Math.max(0, tonAmount || 0);
  if (n <= 0) return { tokens: 0, pct: 0 };
  // Контракт удерживает газ из присланного и берёт комиссию с остатка.
  const netTon = toNano(n.toFixed(9)) * (10000n - CURVE_PARAMS.feeBps) / 10000n;
  const raw = tokensOutFor({ realTon: 0n, tokensSold: 0n }, netTon);
  const tokens = Number(raw / 1000000000n);
  const pct = Math.min(100, (tokens / TOKEN_FIXED_SUPPLY) * 100);
  return { tokens, pct };
}

const LAUNCH_STEPS = [
  { key: "preparing", label: () => t("launchPreparing"), icon: FileText },
  { key: "generating", label: () => t("launchGenerating"), icon: Sparkles },
  { key: "deploying", label: () => t("launchDeploying"), icon: Rocket },
  { key: "confirming", label: () => t("launchConfirming"), icon: ShieldCheck },
];

function TokenLaunchOverlay({ open, form, category, logoUrl, buyAmount, stepIndex, done, error, result, onClose, onRetry, onViewToken }) {
  const [copied, setCopied] = useState(false);
  const [logCopied, setLogCopied] = useState(false);
  useEffect(() => { if (open) setCopied(false); }, [open]);

  if (!open) return null;

  function copyAddr() {
    const addr = result && result.address;
    if (addr && typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function copyErrorLog() {
    if (error && typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(error).catch(() => {});
    setLogCopied(true);
    setTimeout(() => setLogCopied(false), 1400);
  }

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {error ? (
        <div className="fx-modal-card flex flex-col items-center text-center gap-4" style={{ width: "100%", maxWidth: 340, background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: 24, padding: 24 }}>
          <div style={{ width: 64, height: 64, clipPath: FACET, background: hexA(T.down, 0.12), border: `1px solid ${hexA(T.down, 0.35)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldAlert size={26} color={T.down} />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", width: "100%" }}>
            <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700 }}>{t("launchFailedTitle")}</div>
            <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap", textAlign: "left" }}>{error}</div>
          </div>
          <div className="flex flex-col gap-2 w-full mt-1">
            <button onClick={copyErrorLog} className="fx-tap w-full rounded-[20px] py-3" style={{ background: "transparent", border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Copy size={14} color={T.ice} /> {logCopied ? t("linkCopied") : "Скопировать лог"}
            </button>
            <button onClick={onRetry} className="fx-tap w-full rounded-[20px] py-3" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
              {t("retry")}
            </button>
            <button onClick={() => onClose && onClose(null)} className="fx-tap w-full rounded-[20px] py-3" style={{ background: "transparent", border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.muted }}>
              {t("doneClose")}
            </button>
          </div>
        </div>
      ) : !done ? (
        <div className="fx-modal-card flex flex-col items-center text-center gap-5" style={{ width: "100%", maxWidth: 340 }}>
          <div style={{ width: 64, height: 64, clipPath: FACET, background: T.surfaceHi, border: `1px solid ${T.lineHi}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={26} color={T.electric} style={{ animation: "spin360 1.1s linear infinite" }} />
          </div>
          <div>
            <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700 }}>
              {form.name.trim() || "Token"} · ${(form.ticker.trim() || "TICKER").toUpperCase()}
            </div>
            <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5, marginTop: 6 }}>{t("launchingWait")}</div>
          </div>
          <div className="flex flex-col gap-2.5 w-full mt-1">
            {LAUNCH_STEPS.map((step, i) => {
              const Icon = step.icon;
              const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
              return (
                <div key={step.key} className="flex items-center gap-2.5 rounded-[20px] px-3 py-2.5" style={{
                  background: state === "active" ? ink(0.07) : "transparent",
                  border: `1px solid ${state === "active" ? ink(0.22) : T.line}`,
                  opacity: state === "pending" ? 0.45 : 1,
                  transition: `opacity ${EASE}, background ${EASE}`,
                }}>
                  {state === "done" ? (
                    <CheckCircle2 size={16} color={T.up} />
                  ) : state === "active" ? (
                    <RefreshCw size={16} color={T.electric} style={{ animation: "spin360 1s linear infinite" }} />
                  ) : (
                    <Icon size={16} color={T.muted} />
                  )}
                  <span style={{ fontFamily: bodyFont, fontSize: 12.5, color: state === "pending" ? T.muted : T.ice, textAlign: "left" }}>{step.label()}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="fx-modal-card fx-view flex flex-col items-center text-center gap-4" style={{ width: "100%", maxWidth: 360, background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: 24, padding: 24 }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", overflow: "hidden", background: result.logoUrl ? `center/cover no-repeat url(${result.logoUrl})` : T.surfaceHi, border: `1px solid ${T.lineHi}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!result.logoUrl && <Rocket size={26} color={T.electric} />}
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: hexA(T.up, 0.12), border: `1px solid ${hexA(T.up, 0.35)}` }}>
            <ShieldCheck size={13} color={T.up} />
            <span style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 600, color: T.up }}>{t("tokenCreatedStatus")}</span>
          </div>
          <div>
            <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 19, fontWeight: 700 }}>{result.name}</div>
            <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 12, marginTop: 2 }}>${result.ticker}</div>
          </div>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12, lineHeight: 1.5, marginTop: -6 }}>{t("launchSuccessSub")}</p>

          <div className="w-full flex flex-col gap-2 mt-1">
            <div className="flex items-center justify-between rounded-[20px] px-3 py-2.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
              <span style={{ fontFamily: bodyFont, fontSize: 11, color: T.muted }}>{t("totalSupply")}</span>
              <span style={{ fontFamily: monoFont, fontSize: 12, color: T.ice }}>{result.supply}</span>
            </div>
            <div className="flex items-center justify-between rounded-[20px] px-3 py-2.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
              <span style={{ fontFamily: bodyFont, fontSize: 11, color: T.muted }}>{t("initialBuy")}</span>
              <span style={{ fontFamily: monoFont, fontSize: 12, color: T.ice, textAlign: "right" }}>
                {result.buyAmount} TON<br />
                <span style={{ fontSize: 10.5, color: T.muted }}>
                  {result.buyTokens.toLocaleString("ru-RU")} {result.ticker} · {result.buyPct.toFixed(result.buyPct < 1 ? 3 : 1)}%
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[20px] px-3 py-2.5 gap-2" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
              <div className="flex flex-col items-start min-w-0">
                <span style={{ fontFamily: bodyFont, fontSize: 11, color: T.muted }}>{t("contractAddress")}</span>
                <span style={{ fontFamily: monoFont, fontSize: 11.5, color: T.ice, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>{result.address}</span>
              </div>
              <button onClick={copyAddr} className="fx-tap flex-shrink-0">
                {copied ? <CheckCircle2 size={15} color={T.turquoise} /> : <Copy size={15} color={T.muted} />}
              </button>
            </div>
            {result.explorerUrl && (
              <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="fx-tap flex items-center justify-center gap-1.5 rounded-[20px] px-3 py-2.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, textDecoration: "none" }}>
                <ExternalLink size={13} color={T.muted} />
                <span style={{ fontFamily: bodyFont, fontSize: 11.5, color: T.muted }}>{t("viewOnExplorer")}</span>
              </a>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full mt-2">
            <button
              onClick={() => onViewToken && onViewToken(result)}
              className="fx-tap w-full rounded-[20px] py-3"
              style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}
            >
              {t("launchBuyCta")}
            </button>
            <button onClick={() => onClose && onClose(result)} className="fx-tap w-full rounded-[20px] py-3" style={{ background: "transparent", border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.muted }}>
              {t("doneClose")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateView({ showToast, unlocked, accountCreated, connected, onOpenCreateProfile, onOpenConnectModal, onLaunch }) {
  const [form, setForm] = useState({ name: "", ticker: "", buyAmount: "", desc: "", tg: "", x: "", site: "" });
  // Подпись обязательна: сама транзакция запуска эту сумму не тратит —
  // покупка идёт отдельным шагом сразу после создания. Без пояснения
  // человек ждёт токены на кошельке и не понимает, почему их нет.
  const [category, setCategory] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [bannerUrl, setBannerUrl] = useState(null);
  const [touched, setTouched] = useState(false);
  const [logoCropFile, setLogoCropFile] = useState(null);
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  function set(key) { return (e) => setForm(f => ({ ...f, [key]: e.target.value })); }
  // Разделитель допускается ровно один: без этого в поле набиралось
  // «0,1,2», а parseFloat от такого — не число, и запуск молча упирался
  // в «введите сумму». Запятая приводится к точке сразу, чтобы значение
  // в состоянии всегда годилось для разбора.
  function setBuyAmount(e) {
    const raw = String(e.target.value).replace(/[^0-9.,]/g, "").replace(/,/g, ".");
    const [head, ...rest] = raw.split(".");
    const cleaned = (rest.length ? `${head}.${rest.join("")}` : head).slice(0, 12);
    setForm((f) => ({ ...f, buyAmount: cleaned }));
  }
  function onPickLogo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setLogoCropFile(file);
  }
  function handleLogoCropConfirm(croppedFile, croppedUrl) {
    setLogoUrl(croppedUrl);
    setLogoFile(croppedFile);
    setLogoCropFile(null);
    showToast(t("logoUploaded"));
  }
  function onPickBanner(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBannerUrl(URL.createObjectURL(file));
    showToast(t("bannerUploaded"));
  }
  function handleLaunch() {
    setTouched(true);
    if (!logoUrl) {
      showToast(t("logoRequired"));
      return;
    }
    if (!form.name.trim() || !form.ticker.trim()) {
      showToast(t("nameTickerRequired"));
      return;
    }
    if (!form.desc.trim()) {
      showToast(t("descRequiredWarning"));
      return;
    }
    const buyNum = parseFloat(form.buyAmount.replace(",", "."));
    if (!Number.isFinite(buyNum) || buyNum <= 0) {
      showToast(t("buyAmountRequired"));
      return;
    }
    // Порог задан в долларах, поэтому проверять его без курса нельзя:
    // при нуле любая сумма выглядела бы недостаточной.
    const rate = tonUsd();
    if (MIN_LAUNCH_ENFORCED && rate > 0) {
      const minBuyTon = MIN_LAUNCH_USD / rate;
      if (buyNum * rate < MIN_LAUNCH_USD) {
        showToast(trf("buyAmountTooLow", { min: MIN_LAUNCH_USD, tons: minBuyTon.toFixed(2) }));
        return;
      }
    }
    // Real launch: hands off to the root app, which deploys an actual
    // jetton on-chain via TonConnect and seeds a STON.fi pool with the
    // committed buyAmount (see tonLaunch.js / handleLaunchRequest).
    onLaunch({ form, category, logoUrl, logoFile, buyAmount: form.buyAmount.trim(), onFinish: finishLaunch });
  }

  function resetForm() {
    setForm({ name: "", ticker: "", buyAmount: "", desc: "", tg: "", x: "", site: "" });
    setCategory(null);
    setLogoUrl(null);
    setLogoFile(null);
    setBannerUrl(null);
    setTouched(false);
  }

  function finishLaunch(result) {
    if (result) showToast(tf("tokenCreatedToast", { name: result.name, ticker: result.ticker }));
    resetForm();
  }

  if (!unlocked) {
    return (
      <div className="fx-view flex flex-col items-center justify-center text-center gap-3" style={{ minHeight: "70%", paddingTop: 40 }}>
        <MintlyFrame size={64} glow={`${T.violet}55`}><Lock size={26} color={T.violet} /></MintlyFrame>
        <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 17, fontWeight: 700, marginTop: 6 }}>{t("padClosedTitle")}</div>
        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, maxWidth: 280 }}>
          {t("padClosedBody")}
        </p>
        <div className="flex flex-col gap-2 w-full mt-2" style={{ maxWidth: 260 }}>
          {!accountCreated && (
            <button onClick={onOpenCreateProfile} className="fx-tap w-full rounded-[20px] py-3" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 13.5 }}>
              {t("createAccount")}
            </button>
          )}
          {!connected && (
            <button onClick={onOpenConnectModal} className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3" style={{ background: accountCreated ? PRISM : T.surfaceHi, color: accountCreated ? PRISM_TEXT : T.ice, border: accountCreated ? "none" : `1px solid ${T.line}`, fontFamily: displayFont, fontWeight: 700, fontSize: 13.5 }}>
              <Wallet size={15} /> {t("connectWalletCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fx-view flex flex-col gap-7 pb-36" style={{ position: "relative" }}>
      <div>
        <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 19, fontWeight: 700 }}>{t("launchTokenTitle")}</div>
        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12, marginTop: 2 }}>{t("launchTokenSub")}</div>
      </div>

      <div>
        <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{t("logoLabel")}</span>
        <div className="flex gap-3 mt-1.5">
          <input ref={logoInputRef} type="file" accept="image/*" onChange={onPickLogo} style={{ display: "none" }} />
          <input ref={bannerInputRef} type="file" accept="image/*" onChange={onPickBanner} style={{ display: "none" }} />
          <button onClick={() => logoInputRef.current && logoInputRef.current.click()} className="fx-tap flex flex-col items-center justify-center gap-1 flex-shrink-0 overflow-hidden" style={{ width: 76, height: 76, borderRadius: "50%", background: logoUrl ? `center/cover no-repeat url(${logoUrl})` : T.surface, border: logoUrl ? `1.5px solid ${T.lineHi}` : `1px dashed ${touched && !logoUrl ? T.down : T.line}` }}>
            {!logoUrl && (<><ImageIcon size={18} color={touched ? T.down : T.muted} /><span style={{ fontFamily: bodyFont, color: touched ? T.down : T.muted, fontSize: 9 }}>{t("logoShort")}</span></>)}
          </button>
          <button onClick={() => bannerInputRef.current && bannerInputRef.current.click()} className="fx-tap flex-1 flex flex-col items-center justify-center gap-1 rounded-[22px] overflow-hidden" style={{ background: bannerUrl ? `center/cover no-repeat url(${bannerUrl})` : T.surface, border: bannerUrl ? `1.5px solid ${T.lineHi}` : `1px dashed ${T.line}` }}>
            {!bannerUrl && (<><Upload size={18} color={T.muted} /><span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10 }}>{t("bannerOptional")}</span></>)}
          </button>
        </div>
        {touched && !logoUrl && <span style={{ fontFamily: bodyFont, color: T.down, fontSize: 11, marginTop: 4, display: "block" }}>{t("logoRequiredShort")}</span>}
      </div>

      <Field label={t("nameLabel")} placeholder="Prism Cat" value={form.name} onChange={set("name")} />
      <Field label={t("tickerLabel")} placeholder="PRSM" value={form.ticker} onChange={set("ticker")} />

      <div>
        <Field label={t("descLabel")} placeholder={t("descPlaceholder")} area value={form.desc} onChange={set("desc")} error={touched && !form.desc.trim()} />
        {touched && !form.desc.trim() && <span style={{ fontFamily: bodyFont, color: T.down, fontSize: 11, marginTop: 4, display: "block" }}>{t("descRequiredShort")}</span>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Telegram" placeholder="t.me/..." value={form.tg} onChange={set("tg")} />
        <Field label="X" placeholder="x.com/..." value={form.x} onChange={set("x")} />
        <Field label={t("siteLabel")} placeholder="site.xyz" value={form.site} onChange={set("site")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{t("launchAmountLabel")}</span>
        <div className="flex items-center gap-2 rounded-[20px] px-3.5 py-3" style={{ background: T.surface, border: `1px solid ${touched && MIN_LAUNCH_ENFORCED && tonUsd() > 0 && !(parseFloat(form.buyAmount.replace(",", ".")) * tonUsd() >= MIN_LAUNCH_USD) ? T.down : T.line}` }}>
          <input
            value={form.buyAmount}
            onChange={setBuyAmount}
            placeholder="10"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            // Высота строки задаётся явно: без неё каретка наследует
            // межстрочный интервал от родителя и рисуется выше самого
            // текста.
            style={{ fontFamily: displayFont, fontWeight: 700, color: T.ice, fontSize: 16, lineHeight: "20px", height: 20, background: "transparent", border: "none", outline: "none", flex: 1, minWidth: 0, padding: 0 }}
          />
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 13 }}>TON</span>
        </div>
        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11, lineHeight: 1.5, marginTop: 6 }}>
          {t("initialBuyHint")}
        </p>
        {(() => {
          const buyNum = parseFloat(form.buyAmount.replace(",", "."));
          const rate = tonUsd();
          const minBuyTon = rate > 0 ? MIN_LAUNCH_USD / rate : 0;
          if (!Number.isFinite(buyNum) || buyNum <= 0) {
            return (
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11, lineHeight: 1.5 }}>
                {t("launchAmountNote")}
              </p>
            );
          }
          if (MIN_LAUNCH_ENFORCED && rate > 0 && buyNum * rate < MIN_LAUNCH_USD) {
            return (
              <p style={{ fontFamily: bodyFont, color: T.down, fontSize: 11, lineHeight: 1.5 }}>
                {trf("buyAmountTooLow", { min: MIN_LAUNCH_USD, tons: minBuyTon.toFixed(2) })}
              </p>
            );
          }
          const { tokens, pct } = tokensForTon(buyNum);
          return (
            <div className="flex items-center justify-between rounded-[20px] px-3.5 py-2.5" style={{ background: ink(0.06), border: `1px solid ${ink(0.2)}` }}>
              <span style={{ fontFamily: bodyFont, color: T.electric, fontSize: 12 }}>{t("youWillGet")}</span>
              <span style={{ fontFamily: monoFont, color: T.electric, fontSize: 12.5, fontWeight: 600 }}>
                {tokens.toLocaleString("ru-RU")} {(form.ticker.trim() || "TOKEN").toUpperCase()} · {pct.toFixed(pct < 1 ? 3 : 1)}% {t("supplyShare")}
              </span>
            </div>
          );
        })()}
      </div>

      {!connected && (
        <div className="rounded-[22px] p-4 flex items-center gap-2.5" style={{ background: ink(0.07), border: `1px solid ${ink(0.22)}` }}>
          <Wallet size={16} color={T.electric} />
          <span style={{ fontFamily: bodyFont, color: T.electric, fontSize: 12.5 }}>{t("connectToConfirm")}</span>
        </div>
      )}

      <button onClick={handleLaunch} className="cta-launch fx-tap rounded-[22px]" style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 16, color: PRISM_TEXT, background: PRISM, position: "sticky", bottom: 12, padding: "18px 0" }}>
        {t("launchTokenCta")}
      </button>

      <ImageCropModal file={logoCropFile} shape="circle" onCancel={() => setLogoCropFile(null)} onConfirm={handleLogoCropConfirm} />
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
        <SectionTitle>{t("wallet")}</SectionTitle>
        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
          {t("connectWalletNote")}
        </p>
        <button onClick={onConnect} className="fx-tap w-full rounded-[20px] py-3 flex items-center justify-center gap-2" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
          <Wallet size={16} /> {t("connectWallet")}
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={{ padding: 20 }} className="fx-view">
      <div className="flex items-center justify-between mb-2.5">
        <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{t("walletProvider")}</span>
        <span style={{ fontFamily: monoFont, fontSize: 10, color: T.turquoise, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: T.turquoise, animation: "ringPulse 1.8s ease-out infinite" }} /> {t("connected")}</span>
      </div>
      <div className="flex items-end gap-2">
        <span style={{ fontFamily: displayFont, fontSize: 28, fontWeight: 700, color: T.ice, lineHeight: 1 }}>{balance.toFixed(1)}</span>
        <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 13, marginBottom: 3 }}>TON</span>
      </div>
      <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 12, marginTop: 2 }}>≈ ${usd.toFixed(0)}</div>
      <div className="flex items-center gap-2 mt-3 rounded-[20px] px-3 py-2" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
        <span style={{ fontFamily: monoFont, color: T.ice, fontSize: 12, flex: 1 }}>{addressShort}</span>
        <button className="fx-tap" onClick={() => { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>
          {copied ? <CheckCircle2 size={14} color={T.turquoise} /> : <Copy size={14} color={T.muted} />}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={onExplore} className="fx-tap flex items-center justify-center gap-1.5 rounded-[20px] py-2.5" style={{ background: T.surface, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 12, color: T.ice }}>
          <ExternalLink size={13} color={T.muted} /> {t("tonExplorerBtn")}
        </button>
        <button onClick={onDisconnect} className="fx-tap flex items-center justify-center gap-1.5 rounded-[20px] py-2.5" style={{ background: "transparent", border: `1px solid rgba(140,140,148,0.3)`, fontFamily: bodyFont, fontSize: 12, color: T.rose }}>
          <LogOut size={13} /> {t("disconnectShort")}
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
  return (
    <button onClick={() => onOpen(t)} className="fx-card w-full flex items-center gap-3 rounded-[22px] text-left" style={{ background: T.surface, border: `1px solid ${up ? "rgba(49,208,123,0.28)" : "rgba(255,77,77,0.24)"}`, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
      <TrendFX up={up} seedKey={t.seed} />
      <TokenAvatar tone={up ? "up" : "down"} src={t.logoUrl}>{t.emoji}</TokenAvatar>
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
      <div style={{ position: "relative", zIndex: 1 }}><MiniChart base={t.mcapNum} seed={t.seed} poolAddress={t.poolAddress} curveAddress={t.curveAddress} tokenAddress={t.tokenAddress} positive={up} id={`pf-${t.id}`} length={18} /></div>
    </button>
  );
}

function MyTokenCard({ t, onManage }) {
  const holdersCount = useJettonHolders(t.address);
  return (
    <GlassCard style={{ padding: "12px 14px" }} className="flex items-center gap-3">
      <TokenAvatar tone={t.verified ? "neutral" : "neutral"} src={t.logoUrl}>{t.emoji}</TokenAvatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 14, fontWeight: 600 }}>{t.name}</span>
          {t.verified && <ShieldCheck size={12} color={T.electric} />}
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 10 }}>${t.ticker}</span>
        </div>
        <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 16, color: T.turquoise, marginTop: 2 }}>{fmtUSD(t.mcapNum)}</div>
        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10.5, marginTop: 2 }}>{tr("liqShort")} ${t.liq} · {holdersCount == null ? "—" : holdersCount.toLocaleString("ru-RU")} {tr("holdersShort")} · {tr("volShort")} {t.vol}</div>
      </div>
      <button onClick={() => onManage && onManage(t)} className="fx-tap rounded-[16px] px-3 py-1.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 11, color: T.ice }}>{tr("manageBtn")}</button>
    </GlassCard>
  );
}

/* ---------------------------------------------------------
   PIN-CODE — app-open lock. Three pieces:
   - PinDots / PinKeypad: shared visual primitives
   - PinSetupModal: bottom-sheet used from Security settings to
     create / change / disable the PIN (asks for the current PIN
     first when one already exists)
   - PinLockScreen: full-screen gate shown on launch when the
     PIN is enabled, blocking the app until the right code is typed
--------------------------------------------------------- */

const PIN_LENGTH = 4;

function PinDots({ length = PIN_LENGTH, filled, error }) {
  return (
    <div className="flex items-center justify-center gap-3" style={{ animation: error ? "shake 340ms ease" : "none" }}>
      {Array.from({ length }).map((_, i) => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: "50%",
          background: i < filled ? (error ? T.down : PRISM) : "transparent",
          border: `1.5px solid ${i < filled && !error ? "transparent" : error ? T.down : "rgba(255,255,255,0.20)"}`,
          transition: `background ${EASE}, border-color ${EASE}`,
        }} />
      ))}
    </div>
  );
}

function PinKeypad({ onDigit, onBackspace }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
  return (
    <div className="grid grid-cols-3 gap-5" style={{ width: "100%", maxWidth: 264, margin: "0 auto" }}>
      {keys.map((k, idx) => {
        if (k === "") return <div key={idx} />;
        if (k === "back") {
          return (
            <button key={idx} onClick={() => { haptic("soft"); onBackspace(); }} className="fx-tap flex items-center justify-center" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: "50%", background: "transparent" }}>
              <span style={{ fontFamily: bodyFont, fontSize: 19, color: T.muted }}>⌫</span>
            </button>
          );
        }
        return (
          <button
            key={idx}
            onClick={() => { haptic("light"); onDigit(k); }}
            className="fx-tap flex items-center justify-center"
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              background: T.surfaceHi,
              border: `1px solid ${T.line}`,
              boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            }}
          >
            <span style={{ fontFamily: displayFont, fontSize: 21, fontWeight: 700, color: T.ice }}>{k}</span>
          </button>
        );
      })}
    </div>
  );
}

function PinSetupModal({ mode, currentPin, onClose, onComplete, onDisable, showToast }) {
  const [stage, setStage] = useState(mode === "change" || mode === "disable" ? "verify" : "new");
  const [entry, setEntry] = useState("");
  const [firstNew, setFirstNew] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setStage(mode === "change" || mode === "disable" ? "verify" : "new");
    setEntry(""); setFirstNew(""); setError(false);
  }, [mode]);

  if (!mode) return null;

  function shakeAnd(after) {
    haptic("error");
    setError(true);
    setTimeout(() => { setError(false); setEntry(""); after && after(); }, 340);
  }

  function submitStage(code) {
    if (stage === "verify") {
      if (code === currentPin) {
        setEntry("");
        if (mode === "disable") onDisable();
        else setStage("new");
      } else {
        showToast(t("wrongCurrentPin"));
        shakeAnd();
      }
      return;
    }
    if (stage === "new") {
      setFirstNew(code);
      setEntry("");
      setStage("confirm");
      return;
    }
    if (stage === "confirm") {
      if (code === firstNew) {
        onComplete(code);
      } else {
        showToast(t("pinMismatch"));
        setFirstNew("");
        shakeAnd(() => setStage("new"));
      }
    }
  }

  function handleDigit(d) {
    if (entry.length >= PIN_LENGTH) return;
    const next = entry + d;
    setEntry(next);
    if (next.length === PIN_LENGTH) setTimeout(() => submitStage(next), 120);
  }
  function handleBackspace() { setEntry((e) => e.slice(0, -1)); }

  const titles = {
    verify: t("pinEnterCurrent"),
    new: t("pinEnterNew"),
    confirm: t("pinConfirmNew"),
  };

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22, paddingBottom: 34 }}>
        <div className="flex justify-end"><button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button></div>
        <div className="flex flex-col items-center text-center gap-1" style={{ marginTop: -8 }}>
          <MintlyFrame size={52} glow={`${T.electric}55`}><Lock size={20} color={T.electric} /></MintlyFrame>
          <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 15, fontWeight: 700, marginTop: 8 }}>{titles[stage]}</div>
        </div>
        <div style={{ margin: "26px 0" }}><PinDots filled={entry.length} error={error} /></div>
        <PinKeypad onDigit={handleDigit} onBackspace={handleBackspace} />
      </div>
    </div>
  );
}

function PinLockScreen({ pin, profile, onUnlock, onForgot }) {
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);

  function handleDigit(d) {
    if (entry.length >= PIN_LENGTH) return;
    const next = entry + d;
    setEntry(next);
    if (next.length === PIN_LENGTH) {
      setTimeout(() => {
        if (next === pin) { onUnlock(); }
        else {
          haptic("error");
          setError(true);
          setTimeout(() => { setError(false); setEntry(""); }, 340);
        }
      }, 100);
    }
  }
  function handleBackspace() { setEntry((e) => e.slice(0, -1)); }

  const hasName = profile && profile.nickname;

  return (
    <div className="fx-view" style={{ position: "absolute", inset: 0, zIndex: 200, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" }}>
      <div style={{ position: "relative", flex: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center" }}>
          {hasName ? tf("greetingHi", { name: profile.nickname }) : t("greetingBack")}
        </div>

        <div style={{ marginTop: 22, position: "relative" }}>
          <div style={{
            width: 76, height: 76, borderRadius: "50%", overflow: "hidden",
            background: profile && profile.avatarUrl ? `center/cover no-repeat url(${profile.avatarUrl})` : T.surfaceHi,
            border: `1px solid ${T.lineHi}`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {!(profile && profile.avatarUrl) && (
              profile && profile.emoji
                ? <span style={{ fontSize: 32 }}>{profile.emoji}</span>
                : <Lock size={26} color={T.ice} />
            )}
          </div>
        </div>

        <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, marginTop: 14 }}>{t("pinContinueNote")}</div>

        <div style={{ margin: "28px 0" }}><PinDots filled={entry.length} error={error} /></div>
        <PinKeypad onDigit={handleDigit} onBackspace={handleBackspace} />
        <button onClick={onForgot} className="fx-tap" style={{ marginTop: 26, fontFamily: bodyFont, fontSize: 12.5, color: T.muted, textDecoration: "underline", textUnderlineOffset: 3 }}>
          {t("pinForgot")}
        </button>
      </div>
    </div>
  );
}

function ConnectModal({ open, onClose, onConnect }) {
  if (!open) return null;
  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22 }}>
        <div className="flex justify-end"><button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button></div>
        <div className="flex flex-col items-center text-center gap-2" style={{ marginTop: -8 }}>
          <MintlyFrame size={56} glow={`${T.electric}55`}><Wallet size={22} color={T.electric} /></MintlyFrame>
          <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700, marginTop: 6 }}>{t("connectWalletModalTitle")}</div>
          <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>{t("walletRequiredNote")}</div>
        </div>
        <button onClick={() => { onConnect(); onClose(); }} className="fx-tap w-full rounded-[20px] py-3 mt-5" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
          {t("connectWalletCta")}
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
        background: on ? PRISM_TEXT : T.muted, transition: `left ${SPRING}`,
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


/* SettingsPanel — a lightweight bottom-sheet used so every row under
   "Settings" actually opens real, distinct content instead of the
   same placeholder for every item. */
function SettingsPanel({
  item, onClose, appSettings, onUpdateSetting,
  onOpenEditProfile, profile, showToast,
  onTogglePin, onChangePin, insetBottom = 0, insetTop = 0,
  accountCreated, onDeleteAccount, userId, inviteCount = 0,
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!item) return null;
  const Icon = item.icon;

  function openEditFromSettings() { onClose(); onOpenEditProfile(); }
  async function confirmDeleteAccount() {
    setDeleting(true);
    await onDeleteAccount();
    setDeleting(false);
    setDeleteConfirmOpen(false);
    onClose();
  }
  function contactSupport() {
    if (typeof window !== "undefined") window.open("https://t.me/mintly_support", "_blank", "noopener,noreferrer");
  }
  const refLink = referralLink(userId);
  function copyReferral() {
    if (!refLink) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(refLink).catch(() => {});
    showToast(t("refCodeCopied"));
  }
  // Внутри Telegram открываем родной экран «переслать», снаружи — обычную
  // вкладку с тем же адресом.
  function shareReferral() {
    if (!refLink || typeof window === "undefined") return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(t("refShareText"))}`;
    const wa = window.Telegram && window.Telegram.WebApp;
    if (wa && wa.openTelegramLink) wa.openTelegramLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  let body = null;
  switch (item.key) {
    case "profile":
      body = (
        <>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
            {t("editProfileDesc")}
          </p>
          <button onClick={openEditFromSettings} className="fx-tap w-full rounded-[20px] py-3 mt-4" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
            {t("editProfile")}
          </button>
          {accountCreated && (
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3 mt-3"
              style={{ background: "transparent", border: `1px solid rgba(255,77,77,0.35)`, fontFamily: displayFont, fontWeight: 700, fontSize: 13, color: T.down }}
            >
              <ShieldAlert size={15} /> {t("deleteAccountForever")}
            </button>
          )}
          {deleteConfirmOpen && (
            <div className="fx-modal-back" style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => !deleting && setDeleteConfirmOpen(false)}>
              <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: 20, padding: 22 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                  <ShieldAlert size={18} color={T.down} />
                  <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700 }}>{t("deleteAccountQ")}</span>
                </div>
                <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, marginBottom: 18 }}>
                  {t("deleteAccountBody")}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting} className="fx-tap flex-1 rounded-[20px] py-2.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice, opacity: deleting ? 0.6 : 1 }}>
                    {t("cancel")}
                  </button>
                  <button onClick={confirmDeleteAccount} disabled={deleting} className="fx-tap flex-1 rounded-[20px] py-2.5" style={{ background: T.down, border: "none", fontFamily: displayFont, fontWeight: 700, fontSize: 13, color: "#1a0000", opacity: deleting ? 0.6 : 1 }}>
                    {deleting ? t("deletingText") : t("deleteShort")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
      break;
    case "security":
      body = (
        <div className="mt-2">
          <SettingsRow label={t("pinRow")} sub={t("pinRowSub")}>
            <ToggleSwitch on={appSettings.pinEnabled} onChange={onTogglePin} />
          </SettingsRow>
          <button
            onClick={() => { if (appSettings.pinEnabled) onChangePin(); else showToast(t("enablePinFirst")); }}
            className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3 mt-3"
            style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: appSettings.pinEnabled ? T.ice : T.muted, opacity: appSettings.pinEnabled ? 1 : 0.55 }}
          >
            <Lock size={14} color={T.muted} /> {t("changePinCta")}
          </button>
        </div>
      );
      break;
    case "language":
      body = (
        <div className="flex flex-col gap-2 mt-2">
          {["RU", "EN"].map((lng) => (
            <button key={lng} onClick={() => onUpdateSetting("language", lng)} className="fx-tap w-full flex items-center justify-between rounded-[20px] py-3 px-3.5" style={{ background: T.surfaceHi, border: `1px solid ${appSettings.language === lng ? T.turquoise : T.line}` }}>
              <span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>{lng === "RU" ? "Русский" : "English"}</span>
              {appSettings.language === lng && <CheckCircle2 size={16} color={T.turquoise} />}
            </button>
          ))}
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>{t("langFullNote")}</p>
        </div>
      );
      break;
    case "referral":
      body = (
        <>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
            {t("referralDesc")}
          </p>
          <div className="flex items-center justify-between mt-3 rounded-[20px] px-3.5 py-3" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
            <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{t("refInvited")}</span>
            <span style={{ fontFamily: displayFont, color: T.turquoise, fontSize: 16, fontWeight: 700 }}>{inviteCount}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 rounded-[20px] px-3 py-2.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
            <span style={{ fontFamily: monoFont, color: T.ice, fontSize: 11.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refLink || "—"}</span>
            <button onClick={copyReferral} className="fx-tap" disabled={!refLink}><Copy size={14} color={T.muted} /></button>
          </div>
          {refLink && (
            <button onClick={shareReferral} className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3 mt-3" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
              <Send size={14} /> {t("refShare")}
            </button>
          )}
        </>
      );
      break;
    case "support":
      body = (
        <>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
            {t("supportDesc")}
          </p>
          <button onClick={contactSupport} className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3 mt-4" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
            <Send size={14} /> {t("contactSupport")}
          </button>
        </>
      );
      break;
    case "privacy":
      body = <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}>{t("privacyText")}</p>;
      break;
    default:
      body = null;
  }

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: `0 12px ${insetBottom + 14}px` }} onClick={onClose}>
      <div
        className="fx-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440, background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: 26,
          maxHeight: `calc(88vh - ${insetBottom + insetTop}px)`, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 -16px 44px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.line }} />
        </div>
        <div style={{ padding: "4px 22px 0", flexShrink: 0 }}>
          <div className="flex justify-end"><button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button></div>
          <div className="flex flex-col items-center text-center gap-2" style={{ marginTop: -8 }}>
            <MintlyFrame size={52} glow={`${T.electric}44`}><Icon size={20} color={T.electric} /></MintlyFrame>
            <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700, marginTop: 6 }}>{t(item.tKey)}</div>
          </div>
        </div>
        <div className="no-scrollbar" style={{ padding: "0 22px", paddingBottom: 22, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

/* TokenManageSheet — the "Manage" action on a token you created:
   surfaces real controls (copy link, verify, edit info) rather than
   a dead button. */
function TokenManageSheet({ token, onClose, showToast, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => { if (token) setConfirmingDelete(false); }, [token]);
  if (!token) return null;
  function copyLink() {
    const url = `https://mintly.app/token/${token.id}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    showToast(t("tokenLinkCopied"));
  }
  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22 }}>
        <div className="flex justify-end"><button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button></div>
        <div className="flex items-center gap-3" style={{ marginTop: -8, marginBottom: 14 }}>
          <TokenAvatar size={44} src={token.logoUrl}>{token.emoji}</TokenAvatar>
          <div>
            <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 15, fontWeight: 700 }}>{token.name}</div>
            <div style={{ fontFamily: monoFont, color: T.muted, fontSize: 11 }}>${token.ticker}</div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={copyLink} className="fx-tap w-full flex items-center gap-2 rounded-[20px] py-3 px-3.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
            <Copy size={15} color={T.muted} /><span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>{t("copyLink")}</span>
          </button>
          {/* Every token in this list now comes from Supabase (myTokens) —
             MY_TOKENS, the old static demo array, is empty — so any token
             here is the current user's own and safe to delete. */}
          {onDelete && (
            confirmingDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={() => { onDelete(token.id); setConfirmingDelete(false); onClose(); }}
                  className="fx-tap flex-1 flex items-center justify-center gap-2 rounded-[20px] py-3 px-3.5"
                  style={{ background: hexA(T.down, 0.14), border: `1px solid ${hexA(T.down, 0.4)}` }}
                >
                  <span style={{ fontFamily: bodyFont, fontSize: 13, color: T.down, fontWeight: 600 }}>{t("confirmDelete")}</span>
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="fx-tap flex-1 flex items-center justify-center gap-2 rounded-[20px] py-3 px-3.5"
                  style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}
                >
                  <span style={{ fontFamily: bodyFont, fontSize: 13, color: T.muted }}>{t("cancel")}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="fx-tap w-full flex items-center gap-2 rounded-[20px] py-3 px-3.5"
                style={{ background: "transparent", border: `1px solid ${hexA(T.down, 0.35)}` }}
              >
                <Trash2 size={15} color={T.down} /><span style={{ fontFamily: bodyFont, fontSize: 13, color: T.down }}>{t("deleteToken")}</span>
              </button>
            )
          )}
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

/* ---------------------------------------------------------
   ВХОД ЧЕРЕЗ TELEGRAM
   Мини-приложение получает от Telegram строку initData, подписанную
   ключом бота. Проверить подпись можно только зная токен бота, поэтому
   она уходит на сервер (api/telegram-auth.js), а оттуда возвращается
   одноразовый токен, которым открывается обычная сессия Supabase.
   Ни почта, ни пароль у человека не спрашиваются.
--------------------------------------------------------- */

function telegramInitData() {
  if (typeof window === "undefined") return null;
  const data = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
  return data && data.length ? data : null;
}

function telegramUser() {
  if (typeof window === "undefined") return null;
  const wa = window.Telegram && window.Telegram.WebApp;
  return (wa && wa.initDataUnsafe && wa.initDataUnsafe.user) || null;
}

// Ссылка приглашения. Имя бота и мини-приложения знает только тот, кто
// заводил бота, поэтому берём их из переменных окружения сборки. Если их
// не задали — показываем хотя бы сам код, чтобы экран не был пустым.
const TG_BOT = String(import.meta.env.VITE_TG_BOT || "MintlyAppbot").replace(/^@/, "").trim();
const TG_APP = String(import.meta.env.VITE_TG_APP || "Mintly").trim();
function referralCode(userId) { return userId ? "ref_" + userId : ""; }
function referralLink(userId) {
  const code = referralCode(userId);
  if (!code) return "";
  if (!TG_BOT) return code;
  return `https://t.me/${TG_BOT}${TG_APP ? "/" + TG_APP : ""}?startapp=${code}`;
}

// Бросает ошибку с понятным кодом — вызывающая сторона показывает текст.
async function signInWithTelegram() {
  const initData = telegramInitData();
  if (!initData) throw new Error("no_telegram");

  // Кто пригласил. Telegram кладёт сюда то, что стояло после startapp= в
  // ссылке приглашения. Значение только передаём — доверять ему нельзя,
  // сервер сам проверит, что такой пользователь есть и что это не сам
  // приглашённый, и запишет связь единожды, при создании профиля.
  const tg = typeof window !== "undefined" ? window.Telegram && window.Telegram.WebApp : null;
  const startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";

  const res = await fetch("/api/telegram-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, startParam }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Консоли внутри Telegram нет, поэтому текст ошибки сервера едет
    // вместе с кодом — иначе непонятно, на каком шаге всё встало.
    const err = new Error(json.error || `auth_failed_${res.status}`);
    err.detail = json.detail || "";
    throw err;
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: json.token_hash, type: "magiclink" });
  if (error) throw error;
}

/* AuthModal — replaces the old single-button flow. Handles three modes:
   "login"  — email + password, signs in against real Supabase auth
   "create" — nickname + email + password (+ optional avatar/bio), signs up
   "edit"   — profile fields only, no password, updates the existing row
   When not in "edit" mode, a segmented tab lets the user flip between
   login/create without closing the sheet — that's the "красивое меню". */
function AuthModal({ open, onClose, onSubmit, initial, mode = "create", walletAddress }) {
  const isEdit = mode === "edit";
  const [tgBusy, setTgBusy] = useState(false);
  const [tgError, setTgError] = useState("");
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
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarCropFile, setAvatarCropFile] = useState(null);
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
      setAvatarFile(null);
      setAvatarCropFile(null);
      setPreviewEmoji(initial && initial.emoji ? initial.emoji : randomProfileEmoji());
      setTouched(false);
      setServerError("");
      setTgError("");
      setTgBusy(false);
    }
  }, [open, mode]);

  if (!open) return null;

  // Регистрация и вход больше не спрашивают почту с паролем — вместо них
  // одна кнопка «Войти через Telegram». Режим редактирования профиля
  // остаётся прежней формой (ник, описание, аватарка).
  if (!isEdit) {
    const tgUser = telegramUser();
    const insideTelegram = !!telegramInitData();

    async function handleTelegramLogin() {
      setTgError("");
      setTgBusy(true);
      try {
        await signInWithTelegram();
        onClose();
      } catch (err) {
        const code = (err && err.message) || "";
        const detail = (err && err.detail) ? ` — ${String(err.detail).slice(0, 220)}` : "";
        setTgError(code === "no_telegram" ? t("tgAuthOutside")
          : code === "server_not_configured" ? t("tgAuthNotConfigured")
          : `${t("tgAuthFailed")} (${code || "?"})${detail}`);
      } finally {
        setTgBusy(false);
      }
    }

    return (
      <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
        <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22, maxHeight: "88%", overflowY: "auto" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700 }}>{t("tgAuthTitle")}</span>
            <button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button>
          </div>

          <div className="flex flex-col items-center text-center gap-3" style={{ paddingBottom: 6 }}>
            <AvatarFrame frameId="ember" size={96}>
              <div style={{
                width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                background: tgUser && tgUser.photo_url ? `center/cover no-repeat url(${tgUser.photo_url})` : T.surfaceHi,
                fontSize: 34,
              }}>
                {!(tgUser && tgUser.photo_url) && <Send size={28} color={T.electric} />}
              </div>
            </AvatarFrame>

            {tgUser && (
              <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700 }}>
                {tgUser.username ? `@${tgUser.username}` : [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ")}
              </span>
            )}

            <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, maxWidth: 280 }}>
              {insideTelegram ? t("tgAuthHint") : t("tgAuthOutside")}
            </p>

            {tgError && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 12 }}>{tgError}</span>}

            <button
              onClick={handleTelegramLogin}
              disabled={tgBusy || !insideTelegram}
              className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3.5 mt-1"
              style={{
                background: insideTelegram ? PRISM : T.surfaceHi,
                color: insideTelegram ? PRISM_TEXT : T.muted,
                fontFamily: displayFont, fontWeight: 700, fontSize: 14,
                boxShadow: insideTelegram ? `0 0 22px ${glow(0.28)}` : "none",
                opacity: tgBusy ? 0.6 : 1,
              }}
            >
              {tgBusy
                ? <><RefreshCw size={15} style={{ animation: "spin360 1.1s linear infinite" }} /> {t("submittingText")}</>
                : <><Send size={15} /> {t("tgAuthCta")}</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nicknameTrimmed = nickname.trim();
  // Почта и пароль в профиле больше не редактируются: аккаунт заводится
  // Telegram-ом, адрес технический. Остаётся только ник.
  const nicknameValid = NICKNAME_RE.test(nicknameTrimmed);
  const canSubmit = nicknameValid;

  function onPickAvatar(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ""; // allow re-picking the same file later
  if (!file) return;
  setAvatarCropFile(file);
}
function handleAvatarCropConfirm(croppedFile, croppedUrl) {
  setAvatarUrl(croppedUrl); // только превью, в БД пойдёт после загрузки
  setAvatarFile(croppedFile);
  setAvatarCropFile(null);
}

// Расширение файла берём из его типа, а не из имени. Имя приходит от
// пользователя: «logo.png/../../что-то» превратилось бы в путь, который
// уезжает из своей папки, а «.svg» — в картинку, умеющую исполнять
// скрипты у того, кто откроет её напрямую.
const UPLOAD_EXT_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
function safeImageExt(file) {
  return UPLOAD_EXT_BY_TYPE[(file && file.type) || ""] || "png";
}

// Загружает файл в Supabase Storage и возвращает публичный URL
async function uploadAvatarIfNeeded(userId) {
  if (!avatarFile) return avatarUrl; // ничего не выбирали — оставляем как было
  const path = `${userId}/${Date.now()}.${safeImageExt(avatarFile)}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, avatarFile, { upsert: true });
  if (uploadError) {
    setServerError(tf("authErrAvatarUpload", { msg: uploadError.message }));
    return null;
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
  function friendlyAuthError(message) {
    const m = (message || "").toLowerCase();
    if (m.includes("already registered") || m.includes("already exists")) return t("authErrAlreadyRegistered");
    if (m.includes("invalid login credentials")) return t("authErrInvalidCreds");
    if (m.includes("email not confirmed")) return t("authErrNotConfirmed");
    if (m.includes("password") && m.includes("6")) return t("authErrPasswordShort");
    if (m.includes("nickname")) return tf("authErrNicknameTaken", { name: nicknameTrimmed });
    return message || t("authErrGeneric");
  }

  async function handleSubmit() {
    setTouched(true);
    setServerError("");
    if (!canSubmit) return;
    setSubmitting(true);

// ---------- EDIT (no auth call — just updates the row) ----------
    if (isEdit) {
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData?.user?.id;
      let uploadedUrl = avatarUrl; // если userId вдруг не найден — оставляем как было

      if (userId) {
        uploadedUrl = await uploadAvatarIfNeeded(userId);
        if (avatarFile && !uploadedUrl) { setSubmitting(false); return; } // загрузка не удалась

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            nickname: nicknameTrimmed,
            bio: bio.trim(),
            avatar_url: uploadedUrl,
            emoji: uploadedUrl ? null : previewEmoji,
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
        avatarUrl: uploadedUrl,
        emoji: uploadedUrl ? null : previewEmoji,
      });
      return;
    }

  }

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: "22px 22px 0 0", padding: 22, maxHeight: "88%", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: isEdit ? 4 : 14 }}>
          <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 16, fontWeight: 700 }}>
            {isEdit ? t("editProfile") : t("accountLabel")}
          </span>
          <button onClick={onClose} className="fx-tap"><X size={16} color={T.muted} /></button>
        </div>

        {!isEdit && (
          <div className="flex" style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 12, padding: 3, marginBottom: 16 }}>
            {[
              { id: "login", label: t("loginTab"), icon: LogIn },
              { id: "create", label: t("createTab"), icon: Sparkles },
            ].map(({ id, label, icon: Icon }) => {
              const active = authTab === id;
              return (
                <button
                  key={id}
                  onClick={() => { setAuthTab(id); setServerError(""); setTouched(false); }}
                  className="fx-tap tf-btn flex-1 flex items-center justify-center gap-1.5 rounded-[16px] py-2"
                  style={{
                    background: active ? PRISM : "transparent",
                    color: active ? PRISM_TEXT : T.muted,
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
          {isEdit ? t("editHint") : isLogin ? t("loginHint") : t("createHint")}
        </p>

        {!isLogin && (
          <div className="flex flex-col items-center gap-1.5" style={{ marginBottom: 16 }}>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: "none" }} />
            <button onClick={() => avatarInputRef.current && avatarInputRef.current.click()} className="fx-tap flex flex-col items-center justify-center gap-1 overflow-hidden" style={{ width: 84, height: 84, borderRadius: "50%", background: avatarUrl ? `center/cover no-repeat url(${avatarUrl})` : T.bg, border: avatarUrl ? `1.5px solid ${T.lineHi}` : `1px dashed ${T.lineHi}`, fontSize: 34 }}>
              {!avatarUrl && previewEmoji}
            </button>
            {avatarUrl && <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 10.5 }}>{t("changeAvatarHint")}</span>}
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          {!isLogin && (
            <>
              <Field label={t("nicknameLabel")} placeholder="leo_builds" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              {touched && !nicknameValid && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 11, marginTop: -10 }}>{t("nicknameError")}</span>}
            </>
          )}
          {!isLogin && <Field label={t("bioLabel")} placeholder={t("bioPlaceholder")} area value={bio} onChange={(e) => setBio(e.target.value)} />}
        </div>
        {serverError && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 12, marginTop: 10, display: "block" }}>{serverError}</span>}
        <button onClick={handleSubmit} disabled={submitting} className="fx-tap w-full rounded-[20px] py-3 mt-5" style={{ background: canSubmit ? PRISM : T.surfaceHi, color: canSubmit ? PRISM_TEXT : T.muted, fontFamily: displayFont, fontWeight: 700, fontSize: 14, boxShadow: canSubmit ? `0 0 22px ${glow(0.28)}` : "none", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? t("submittingText") : isEdit ? t("saveChanges") : isLogin ? t("loginCta") : t("createAccountShort")}
        </button>
      </div>

      <ImageCropModal file={avatarCropFile} shape="circle" onCancel={() => setAvatarCropFile(null)} onConfirm={handleAvatarCropConfirm} />
    </div>
  );
}

function ProfileView({
  connected, walletAddress, tonBalance, tonPriceUsd, onConnect, onDisconnect, onOpenConnectModal, showToast,
  accountCreated, profile, onOpenCreateProfile, onOpenLogin, onOpenEditProfile, onLogOut,
  onOpenSetting, onManageToken, onGoCreate, onOpenToken, myTokens = [], onClearAllTokens,
  cosmetics = { frame: "none", card: "none" }, onGoShop, onOpenAchievements, insetTop = 0, userId = null,
  // Счётчики подписок и достижения считаются в корне: их же показывает
  // магазин и отдельная страница достижений, дублировать запрос незачем.
  followCounts = { followers: 0, following: 0 }, achievements = [], creatorTier = 0, onVerified,
  tradeStats = { trades: 0, tokens: 0, profitUsd: 0 },
}) {
  const [loading, setLoading] = useState(true);
  // Подтверждение хранится в профиле, а не только на экране: иначе
  // значок пропадал при первом же обновлении страницы.
  const [verifyStatus, setVerifyStatus] = useState(profile.verified ? "verified" : "none");
  useEffect(() => {
    setVerifyStatus((cur) => (profile.verified ? "verified" : cur === "pending" ? "pending" : "none"));
  }, [profile.verified]);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);


  useEffect(() => { const t = setTimeout(() => setLoading(false), 650); return () => clearTimeout(t); }, []);


  const unlocked = accountCreated && connected;
  function requireUnlock(missingMsg) {
    if (!accountCreated) { onOpenCreateProfile(); showToast(t("firstAccountFirst")); return false; }
    if (!connected) { onOpenConnectModal(); showToast(t("connectWalletContinue")); return false; }
    return true;
  }
  function connectWallet() { onConnect(); showToast(t("walletConnectedToast")); }
  function disconnectWallet() { onDisconnect(); showToast(t("walletDisconnectedToast")); }
  function copyAddress() {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(walletAddress).catch(() => {});
    showToast(t("addressCopied"));
  }
  function startVerify() {
    if (!requireUnlock()) return;
    setVerifyStatus("pending");
    showToast(t("verifyRequestSent"));
    setTimeout(() => {
      setVerifyStatus("verified");
      showToast(t("profileVerified"));
      if (onVerified) onVerified();
    }, 2200);
  }
  function goCreateToken() {
    if (!requireUnlock()) return;
    onGoCreate();
  }
  function openSettingItem(item) {
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
        <div className="flex flex-col items-center text-center gap-2" style={{ marginTop: 10, position: "relative", zIndex: 0 }}>
          {/* bleed выводит подложку за горизонтальные отступы экрана и
              поднимает её выше шапки — так у карточки не остаётся видимых
              обрезанных краёв. */}
          <ProfileCardBg cardId={cosmetics.card} height={320} radius={0} bleed={16} top={PROFILE_CARD_TOP(insetTop)} />
          {accountCreated && (
            <button onClick={logOut} className="fx-tap flex items-center gap-1.5" style={{ position: "absolute", top: 0, right: 0, zIndex: 2, background: "transparent", border: `1px solid rgba(140,140,148,0.3)`, borderRadius: 999, padding: "6px 12px", fontFamily: bodyFont, fontSize: 12, color: T.rose }}>
              <LogOut size={13} /> {t("logOutShort")}
            </button>
          )}
          <button
            onClick={onGoShop}
            className="fx-tap"
            style={{ position: "relative", zIndex: 1, background: "transparent", border: "none", padding: 0, lineHeight: 0 }}
          >
            <AvatarFrame frameId={cosmetics.frame} size={128}>
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: profile.avatarUrl ? `center/cover no-repeat url(${profile.avatarUrl})` : T.surfaceHi, border: cosmetics.frame === "none" ? (profile.avatarUrl ? `2px solid ${T.lineHi}` : `2px dashed ${T.lineHi}`) : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: accountCreated ? 52 : 40 }}>
                  {!profile.avatarUrl && (accountCreated && profile.emoji ? profile.emoji : <User size={40} color={T.muted} />)}
                </div>
            </AvatarFrame>
          </button>
          <div className="flex flex-col items-center text-center gap-2" style={{ position: "relative", zIndex: 1, width: "100%" }}>
          {accountCreated ? (
            <>
              <div className="flex items-center gap-1.5 mt-1">
                <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 19, fontWeight: 700 }}>{profile.nickname}</span>
                <CreatorWreathBadge tier={creatorTier} size={19} />
                <VerifiedBadge verified={verifyStatus === "verified"} size={16} />
              </div>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, maxWidth: 260, lineHeight: 1.5 }}>
                {profile.bio || t("bioEmptyPlaceholder")}
              </p>
              <div className="flex items-center gap-3" style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>
                <span className="flex items-center gap-1"><Clock size={12} /> {t("memberSince")}</span>
              </div>
              <button onClick={onOpenEditProfile} className="fx-tap rounded-[20px] px-5 py-2.5 mt-2" style={{ background: T.surface, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice }}>{t("editProfileBtn")}</button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 17, fontWeight: 700, marginTop: 4 }}>{t("accountNotCreated")}</div>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, maxWidth: 260, lineHeight: 1.5 }}>{t("accountNotCreatedBody")}</p>
              <div className="flex items-center gap-2 mt-2" style={{ width: "100%", maxWidth: 300 }}>
                <button onClick={onOpenLogin} className="fx-tap flex-1 flex items-center justify-center gap-1.5 rounded-[20px] px-4 py-3" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 12.5 }}>
                  <Send size={14} /> {t("tgAuthCta")}
                </button>
              </div>
            </>
          )}
          </div>
        </div>

        {/* Всё, что ниже шапки, поднято над её слоем. Подложка карточки
            профиля лежит внутри шапки и заканчивается сплошной чёрной
            растушёвкой; по правилам отрисовки позиционированный слой
            рисуется поверх фонов обычных блоков, и эта растушёвка
            срезала верх виджета кошелька. */}
        <div style={{ position: "relative", zIndex: 1 }}>

        <div className="mt-5"><WalletCard connected={connected} walletAddress={walletAddress} tonBalance={tonBalance} tonPriceUsd={tonPriceUsd} onConnect={connectWallet} onDisconnect={disconnectWallet} onCopy={copyAddress} onExplore={exploreWallet} /></div>

        <div className="mt-5">
          <SectionTitle>{t("statsTitle")}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <StatBlock label={t("statTotalProfit")} value={Math.round(tradeStats.profitUsd)} color={tradeStats.profitUsd >= 0 ? T.up : T.down} suffix=" $" />
            <StatBlock label={t("statCreatedTokens")} value={myTokens.length} />
            <StatBlock label={t("statTokensOwned")} value={tradeStats.tokens} />
            <StatBlock label={t("statTotalTrades")} value={tradeStats.trades} />
            <StatBlock label={t("statFollowers")} value={followCounts.followers} />
            <StatBlock label={t("statFollowing")} value={followCounts.following} />
          </div>
        </div>

        <div className="mt-5">
          <SectionTitle>{t("portfolioTitle")}</SectionTitle>
          {!connected ? (
            <GlassCard style={{ padding: 22 }} className="flex flex-col items-center text-center gap-3">
              <MintlyFrame size={48} glow={`${T.violet}55`}><Wallet size={18} color={T.violet} /></MintlyFrame>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 13, lineHeight: 1.5 }}>{t("portfolioConnectBody")}</p>
              <button onClick={connectWallet} className="fx-tap rounded-[20px] px-5 py-2.5" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 13 }}>{t("connectWalletCta")}</button>
            </GlassCard>
          ) : loading ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map(i => (
                <div key={i} className="fx-card flex items-center gap-3 rounded-[22px]" style={{ background: T.surface, border: `1px solid ${T.line}`, padding: "12px 14px" }}>
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
          <SectionTitle action={
            <div className="flex items-center gap-3">
              {onClearAllTokens && myTokens.some((tok) => tok.network === "testnet") && (
                confirmingClearAll ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { onClearAllTokens(); setConfirmingClearAll(false); }} className="fx-tap" style={{ fontFamily: bodyFont, fontSize: 11, color: T.down, fontWeight: 600 }}>{t("confirmDelete")}</button>
                    <button onClick={() => setConfirmingClearAll(false)} className="fx-tap" style={{ fontFamily: bodyFont, fontSize: 11, color: T.muted }}>{t("cancel")}</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmingClearAll(true)} className="fx-tap flex items-center gap-1" style={{ fontFamily: bodyFont, fontSize: 11.5, color: T.down }}>
                    <Trash2 size={13} /> {t("clearAllTokens")}
                  </button>
                )
              )}
              <button onClick={goCreateToken} className="fx-tap flex items-center gap-1" style={{ fontFamily: bodyFont, fontSize: 11.5, color: unlocked ? T.electric : T.muted }}>{unlocked ? <PlusCircle size={13} /> : <Lock size={12} />} {t("myTokensCreate")}</button>
            </div>
          }>{t("myTokensTitle")}</SectionTitle>
          {[...myTokens, ...MY_TOKENS].length === 0 ? (
            <GlassCard style={{ padding: 22 }} className="flex flex-col items-center text-center gap-2">
              <MintlyFrame size={40} glow={`${T.electric}44`}><Rocket size={16} color={T.electric} /></MintlyFrame>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>{t("noTokensYet")}</p>
            </GlassCard>
          ) : (
            <div className="flex flex-col gap-2">{[...myTokens, ...MY_TOKENS].map(t => <MyTokenCard key={t.id} t={t} onManage={onManageToken} />)}</div>
          )}
        </div>

        <div className="mt-5">
          <SectionTitle>{t("activityTitle")}</SectionTitle>
          {ACTIVITY.length === 0 ? (
            <GlassCard style={{ padding: 22 }} className="flex flex-col items-center text-center gap-2">
              <MintlyFrame size={40} glow={`${T.muted}33`}><Clock size={16} color={T.muted} /></MintlyFrame>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>{t("noActivityYet")}</p>
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
          <SectionTitle action={
            <button onClick={onOpenAchievements} className="fx-tap flex items-center gap-1" style={{ fontFamily: bodyFont, fontSize: 11.5, color: T.electric }}>
              {t("achAll")} <ChevronRight size={13} />
            </button>
          }>{t("achievementsTitle")}</SectionTitle>
          <button onClick={onOpenAchievements} className="fx-tap w-full text-left rounded-[22px] p-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12 }}>{t("achProgress")}</span>
              <span style={{ fontFamily: monoFont, color: T.ice, fontSize: 13, fontWeight: 700 }}>
                {tf("achUnlockedOf", { done: achievements.filter((a) => a.done).length, total: achievements.length })}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: T.surfaceHi, overflow: "hidden" }}>
              <div style={{ width: `${achievements.length ? (achievements.filter((a) => a.done).length / achievements.length) * 100 : 0}%`, height: "100%", background: T.electric }} />
            </div>
            {/* Ближайшие незакрытые — чтобы было видно, за чем идти */}
            <div className="flex items-center gap-1.5" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {achievements.filter((a) => !a.done).slice(0, 3).map((a) => (
                <span key={a.id} className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
                  <a.icon size={11} color={T.muted} />
                  <span style={{ fontFamily: bodyFont, fontSize: 10.5, color: T.muted }}>{a.label}</span>
                </span>
              ))}
            </div>
          </button>
        </div>

        <div className="mt-5">
          <SectionTitle>{t("verificationTitle")}</SectionTitle>
          <GlassCard style={{ padding: 18 }} className="flex items-center gap-3">
            {verifyStatus === "verified" ? (
              <>
                <ShieldCheck size={22} color={T.electric} />
                <div className="flex-1">
                  <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600 }}>{t("verifiedStatus")}</div>
                  <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>{t("profileConfirmed")}</div>
                </div>
              </>
            ) : verifyStatus === "pending" ? (
              <>
                <ShieldAlert size={22} color={T.violet} />
                <div className="flex-1">
                  <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600 }}>{t("pendingStatus")}</div>
                  <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>{t("verifyPending")}</div>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert size={22} color={T.muted} />
                <div className="flex-1">
                  <div style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600 }}>{t("notVerifiedStatus")}</div>
                  <div style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11.5 }}>{t("verifyCta")}</div>
                </div>
                <button onClick={startVerify} className="fx-tap rounded-[16px] px-3 py-2 flex items-center gap-1.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 12, color: T.ice, opacity: unlocked ? 1 : 0.55 }}>
                  {!unlocked && <Lock size={11} color={T.muted} />} {t("verifyAccountBtn")}
                </button>
              </>
            )}
          </GlassCard>
        </div>

        <div className="mt-5">
          <SectionTitle>{t("settings")}</SectionTitle>
          <GlassCard style={{ padding: "4px 16px" }}>
            {SETTINGS_ITEMS.map((s, i) => (
              <button key={s.key} onClick={() => openSettingItem(s)} className="fx-tap w-full flex items-center gap-3 py-3" style={{ borderBottom: i < SETTINGS_ITEMS.length - 1 ? `1px solid ${T.line}` : "none", opacity: 1 }}>
                <s.icon size={16} color={T.muted} />
                <span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice, flex: 1, textAlign: "left" }}>{t(s.tKey)}</span>
                <ChevronRight size={14} color={T.muted} />
              </button>
            ))}
          </GlassCard>
        </div>

        </div>
      </div>
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

// Поправка к системному отступу сверху. Отрицательная — контент
// поднимается выше, ближе к шапке Telegram, чем предписывает safe-area.
// Ниже нуля итог не опускаем: отрицательный padding браузер просто
// проигнорирует, и вёрстка поедет молча.
const CONTENT_TOP_GAP = 0;
const contentTopPad = (insetTop) => Math.max(0, insetTop + CONTENT_TOP_GAP);

// Насколько подложка профиля заходит выше начала контента. Верхние
// insetTop + CONTENT_TOP_GAP + 10 доводят её ровно до верха окна, а
// оставшийся запас нужен на случай, если клиент всё-таки позволит
// оттянуть список — тогда под пальцем окажется карточка, а не пустой фон.
const PROFILE_CARD_TOP = (insetTop) => -(contentTopPad(insetTop) + 10 + 160);

/* Где именно запущено приложение.
   Основной источник — сам Telegram: он сообщает платформу ("ios",
   "android", "tdesktop", "macos", "web", "weba", "webk", "unknown") и
   версию клиента. Это надёжнее разбора строки браузера, но внутри
   Telegram доступно не всегда (например при открытии по обычной ссылке),
   поэтому есть и запасной разбор userAgent.
   Значение считается один раз: между перерисовками устройство не
   меняется, а к строке браузера обращаться на каждый рендер незачем. */
function detectDevice() {
  if (typeof window === "undefined") {
    return { platform: "unknown", inTelegram: false, isIOS: false, isAndroid: false, isDesktop: false, isMobile: false, isTouch: false, version: null };
  }
  const tg = window.Telegram && window.Telegram.WebApp;
  const ua = navigator.userAgent || "";
  const tgPlatform = tg && tg.platform ? String(tg.platform).toLowerCase() : null;

  // iPadOS с 13-й версии представляется макинтошем, отличить можно только
  // по наличию сенсорного ввода.
  const iPadAsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const uaIOS = /iPad|iPhone|iPod/.test(ua) || iPadAsMac;
  const uaAndroid = /Android/.test(ua);

  const platform = tgPlatform && tgPlatform !== "unknown"
    ? tgPlatform
    : uaIOS ? "ios" : uaAndroid ? "android" : "web";

  const isIOS = platform === "ios" || platform === "macos" || uaIOS;
  const isAndroid = platform === "android" || uaAndroid;
  const isDesktop = platform === "tdesktop" || platform === "macos" || (!isIOS && !isAndroid);

  return {
    platform,
    inTelegram: !!tg,
    version: tg && tg.version ? tg.version : null,
    isIOS,
    isAndroid,
    isDesktop,
    isMobile: !isDesktop,
    isTouch: navigator.maxTouchPoints > 0 || "ontouchstart" in window,
  };
}

const DEVICE = detectDevice();

// Тем, кому устройство нужно внутри разметки. Отдельный хук, а не просто
// константа, — чтобы не тянуть её импортом через полфайла и чтобы позже
// можно было пересчитывать при смене клиента, не трогая вызовы.
function useDevice() {
  return DEVICE;
}

/* Ракета запуска.

   Летит снизу вверх и «влетает» в остров: к концу пути уменьшается и
   гаснет, а обрамление острова в этот момент вспыхивает. Если острова
   нет (не тот айфон или окно Telegram начинается ниже), ракета просто
   уходит за верхний край — анимация остаётся осмысленной.

   Всё на CSS-анимациях: рисовать её покадрово в JS незачем, а на
   композиции она не даёт нагрузки поверх торгового экрана. */
const ROCKET_FLIGHT_MS = 1900;

// Анимация ракеты — настоящая из Telegram (Lottie). Файл лежит в public
// и подгружается один раз: класть полмегабайта в основной пакет ради
// анимации, которая играет раз в жизни токена, незачем.
let rocketAnimData = null;
let rocketAnimLoading = null;
function loadRocketAnimation(variant = "default") {
  if (rocketAnimData) return Promise.resolve(rocketAnimData);
  if (rocketAnimLoading) return rocketAnimLoading;
  const file = variant === "outline" ? "/rocket-outline.json" : "/rocket.json";
  rocketAnimLoading = fetch(file)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { rocketAnimData = data; rocketAnimLoading = null; return data; })
    .catch(() => { rocketAnimLoading = null; return null; });
  return rocketAnimLoading;
}

/* Ракета запуска.

   Летит снизу вверх по центру и «влетает» в остров: к концу пути
   уменьшается и гаснет, а обрамление острова в этот момент вспыхивает.
   Если острова нет (не тот айфон или окно Telegram начинается ниже),
   ракета просто уходит за верхний край — анимация остаётся осмысленной.

   Картинка нарисована носом вверх-вправо, поэтому при вертикальном
   полёте её разворачивают на 45 градусов. */
function LaunchRocket({ targetTop = ROCKET_TOUCH_TOP, variant = "default" }) {
  const holderRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let anim = null;
    (async () => {
      const [{ default: lottie }, data] = await Promise.all([
        import("lottie-web/build/player/lottie_light"),
        loadRocketAnimation(variant),
      ]);
      if (cancelled || !data || !holderRef.current) return;
      anim = lottie.loadAnimation({
        container: holderRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: data,
      });
    })();
    return () => { cancelled = true; if (anim) anim.destroy(); };
  }, [variant]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0, zIndex: 1900, pointerEvents: "none",
        // Ракета летит к центру острова: конец пути приходит переменной.
        ["--fly-to"]: `${targetTop}px`,
      }}
    >
      {/* Два слоя: внешний ведёт полёт, внутренний доворачивает картинку
          и сдвигает её так, чтобы центром вращения и точкой прилёта был
          сам корпус. В исходном кадре ракета нарисована не по центру
          холста, а в его верхнем правом углу — без поправки она уходила
          в остров мимо, левее и выше. */}
      <div
        style={{
          // По горизонтали центрует translate(-50%) в самой анимации,
          // поэтому отрицательного поля здесь быть не должно: вместе они
          // сдвигали ракету на её же ширину влево. По вертикали поле
          // нужно — чтобы --fly-to означала центр, а не верхний край.
          position: "absolute", left: "50%", top: 0, width: 168, height: 168, marginTop: -84,
          animation: `rocketFly ${ROCKET_FLIGHT_MS}ms cubic-bezier(0.45,0,0.5,1) forwards`,
        }}
      >
        {/* Поправка на то, что в исходном кадре ракета нарисована не по
            центру холста: измерено по отрисовке, смещение около 13 на 11
            точек для этого размера. */}
        <div ref={holderRef} style={{ width: "100%", height: "100%", transform: "translate(13px, -11px)" }} />
      </div>
    </div>
  );
}

/* Обрамление «Динамического острова».

   Отличить айфон с островом от айфона с чёлкой по строке браузера
   нельзя — модель там не пишут. Но верхний безопасный отступ у них
   разный: у чёлки это 44–48 точек, у острова 59 (у Pro-моделей 16-й
   серии 62). Порог посередине и разделяет поколения.

   Размеры самого острова заданы системой: 125.7 × 36.7 точки, отступ
   сверху 11. Рамка рисуется чуть больше, ровно вокруг него. */
const ISLAND_MIN_SAFE_TOP = 51;
const ISLAND_WIDTH = 126;
const ISLAND_HEIGHT = 37.3;
const ISLAND_TOP = 11;
// Зазор между островом и рамкой. Ровно на половину толщины линии:
// обводка рисуется по центру пути, поэтому внешняя её половина ложится
// вплотную к краю острова, а внутренняя — на сам остров. Больший зазор
// читался как отдельная рамка рядом, а не как обводка самого острова.
const ISLAND_GAP = 1;
// Нижняя граница обрамления и вынос носа ракеты от её центра. Ракета
// должна погаснуть ровно в тот миг, когда нос коснулся рамки, а не
// пролететь сквозь неё: значит центр в конце пути стоит настолько ниже
// границы, насколько нос выступает вперёд.
const ISLAND_BOTTOM = ISLAND_TOP - ISLAND_GAP + ISLAND_HEIGHT + ISLAND_GAP * 2;
const ROCKET_NOSE_OFFSET = 50;
const ROCKET_TOUCH_TOP = ISLAND_BOTTOM + ROCKET_NOSE_OFFSET;

function DynamicIslandFrame({ topOffset = 0, hitKey = 0, phase = "in" }) {
  const w = ISLAND_WIDTH + ISLAND_GAP * 2;
  const h = ISLAND_HEIGHT + ISLAND_GAP * 2;
  const r = h / 2;
  const pad = 16; // место под свечение, чтобы его не срезало по краю

  // Контур пилюли, начатый строго от середины нижней грани: искры
  // стартуют оттуда и расходятся в обе стороны, поэтому обе половины
  // описываются одним и тем же путём, пройденным в разные стороны.
  const ringCW = `M ${w / 2} ${h} L ${w - r} ${h} A ${r} ${r} 0 0 0 ${w - r} 0 L ${r} 0 A ${r} ${r} 0 0 0 ${r} ${h} Z`;
  const ringCCW = `M ${w / 2} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} Z`;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: ISLAND_TOP - ISLAND_GAP - pad + topOffset,
        left: "50%",
        marginLeft: -(w / 2 + pad),
        width: w + pad * 2,
        height: h + pad * 2,
        pointerEvents: "none",
        // Выше всего, включая заставку и модальные окна: это обрамление
        // самого экрана телефона, а не элемент интерфейса.
        zIndex: 2000,
        animation: phase === "out"
          ? "frameFadeOut 500ms ease-in both"
          : "frameFadeIn 420ms ease-out both",
      }}
    >
      <svg width={w + pad * 2} height={h + pad * 2} viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} style={{ overflow: "visible" }}>
        {/* спокойное состояние */}
        <path
          d={ringCW}
          fill="none"
          stroke={T.electric}
          strokeWidth={1.5}
          style={{ filter: `drop-shadow(0 0 6px ${hexA(T.electric, 0.6)})`, animation: "islandGlow 3.4s ease-in-out infinite" }}
        />

        {/* Реакция на прилёт ракеты. Ключ меняется на каждый запуск —
            элементы пересоздаются, и анимация проигрывается заново. */}
        {hitKey > 0 && (
          <g key={hitKey}>
            {/* две искры от середины нижней грани навстречу друг другу */}
            {[["islandSparkRun", ringCW], ["islandSparkRun", ringCCW]].map(([anim, d], i) => (
              <path
                key={i}
                d={d}
                pathLength={1000}
                fill="none"
                stroke="#FFE9C8"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="26 974"
                style={{
                  filter: `drop-shadow(0 0 7px ${T.electric})`,
                  animation: `${anim} 700ms cubic-bezier(0.5,0,0.6,1) forwards`,
                }}
              />
            ))}
            {/* встретились наверху — вспыхивает весь контур и плавно гаснет */}
            <path
              d={ringCW}
              fill="none"
              stroke="#FFC9A8"
              strokeWidth={2.6}
              style={{ opacity: 0, animation: "islandRingBurst 1400ms 690ms ease-out forwards" }}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

/* Ракета, пролетающая на фоне кнопки запуска.

   Та же анимация Telegram, что и при самом запуске, только маленькая и
   по горизонтали: справа налево. Картинка нарисована носом вверх-вправо,
   поэтому доворачивается так, чтобы нос смотрел по ходу движения.
   Проигрыватель и данные подгружаются один раз на всё приложение — те
   же самые, что для большой ракеты. */
function ButtonRocketFlyby({ size = 26 }) {
  const holderRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let anim = null;
    (async () => {
      const [{ default: lottie }, data] = await Promise.all([
        import("lottie-web/build/player/lottie_light"),
        loadRocketAnimation(),
      ]);
      if (cancelled || !data || !holderRef.current) return;
      anim = lottie.loadAnimation({
        container: holderRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: data,
      });
    })();
    return () => { cancelled = true; if (anim) anim.destroy(); };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
        borderRadius: "inherit", opacity: 0.8,
      }}
    >
      <div
        ref={holderRef}
        style={{
          position: "absolute", top: "50%", left: 0,
          width: size, height: size, marginTop: -size / 2,
          animation: "buttonRocketFly 9s linear infinite",
        }}
      />
    </div>
  );
}

/* Лист как иконка. Тот же контур, что падает на фоне приложения, —
   чтобы кнопка запуска была из того же набора, что и всё остальное, а
   не из чужого. Прожилки на такой величине не рисуются: они
   превращаются в грязь. */
// Кленовый по умолчанию: из трёх фоновых пород он единственный, чей
// силуэт остаётся узнаваемым листом на шестнадцати точках. Дубовый на
// такой величине рассыпается в зубчики, мятный читается как капля.
function LeafIcon({ size = 14, color = T.electric, kind = 0 }) {
  const leaf = LEAF_KINDS[kind % LEAF_KINDS.length];
  return (
    <svg width={size * (30 / 38)} height={size} viewBox="-15 -32 30 38" style={{ flexShrink: 0 }} aria-hidden>
      <path d={leaf.stem} stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <path d={leaf.outline} fill={color} />
    </svg>
  );
}

/* Обрамление экрана — для телефонов без «острова».

   Там врезаться не во что, поэтому ракета доходит до верхней границы
   самого экрана, а светится его контур. Эффект тот же самый: две искры
   от середины нижней грани расходятся по контуру, встречаются наверху и
   поджигают весь обрамок, который потом плавно гаснет.

   Скругление угла экрана веб-страница не знает: у телефонов оно около
   сорока точек, у настольного окна прямые углы. Разделяем по наличию
   сенсорного ввода. */
const SCREEN_FRAME_INSET = 3;
const SCREEN_FRAME_RADIUS = 44;
const ROCKET_TOUCH_TOP_SCREEN = SCREEN_FRAME_INSET + ROCKET_NOSE_OFFSET;

function ScreenFrame({ hitKey = 0, phase = "in" }) {
  const [size, setSize] = useState(() => (typeof window === "undefined"
    ? { w: 0, h: 0 }
    : { w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (!size.w || !size.h) return null;

  const inset = SCREEN_FRAME_INSET;
  const w = size.w - inset * 2;
  const h = size.h - inset * 2;
  const r = Math.min(DEVICE.isTouch ? SCREEN_FRAME_RADIUS : 14, w / 2, h / 2);

  // Контур начинается от середины нижней грани — оттуда стартуют искры.
  const ringCW = `M ${w / 2} ${h} L ${w - r} ${h} A ${r} ${r} 0 0 0 ${w} ${h - r} L ${w} ${r} A ${r} ${r} 0 0 0 ${w - r} 0 L ${r} 0 A ${r} ${r} 0 0 0 0 ${r} L 0 ${h - r} A ${r} ${r} 0 0 0 ${r} ${h} Z`;
  const ringCCW = `M ${w / 2} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} Z`;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", left: inset, top: inset, width: w, height: h,
        pointerEvents: "none", zIndex: 2000,
        animation: phase === "out"
          ? "frameFadeOut 500ms ease-in both"
          : "frameFadeIn 420ms ease-out both",
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <path
          d={ringCW}
          fill="none"
          stroke={T.electric}
          strokeWidth={1.5}
          style={{ filter: `drop-shadow(0 0 6px ${hexA(T.electric, 0.6)})`, animation: "islandGlow 3.4s ease-in-out infinite" }}
        />
        {hitKey > 0 && (
          <g key={hitKey}>
            {[ringCW, ringCCW].map((d, i) => (
              <path
                key={i}
                d={d}
                pathLength={1000}
                fill="none"
                stroke="#FFE9C8"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="26 974"
                style={{
                  filter: `drop-shadow(0 0 7px ${T.electric})`,
                  // Контур экрана длиннее островного, поэтому и бежать по
                  // нему дольше: иначе искры мелькали бы рывком.
                  animation: "islandSparkRun 1100ms cubic-bezier(0.5,0,0.6,1) forwards",
                }}
              />
            ))}
            <path
              d={ringCW}
              fill="none"
              stroke="#FFC9A8"
              strokeWidth={2.6}
              style={{ opacity: 0, animation: "islandRingBurst 1400ms 1090ms ease-out forwards" }}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function useTelegramViewport() {
  const [height, setHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 720
  );
  const [insetBottom, setInsetBottom] = useState(0);
  const [insetTop, setInsetTop] = useState(0);
  // Отдельно от суммарного отступа: это отступ железа телефона (чёлка
  // или «остров»), без учёта собственной шапки Telegram. По нему видно,
  // какой именно вырез у экрана.
  const [deviceTop, setDeviceTop] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
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
        // Два разных отступа, и их надо складывать, а не выбирать один:
        // safeAreaInset — это железо телефона (чёлка, статус-бар),
        // contentSafeAreaInset — собственная шапка Telegram над окном
        // приложения. В полноэкранном режиме важен первый, в обычном —
        // второй, и оба могут быть ненулевыми одновременно.
        const device = tg.safeAreaInset || {};
        const content = tg.contentSafeAreaInset || {};
        setInsetTop((device.top || 0) + (content.top || 0));
        setInsetBottom((device.bottom || 0) + (content.bottom || 0));
        setDeviceTop(device.top || 0);
        setFullscreen(!!tg.isFullscreen);
        setReady(true);
      };
      update();
      tg.onEvent && tg.onEvent("viewportChanged", update);
      tg.onEvent && tg.onEvent("safeAreaChanged", update);
      tg.onEvent && tg.onEvent("contentSafeAreaChanged", update);
      return () => {
        tg.offEvent && tg.offEvent("viewportChanged", update);
        tg.offEvent && tg.offEvent("safeAreaChanged", update);
        tg.offEvent && tg.offEvent("contentSafeAreaChanged", update);
      };
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

  return { height, insetBottom, insetTop, deviceTop, fullscreen, ready };
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
// Кошелёк комиссии площадки. Он зашивается в кривую при запуске токена,
// и контракт сам отправляет туда 1% с каждой покупки и продажи. Смена
// адреса действует только на новые токены: у уже развёрнутых кривых
// получатель поменять нельзя.
const FEE_ADDRESS = "0QClGN5huzz-Z3bwgxr7GOPe5Jyi8PNKbsNnDFKFNGbjunBZ";
const FEE_PERCENT = 0.01; // 1% комиссии
  // Балансовый API (tonapi.io) по умолчанию смотрит в mainnet. Если
  // кошелёк подключён в testnet (например, для проверки покупки на
  // тестовых TON), запрос к mainnet-адресу вернёт пустой/нулевой баланс,
  // и любая покупка будет падать в "недостаточно средств" — это и была
  // причина того, что покупка "не работала" при тесте. Переключатель
  // ниже отправляет запросы в testnet-API вместо mainnet. Важно: сам
  // TonConnectUIProvider (обычно настраивается в index/main файле, не
  // в этом) тоже должен быть сконфигурирован под testnet — иначе
  // подключаемый кошелёк не будет знать, что вы работаете в тестовой сети.
  const TON_TESTNET = TON_TESTNET_NETWORK;
  const TONAPI_HOST = TON_TESTNET ? "testnet.tonapi.io" : "tonapi.io";
  // Бесплатный tonapi.io без ключа сильно лимитирован (мы поймали
  // 429 "rate limit: free tier"). Заведите бесплатный ключ на
  // https://tonconsole.com (Project -> API Keys) и вставьте сюда —
  // лимит вырастет на порядки. С пустой строкой запросы просто
  // продолжат уходить без заголовка Authorization, как сейчас.
  const TONAPI_KEY = "";
  const [view, setView] = useState("home");
  const [tab, setTab] = useState("home");
  const [token, setToken] = useState(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { height, insetBottom, insetTop, deviceTop, fullscreen, ready: viewportReady } = useTelegramViewport();
  const device = useDevice();
  // Рамка вокруг «острова» рисуется только там, где остров есть и где он
  // виден: в обычном режиме окно Telegram начинается ниже него, и
  // обрамлять нечего. Параметр ?island=1 включает её принудительно —
  // чтобы можно было посмотреть на любом устройстве.
  const forceIsland = typeof window !== "undefined" && /[?&]island=1/.test(window.location.search);
  const rocketVariant = typeof window !== "undefined" && /[?&]rocket=outline/.test(window.location.search) ? "outline" : "default";
  // Полёт ракеты после удачного запуска токена и вспышка острова в
  // момент, когда она в него влетает.
  const [rocketFlying, setRocketFlying] = useState(false);
  const [islandHitKey, setIslandHitKey] = useState(0);
  // Обрамление живёт только во время запуска токена — и вокруг острова,
  // и по краю экрана там, где острова нет. Постоянно висеть оно не
  // может: остров умеет раскрываться под музыку, звонок, таймер — и
  // тогда он становится больше нашей рамки, а веб-странице его форма
  // недоступна, узнать о раскрытии неоткуда. Контур экрана, висевший
  // всё время, просто мешал смотреть на приложение.
  // null — не показываем, "in" — проявляется и держится, "out" — гаснет.
  const [islandFramePhase, setIslandFramePhase] = useState(null);
  const rocketTimers = useRef([]);
  function playLaunchRocket() {
    rocketTimers.current.forEach(clearTimeout);
    setRocketFlying(true);
    setIslandFramePhase("in");
    rocketTimers.current = [
      // Искры трогаются в тот момент, когда ракета уже у самого острова.
      setTimeout(() => setIslandHitKey((n) => n + 1), ROCKET_FLIGHT_MS - 130),
      setTimeout(() => setRocketFlying(false), ROCKET_FLIGHT_MS + 60),
      // Вспышка контура доигрывает около двух секунд после касания,
      // потом рамка уходит.
      setTimeout(() => setIslandFramePhase("out"), ROCKET_FLIGHT_MS + 2100),
      setTimeout(() => setIslandFramePhase(null), ROCKET_FLIGHT_MS + 2600),
    ];
  }
  useEffect(() => () => rocketTimers.current.forEach(clearTimeout), []);
  // Анимацию тянем заранее, в фоне: к моменту запуска токена она должна
  // быть готова, иначе полёт начнётся с задержкой на загрузку.
  useEffect(() => {
    const to = setTimeout(() => loadRocketAnimation(rocketVariant), 4000);
    return () => clearTimeout(to);
  }, [rocketVariant]);
  // ?rocket=1 — проиграть полёт без запуска токена: чтобы посмотреть и
  // поправить, не тратя TON.
  useEffect(() => {
    if (typeof window === "undefined" || !/[?&]rocket=1/.test(window.location.search)) return;
    // С запасом: до конца заставки рамка ещё не показывается, и полёт
    // прошёл бы впустую.
    const to = setTimeout(playLaunchRocket, 7000);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showIsland = forceIsland || (device.isIOS && deviceTop >= ISLAND_MIN_SAFE_TOP && (fullscreen || !device.inTelegram));

  // Always open on Home — closing and reopening the app (or refreshing)
  // should land the person back on the front page rather than wherever
  // they were before.

  // Real, live TON meme-pool feed — polled every 2.5s. Lives at the root
  // (not inside HomeView) so the currently-open token detail can also stay
  // synced to fresh data below, instead of freezing at whatever price it
  // had the moment it was tapped.
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let tick = 0;

    // Глубокий проход собирает много страниц — им наполняются «Горячие» и
    // «DEX». Гонять столько запросов каждые 15 секунд нельзя (упрёмся в
    // лимит API), поэтому обычный опрос обновляет только первую страницу,
    // а остальное освежается раз в пару минут.
    async function poll(deep) {
      const live = deep
        ? await fetchTonMemePools(FEED_LIMIT, FEED_PAGES)
        : await fetchTonMemePools(20, 1);
      if (cancelled || !live || !live.length) { setTokensLoading(false); return; }

      setTokens((prev) => {
        if (deep || !prev.length) return live;
        // Свежие цифры по верхушке накладываем на уже собранный список,
        // не теряя пулы с дальних страниц.
        const fresh = new Map(live.map((tok) => [tok.id, tok]));
        const merged = prev.map((tok) => fresh.get(tok.id) || tok);
        const known = new Set(prev.map((tok) => tok.id));
        live.forEach((tok) => { if (!known.has(tok.id)) merged.push(tok); });
        return merged;
      });
      setTokensLoading(false);
    }

    // Сначала быстрый проход по первой странице — он снимает заставку, —
    // и только потом добор остальных страниц в фоне.
    poll(false).then(() => { if (!cancelled) poll(true); });
    const iv = setInterval(() => {
      tick += 1;
      poll(tick % FEED_DEEP_EVERY === 0);
    }, TOKEN_REFRESH_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);
  // Whenever a fresh poll comes in, refresh the currently-viewed token (if
  // any) with its updated row from that same poll — so price, market cap
  // and the header stats on the detail screen move in step with the feed
  // instead of staying pinned to the value at tap-time.
  useEffect(() => {
    if (!token) return;
    const fresh = tokens.find(x => x.id === token.id);
    if (fresh && fresh !== token) setToken(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);


  // Настоящее подключение кошелька через TonConnect. `wallet` — null,
  // пока пользователь не подключил кошелёк; после подключения содержит
  // реальные данные (адрес и т.д.), которые прилетают от Tonkeeper/др.
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const connected = !!wallet;
  const walletAddress = wallet ? Address.parse(wallet.account.address).toString({ bounceable: false }) : "";
  const walletAddressShort = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "";

  // Реальный баланс TON — подтягиваем с публичного API tonapi.io по
  // адресу подключённого кошелька (не требует ключа для базовых запросов,
  // но без ключа лимит очень низкий — см. TONAPI_KEY выше).
  const [tonBalance, setTonBalance] = useState(0);
  const [tonPriceUsd, setTonPriceUsd] = useState(0);

  // Токен на кривой во внешней ленте не появляется — пары на DEX у него
  // нет, — поэтому его показатели обновляем сами, пока экран открыт.
  // Всё считается по цепочке: цена и капитализация по резервам, объём и
  // изменение по сделкам самой кривой.
  useEffect(() => {
    if (!token?.curveAddress) return;
    const curve = token.curveAddress;
    const jetton = token.tokenAddress;
    let cancelled = false;
    async function load() {
      const m = await fetchCurveMarket(curve, jetton, TON_TESTNET, tonPriceUsd);
      if (cancelled || !m) return;
      setToken((prev) => (prev && prev.curveAddress === curve ? {
        ...prev,
        price: m.priceUsd,
        mcapNum: m.mcapUsd,
        vol: fmtCompact(m.vol24Usd),
        liq: fmtCompact(m.liqUsd),
        change: m.change24,
        tx24h: m.tx24,
      } : prev));
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [token?.curveAddress, token?.tokenAddress, tonPriceUsd]);

  // Диагностика запроса баланса — больше не рисуется на экране, но
  // остаётся в консоли (console.log/console.error) на случай отладки.
  const [tonDebug, setTonDebug] = useState(null);
  // Раньше баланс перезапрашивался только при смене адреса кошелька —
  // после успешной покупки/продажи он так и оставался старым значением
  // (в вашем случае — 0, потому что первый запрос ни разу не прошёл
  // из-за 429). Инкрементируем этот счётчик из confirmTrade, чтобы
  // эффект ниже перезапустился и подтянул баланс заново.
  const [balanceRefreshTick, setBalanceRefreshTick] = useState(0);
  useEffect(() => {
    if (!walletAddress) { setTonBalance(0); return; }
    // wallet.account.chain — это то, в какой сети реально сидит
    // подключённый кошелёк ("-239" = mainnet, "-3" = testnet). Если он
    // не равен "-3", кошелёк подключён не в testnet, и никакой запрос
    // к testnet.tonapi.io не покажет ваши тестовые TON, потому что
    // TonConnectUIProvider (в index/main файле) настроен на mainnet-
    // манифест.
    const chain = wallet?.account?.chain;
    let cancelled = false;
    // Бесплатный tonapi.io без ключа отдаёт 429 "rate limit: free tier"
    // при частых запросах (типично во время разработки с HMR/перезагрузками).
    // Ретраим с нарастающей паузой вместо того, чтобы сразу сдаваться и
    // показывать баланс 0, будто на кошельке правда пусто.
    async function fetchBalance(attempt = 0) {
      try {
        const headers = TONAPI_KEY ? { Authorization: `Bearer ${TONAPI_KEY}` } : {};
        const r = await fetch(`https://${TONAPI_HOST}/v2/accounts/${walletAddress}`, { headers });
        const body = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.status === 429 && attempt < 3) {
          const delay = 1200 * (attempt + 1);
          console.warn(`[ton-debug] tonapi 429, retry in ${delay}ms (attempt ${attempt + 1}/3)`);
          setTonDebug({ chain, host: TONAPI_HOST, status: r.status, error: `rate limited, retrying (${attempt + 1}/3)` });
          setTimeout(() => fetchBalance(attempt + 1), delay);
          return;
        }
        if (!r.ok) {
          console.error("[ton-debug] tonapi error", r.status, body);
          setTonBalance(0);
          setTonDebug({ chain, host: TONAPI_HOST, status: r.status, error: JSON.stringify(body).slice(0, 160) });
          return;
        }
        console.log("[ton-debug] tonapi response:", body);
        setTonBalance(body && body.balance ? Number(body.balance) / 1e9 : 0);
        setTonDebug({ chain, host: TONAPI_HOST, status: r.status, balanceRaw: body?.balance });
      } catch (err) {
        if (cancelled) return;
        console.error("[ton-debug] tonapi fetch failed:", err);
        setTonBalance(0);
        setTonDebug({ chain, host: TONAPI_HOST, error: String(err).slice(0, 160) });
      }
    }
    console.log("[ton-debug] wallet.account.chain:", chain, "address:", walletAddress);
    fetchBalance();
    return () => { cancelled = true; };
  }, [walletAddress, balanceRefreshTick]);
  const [tonPriceChecked, setTonPriceChecked] = useState(false);
  useEffect(() => {
    // Два источника: если один недоступен (у CoinGecko бывает лимит на
    // адрес), курс всё равно приедет. Без курса приложение не может
    // показать ни цену, ни капитализацию, поэтому запасной источник тут
    // не роскошь.
    async function loadRate() {
      const sources = [
        async () => {
          const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd");
          const d = await r.json();
          return (d && d["the-open-network"] && d["the-open-network"].usd) || 0;
        },
        async () => {
          const r = await fetch(`${TONAPI_MAINNET_BASE}/v2/rates?tokens=ton&currencies=usd`);
          const d = await r.json();
          return Number(d?.rates?.TON?.prices?.USD) || 0;
        },
      ];
      for (const load of sources) {
        try {
          const usd = await load();
          if (usd > 0) {
            tonUsdLive = usd;
            setTonPriceUsd(usd);
            return;
          }
        } catch (e) { /* пробуем следующий источник */ }
      }
    }
    loadRate().finally(() => setTonPriceChecked(true));
    // Курс живой: за час он успевает уйти, а экран может висеть долго.
    const iv = setInterval(loadRate, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  // Global toast — rendered once at the root (not nested inside any
  // scrolling view), so it's never clipped no matter which screen
  // triggered it.
  const [toast, setToast] = useState(null);
  // Отдельный признак ухода: сама подсказка ещё в разметке, но уже
  // проигрывает анимацию вверх. Без него она исчезала мгновенно.
  const [toastLeaving, setToastLeaving] = useState(false);
  // Номер показа: по нему подсказка пересоздаётся, и анимация появления
  // проигрывается заново даже если текст совпал с предыдущим.
  const [toastSeq, setToastSeq] = useState(0);
  const toastTimer = useRef(null);
  const toastHideTimer = useRef(null);
  function showToast(msg) {
    clearTimeout(toastTimer.current);
    clearTimeout(toastHideTimer.current);
    setToast(msg);
    setToastLeaving(false);
    setToastSeq((n) => n + 1);
    haptic();
    toastTimer.current = setTimeout(() => setToastLeaving(true), 2400);
    toastHideTimer.current = setTimeout(() => {
      setToast(null);
      setToastLeaving(false);
    }, 2400 + TOAST_OUT_MS);
  }
  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(toastHideTimer.current);
  }, []);

  // Profile / account state lives here (not inside ProfileView) so the
  // AuthModal bottom sheet can be rendered as a direct child of
  // the root — exactly like ConnectModal already is — instead of being
  // nested inside ProfileView's own scrollable content, which was
  // clipping it off-screen.
  //
  // Source of truth is now the real Supabase auth session (not
  // localStorage) — this is what makes login persist across reloads and
  // work across devices instead of just faking it client-side.
  const EMPTY_PROFILE = { nickname: "", email: "", bio: "", avatarUrl: null, emoji: null, verified: false };
  const [accountCreated, setAccountCreated] = useState(false);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState(null);

  // Подписчики и подписки текущего человека. Считаем на стороне базы
  // (head + exact count): сами строки здесь не нужны. Живут в корне,
  // потому что от них зависят и профиль, и достижения, и магазин.
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  // Сколько человек пришло по своей ссылке. Считается по профилям, где
  // стоит связь с этим пользователем: то есть по тем, кто действительно
  // зашёл и завёл аккаунт, а не по кликам.
  const [inviteCount, setInviteCount] = useState(0);
  useEffect(() => {
    if (!userId) { setInviteCount(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("invited_by", userId);
        if (!cancelled) setInviteCount(count || 0);
      } catch (err) {
        // Колонки ещё нет — показываем ноль, а не ломаем экран.
        console.warn("[mintly] invite count unavailable:", err && err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
  useEffect(() => {
    if (!userId) { setFollowCounts({ followers: 0, following: 0 }); return; }
    let cancelled = false;
    (async () => {
      try {
        const [followers, following] = await Promise.all([
          supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
          supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
        ]);
        if (cancelled) return;
        setFollowCounts({ followers: followers.count || 0, following: following.count || 0 });
      } catch (err) {
        console.warn("[mintly] follow counts unavailable:", err && err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);


  async function loadProfileForUser(user) {
    setUserId(user ? user.id : null);
    if (!user) { setAccountCreated(false); setProfile(EMPTY_PROFILE); setMyTokens([]); return; }
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("nickname, email, bio, avatar_url, emoji, frame_id, card_id, creator_tier, verified")
      .eq("id", user.id)
      .single();
    if (error || !prof) { setAccountCreated(false); setProfile(EMPTY_PROFILE); setMyTokens([]); return; }
    setProfile({ nickname: prof.nickname, email: prof.email, bio: prof.bio || "", avatarUrl: prof.avatar_url, emoji: prof.emoji, verified: !!prof.verified });
    // Ступень знака создателя лежит в профиле, а не только на устройстве:
    // её должны видеть другие. Здесь только читаем, повышает её эффект
    // ниже, когда посчитается лучшая капитализация.
    setCreatorTier(Number(prof.creator_tier) || 0);
    setAccountCreated(true);
    // Косметика хранится в профиле, а не только на устройстве — иначе её
    // не увидят другие. Но если на сервере пусто, а локально что-то
    // надето (выбор сделан до переезда в базу), локальное не затираем, а
    // наоборот — поднимаем на сервер.
    setCosmetics((local) => {
      const serverFrame = FRAME_BY_ID[prof.frame_id] ? prof.frame_id : "none";
      const serverCard = CARD_BY_ID[prof.card_id] ? prof.card_id : "none";
      const frame = serverFrame === "none" && local.frame !== "none" ? local.frame : serverFrame;
      const card = serverCard === "none" && local.card !== "none" ? local.card : serverCard;

      const patch = {};
      if (frame !== serverFrame) patch.frame_id = frame;
      if (card !== serverCard) patch.card_id = card;
      if (Object.keys(patch).length) {
        supabase.from("profiles").update(patch).eq("id", user.id).then(({ error }) => {
          if (error) console.warn("[mintly] failed to migrate cosmetics:", error.message);
        });
      }
      return { frame, card };
    });
    loadMyTokens(user.id);
  }

  // "My Tokens" now live in Supabase (table `tokens`, see
  // "My Tokens" now live in Supabase (table `tokens`, see
  // supabase_tokens_schema.sql) instead of localStorage — this makes them
  // persist across devices/reinstalls and survive a logout/login, tied to
  // the real account (owner_id = auth.uid()) instead of just this browser.
  function mapTokenRow(row) {
    return {
      id: row.id,
      name: row.name,
      ticker: row.ticker,
      emoji: "🚀",
      verified: false,
      mcapNum: 0,
      liq: "0",
      vol: "0",
      change: 0,
      tx24h: 0,
      address: row.address,
      poolAddress: row.pool_address,
      curveAddress: row.curve_address || null,
      curveJettonWallet: row.curve_jetton_wallet || null,
      creatorWallet: row.creator_wallet || null,
      buyTokens: Number(row.buy_tokens) || 0,
      explorerUrl: row.explorer_url,
      supply: row.supply,
      buyAmount: row.buy_amount,
      logoUrl: row.logo_url,
      network: row.network || "mainnet",
      ownerId: row.owner_id || null,
      createdAt: new Date(row.created_at).getTime(),
    };
  }
  async function loadMyTokens(uid) {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("owner_id", uid)
      .order("created_at", { ascending: false });
    if (error) { console.error("[mintly] failed to load tokens from Supabase:", error); return; }
    setMyTokens((data || []).map(mapTokenRow));
  }

  // Public feed for the mempad's "Новые" tab — every token launched by
  // every user, not just the signed-in one (that's `myTokens`, scoped to
  // owner_id above). RLS on `tokens` allows public select, so this works
  // even for signed-out visitors.
  const [communityTokens, setCommunityTokens] = useState([]);
  const [communityLoaded, setCommunityLoaded] = useState(false);
  async function loadCommunityTokens() {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { console.error("[mintly] failed to load community tokens from Supabase:", error); setCommunityLoaded(true); return; }
    const rows = (data || []).map(mapTokenRow);
    setCommunityTokens(rows);
    setCommunityLoaded(true);

    // Все рыночные числа берём у самих кривых: цену, капитализацию,
    // объём и изменение за сутки. Ограничиваем количество запросов —
    // лента может быть длинной, а при открытии токена всё равно идёт
    // отдельное, более свежее обновление.
    const withCurve = rows.filter((tok) => tok.curveAddress).slice(0, 12);
    if (!withCurve.length) return;
    const markets = await Promise.all(
      withCurve.map((tok) => fetchCurveMarket(tok.curveAddress, tok.address, TON_TESTNET, tonPriceUsd)),
    );
    const priced = new Map();
    withCurve.forEach((tok, i) => {
      const m = markets[i];
      if (!m) return;
      priced.set(tok.id, {
        priceTon: m.priceTon,
        // Капитализация — цена за весь выпуск, а не за проданное: так её
        // считают на всех подобных площадках. Выпуск читается с цепочки.
        mcapNum: m.mcapUsd,
        vol: fmtCompact(m.vol24Usd),
        liq: fmtCompact(m.liqUsd),
        change: m.change24,
        tx24h: m.tx24,
        // Для тонкой шкалы в ленте: сколько собрано и сколько нужно.
        raisedTon: Number(m.state.realTon) / 1e9,
        graduationTon: Number(m.state.graduationTon) / 1e9,
      });
    });
    if (!priced.size) return;
    setCommunityTokens((prev) =>
      prev.map((tok) => {
        const p = priced.get(tok.id);
        return p ? { ...tok, ...p } : tok;
      }),
    );
  }

  useEffect(() => {
    let active = true;
    (async () => {
      let { data: { session } } = await supabase.auth.getSession();
      // Внутри Telegram вход происходит сам: подпись initData уже есть,
      // спрашивать человека не о чем. Если не вышло — просто открываем
      // приложение без аккаунта, кнопка входа остаётся в профиле.
      if (!session && telegramInitData()) {
        try {
          await signInWithTelegram();
          session = (await supabase.auth.getSession()).data.session;
        } catch (err) {
          console.warn("[mintly] telegram auto sign-in failed:", err && err.message);
        }
      }
      if (!active) return;
      await loadProfileForUser(session?.user || null);
      setAuthChecked(true);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfileForUser(session?.user || null);
    });
    loadCommunityTokens();
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalMode, setProfileModalMode] = useState("create");
  const [settingsItem, setSettingsItem] = useState(null);
  const [manageToken_, setManageToken_] = useState(null);
  const [tradeModal, setTradeModal] = useState(null); // { mode: 'buy' | 'sell' }
  // Настоящий баланс открытого токена на кошельке. Пока он не пришёл —
  // null, и окно сделки временно опирается на локальный счётчик.
  const [chainHolding, setChainHolding] = useState(null);
  // Адрес своего кошелька жетона узнаём заранее, при открытии окна
  // сделки. Спрашивать его в момент нажатия нельзя: ожидание ответа
  // разрывает цепочку от жеста пользователя, и Telegram сворачивает окно
  // кошелька раньше, чем по нему успевают нажать.
  const [chainJettonWallet, setChainJettonWallet] = useState(null);
  // Состояние кривой для предпросчёта суммы сделки. Без него окно
  // считало по цене из ленты, а у токенов на кривой её нет — отсюда
  // «вы получите 0».
  const [tradeCurveState, setTradeCurveState] = useState(null);
  const [chainHoldingRaw, setChainHoldingRaw] = useState(null);
  // Настоящий баланс открытого токена спрашиваем у сети — при открытии
  // окна сделки и после каждой сделки. Локальный счётчик остаётся только
  // как запасной вариант, пока ответ не пришёл.
  useEffect(() => {
    const jetton = token?.tokenAddress;
    if (!tradeModal || !jetton || !walletAddress) { setChainHolding(null); setChainJettonWallet(null); setTradeCurveState(null); return; }
    if (token?.curveAddress) {
      fetchCurveState(token.curveAddress, TON_TESTNET).then((state) => {
        if (!cancelled && state) setTradeCurveState(state);
      });
    }
    let cancelled = false;
    fetchJettonAccount(jetton, walletAddress, TON_TESTNET).then((info) => {
      if (cancelled || !info) return;
      if (info.balance != null) setChainHolding(info.balance);
      if (info.raw != null) setChainHoldingRaw(info.raw);
      if (info.wallet) setChainJettonWallet(info.wallet);
    });
    return () => { cancelled = true; };
  }, [tradeModal, token?.tokenAddress, walletAddress, balanceRefreshTick]);
  const [appSettings, setAppSettings] = useState(() => {
    const base = { language: "RU", theme: "Dark", pinEnabled: false };
    try {
      if (typeof window !== "undefined") {
        const savedTheme = window.localStorage.getItem("mintly_theme");
        const savedLang = window.localStorage.getItem("mintly_language");
        if (savedTheme) base.theme = savedTheme;
        if (savedLang) base.language = savedLang;
      }
    } catch (e) { /* localStorage unavailable */ }
    applyTheme(base.theme);
    setLang(base.language);
    return base;
  });
  function updateAppSetting(key, value) {
    if (key === "theme") applyTheme(value);
    if (key === "language") setLang(value);
    setAppSettings((s) => ({ ...s, [key]: value }));
    try {
      if (typeof window !== "undefined") {
        if (key === "theme") window.localStorage.setItem("mintly_theme", value);
        if (key === "language") window.localStorage.setItem("mintly_language", value);
      }
    } catch (e) { /* localStorage unavailable */ }
    showToast(key === "theme" ? (value === "White" ? t("themeChangedWhite") : t("themeChangedDark")) : t("settingsSaved"));
  }

  // Косметика из магазина — рамка аватарки и карточка профиля. Это чисто
  // оформление устройства, серверу о нём знать нечего, поэтому храним в
  // localStorage рядом с темой и языком.
  const [cosmetics, setCosmetics] = useState(() => {
    const base = { frame: "none", card: "none" };
    try {
      if (typeof window !== "undefined") {
        const f = window.localStorage.getItem("mintly_frame");
        const c = window.localStorage.getItem("mintly_card");
        if (f && FRAME_BY_ID[f]) base.frame = f;
        if (c && CARD_BY_ID[c]) base.card = c;
      }
    } catch (e) { /* localStorage unavailable */ }
    return base;
  });
  const COSMETIC_STORAGE = { frame: "mintly_frame", card: "mintly_card" };
  function equipCosmetic(kind, id) {
    setCosmetics((c) => ({ ...c, [kind]: id }));
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COSMETIC_STORAGE[kind] || "mintly_frame", id);
      }
    } catch (e) { /* localStorage unavailable */ }
    // localStorage оставляем для мгновенного отклика и гостей, но выбор
    // вошедшего уходит в профиль — иначе его предметы не увидит никто.
    if (userId) {
      supabase
        .from("profiles")
        .update(kind === "frame" ? { frame_id: id } : { card_id: id })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) console.warn("[mintly] failed to save cosmetics:", error.message);
        });
    }
    showToast(id === "none" ? t("cosmeticRemoved") : t("cosmeticApplied"));
  }

  // PIN-код при входе — код хранится только на устройстве (localStorage),
  // это локальная блокировка приложения, а не серверная авторизация.
  // При включённом PIN экран блокировки перекрывает весь интерфейс,
  // пока не введён верный код.
  const [pinCode, setPinCode] = useState(null);
  const [pinModal, setPinModal] = useState(null); // { mode: "create" | "change" | "disable" } | null
  const [pinLocked, setPinLocked] = useState(false);

  useEffect(() => {
    try {
      const storedEnabled = window.localStorage.getItem("mintly_pin_enabled") === "1";
      const storedPin = window.localStorage.getItem("mintly_pin");
      if (storedEnabled && storedPin) {
        setPinCode(storedPin);
        setAppSettings((s) => ({ ...s, pinEnabled: true }));
        setPinLocked(true);
      }
    } catch (e) { /* localStorage unavailable */ }
  }, []);

  function persistPin(enabled, code) {
    try {
      if (enabled && code) {
        window.localStorage.setItem("mintly_pin", code);
        window.localStorage.setItem("mintly_pin_enabled", "1");
      } else {
        window.localStorage.removeItem("mintly_pin");
        window.localStorage.removeItem("mintly_pin_enabled");
      }
    } catch (e) { /* localStorage unavailable */ }
  }

  // "My Tokens" (create-flow results) — now backed by Supabase (see
  // loadMyTokens/loadProfileForUser above), scoped per-account instead of
  // per-browser. Starts empty and is populated once the session resolves.
  const [myTokens, setMyTokens] = useState([]);

  // Лучшая капитализация среди своих токенов — на ней держатся
  // достижения «довести токен до $1K/$10K/$100K». Это рекорд, а не
  // текущее значение: цена ходит вверх-вниз, и было бы странно отбирать
  // уже полученную рамку из-за просадки. Рекорд лежит рядом с
  // пользователем в браузере — на цепочке его хранить негде.
  const [bestMcapUsd, setBestMcapUsd] = useState(0);
  const mcapPeakKey = userId ? `mintly:mcapPeak:${userId}` : "";
  useEffect(() => {
    if (!mcapPeakKey) { setBestMcapUsd(0); return; }
    try {
      const saved = Number(localStorage.getItem(mcapPeakKey) || 0);
      if (saved > 0) setBestMcapUsd(saved);
    } catch { /* приватный режим — просто начнём с нуля */ }
  }, [mcapPeakKey]);
  const myCurveKey = myTokens.map((tok) => tok.curveAddress || "").filter(Boolean).join(",");
  useEffect(() => {
    if (!myCurveKey || !tonPriceUsd) return;
    let cancelled = false;
    (async () => {
      const list = myTokens.filter((tok) => tok.curveAddress).slice(0, 8);
      const markets = await Promise.all(
        list.map((tok) => fetchCurveMarket(tok.curveAddress, tok.address || tok.tokenAddress, TON_TESTNET, tonPriceUsd).catch(() => null)),
      );
      if (cancelled) return;
      const top = markets.reduce((max, m) => (m && m.mcapUsd > max ? m.mcapUsd : max), 0);
      if (top <= 0) return;
      setBestMcapUsd((prev) => {
        if (top <= prev) return prev;
        try { if (mcapPeakKey) localStorage.setItem(mcapPeakKey, String(top)); } catch { /* не критично */ }
        return top;
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCurveKey, tonPriceUsd, mcapPeakKey]);

  // Сводка по своим сделкам: сколько их было, на сколько токенов
  // разных выпусков заходил и что вышло по деньгам. Прибыль считаем
  // только по закрытым деньгам: продано минус вложено. Пока человек
  // держит купленное, прибыль отрицательная — это честно, а не ошибка.
  const [tradeTick, setTradeTick] = useState(0);
  const [tradeStats, setTradeStats] = useState({ trades: 0, tokens: 0, profitUsd: 0 });
  useEffect(() => {
    if (!userId) { setTradeStats({ trades: 0, tokens: 0, profitUsd: 0 }); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("side, ton_amount, ton_price_usd, token_address")
        .eq("user_id", userId)
        .limit(1000);
      if (error) { console.warn("[mintly] сделки недоступны:", error.message); return; }
      if (cancelled) return;
      const rows = data || [];
      let profit = 0;
      const seen = new Set();
      for (const r of rows) {
        const usd = (Number(r.ton_amount) || 0) * (Number(r.ton_price_usd) || 0);
        profit += r.side === "sell" ? usd : -usd;
        if (r.token_address) seen.add(r.token_address);
      }
      setTradeStats({ trades: rows.length, tokens: seen.size, profitUsd: profit });
    })();
    return () => { cancelled = true; };
  }, [userId, tradeTick]);

  // Подтверждение аккаунта. Тоже в профиле: значок у ника должен
  // переживать перезапуск приложения и быть виден другим.
  function markProfileVerified() {
    setProfile((p) => ({ ...p, verified: true }));
    if (!userId) return;
    supabase.from("profiles").update({ verified: true }).eq("id", userId).then(({ error }) => {
      if (error) console.warn("[mintly] failed to save verification:", error.message);
    });
  }

  // Ступень знака создателя. Живёт в профиле, потому что её видят другие,
  // и только растёт: если токен просядет, знак остаётся.
  const [creatorTier, setCreatorTier] = useState(0);
  useEffect(() => {
    const earned = creatorTierOf(bestMcapUsd);
    if (!userId || earned <= creatorTier) return;
    setCreatorTier(earned);
    supabase.from("profiles").update({ creator_tier: earned }).eq("id", userId).then(({ error }) => {
      if (error) console.warn("[mintly] failed to save creator tier:", error.message);
    });
  }, [bestMcapUsd, creatorTier, userId]);

  // Достижения. Считаются здесь, потому что нужны сразу трём экранам:
  // профилю, отдельной странице и магазину — он по ним запирает предметы.
  const achievements = useMemo(
    () => buildAchievements({
      tokensCount: myTokens.length,
      bestMcapUsd,
      invites: inviteCount,
      connected,
      profile,
      cosmetics,
    }),
    [myTokens.length, bestMcapUsd, inviteCount, connected, profile, cosmetics],
  );
  async function deleteMyToken(id) {
    // Optimistic local removal, then the real delete — RLS (see
    // supabase_tokens_schema.sql) already guarantees a user can only
    // delete their own rows, so no extra owner check is needed here.
    setMyTokens((prev) => prev.filter((tok) => tok.id !== id));
    setCommunityTokens((prev) => prev.filter((tok) => tok.id !== id));
    setHoldings((prev) => {
      const next = { ...prev };
      delete next[id];
      try { if (typeof window !== "undefined") window.localStorage.setItem("mintly_holdings", JSON.stringify(next)); } catch (e) { /* localStorage unavailable */ }
      return next;
    });
    const { error } = await supabase.from("tokens").delete().eq("id", id);
    if (error) { console.error("[mintly] failed to delete token from Supabase:", error); showToast(t("deleteFailedToast")); if (userId) loadMyTokens(userId); loadCommunityTokens(); }
  }
  async function clearAllMyTokens() {
    // Only clean up testnet junk — never touches real mainnet tokens,
    // even if the same account has both. Because delete goes straight to
    // Supabase (not just this device's local state), a purge here removes
    // them from communityTokens too, so they vanish from the mempad for
    // every user, not just this browser.
    const testnetIds = myTokens.filter((tok) => tok.network === "testnet").map((tok) => tok.id);
    if (!testnetIds.length) return;
    setMyTokens((prev) => prev.filter((tok) => tok.network !== "testnet"));
    setCommunityTokens((prev) => prev.filter((tok) => !testnetIds.includes(tok.id)));
    setHoldings((prev) => {
      const next = { ...prev };
      testnetIds.forEach((id) => delete next[id]);
      try { if (typeof window !== "undefined") window.localStorage.setItem("mintly_holdings", JSON.stringify(next)); } catch (e) { /* localStorage unavailable */ }
      return next;
    });
    const { error } = await supabase.from("tokens").delete().in("id", testnetIds);
    if (error) { console.error("[mintly] failed to clear testnet tokens in Supabase:", error); showToast(t("deleteFailedToast")); if (userId) loadMyTokens(userId); loadCommunityTokens(); }
  }
  // Real per-token holdings — the source of truth for "how much of this
  // token do I actually own", so Sell can never exceed what was actually
  // bought through this app. Purely local (same trust model as myTokens
  // above: this app has no real trading backend), but unlike the old
  // hardcoded 5000-token fallback, it starts every token at 0 and only
  // grows/shrinks from real confirmed buys/sells.
  const [holdings, setHoldings] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("mintly_holdings");
        if (saved) return JSON.parse(saved);
      }
    } catch (e) { /* localStorage unavailable */ }
    return {};
  });
  function adjustHolding(tokenId, delta) {
    setHoldings((prev) => {
      const next = { ...prev, [tokenId]: Math.max(0, (prev[tokenId] || 0) + delta) };
      try { if (typeof window !== "undefined") window.localStorage.setItem("mintly_holdings", JSON.stringify(next)); } catch (e) { /* localStorage unavailable */ }
      return next;
    });
  }

  async function handleTokenCreated(result) {
    // Ракета уходит сразу, не дожидаясь записи в базу: токен уже создан
    // в сети, а полёт длится меньше двух секунд.
    playLaunchRocket();
    if (!userId) {
      // Shouldn't normally happen — launching requires accountCreated —
      // but guard anyway rather than silently dropping the token.
      showToast(t("deleteFailedToast"));
      console.error("[mintly] handleTokenCreated: no authenticated user, can't save to Supabase");
      return;
    }

    const { data: row, error } = await supabase
      .from("tokens")
      .insert({
        owner_id: userId,
        name: result.name,
        ticker: result.ticker,
        logo_url: result.logoUrl || null,
        supply: result.supply,
        buy_amount: result.buyAmount,
        buy_tokens: result.buyTokens || 0,
        address: result.address,
        pool_address: result.poolAddress || null,
        curve_address: result.curveAddress || null,
        curve_jetton_wallet: result.curveJettonWallet || null,
        creator_wallet: result.creatorWallet || null,
        explorer_url: result.explorerUrl || null,
        category: result.category || null,
        network: result.network || (TON_TESTNET ? "testnet" : "mainnet"),
      })
      .select()
      .single();

    if (error || !row) {
      console.error("[mintly] failed to save token to Supabase:", error);
      showToast(t("deleteFailedToast"));
      return;
    }

    const entry = {
      id: row.id,
      name: row.name,
      ticker: row.ticker,
      emoji: "🚀",
      verified: false,
      // Ноль, а не введённая сумма: настоящие цифры приедут с кривой
      // через секунду после развёртывания, а до этого показывать оценку
      // — значит рисовать капитализацию, которой ещё нет.
      mcapNum: 0,
      liq: "0",
      vol: "0",
      change: 0,
      tx24h: 0,
      address: row.address,
      poolAddress: row.pool_address,
      curveAddress: row.curve_address || null,
      curveJettonWallet: row.curve_jetton_wallet || null,
      creatorWallet: row.creator_wallet || null,
      buyTokens: Number(row.buy_tokens) || 0,
      explorerUrl: row.explorer_url,
      supply: row.supply,
      buyAmount: row.buy_amount,
      logoUrl: row.logo_url,
      network: row.network || "mainnet",
      createdAt: new Date(row.created_at).getTime(),
    };
    setMyTokens((prev) => [entry, ...prev]);
    setCommunityTokens((prev) => [entry, ...prev]);
    // The premint transaction sends the token's initial buy allocation
    // straight to the creator's own wallet on-chain — but the app's
    // own "how much of this do I hold" number (`holdings`, used by
    // TradeModal/balances everywhere) is a purely local counter that
    // only buy/sell in TradeModal ever touched (see adjustHolding
    // calls in confirmTrade). Nothing credited it on a successful
    // launch, so a freshly created token always showed 0 in-app even
    // though the real on-chain balance was correct. Credit it here
    // with the same buyTokens figure the launch overlay itself already
    // promised the user under "Стартовая покупка".
    if (result.buyTokens) adjustHolding(entry.id, result.buyTokens);
  }

  function handleTogglePin(v) { setPinModal({ mode: v ? "create" : "disable" }); }
  // Root-level control for the token-creation simulation overlay. It's
  // rendered here (not inside CreateView) for the same reason every other
  // modal in this app is rendered here: this container is the one with a
  // real, explicit height matching the visible screen (via
  // useTelegramViewport) — a nested scrollable view like CreateView's form
  // has no such guarantee, so a modal positioned relative to it can end up
  // rendered outside the currently visible/scrolled area.
  const [launchRequest, setLaunchRequest] = useState(null); // { form, category, logoUrl, logoFile, buyAmount, onFinish } | null
  const [launchProgress, setLaunchProgress] = useState({ stepIndex: 0, done: false, error: null, result: null });
  const EMPTY_LAUNCH_FORM = { name: "", ticker: "", buyAmount: "", desc: "", tg: "", x: "", site: "" };

  function handleLaunchRequest(req) {
    setLaunchRequest(req);
    runRealLaunch(req);
  }

  // Runs the actual on-chain launch (jetton deploy + STON.fi pool) via
  // TonConnect. Every stage the user sees in TokenLaunchOverlay reflects
  // a real transaction/confirmation, not a timer.
  async function runRealLaunch(req) {
    setLaunchProgress({ stepIndex: 0, done: false, error: null, result: null });
    const buyNum = parseFloat(String(req.buyAmount || "0").replace(",", "."));

    // The log shows every low-level check passing (RPC reachable, TonClient4
    // and AssetsSDK both initialized, getAccountLite OK) and the failure
    // happening only inside deployJetton itself with a bare "Exceeded number
    // of retries". That specific combination — connectivity fine, only the
    // wait-for-deploy step failing — is the signature of polling the wrong
    // chain: the app is configured for `network: testnet` (TON_TESTNET
    // above), but the wallet TonConnect actually connected is on mainnet (or
    // vice versa). The deploy message either never lands on the chain being
    // polled, or lands on a chain nobody's watching, so the SDK just polls
    // an address that will never go active until it gives up. Catching that
    // here — before spending a wallet approval + a deploy attempt on it —
    // turns a dead-end retry-exhaustion message into an actionable one.
    const expectedChain = TON_TESTNET ? "-3" : "-239";
    const actualChain = wallet?.account?.chain;
    if (actualChain && actualChain !== expectedChain) {
      const actualNet = actualChain === "-239" ? "mainnet" : actualChain === "-3" ? "testnet" : actualChain;
      const expectedNet = TON_TESTNET ? "testnet" : "mainnet";
      setLaunchProgress({
        stepIndex: 0,
        done: false,
        error: `Кошелёк подключён в сети ${actualNet}, а запуск токена настроен на ${expectedNet}. Переключите сеть в кошельке на ${expectedNet} (или поменяйте TON_TESTNET в коде на противоположное значение) и попробуйте снова — иначе деплой никогда не подтвердится на той сети, которую опрашивает приложение, и упадёт с той же "Exceeded number of retries".`,
        result: null,
      });
      return;
    }

    try {
      const chainResult = await launchRealToken({
        tonConnectUI,
        walletAddress,
        form: req.form,
        logoFile: req.logoFile,
        buyAmountTon: buyNum,
        treasuryAddress: TREASURY_ADDRESS,
        feeAddress: FEE_ADDRESS,
        feePercent: FEE_PERCENT,
        network: TON_TESTNET ? "testnet" : "mainnet",
        onStage: (i) => setLaunchProgress((p) => ({ ...p, stepIndex: i })),
      });
      const { tokens, pct } = tokensForTon(buyNum);
      // BUG FIX: logoUrl here used to be req.logoUrl — a `blob:` object URL
      // created by URL.createObjectURL() purely in this tab's memory (see
      // the logo picker in the create form). It rendered fine immediately
      // because the blob was still alive in memory, but it was never a
      // real file anywhere: after a page refresh (or for any other user,
      // who never had that blob to begin with) the URL just points at
      // nothing. Upload the actual file to Supabase Storage now and use
      // the real public URL everywhere from here on — success screen,
      // Supabase `tokens` row, and everyone else's feed all get the same
      // persistent image.
      let persistentLogoUrl = null;
      if (req.logoFile && userId) {
        try {
          // Путь обязан начинаться с id пользователя: политика хранилища
          // сверяет первую папку с auth.uid(). Раньше здесь был префикс
          // `tokens/`, из-за него загрузка отклонялась, и в базу уезжала
          // мёртвая blob-ссылка — логотипы не открывались ни у кого.
          const path = `${userId}/token-${Date.now()}.${safeImageExt(req.logoFile)}`;
          const { error: logoUploadError } = await supabase.storage
            .from("avatars")
            .upload(path, req.logoFile, { upsert: true });
          if (!logoUploadError) {
            const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
            if (pub && pub.publicUrl) persistentLogoUrl = pub.publicUrl;
          } else {
            console.error("[mintly] token logo upload failed:", logoUploadError);
          }
        } catch (e) { console.error("[mintly] token logo upload threw:", e); }
      }
      // Если загрузка не прошла — сохраняем пустоту, а не blob-ссылку:
      // она живёт только в этой вкладке, у всех остальных это битая
      // картинка. Пустое поле хотя бы честно покажет эмодзи.
      if (!persistentLogoUrl && req.logoUrl && !String(req.logoUrl).startsWith("blob:")) {
        persistentLogoUrl = req.logoUrl;
      }
      setLaunchProgress({
        stepIndex: LAUNCH_STEPS.length,
        done: true,
        error: null,
        result: {
          name: req.form.name.trim() || t("unnamedToken"),
          ticker: (req.form.ticker.trim() || "TOKEN").toUpperCase(),
          supply: TOKEN_FIXED_SUPPLY_LABEL,
          buyAmount: req.buyAmount && String(req.buyAmount).trim() ? req.buyAmount : "0",
          // chainResult.mintedTokens is the real, on-chain-confirmed
          // balance (tonLaunch.js only resolves once it's verified
          // nonzero) — prefer it over the pre-launch estimate so the
          // success screen and in-app balance always match the wallet.
          buyTokens: chainResult.mintedTokens ?? tokens,
          buyPct: pct,
          category: req.category || null,
          logoUrl: persistentLogoUrl,
          curveAddress: chainResult.curveAddress,
          curveJettonWallet: chainResult.curveJettonWallet,
          creatorWallet: chainResult.creatorWallet || null,
          network: TON_TESTNET ? "testnet" : "mainnet",
          address: chainResult.jettonMasterAddress,
          poolAddress: chainResult.poolAddress,
          explorerUrl: chainResult.explorerUrl,
          createdAt: Date.now(),
        },
      });
    } catch (err) {
      setLaunchProgress({ stepIndex: 0, done: false, error: (err && err.message) || String(err), result: null });
    }
  }

  function retryLaunch() {
    if (launchRequest) runRealLaunch(launchRequest);
  }

  function closeLaunchOverlay(result) {
    const req = launchRequest;
    setLaunchRequest(null);
    setLaunchProgress({ stepIndex: 0, done: false, error: null, result: null });
    if (result) handleTokenCreated(result);
    if (req && req.onFinish) req.onFinish(result);
    // Стартовая покупка едет внутри транзакции запуска, поэтому окно
    // покупки здесь больше не открывается — иначе создатель купил бы
    // дважды. На страницу токена он попадёт кнопкой с экрана успеха.
    if (result) openLaunchBuy(result, { openTradeSheet: false });
  }
  // Создатель покупает первым: кроме него о токене ещё никто не знает,
  // а размер этой покупки и задаёт стартовую цену — кривая сдвигается
  // ровно на внесённую сумму. Открываем окно покупки само, чтобы шаг не
  // выглядел необязательным.
  function openLaunchBuy(result, { openTradeSheet = true } = {}) {
    if (!result || !result.address) return;
    const amount = parseFloat(String(result.buyAmount || "").replace(",", "."));
    const feedToken = localTokenToFeedShape({
      id: result.address,
      address: result.address,
      name: result.name,
      ticker: result.ticker,
      emoji: "🚀",
      logoUrl: result.logoUrl || null,
      mcapNum: 0,
      liq: "0",
      vol: "0",
      verified: false,
      curveAddress: result.curveAddress || null,
      curveJettonWallet: result.curveJettonWallet || null,
      createdAt: result.createdAt || Date.now(),
    });
    openToken(feedToken);
    if (openTradeSheet) {
      setTradeModal({ mode: "buy", prefill: Number.isFinite(amount) && amount > 0 ? amount : undefined });
    }
  }

  function viewLaunchedToken(result) {
    // closeLaunchOverlay сам открывает покупку — здесь только закрываем.
    closeLaunchOverlay(result);
  }
  function requestChangePin() { setPinModal({ mode: "change" }); }
  function completePinSetup(code) {
    const wasChange = pinModal && pinModal.mode === "change";
    setPinCode(code);
    setAppSettings((s) => ({ ...s, pinEnabled: true }));
    persistPin(true, code);
    setPinModal(null);
    showToast(wasChange ? t("pinChanged") : t("pinEnabled"));
  }
  function completePinDisable() {
    setPinCode(null);
    setAppSettings((s) => ({ ...s, pinEnabled: false }));
    persistPin(false, null);
    setPinModal(null);
    showToast(t("pinDisabled"));
  }
  function forgotPin() {
    setPinCode(null);
    setAppSettings((s) => ({ ...s, pinEnabled: false }));
    persistPin(false, null);
    setPinLocked(false);
    showToast(t("pinResetToast"));
  }

  function openToken(t) { setToken(t); setView("token"); }
  function goTab(name) { setTab(name); setView(name); }
  // Создание — отдельная страница, а не вкладка: пункт из нижнего меню
  // убран, поэтому tab не трогаем — подсветка остаётся на том разделе,
  // откуда пришли, и «назад» возвращает туда же.
  function openCreate() { setView("create"); }
  function backFromToken() { setView(tab); }
  // Профиль создателя открывается поверх карточки токена, поэтому «назад»
  // возвращает именно на неё, а не на вкладку.
  const [viewedUserId, setViewedUserId] = useState(null);
  function openUserProfile(id) { if (!id) return; setViewedUserId(id); setView("user"); }
  function backFromUserProfile() { setView(token ? "token" : tab); }

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
    showToast(profileModalMode === "edit" ? t("profileUpdated") : profileModalMode === "login" ? t("loggedIn") : t("accountCreatedToast"));
  }
  async function logOutProfile() {
    await supabase.auth.signOut();
    setAccountCreated(false);
    setProfile(EMPTY_PROFILE);
    if (connected) tonConnectUI.disconnect();
    showToast(t("loggedOut"));
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
    showToast(t("accountDeleted"));
  }
  function openLoginProfile() { setProfileModalMode("login"); setProfileModalOpen(true); }
  function requireUnlockRoot() {
    if (!accountCreated) { setProfileModalMode("create"); setProfileModalOpen(true); showToast(t("firstAccountFirst")); return false; }
    if (!connected) { setConnectModalOpen(true); showToast(t("connectWalletTrade")); return false; }
    return true;
  }
  function handleBuy() { if (requireUnlockRoot()) setTradeModal({ mode: "buy" }); }
  function handleSell() { if (requireUnlockRoot()) setTradeModal({ mode: "sell" }); }
  // Своя запись о сделке. Цепочка знает о переводе, но не знает, кто
  // его сделал из приложения и по какому курсу — а без этого не
  // посчитать ни портфель, ни прибыль. Пишем после того, как кошелёк
  // подтвердил отправку; ошибку записи глотаем: сделка уже ушла в сеть,
  // и мешать человеку из-за неудачной строки в базе незачем.
  function recordTrade(side, tonAmount, tokenAmount) {
    if (!userId) return;
    supabase.from("trades").insert({
      user_id: userId,
      token_id: token && token.id ? token.id : null,
      token_address: token ? token.address : null,
      ticker: token ? token.ticker : null,
      side,
      ton_amount: Number(tonAmount) || 0,
      token_amount: Number(tokenAmount) || 0,
      ton_price_usd: tonPriceUsd || 0,
    }).then(({ error }) => {
      if (error) console.warn("[mintly] не удалось записать сделку:", error.message);
      else setTradeTick((n) => n + 1);
    });
  }

  async function confirmTrade(mode, payAmount, receiveAmount, unit, rawAmount, rawEstimate) {
    if (mode === "buy") {
      // rawAmount is now the TON amount the person typed directly (the
      // modal is denominated in TON, not USD), so no USD conversion is
      // needed here — we only still require tonPriceUsd to be loaded so
      // the estimated token amount shown to the user was computed correctly.
      if (!(tonPriceUsd > 0)) { showToast(t("rateLoadingRetry")); return; }
      const totalTon = rawAmount;
      const spendableTon = Math.max(0, tonBalance - NETWORK_FEE_TON);
      if (totalTon > spendableTon) { showToast(t("insufficientTon")); return; }
      const feeTon = totalTon * FEE_PERCENT;
      const mainTon = totalTon - feeTon;

      try {
        // У токенов, запущенных в приложении, есть своя бондинг-кривая —
        // покупка идёт сообщением на неё, и жетоны реально приходят на
        // кошелёк. У токенов из внешней ленты кривой нет: там остаётся
        // прежний перевод, потому что торговать на чужом пуле отсюда
        // пока нечем.
        const messages = token.curveAddress
          ? [{
              address: token.curveAddress,
              // Контракт удерживает фиксированную сумму на газ, поэтому
              // отправляем её сверх суммы покупки — иначе на кривую
              // попадёт меньше, чем человек ввёл.
              amount: (toNano(totalTon.toFixed(9)) + CURVE_GAS_BUY_OVERHEAD).toString(),
              payload: buildBuyBody({ queryId: 0n, minTokensOut: 0n }).toBoc().toString("base64"),
            }]
          : [
              { address: TREASURY_ADDRESS, amount: toNano(mainTon.toFixed(9)).toString() },
              { address: FEE_ADDRESS, amount: toNano(feeTon.toFixed(9)).toString() },
            ];
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: TON_TESTNET ? "-3" : "-239",
          messages,
        });
        adjustHolding(token.id, rawEstimate);
        recordTrade("buy", totalTon, rawEstimate);
        setTradeModal(null);
        showToast(tf("boughtToast", { receive: receiveAmount, ticker: token.ticker, pay: payAmount, unit }));
        // Баланс на цепочке обновится не мгновенно — даём блокчейну
        // пару секунд на подтверждение, потом перезапрашиваем его.
        setTimeout(() => setBalanceRefreshTick((n) => n + 1), 4000);
      } catch (err) {
        showToast(t("txCancelled"));
      }
    } else {
      // Can't sell more than is actually held — re-checked here too, not
      // just in the modal, in case the ledger changed since it opened.
      // Баланс берём тот же, что показан в окне, — из сети. Локальный
      // счётчик знает только о сделках через это приложение, поэтому у
      // него ноль, и продажа молча обрывалась здесь же.
      const held = chainHolding;
      if (held == null) { showToast(t("balanceLoading")); return; }
      if (rawAmount > held) { showToast(t("insufficientSellAmount")); return; }
      if (!connected) { showToast(t("connectWalletSell")); return; }
      // Продажа на кривой — это перевод жетонов на её кошелёк: кривая
      // получает уведомление и присылает TON обратно. Нужен свой кошелёк
      // жетона продавца, поэтому адрес спрашиваем у мастера жетона.
      try {
        let messages;
        if (token.curveAddress && token.tokenAddress && chainJettonWallet) {
          // Адрес уже известен — между нажатием и открытием кошелька не
          // должно быть ни одного await, иначе окно кошелька закроется.
          // tonapi отдаёт адрес в сыром виде (0:abc…), а кошельки ждут
          // привычный EQ…-формат: на сыром часть из них молча отклоняет
          // запрос, и окно подтверждения закрывается само.
          const sellerWallet = Address.parse(chainJettonWallet).toString();
          const wanted = toNano(rawAmount.toFixed(9));
          const sellRaw = chainHoldingRaw != null && wanted > chainHoldingRaw ? chainHoldingRaw : wanted;
          const body = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            // Продаём не больше того, что реально на кошельке: при продаже
            // всего берём точное значение из сети, а не пересчитанное из
            // округлённого числа токенов.
            .storeCoins(sellRaw)
            .storeAddress(Address.parse(token.curveAddress))
            .storeAddress(Address.parse(walletAddress))
            .storeBit(false)
            .storeCoins(CURVE_SELL_FORWARD_TON)
            .storeBit(true)
            .storeRef(buildSellPayload(0n))
            .endCell();
          messages = [{
            address: sellerWallet,
            amount: CURVE_SELL_VALUE.toString(),
            payload: body.toBoc().toString("base64"),
          }];
        } else {
          // У токенов из внешней ленты кривой нет: настоящей продажи
          // здесь не происходит, но комиссия площадки берётся с любой
          // сделки — те же 1%, что удерживает кривая. Считаем их от
          // суммы продажи в TON; совсем маленькая сумма упирается в
          // минимум, иначе сообщение не покрыло бы даже пересылку.
          const usdValue = rawAmount * (token.price > 0 ? token.price : 0);
          const tonValue = tonPriceUsd > 0 ? usdValue / tonPriceUsd : 0;
          const feeTon = Math.max(0.01, tonValue * FEE_PERCENT);
          messages = [{
            address: FEE_ADDRESS,
            amount: toNano(feeTon.toFixed(9)).toString(),
          }];
        }
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: TON_TESTNET ? "-3" : "-239",
          messages,
        });
        adjustHolding(token.id, -rawAmount);
        // Сколько TON вернулось — это оценка из окна, точную сумму знает
        // только сеть, а ждать её здесь нельзя.
        recordTrade("sell", tonPriceUsd > 0 ? (rawAmount * (token.price > 0 ? token.price : 0)) / tonPriceUsd : 0, rawAmount);
        setTradeModal(null);
        showToast(tf("soldToast", { pay: payAmount, ticker: token.ticker, receive: receiveAmount, unit }));
        setTimeout(() => setBalanceRefreshTick((n) => n + 1), 4000);
      } catch (err) {
        // Текст ошибки показываем целиком: консоли внутри Telegram нет, а
        // отличить отказ пользователя от отклонённого запроса иначе
        // невозможно.
        const detail = (err && (err.message || String(err))) || "";
        console.error("[mintly] продажа не прошла:", err);
        showToast(detail ? `${t("txCancelled")} — ${detail.slice(0, 140)}` : t("txCancelled"));
      }
    }
  }
  // Экран загрузки на старте: держим его, пока не отработали все
  // стартовые запросы — восстановление сессии, лента пулов (из неё же
  // берутся покупки для тикера), токены сообщества и курс TON. Каждый
  // шаг «готов» и по успеху, и по ошибке: если API недоступен, в
  // приложение всё равно надо пустить.
  const bootSteps = [
    { key: "bootStepAuth", done: authChecked },
    { key: "bootStepFeed", done: !tokensLoading },
    { key: "bootStepTokens", done: communityLoaded },
    { key: "bootStepRate", done: tonPriceChecked },
  ];
  const bootDone = bootSteps.every((s) => s.done);
  const [bootHidden, setBootHidden] = useState(false);
  const framesReady = bootHidden && (viewportReady || !device.inTelegram);
  // Страховка: даже если какой-то запрос завис, дольше 9 секунд держать
  // человека на заставке нельзя.
  useEffect(() => {
    const to = setTimeout(() => setBootHidden(true), 9000);
    return () => clearTimeout(to);
  }, []);
  // Небольшая задержка после готовности — чтобы заставка успела доиграть
  // затухание, а не моргнула.
  useEffect(() => {
    if (!bootDone) return;
    const to = setTimeout(() => setBootHidden(true), 520);
    return () => clearTimeout(to);
  }, [bootDone]);

  return (
    <div
      // Устройство проставляется в разметку: по нему можно и стили
      // цеплять, и видеть в инспекторе, где именно открыто приложение,
      // когда проблема воспроизводится только на одном клиенте.
      data-platform={device.platform}
      data-telegram={device.inTelegram ? "1" : "0"}
      style={{ background: T.bg, height, minHeight: height, width: "100%", maxWidth: 480, margin: "0 auto", fontFamily: bodyFont, position: "relative", overflow: "hidden" }}
    >
      <GlobalStyle />
      {/* Обрамление появляется только после заставки и только когда
          Telegram уже сообщил отступы. Раньше на телефоне с островом в
          первые мгновения рисовался контур экрана — отступы ещё не
          пришли, приложение считало, что острова нет, — а потом рамка
          прыгала на своё место. Вне Telegram отступов не будет вовсе,
          там ждать нечего. */}
      {/* Обрамление — часть запуска токена, а не постоянная деталь
          интерфейса: раньше на телефонах без острова контур экрана висел
          всё время и мешал. Теперь и остров, и рамка экрана появляются
          только на время полёта ракеты и гаснут вместе с ней. */}
      {framesReady && islandFramePhase && (showIsland
        ? <DynamicIslandFrame hitKey={islandHitKey} phase={islandFramePhase} />
        : <ScreenFrame hitKey={islandHitKey} phase={islandFramePhase} />)}
      {rocketFlying && <LaunchRocket targetTop={showIsland ? ROCKET_TOUCH_TOP : ROCKET_TOUCH_TOP_SCREEN} variant={rocketVariant} />}
      <CyberGrid showStars={view !== "profile" && view !== "user"} />
      {!bootHidden && <BootSplash steps={bootSteps} done={bootDone} insetTop={insetTop} />}
      <Toast key={toastSeq} toast={toast} insetTop={insetTop} leaving={toastLeaving} />

      {pinLocked && appSettings.pinEnabled && pinCode && (
        <PinLockScreen pin={pinCode} profile={profile} onUnlock={() => setPinLocked(false)} onForgot={forgotPin} />
      )}

      <ConnectModal open={connectModalOpen} onClose={() => setConnectModalOpen(false)} onConnect={() => tonConnectUI.openModal()} />
      <AuthModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} onSubmit={submitProfile} initial={profile} mode={profileModalMode} walletAddress={walletAddress} />
      <SettingsPanel
        item={settingsItem}
        onClose={() => setSettingsItem(null)}
        appSettings={appSettings}
        onUpdateSetting={updateAppSetting}
        insetBottom={insetBottom}
        insetTop={insetTop}
        onOpenEditProfile={openEditProfile}
        profile={profile}
        showToast={showToast}
        onTogglePin={handleTogglePin}
        onChangePin={requestChangePin}
        accountCreated={accountCreated}
        onDeleteAccount={deleteAccountForever}
        userId={userId}
        inviteCount={inviteCount}
      />
      <PinSetupModal
        mode={pinModal ? pinModal.mode : null}
        currentPin={pinCode}
        onClose={() => setPinModal(null)}
        onComplete={completePinSetup}
        onDisable={completePinDisable}
        showToast={showToast}
      />
      <TokenManageSheet token={manageToken_} onClose={() => setManageToken_(null)} showToast={showToast} onDelete={deleteMyToken} />
      <TradeModal t={token} tradeModal={tradeModal} onClose={() => setTradeModal(null)} onConfirm={confirmTrade} walletTonBalance={tonBalance} tonPriceUsd={tonPriceUsd} heldAmount={chainHolding} curveState={tradeCurveState} />
      <TokenLaunchOverlay
        open={!!launchRequest}
        form={launchRequest ? launchRequest.form : EMPTY_LAUNCH_FORM}
        category={launchRequest ? launchRequest.category : null}
        logoUrl={launchRequest ? launchRequest.logoUrl : null}
        buyAmount={launchRequest ? launchRequest.buyAmount : ""}
        stepIndex={launchProgress.stepIndex}
        done={launchProgress.done}
        error={launchProgress.error}
        result={launchProgress.result}
        onClose={closeLaunchOverlay}
        onRetry={retryLaunch}
        onViewToken={viewLaunchedToken}
      />

      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
        {/* header with logo/wallet removed — content now starts right at the top.
            The bottom nav is an absolutely-positioned overlay (not a flex
            sibling) so the feed actually scrolls underneath it — that's what
            makes the frosted-glass blur show real content/text sliding past
            behind the bar instead of just a flat tinted strip. paddingBottom
            below reserves the nav's own height so the last row of content
            can still scroll clear of it. */}
        <div className="no-scrollbar px-4" style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingTop: contentTopPad(insetTop), paddingBottom: 116 + insetBottom }} key={view}>
          {view === "home" && <HomeView onGoTab={goTab} />}
          {view === "mempad" && <MempadView tokens={tokens} loading={tokensLoading} myTokens={communityTokens} onOpen={openToken} onLaunch={openCreate} />}
          {view === "shop" && (
            <ShopView
              cosmetics={cosmetics}
              onEquip={equipCosmetic}
              achievements={achievements}
              onOpenAchievements={() => setView("achievements")}
              showToast={showToast}
            />
          )}
          {view === "achievements" && (
            <AchievementsView achievements={achievements} onGoShop={() => goTab("shop")} onBack={() => setView("profile")} />
          )}
          {view === "user" && (
            <PublicProfileView
              userId={viewedUserId}
              currentUserId={userId}
              onBack={backFromUserProfile}
              onOpenToken={(row) => openToken(localTokenToFeedShape(mapTokenRow(row)))}
              onNeedAuth={openCreateProfile}
              showToast={showToast}
              insetTop={insetTop}
            />
          )}
          {view === "token" && <TokenDetail t={token} onBack={backFromToken} showToast={showToast} onBuy={handleBuy} onSell={handleSell} unlocked={accountCreated && connected} connected={connected} onConnectWallet={() => setConnectModalOpen(true)} themeKey={appSettings.theme} currentUserId={userId} onNeedAuth={openCreateProfile} onOpenProfile={openUserProfile} tonPriceUsd={tonPriceUsd} />}
          {view === "create" && (
            <CreateView
              showToast={showToast}
              unlocked={accountCreated && connected}
              accountCreated={accountCreated}
              connected={connected}
              onOpenCreateProfile={openCreateProfile}
              onOpenConnectModal={() => setConnectModalOpen(true)}
              onLaunch={handleLaunchRequest}
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
              onOpenSetting={(item) => setSettingsItem(item)}
              onManageToken={(tok) => setManageToken_(tok)}
              onGoCreate={openCreate}
              onOpenToken={openToken}
              myTokens={myTokens}
              onClearAllTokens={clearAllMyTokens}
              cosmetics={cosmetics}
              onGoShop={() => goTab("shop")}
              onOpenAchievements={() => setView("achievements")}
              followCounts={followCounts}
              achievements={achievements}
              insetTop={insetTop}
              userId={userId}
              creatorTier={creatorTier}
              onVerified={markProfileVerified}
              tradeStats={tradeStats}
            />
          )}
        </div>

        <div
          className="flex items-center justify-around"
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: insetBottom + 16, zIndex: 5,
            width: "92%", maxWidth: 420,
            padding: "10px 10px",
            borderRadius: 999,
            background: hexA(T.bg, 0.28), backdropFilter: "blur(20px) saturate(1.6)", WebkitBackdropFilter: "blur(20px) saturate(1.6)",
            border: `1px solid ${T.lineHi}`,
            boxShadow: "0 10px 34px rgba(0,0,0,0.4)",
          }}
        >
          {[
            { id: "home", label: t("navHome"), icon: HomeIcon },
            { id: "mempad", label: t("navMempad"), icon: Rocket },
            { id: "shop", label: t("navShop"), icon: ShoppingBag },
            { id: "profile", label: t("navProfile"), icon: User },
          ].map(({ id, label, icon: Icon, locked }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => goTab(id)} className="fx-tap flex flex-col items-center gap-1.5" style={{ position: "relative" }}>
                <Icon size={22} strokeWidth={1.75} color={active ? T.turquoise : T.muted} style={{ transition: `color ${EASE}` }} />
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
