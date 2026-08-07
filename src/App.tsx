import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, Flame, TrendingUp, Clock, Sparkles, ArrowUpRight, ArrowDownRight,
  Wallet, Home as HomeIcon, PlusCircle, User, ChevronLeft, Share2, Star,
  ShieldCheck, ShieldAlert, Globe, Globe2, Send, Twitter, Image as ImageIcon, Upload,
  Copy, ExternalLink, LogOut, ChevronRight, ChevronDown, Rocket, MoreHorizontal, HeartCrack,
  Settings as SettingsIcon, Bell, Lock, Palette, Gift, LifeBuoy,
  FileText, ShieldQuestion, ArrowDownToLine, ArrowUpFromLine, Link2, CheckCircle2, RefreshCw, X,
  Eye, EyeOff, LogIn, Mail, KeyRound, ShoppingBag, Trash2
} from "lucide-react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Address, toNano} from "@ton/core";
import { supabase } from "./supabaseClient";
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
    connect: "Подключить", connected: "Подключён",
    settingsSaved: "Настройки сохранены",
    langTitle: "Язык", themeTitle: "Оформление",
    themeDark: "Тёмная", themeWhite: "Светлая",
    langFullNote: "Интерфейс переведён на выбранный язык.",
    search: "Поиск токенов",
    buy: "Купить", sell: "Продать", cancel: "Отмена", confirm: "Подтвердить",
    follow: "Подписаться", following: "Вы подписаны", share: "Поделиться",
    copyAddress: "Скопировать адрес", disconnectWallet: "Отключить кошелёк",
    disconnectShort: "Отключить", tonExplorerBtn: "Обозреватель TON", walletProvider: "Кошелёк",
    connectWallet: "Подключить TON-кошелёк",
    editProfile: "Редактировать профиль",
    logOut: "Выйти", deleteAccount: "Удалить аккаунт",
    createToken: "Создать токен",
    settings: "Настройки",
    notifications: "Уведомления", security: "Безопасность",
    wallet: "Кошелёк", profileSettings: "Профиль", referral: "Реферальная программа",
    privacy: "Конфиденциальность", terms: "Условия использования", support: "Поддержка",
    launchPreparing: "Подготовка метаданных…",
    launchGenerating: "Генерация токена…",
    launchDeploying: "Деплой…",
    launchConfirming: "Подтверждение…",
    launchSuccessTitle: "Токен создан",
    launchSuccessSub: "Токен успешно выпущен и готов к торгам",
    tokenCreatedStatus: "Токен создан",
    contractAddress: "Адрес контракта",
    totalSupply: "Общий выпуск",
    initialBuy: "Стартовая покупка",
    viewToken: "Открыть токен",
    doneClose: "Готово",
    launchingWait: "Не закрывай экран, это займёт пару секунд…",
    heroTitle: "Начни уже сейчас",
    heroBodyLead: "Создавай, торгуй и расти с ",
    heroBodyTail: " первый месяц. Присоединяйся к экосистеме с первого дня.",
    heroFee: "0% комиссией платформы",
    mempadComingSoon: "Здесь скоро появится что-то ещё.",
    mempadSpotlight: "В центре внимания",
    mempadLaunchToken: "Запустить токен",
    mempadFilterNew: "Новые", mempadFilterHot: "Горячие", mempadFilterBluming: "В росте", mempadFilterDex: "DEX",
    homeActionLaunch: "Создать токен", homeActionMempad: "Мемпад", homeActionWallet: "Кошелёк",
    homeTopGainer: "Лидер роста",
    homeUpdatesComingSoon: "Здесь скоро появятся новости и обновления платформы.",
    searchPlaceholder: "Найти токен или тикер",
    emptyFilter: "По этому фильтру пока пусто — попробуй другой или загляни позже.",
    catAll: "Все", catMemes: "Мемы", catUtility: "Утилиты", catGames: "Игры", catAI: "AI", catSocial: "Соц",
    linkCopied: "Ссылка скопирована",
    tokenLinkCopied: "Ссылка на токен скопирована",
    reportSent: "Жалоба отправлена на проверку",
    back: "Назад",
    perToken: "/ токен",
    chartLoading: "загрузка графика…",
    fakeChartBadge: "Фейковый график",
    ohlcOpen: "О", ohlcHigh: "В", ohlcLow: "Н", ohlcClose: "З",
    statPrice: "Цена", statLiquidity: "Ликвидность", statHolders: "Держателей", statVolume24h: "Объём 24ч",
    tabChart: "График", tabInfo: "Инфо", tabTx: "Транзакции",
    chartModeMcap: "МКап", chartModePrice: "Цена",
    tokenNoAddress: "Адрес недоступен",
    txUnavailable: "Список транзакций пока недоступен для этого пула",
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
    categoryLabel: "Категория",
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
    refCodeCopied: "Реферальный код скопирован",
    editProfileDesc: "Никнейм, аватар, почта и описание профиля.",
    walletConnectedStatus: "Кошелёк подключён",
    walletNotConnectedStatus: "Кошелёк не подключён",
    pushNotif: "Push-уведомления",
    pushNotifSub: "Сделки, рост цены, ответы в комментариях",
    emailNotif: "Email-уведомления",
    emailNotifSub: "Еженедельный дайджест по портфелю",
    twoFA: "Двухфакторная аутентификация",
    twoFASub: "Подтверждение входа кодом",
    pinRow: "PIN-код",
    pinRowSub: "Запрашивать код при каждом открытии Mintly",
    enablePinFirst: "Сначала включи PIN-код",
    changePinCta: "Сменить PIN-код",
    referralDesc: "Приглашай друзей — получай % от их комиссий за сделки.",
    supportDesc: "Ответим в течение суток в Telegram-поддержке.",
    contactSupport: "Написать в поддержку",
    copyLink: "Скопировать ссылку",
    privacyText: "Мы собираем только данные, необходимые для работы приложения: никнейм, адрес кошелька и историю сделок внутри Mintly. Данные не передаются третьим лицам в рекламных целях. Ты можешь удалить аккаунт в любой момент — все локальные данные профиля будут стёрты немедленно.",
    termsText: "Используя Mintly, ты подтверждаешь, что совершаешь сделки на свой риск. Mintly не гарантирует доходность токенов и не несёт ответственности за потери, вызванные волатильностью рынка. Запрещено создавать токены, вводящие пользователей в заблуждение, или использующие чужой бренд без разрешения.",
    accountLabel: "Аккаунт",
    loginTab: "Войти", createTab: "Создать аккаунт",
    changeAvatarHint: "Нажми, чтобы заменить",
    editHint: "Никнейм обязателен, остальное можно заполнить позже.",
    loginHint: "Войди в свой аккаунт по почте и паролю.",
    createHint: "Никнейм, почта и пароль обязательны, остальное можно заполнить позже.",
    nicknameLabel: "Никнейм",
    nicknameError: "2–20 символов, только латинские буквы, цифры, _ и ., начинается с буквы",
    emailLabel: "Почта",
    emailRequired: "Укажите email — поле обязательно",
    emailInvalid: "Введите корректный email",
    passwordLabel: "Пароль",
    passwordPlaceholder: "Минимум 6 символов",
    passwordError: "Пароль должен быть не короче 6 символов",
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
    createCta: "Создать",
    myTokensCreate: "Создать",
    myTokensTitle: "Мои токены",
    unnamedToken: "Токен без названия",
    noTokensYet: "Ты ещё не запустил ни одного токена.",
    noActivityYet: "Пока нет активности — покупки, продажи и запуски токенов появятся здесь.",
    noAchievementsYet: "Достижений пока нет — торгуй и запускай токены, чтобы получить первое.",
    profileConfirmed: "Профиль подтверждён",
    verifyPending: "Заявка на проверке",
    verifyCta: "Подтверди личность для бейджа",
    deleteAccountForever: "Удалить аккаунт навсегда",
    editProfileBtn: "Редактировать профиль",
    statsTitle: "Статистика",
    statPortfolioValue: "Стоимость портфеля",
    statTotalProfit: "Общая прибыль",
    statCreatedTokens: "Создано токенов",
    statTokensOwned: "Токенов в портфеле",
    statTotalTrades: "Всего сделок",
    statWinRate: "Процент побед",
    statFollowers: "Подписчики",
    statFollowing: "Подписки",
    portfolioTitle: "Портфель",
    portfolioConnectBody: "Подключи TON-кошелёк, чтобы видеть портфель и начать торговать.",
    activityTitle: "Активность",
    achievementsTitle: "Достижения",
    verificationTitle: "Верификация",
    verifiedStatus: "Подтверждён",
    pendingStatus: "На проверке",
    notVerifiedStatus: "Не подтверждён",
    verifyAccountBtn: "Подтвердить аккаунт",
    dangerZoneTitle: "Опасная зона",
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
    authErrProfileLoad: "Не удалось загрузить профиль, попробуй ещё раз",
    authConfirmEmailSent: "Мы отправили письмо для подтверждения — перейди по ссылке, потом войди",
  },
  EN: {
    navHome: "Home", navMempad: "Mempad", navCreate: "Create", navProfile: "Profile", navShop: "Shop",
    shopTitle: "Shop", shopComingSoon: "The shop is coming soon. Check back later — something interesting will show up here.",
    connect: "Connect", connected: "Connected",
    settingsSaved: "Settings saved",
    langTitle: "Language", themeTitle: "Appearance",
    themeDark: "Dark", themeWhite: "White",
    langFullNote: "The interface is translated into the selected language.",
    search: "Search tokens",
    buy: "Buy", sell: "Sell", cancel: "Cancel", confirm: "Confirm",
    follow: "Follow", following: "Following", share: "Share",
    copyAddress: "Copy address", disconnectWallet: "Disconnect wallet",
    disconnectShort: "Disconnect", tonExplorerBtn: "TON Explorer", walletProvider: "Wallet",
    connectWallet: "Connect TON Wallet",
    editProfile: "Edit profile",
    logOut: "Log out", deleteAccount: "Delete account",
    createToken: "Create token",
    settings: "Settings",
    notifications: "Notifications", security: "Security",
    wallet: "Wallet", profileSettings: "Profile", referral: "Referral program",
    privacy: "Privacy", terms: "Terms of use", support: "Support",
    launchPreparing: "Preparing metadata…",
    launchGenerating: "Generating token…",
    launchDeploying: "Deploying…",
    launchConfirming: "Confirming…",
    launchSuccessTitle: "Success",
    launchSuccessSub: "Your token has been created and is ready to trade",
    tokenCreatedStatus: "Token Created",
    contractAddress: "Contract address",
    totalSupply: "Total supply",
    initialBuy: "Initial buy",
    viewToken: "View token",
    doneClose: "Done",
    launchingWait: "Don't close this screen, this'll just take a second…",
    heroTitle: "Start right now",
    heroBodyLead: "Create, trade and grow with ",
    heroBodyTail: " for the first month. Join the ecosystem from day one.",
    heroFee: "0% platform fee",
    mempadComingSoon: "Something else is coming here soon.",
    mempadSpotlight: "Spotlight",
    mempadLaunchToken: "Launch token",
    mempadFilterNew: "New", mempadFilterHot: "Hot", mempadFilterBluming: "Bluming", mempadFilterDex: "DEX",
    homeActionLaunch: "Launch token", homeActionMempad: "Mempad", homeActionWallet: "Wallet",
    homeTopGainer: "Top gainer",
    homeUpdatesComingSoon: "News and platform updates are coming here soon.",
    searchPlaceholder: "Search token or ticker",
    emptyFilter: "Nothing here for this filter yet — try another or check back later.",
    catAll: "All", catMemes: "Memes", catUtility: "Utility", catGames: "Games", catAI: "AI", catSocial: "Social",
    linkCopied: "Link copied",
    tokenLinkCopied: "Token link copied",
    reportSent: "Report sent for review",
    back: "Back",
    perToken: "/ token",
    chartLoading: "loading chart…",
    fakeChartBadge: "Fake chart",
    ohlcOpen: "O", ohlcHigh: "H", ohlcLow: "L", ohlcClose: "C",
    statPrice: "Price", statLiquidity: "Liquidity", statHolders: "Holders", statVolume24h: "24h Volume",
    tabChart: "Chart", tabInfo: "Info", tabTx: "Transactions",
    chartModeMcap: "MCap", chartModePrice: "Price",
    tokenNoAddress: "Address unavailable",
    txUnavailable: "Transaction list isn't available for this pool yet",
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
    categoryLabel: "Category",
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
    refCodeCopied: "Referral code copied",
    editProfileDesc: "Nickname, avatar, email and profile bio.",
    walletConnectedStatus: "Wallet connected",
    walletNotConnectedStatus: "Wallet not connected",
    pushNotif: "Push notifications",
    pushNotifSub: "Trades, price moves, comment replies",
    emailNotif: "Email notifications",
    emailNotifSub: "Weekly portfolio digest",
    twoFA: "Two-factor authentication",
    twoFASub: "Confirm sign-in with a code",
    pinRow: "PIN code",
    pinRowSub: "Require a code every time Mintly opens",
    enablePinFirst: "Enable PIN code first",
    changePinCta: "Change PIN code",
    referralDesc: "Invite friends — earn a % of their trading fees.",
    supportDesc: "We'll reply within a day on Telegram support.",
    contactSupport: "Message support",
    copyLink: "Copy link",
    privacyText: "We only collect data needed to run the app: nickname, wallet address, and your trade history within Mintly. Data is never shared with third parties for advertising. You can delete your account at any time — all local profile data is erased immediately.",
    termsText: "By using Mintly, you confirm you trade at your own risk. Mintly does not guarantee token returns and is not liable for losses caused by market volatility. Creating tokens that mislead users or use someone else's brand without permission is prohibited.",
    accountLabel: "Account",
    loginTab: "Log in", createTab: "Create account",
    changeAvatarHint: "Tap to replace",
    editHint: "Nickname is required, everything else can be filled in later.",
    loginHint: "Log in to your account with email and password.",
    createHint: "Nickname, email and password are required, everything else can be filled in later.",
    nicknameLabel: "Nickname",
    nicknameError: "2–20 characters, Latin letters, digits, _ and . only, must start with a letter",
    emailLabel: "Email",
    emailRequired: "Email is required",
    emailInvalid: "Enter a valid email",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 6 characters",
    passwordError: "Password must be at least 6 characters",
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
    createCta: "Create",
    myTokensCreate: "Create",
    myTokensTitle: "My Tokens",
    unnamedToken: "Unnamed Token",
    noTokensYet: "You haven't launched any tokens yet.",
    noActivityYet: "No activity yet — buys, sells and launches will show up here.",
    noAchievementsYet: "No achievements yet — trade and launch tokens to earn your first one.",
    profileConfirmed: "Profile verified",
    verifyPending: "Review pending",
    verifyCta: "Verify your identity for a badge",
    deleteAccountForever: "Delete account forever",
    editProfileBtn: "Edit Profile",
    statsTitle: "Statistics",
    statPortfolioValue: "Portfolio Value",
    statTotalProfit: "Total Profit",
    statCreatedTokens: "Created Tokens",
    statTokensOwned: "Tokens Owned",
    statTotalTrades: "Total Trades",
    statWinRate: "Win Rate",
    statFollowers: "Followers",
    statFollowing: "Following",
    portfolioTitle: "Portfolio",
    portfolioConnectBody: "Connect your TON Wallet to view your portfolio and start trading.",
    activityTitle: "Activity",
    achievementsTitle: "Achievements",
    verificationTitle: "Verification",
    verifiedStatus: "Verified",
    pendingStatus: "Pending",
    notVerifiedStatus: "Not Verified",
    verifyAccountBtn: "Verify Account",
    dangerZoneTitle: "Danger Zone",
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
    authErrProfileLoad: "Couldn't load profile, try again",
    authConfirmEmailSent: "We sent a confirmation email — follow the link, then log in",
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
const logoFont = "'Futura XP', 'Futura', 'Century Gothic', 'Segoe UI', sans-serif";
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
function mcapSeries(base, seed, n = 22, offset = 0) {
  let v = base;
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = i + offset;
    const drift = Math.sin(idx * 0.55 + seed) * base * 0.02;
    const noise = (Math.random() - 0.5) * base * 0.015;
    v = Math.max(base * 0.6, v + drift * 0.3 + noise);
    out.push({ i, mcap: v });
  }
  return out;
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
function haptic() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate(12); } catch (e) { /* unsupported */ }
  }
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
      * { -webkit-tap-highlight-color: transparent; }
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
      @keyframes starPulse { 0%,100%{opacity:calc(var(--o) * 0.3);} 50%{opacity:var(--o);} }
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
      @keyframes toastIn { from{opacity:0; transform:translateY(-10px) translateX(-50%);} to{opacity:1; transform:translateY(0) translateX(-50%);} }
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
      .fx-card { animation: fadeInUp 480ms cubic-bezier(0.16,1,0.3,1) both; transition: transform ${SPRING}, border-color ${EASE}; will-change: transform; }
      .fx-card:active { transform: scale(0.98); transition: transform ${PRESS}; }
      .fx-card:hover { border-color: ${T.lineHi} !important; }
      .fx-tap { transition: transform ${SPRING}; will-change: transform; }
      .fx-tap:active { transform: scale(0.96); transition: transform ${PRESS}; }
      .fx-view { animation: fadeInUp 320ms cubic-bezier(0.16,1,0.3,1) both; }
      .fx-skeleton { background: linear-gradient(90deg, ${T.surface} 25%, ${T.surfaceHi} 37%, ${T.surface} 63%); background-size: 400px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fx-chip { transition: border-color ${EASE}, background ${EASE}, color ${EASE}, transform ${SPRING}; will-change: transform; }
      .fx-chip:active { transition: border-color ${EASE}, background ${EASE}, color ${EASE}, transform ${PRESS}; }
      .fx-modal-back { animation: fadeIn 220ms ease-out both; }
      .fx-modal-card { animation: scaleIn 260ms cubic-bezier(0.16,1,0.3,1) both; }
      .fx-avatar { transition: transform ${SPRING}; will-change: transform; }
      .fx-avatar:active { transform: scale(0.96); transition: transform ${PRESS}; }
      .cta-launch { transition: transform ${SPRING}, opacity ${EASE}; will-change: transform; }
      .cta-launch:hover { opacity: 0.92; }
      .cta-launch:active { transform: scale(0.98); transition: transform ${PRESS}; }
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

/* CyberGrid — живой фон вместо плоской чёрной заливки.
   Два слоя, оба на CSS/SVG (без rAF и канваса, чтобы не жечь батарею в
   Telegram WebView): россыпь белых четырёхлучевых звёздочек и тонкая
   сетка. Всё под pointer-events:none и на zIndex 0 — контент приложения
   лежит выше на zIndex 1. */
function CyberGrid({ forceDark }) {
  const dark = forceDark || T.bg === DARK_THEME.bg;
  const gridLine = dark ? "rgba(255,255,255,0.05)" : "rgba(20,21,26,0.06)";
  const starColor = dark ? "#FFFFFF" : "#14151A";

  // Детерминированные позиции — звёзды не перескакивают при каждом ре-рендере.
  const stars = useMemo(() => {
    const rnd = seededRand(20240607);
    return Array.from({ length: 90 }, () => ({
      left: rnd() * 100,
      top: rnd() * 100,
      size: 5 + rnd() * 5,
      opacity: 0.3 + rnd() * 0.55,
      delay: -rnd() * 8,
      dur: 4 + rnd() * 5,
    }));
  }, []);

  return (
    <div aria-hidden data-bg-fx style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* сетка, растворяющаяся к краям */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
          backgroundSize: "70px 70px, 70px 70px",
          animation: "gridDrift 30s linear infinite",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 35%, #000 0%, transparent 80%)",
          maskImage: "radial-gradient(ellipse at 50% 35%, #000 0%, transparent 80%)",
        }}
      />

      {/* звёзды-искры */}
      {stars.map((s, i) => (
        <svg
          key={i}
          width={s.size}
          height={s.size}
          viewBox="0 0 10 10"
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: `${s.top}%`,
            ["--o" as any]: s.opacity,
            opacity: s.opacity,
            animation: `starPulse ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        >
          <path
            d="M5 0 C5.4 3.2 6.8 4.6 10 5 C6.8 5.4 5.4 6.8 5 10 C4.6 6.8 3.2 5.4 0 5 C3.2 4.6 4.6 3.2 5 0 Z"
            fill={starColor}
          />
        </svg>
      ))}
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
const MiniChart = React.memo(function MiniChart({ base, seed, poolAddress, positive, id, width = 78, height = 36, length = 22 }) {
  const tick = useLiveTick();
  const [closes, setCloses] = useState(null);
  // Demo tokens (no on-chain pool) have nothing to fetch, so they're
  // "visible" immediately and just run the synthetic series below.
  const [visible, setVisible] = useState(!poolAddress);
  const elRef = useRef(null);

  // Only fetch real candle history once the card actually scrolls into
  // view. With 18+ cards in a feed, kicking off every request up front
  // would mean 18 simultaneous calls on what might be a mobile connection.
  useEffect(() => {
    if (!poolAddress || visible) return;
    const el = elRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [poolAddress, visible]);

  useEffect(() => {
    if (!poolAddress || !visible) return;
    let cancelled = false;
    function load() {
      fetchSparkCloses(poolAddress, length).then((res) => {
        if (!cancelled && res) setCloses(res);
      });
    }
    load();
    // Cards can stay mounted a long time in the feed; periodically pull a
    // fresh real shape (throttled by fetchSparkCloses's own TTL/cache, so
    // this doesn't add extra network load beyond what the cache allows).
    const iv = setInterval(load, SPARK_TTL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [poolAddress, visible, length]);

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
    if (closes && closes.length > 1) {
      const fetchBase = fetchBaseRef.current || base || 1;
      const ratio = fetchBase ? (base || fetchBase) / fetchBase : 1;
      const anchor = closes[closes.length - 1] || 1;
      return closes.map((v, i) => ({ i, mcap: v * ratio + Math.sin((i + tick) * 0.7 + seed) * anchor * 0.0015 }));
    }
    return mcapSeries(base, seed, length, tick);
  }, [closes, base, seed, length, tick]);

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
async function fetchTonMemePools(limit = 18) {
  try {
    // include=base_token,dex pulls the actual token record (real name,
    // symbol, on-chain address, logo image_url) and the DEX the pool
    // trades on, for every pool in one request.
    const res = await fetch(`${GT_BASE}/networks/${GT_NETWORK}/trending_pools?page=1&include=base_token,dex`);
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const json = await res.json();
    const rows = (json?.data || []).slice(0, limit);
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
    const res = await fetch(`${GT_BASE}/networks/${GT_NETWORK}/tokens/${tokenAddress}/info`);
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
const HOLDERS_TTL_MS = 60_000;
const holdersCache = new Map(); // tokenAddress -> { count, ts }
const holdersInflight = new Map(); // tokenAddress -> Promise, de-dupes concurrent callers
async function fetchJettonHolders(tokenAddress) {
  if (!tokenAddress) return null;
  const cached = holdersCache.get(tokenAddress);
  if (cached && Date.now() - cached.ts < HOLDERS_TTL_MS) return cached.count;
  if (holdersInflight.has(tokenAddress)) return holdersInflight.get(tokenAddress);
  const p = (async () => {
    try {
      const res = await fetch(`${TONAPI_MAINNET_BASE}/v2/jettons/${tokenAddress}`);
      if (!res.ok) throw new Error(`tonapi ${res.status}`);
      const json = await res.json();
      const count = typeof json?.holders_count === "number" ? json.holders_count : null;
      holdersCache.set(tokenAddress, { count, ts: Date.now() });
      holdersInflight.delete(tokenAddress);
      return count;
    } catch (err) {
      holdersInflight.delete(tokenAddress);
      return cached ? cached.count : null;
    }
  })();
  holdersInflight.set(tokenAddress, p);
  return p;
}

// Plain hook form of fetchJettonHolders, for spots (token detail header,
// info tab) that lay the number out themselves rather than using the
// icon+value HoldersBadge component. undefined = still loading, null =
// TonAPI has nothing for this address.
function useJettonHolders(tokenAddress) {
  const [count, setCount] = useState(undefined);
  useEffect(() => {
    setCount(undefined);
    if (!tokenAddress) return;
    let cancelled = false;
    fetchJettonHolders(tokenAddress).then((c) => { if (!cancelled) setCount(c); });
    return () => { cancelled = true; };
  }, [tokenAddress]);
  return count;
}

// Fetches real OHLCV candles for one pool/timeframe. Returns
// { candles: [{time,open,high,low,close}], volume: [{time,value,color}] }
// in ascending time order, ready for lightweight-charts — or null on failure.
// Real recent trades for a pool (GeckoTerminal's /trades endpoint) — used
// by the Transactions tab on the token screen. Not cached: this is
// explicitly opened by the person to see what's happening right now.
async function fetchPoolTrades(poolAddress, limit = 25) {
  if (!poolAddress) return null;
  try {
    const res = await fetch(`${GT_BASE}/networks/${GT_NETWORK}/pools/${poolAddress}/trades`);
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const json = await res.json();
    const rows = json?.data || [];
    return rows.slice(0, limit).map(row => {
      const a = row.attributes || {};
      return {
        id: row.id,
        kind: a.kind, // "buy" | "sell"
        volUsd: parseFloat(a.volume_in_usd) || 0,
        priceUsd: parseFloat(a.price_from_in_usd || a.price_to_in_usd) || 0,
        txHash: a.tx_hash || null,
        at: a.block_timestamp || null,
      };
    });
  } catch (err) {
    return null;
  }
}

async function fetchPoolOHLCV(poolAddress, tf) {
  const cfg = GT_TF[tf] || GT_TF.H1;
  const fetchLimit = Math.min(1000, 200 * (cfg.resample || 1));
  const url = `${GT_BASE}/networks/${GT_NETWORK}/pools/${poolAddress}/ohlcv/${cfg.timeframe}?aggregate=${cfg.aggregate}&limit=${fetchLimit}&currency=usd&token=base`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const json = await res.json();
    const list = json?.data?.attributes?.ohlcv_list || [];
    let candles = list
      .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
      .filter(c => [c.time, c.open, c.high, c.low, c.close].every(v => typeof v === "number" && Number.isFinite(v)))
      .sort((a, b) => a.time - b.time);
    if (cfg.resample) candles = resampleCandles(candles, cfg.resample);
    if (!candles.length) return null;
    return {
      candles: candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })),
      volume: candles.map(c => ({ time: c.time, value: Number.isFinite(c.volume) ? c.volume : 0, color: c.close >= c.open ? hexA(T.up, 0.32) : hexA(T.down, 0.32) })),
    };
  } catch (err) {
    return null; // caller falls back to a synthetic random-walk chart
  }
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
async function fetchSparkCloses(poolAddress, n = 24) {
  if (!poolAddress) return null;
  const cached = sparkCache.get(poolAddress);
  if (cached && Date.now() - cached.ts < SPARK_TTL_MS) return cached.closes;
  if (sparkInflight.has(poolAddress)) return sparkInflight.get(poolAddress);
  const p = (async () => {
    const result = await fetchPoolOHLCV(poolAddress, "M15");
    const closes = result?.candles?.length ? result.candles.slice(-n).map(c => c.close) : null;
    if (closes && closes.length > 1) sparkCache.set(poolAddress, { closes, ts: Date.now() });
    sparkInflight.delete(poolAddress);
    return closes || (cached ? cached.closes : null);
  })();
  sparkInflight.set(poolAddress, p);
  return p;
}

// Synthetic fallback generator — only used when a real pool/candle fetch
// isn't available (offline, rate-limited, or a bundled demo token with no
// on-chain pool). Keeps the app functional even without network access.
function genSyntheticCandles(basePrice, seed, timeframe, n = 140) {
  const volMap = { M1: 0.006, M5: 0.012, M15: 0.018, M30: 0.022, H1: 0.026, H4: 0.036, D1: 0.05, W1: 0.07, MN1: 0.09 };
  const stepSec = TF_SECONDS[timeframe] || 3600;
  const vol = basePrice * (volMap[timeframe] || 0.03);
  const tfSeed = seed + TIMEFRAMES.indexOf(timeframe) * 3.1;
  const anchor = Math.floor(Date.now() / 1000);
  let price = basePrice * 0.94;
  const candles = [], volume = [];
  for (let i = 0; i < n; i++) {
    const open = price;
    const drift = Math.sin(i * 0.5 + tfSeed) * vol * 0.7;
    const close = Math.max(basePrice * 0.4, open + drift + (Math.random() - 0.45) * vol);
    const high = Math.max(open, close) + Math.random() * vol * 0.5;
    const low = Math.max(basePrice * 0.3, Math.min(open, close) - Math.random() * vol * 0.5);
    const time = anchor - (n - 1 - i) * stepSec;
    candles.push({ time, open, high, low, close });
    volume.push({ time, value: Math.abs(close - open) / vol * 500 + Math.random() * 300 + 80, color: close >= open ? hexA(T.up, 0.32) : hexA(T.down, 0.32) });
    price = close;
  }
  return { candles, volume };
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
const CHART_GUTTER_W = 58;

function TerminalChart({ candles, height = 340, themeKey, onHover, tf, valueFmt }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [widthPx, setWidthPx] = useState(320);

  const n = candles?.length || 0;
  const viewRef = useRef({ start: Math.max(0, n - CHART_DEFAULT_VISIBLE), count: Math.min(n, CHART_DEFAULT_VISIBLE) || 1 });
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
    const plotW = Math.max(1, widthPx - CHART_GUTTER_W);
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
    return { startI, endI, min, max, range, slot, bodyW, yFor, xFor, padTop, padBottom, drawHeight, plotW };
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

    const { startI, endI, min, max, range, yFor, xFor, bodyW, plotW, padTop, padBottom, drawHeight } = layout;
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
    ctx.fillRect(plotW, 0, CHART_GUTTER_W, height);
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
      ctx.fillRect(widthPx - CHART_GUTTER_W, pillTop, CHART_GUTTER_W, pillTop + 32 - pillTop);
      ctx.fillStyle = T.bg;
      ctx.textAlign = "center";
      ctx.font = "700 11px " + monoFont;
      ctx.fillText(priceLabel, widthPx - CHART_GUTTER_W / 2, pillTop + 13);
      ctx.font = "9px " + monoFont;
      ctx.fillText(countdownLabel, widthPx - CHART_GUTTER_W / 2, pillTop + 26);
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
    draw();
  }
  // Vertical pan: shifts the frozen price window up/down so the content
  // moves with your finger, exactly like the horizontal pan — this is the
  // "you move it yourself" behavior instead of it auto-fitting.
  function panYByPixels(dyScreen) {
    const layout = computeLayout();
    if (!layout) return;
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
        style={{ position: "absolute", right: 0, top: 0, width: CHART_GUTTER_W, height: "100%", touchAction: "none", cursor: "ns-resize" }}
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

function Toast({ toast, insetTop = 0 }) {
  if (!toast) return null;
  return (
    <div style={{ position: "absolute", top: insetTop + 14, left: "50%", zIndex: 50, animation: "toastIn 240ms cubic-bezier(0.16,1,0.3,1) both" }}>
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

const FILTERS = [
  { id: "gems", label: "💎 Gems" },
  { id: "trending", label: "Trending" },
  { id: "pumping", label: "Pumping" },
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

/* MOCK DATA — profile */

/* New-user state: nothing bought, nothing launched, no history yet. */
const PORTFOLIO_TOKENS = [];
const MY_TOKENS = [];
const ACTIVITY = [];
const ACHIEVEMENTS = [];

const SETTINGS_ITEMS = [
  { key: "profile", icon: SettingsIcon, tKey: "profileSettings" },
  { key: "wallet", icon: Wallet, tKey: "wallet" },
  { key: "notifications", icon: Bell, tKey: "notifications" },
  { key: "security", icon: Lock, tKey: "security" },
  { key: "language", icon: Globe2, tKey: "langTitle" },
  { key: "appearance", icon: Palette, tKey: "themeTitle" },
  { key: "referral", icon: Gift, tKey: "referral" },
  { key: "support", icon: LifeBuoy, tKey: "support" },
  { key: "privacy", icon: FileText, tKey: "privacy" },
  { key: "terms", icon: ShieldQuestion, tKey: "terms" },
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
const HoldersBadge = React.memo(function HoldersBadge({ tokenAddress, icon: Icon = User }) {
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
    fetchJettonHolders(tokenAddress).then((c) => { if (!cancelled) setCount(c); });
    return () => { cancelled = true; };
  }, [tokenAddress, visible]);

  return (
    <span ref={elRef} className="flex items-center gap-1" style={{ fontFamily: monoFont, fontSize: 10.5, color: T.muted }}>
      <Icon size={11} color={T.muted} /> {count == null ? "—" : count.toLocaleString("ru-RU")}
    </span>
  );
});

function TokenCard({ t, onOpen, index }) {
  const up = t.change >= 0;
  return (
    <button onClick={() => onOpen(t)} className="fx-tap w-full text-left" style={{ padding: "12px 2px", borderBottom: `1px solid ${T.line}`, animationDelay: `${index * 55}ms` }}>
      <div className="flex items-center gap-2.5">
        <TokenAvatar size={42} tone={up ? "up" : "down"} src={t.logoUrl}>{t.emoji}</TokenAvatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 13, fontWeight: 600 }}>{t.name}</span>
            {t.verified && <ShieldCheck size={11} color={T.electric} />}
            <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 9.5 }}>${t.ticker} · {catLabel(t.cat)}</span>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 17, color: T.ice, opacity: 0.92 }}>{fmtUSD(t.mcapNum)}</span>
            <ChangeBadge value={t.change} />
          </div>
        </div>
        <MiniChart base={t.mcapNum} seed={t.seed} poolAddress={t.poolAddress} positive={up} id={t.id} width={62} height={30} />
      </div>
      <div className="flex items-center gap-3 mt-2" style={{ paddingLeft: 52 }}>
        <HoldersBadge tokenAddress={t.tokenAddress} />
        <CardStat icon={Flame}>${t.vol}</CardStat>
      </div>
    </button>
  );
}

function TokenCardSkeleton({ index }) {
  return (
    <div className="w-full" style={{ padding: "12px 2px", borderBottom: `1px solid ${T.line}`, animationDelay: `${index * 55}ms` }}>
      <div className="flex items-center gap-2.5">
        <div className="fx-skeleton" style={{ width: 42, height: 42, borderRadius: "50%" }} />
        <div className="flex-1 flex flex-col gap-2">
          <div className="fx-skeleton" style={{ width: "40%", height: 11, borderRadius: 4 }} />
          <div className="fx-skeleton" style={{ width: "60%", height: 16, borderRadius: 4 }} />
        </div>
        <div className="fx-skeleton" style={{ width: 62, height: 30, borderRadius: 6 }} />
      </div>
      <div className="flex items-center gap-3 mt-2" style={{ paddingLeft: 52 }}>
        <div className="fx-skeleton" style={{ width: "40%", height: 10, borderRadius: 4 }} />
      </div>
    </div>
  );
}

// Real tokens only — no bundled/demo list. The feed starts empty and
// fills in as soon as the first live GeckoTerminal fetch resolves.
const TOKEN_REFRESH_MS = 2500;

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
          <HoldersBadge tokenAddress={tok.tokenAddress} />
          <CardStat icon={Flame}>${tok.vol}</CardStat>
        </div>
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

// Adapts a locally-launched token (from myTokens — see handleTokenCreated
// at the root) into the same shape the real GeckoTerminal feed produces,
// so MempadRow/TokenDetail can render either without a special case.
// price is derived from mcap/fixed-supply since these tokens don't have
// a price field of their own yet; change is 0 — there's no history for a
// token that was just launched. poolAddress stays null until the pool is
// actually indexed somewhere, so TokenDetail's chart falls back to its
// existing synthetic view rather than pretending there's real OHLCV.
function localTokenToFeedShape(entry) {
  const price = entry.mcapNum ? entry.mcapNum / 1_000_000_000 : 0;
  return {
    id: entry.id,
    tokenAddress: entry.address,
    poolAddress: null,
    name: entry.name,
    ticker: entry.ticker,
    logoUrl: entry.logoUrl,
    emoji: entry.emoji,
    price,
    change: 0,
    mcapNum: entry.mcapNum,
    liq: entry.liq,
    vol: entry.vol,
    cat: "Мемы",
    seed: hashSeed(entry.id),
    verified: entry.verified,
    live: false,
    dexName: null,
    createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
  };
}

/* ShopView — placeholder tab. Empty for now: just a title and an
   empty-state card, same visual language as the other empty states
   in the app (see e.g. the Mempad empty-filter card below). */
function ShopView() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("shopTitle")}</span>
      <div className="fx-view rounded-[22px] p-6 flex flex-col items-center text-center gap-2" style={{ background: T.surface, border: `1px dashed ${T.line}` }}>
        <MintlyFrame size={48} glow={`${T.electric}33`}><ShoppingBag size={20} color={T.electric} /></MintlyFrame>
        <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, maxWidth: 260 }}>{t("shopComingSoon")}</p>
      </div>
    </div>
  );
}

function MempadView({ tokens, loading, myTokens, onOpen, onLaunch }) {
  const [filter, setFilter] = useState("new");

  const spotlight = useMemo(() => {
    if (!tokens.length) return null;
    return [...tokens].sort((a, b) => b.mcapNum - a.mcapNum)[0];
  }, [tokens]);

  const localTokens = useMemo(() => (myTokens || []).map(localTokenToFeedShape), [myTokens]);

  const list = useMemo(() => {
    // "New" now means what it literally says: tokens launched through
    // this app, not the newest items in the external real-market feed.
    if (filter === "new") return localTokens;
    let arr = tokens.filter(tok => !spotlight || tok.id !== spotlight.id);
    switch (filter) {
      case "hot": arr = [...arr].sort((a, b) => b.change - a.change); break;
      case "dex": arr = arr.filter(tok => tok.verified); break;
      default: break;
    }
    return arr;
  }, [tokens, filter, spotlight, localTokens]);

  return (
    <div className="flex flex-col gap-5" style={{ paddingBottom: 12 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("navMempad")}</span>
        <button onClick={onLaunch} className="fx-tap flex items-center gap-1.5 rounded-full px-3.5 py-2" style={{ background: "rgba(49,208,123,0.14)", border: `1px solid rgba(49,208,123,0.35)` }}>
          <Sparkles size={13} color={T.up} />
          <span style={{ fontFamily: bodyFont, color: T.up, fontSize: 12.5, fontWeight: 600 }}>{t("mempadLaunchToken")}</span>
        </button>
      </div>

      {loading && !spotlight ? (
        <div className="fx-card rounded-[22px] p-6 flex flex-col items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <div className="fx-skeleton" style={{ width: 92, height: 92, borderRadius: "50%" }} />
          <div className="fx-skeleton" style={{ width: 90, height: 16, borderRadius: 4 }} />
          <div className="fx-skeleton" style={{ width: 130, height: 24, borderRadius: 4 }} />
        </div>
      ) : spotlight && (
        <div>
          <SectionTitle>{t("mempadSpotlight")}</SectionTitle>
          <button onClick={() => onOpen(spotlight)} className="fx-card w-full flex flex-col items-center text-center gap-2.5 rounded-[22px] p-6" style={{ border: `1px solid ${T.line}`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <TokenAvatar size={92} tone={spotlight.change >= 0 ? "up" : "down"} src={spotlight.logoUrl}>{spotlight.emoji}</TokenAvatar>
              <span style={{ fontFamily: displayFont, color: T.ice, fontSize: 20, fontWeight: 800 }}>{spotlight.ticker}</span>
              <div className="flex items-center gap-3">
                <HoldersBadge tokenAddress={spotlight.tokenAddress} />
                <CardStat icon={Flame}>${spotlight.vol}</CardStat>
              </div>
              <span style={{ fontFamily: displayFont, color: T.up, fontSize: 27, fontWeight: 800, lineHeight: 1 }}>{fmtUSD(spotlight.mcapNum)}</span>
              {fmtAge(spotlight.createdAt) && (
                <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 11 }}>{fmtAge(spotlight.createdAt)}</span>
              )}
            </div>
          </button>
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

function TokenDetail({ t: token, onBack, showToast, onBuy, onSell, unlocked = true, connected = true, onConnectWallet, themeKey }) {
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
  const [hovered, setHovered] = useState(null);
  const up = token.change >= 0;
  const holdersCount = useJettonHolders(token.tokenAddress);

  // Real OHLCV (via GeckoTerminal's data API — no iframe, no branding) when
  // the token is backed by a live on-chain pool; a synthetic random-walk
  // chart otherwise (bundled demo tokens, or if the fetch fails) so the
  // screen never shows a blank chart. We render everything ourselves with
  // TerminalChart, so there's no external widget or watermark involved.
  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    (async () => {
      let result = null;
      if (token.poolAddress) result = await fetchPoolOHLCV(token.poolAddress, tf);
      if (!result) result = genSyntheticCandles(token.price, token.seed, tf, CHART_TOTAL);
      if (!cancelled) { setChartData({ ...result, isLive: !!token.poolAddress }); setChartLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tf, token.id, token.poolAddress]);

  // Live tick: for real pools, refetch the latest candles every few
  // seconds. For the synthetic fallback, wiggle the last candle locally
  // like a simulated feed. Deliberately NOT depending on token.price here:
  // the root now syncs the open token's price/mcap every 2.5s, and if
  // this effect depended on token.price it would tear down and recreate the
  // interval every 2.5s too — meaning the 8000ms timer would never
  // actually survive long enough to fire, and the chart would never
  // refetch. priceRef always holds the latest price for the fallback
  // branch without needing to be a dependency.
  const priceRef = useRef(token.price);
  useEffect(() => { priceRef.current = token.price; }, [token.price]);

  useEffect(() => {
    if (!chartData) return;
    const iv = setInterval(async () => {
      if (token.poolAddress) {
        const fresh = await fetchPoolOHLCV(token.poolAddress, tf);
        if (fresh?.candles?.length) {
          setChartData(prev => prev && ({ ...prev, candles: fresh.candles, volume: fresh.volume }));
        }
      } else {
        setChartData(prev => {
          if (!prev?.candles?.length) return prev;
          const candles = [...prev.candles];
          const volume = [...prev.volume];
          const last = { ...candles[candles.length - 1] };
          const price = priceRef.current;
          const wig = price * 0.006;
          last.close = Math.max(price * 0.3, last.close + (Math.random() - 0.5) * wig);
          last.high = Math.max(last.high, last.close);
          last.low = Math.min(last.low, last.close);
          candles[candles.length - 1] = last;
          return { ...prev, candles, volume };
        });
      }
    }, token.poolAddress ? 8000 : 1000);
    return () => clearInterval(iv);
  }, [token.id, token.poolAddress, tf, !!chartData]);

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
    if (token.tokenAddress) {
      fetchTokenInfo(token.tokenAddress).then((res) => { if (!cancelled) setInfo(res); });
    }
    return () => { cancelled = true; };
  }, [token.tokenAddress]);

  // Real recent trades for the Transactions tab — only fetched once that
  // tab is actually opened (no point spending API calls on tabs nobody
  // looked at), refreshed while it stays open.
  const [trades, setTrades] = useState(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  useEffect(() => {
    if (tab !== "tx" || !token.poolAddress) return;
    let cancelled = false;
    setTradesLoading(true);
    async function load() {
      const res = await fetchPoolTrades(token.poolAddress);
      if (!cancelled) { setTrades(res); setTradesLoading(false); }
    }
    load();
    const iv = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tab, token.poolAddress]);

  function openSocial(url) {
    if (typeof window !== "undefined" && url) window.open(url, "_blank", "noopener,noreferrer");
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

          <div className="rounded-[22px] overflow-hidden" style={{ background: "#000000", border: `1px solid ${T.line}`, padding: 2, position: "relative" }}>
            {chartLoading || !chartData ? (
              <div className="flex items-center justify-center" style={{ height: 340, fontFamily: monoFont, fontSize: 11, color: T.muted }}>
                {tr("chartLoading")}
              </div>
            ) : (
              <TerminalChart key={`${token.id}-${tf}-${chartMode}`} candles={scaledCandles} height={340} themeKey={themeKey} onHover={setHovered} tf={tf} valueFmt={chartMode === "price" ? fmtPrice : fmtUSD} />
            )}
            {/* chartData.isLive is false whenever there's no real on-chain pool
                behind this token, i.e. the candles are the synthetic
                random-walk fallback (see the effect above) rather than real
                OHLCV — flag that clearly so it can't be mistaken for a real
                price history. */}
            {!chartLoading && chartData && !chartData.isLive && (
              <div style={{
                position: "absolute", top: 10, left: 10, zIndex: 2,
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 9px", borderRadius: 999,
                background: hexA(T.down, 0.16), border: `1px solid ${hexA(T.down, 0.5)}`,
                backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
              }}>
                <ShieldAlert size={11} color={T.down} />
                <span style={{ fontFamily: bodyFont, fontSize: 10.5, fontWeight: 700, color: T.down, letterSpacing: 0.2 }}>
                  {tr("fakeChartBadge")}
                </span>
              </div>
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

          {connected ? (
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
            <StatChip icon={User} label={tr("statHolders")} value={holdersCount == null ? "—" : holdersCount.toLocaleString("ru-RU")} />
            <StatChip icon={Flame} label={tr("statVolume24h")} value={`$${token.vol}`} />
          </div>
          {(info?.description || info?.telegram || info?.twitter || info?.website) ? (
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
              <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{tr("txUnavailable")}</span>
            </div>
          )}
        </div>
      )}

      {tab === "tx" && (
        <div className="flex flex-col gap-1.5">
          {!token.poolAddress || (!tradesLoading && trades && trades.length === 0) || (!tradesLoading && !trades) ? (
            <div className="rounded-[22px] p-4 flex items-center justify-center text-center" style={{ background: T.surface, border: `1px dashed ${T.line}`, minHeight: 80 }}>
              <span style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5 }}>{tr("txUnavailable")}</span>
            </div>
          ) : tradesLoading && !trades ? (
            <div className="flex items-center justify-center" style={{ height: 120, fontFamily: monoFont, fontSize: 11, color: T.muted }}>{tr("chartLoading")}</div>
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
const TON_USD = 7.1;
const MIN_LAUNCH_USD = 5; // minimum initial-buy commitment required to launch a token
const NETWORK_FEE_TON = 0.05;
const SLIPPAGE_OPTIONS = [0.5, 1, 3];

function parseAmount(str) {
  const n = parseFloat(str.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* TradeModal — the buy/sell sheet: pick an amount (with quick %/preset
   chips), see the live conversion, pick slippage tolerance, and confirm.
   Shared between the Buy and Sell CTAs so switching tabs mid-flow works. */
function TradeModal({ t: token, tradeModal, onClose, onConfirm, walletTonBalance = 0, tonPriceUsd = 0, heldAmount = 0 }) {
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

  const holdingTokens = heldAmount;
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
  const estimate = isBuy ? (amount * tonPriceUsd) / token.price : amount * token.price;
  const feeUsd = NETWORK_FEE_TON * tonPriceUsd;
  const canConfirm = amount > 0 && !overMax && (!isBuy || tonPriceUsd > 0);

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
            {t("available")}: {isBuy ? `${spendableTon.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} TON` : `${holdingTokens.toLocaleString("ru-RU")} ${token.ticker}`}
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

  return (
    <div className="fx-modal-back" style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div className="fx-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: T.surface, border: `1px solid ${T.lineHi}`, borderRadius: 24, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
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
/* Simple fixed conversion so the "how much do I buy" field can show a live
   token count / % of supply. Modeled loosely like a pump.fun-style bonding
   curve where the whole supply is notionally worth 1000 TON at launch —
   so 1 TON ≈ 0.1% of supply. Purely cosmetic (see note on TokenLaunchOverlay
   above): nothing here reflects a real price feed or on-chain curve. */
const TOKENS_PER_TON = TOKEN_FIXED_SUPPLY / 1000;
function tokensForTon(tonAmount) {
  const n = Math.max(0, tonAmount || 0);
  const tokens = Math.min(TOKEN_FIXED_SUPPLY, Math.round(n * TOKENS_PER_TON));
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
              {t("viewToken")}
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
  const [category, setCategory] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [bannerUrl, setBannerUrl] = useState(null);
  const [touched, setTouched] = useState(false);
  const [logoCropFile, setLogoCropFile] = useState(null);
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  function set(key) { return (e) => setForm(f => ({ ...f, [key]: e.target.value })); }
  function setBuyAmount(e) {
    setForm(f => ({ ...f, buyAmount: e.target.value.replace(/[^0-9.,]/g, "") }));
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
    const minBuyTon = MIN_LAUNCH_USD / TON_USD;
    if (buyNum * TON_USD < MIN_LAUNCH_USD) {
      showToast(trf("buyAmountTooLow", { min: MIN_LAUNCH_USD, tons: minBuyTon.toFixed(2) }));
      return;
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
        <div className="flex items-center gap-2 rounded-[20px] px-3.5 py-3" style={{ background: T.surface, border: `1px solid ${touched && !(parseFloat(form.buyAmount.replace(",", ".")) * TON_USD >= MIN_LAUNCH_USD) ? T.down : T.line}` }}>
          <input
            value={form.buyAmount}
            onChange={setBuyAmount}
            placeholder="10"
            inputMode="decimal"
            style={{ fontFamily: displayFont, fontWeight: 700, color: T.ice, fontSize: 16, background: "transparent", border: "none", outline: "none", flex: 1, minWidth: 0 }}
          />
          <span style={{ fontFamily: monoFont, color: T.muted, fontSize: 13 }}>TON</span>
        </div>
        {(() => {
          const buyNum = parseFloat(form.buyAmount.replace(",", "."));
          const minBuyTon = MIN_LAUNCH_USD / TON_USD;
          if (!Number.isFinite(buyNum) || buyNum <= 0) {
            return (
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 11, lineHeight: 1.5 }}>
                {t("launchAmountNote")}
              </p>
            );
          }
          if (buyNum * TON_USD < MIN_LAUNCH_USD) {
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
      <div style={{ position: "relative", zIndex: 1 }}><MiniChart base={t.mcapNum} seed={t.seed} poolAddress={t.poolAddress} positive={up} id={`pf-${t.id}`} length={18} /></div>
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
            <button key={idx} onClick={onBackspace} className="fx-tap flex items-center justify-center" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: "50%", background: "transparent" }}>
              <span style={{ fontFamily: bodyFont, fontSize: 19, color: T.muted }}>⌫</span>
            </button>
          );
        }
        return (
          <button
            key={idx}
            onClick={() => onDigit(k)}
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
    haptic();
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
          haptic();
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
  connected, onConnectWallet, onDisconnectWallet, onCopyAddress,
  onOpenEditProfile, profile, showToast,
  onTogglePin, onChangePin, insetBottom = 0, insetTop = 0,
  accountCreated, onDeleteAccount,
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
  function copyReferral() {
    const code = "MINTLY-" + (profile.nickname ? profile.nickname.toUpperCase() : "GUEST");
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    showToast(t("refCodeCopied"));
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
    case "wallet":
      body = (
        <>
          <div className="flex items-center justify-center gap-2 mt-1 mb-3">
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? T.turquoise : T.muted }} />
            <span style={{ fontFamily: bodyFont, fontSize: 12.5, color: connected ? T.turquoise : T.muted }}>{connected ? t("walletConnectedStatus") : t("walletNotConnectedStatus")}</span>
          </div>
          {connected ? (
            <div className="flex flex-col gap-2">
              <button onClick={onCopyAddress} className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3" style={{ background: T.surfaceHi, border: `1px solid ${T.line}`, fontFamily: bodyFont, fontSize: 13, color: T.ice }}>
                <Copy size={14} color={T.muted} /> {t("copyAddress")}
              </button>
              <button onClick={() => { onDisconnectWallet(); onClose(); }} className="fx-tap w-full flex items-center justify-center gap-2 rounded-[20px] py-3" style={{ background: "transparent", border: `1px solid rgba(140,140,148,0.3)`, fontFamily: bodyFont, fontSize: 13, color: T.rose }}>
                <LogOut size={14} /> {t("disconnectWallet")}
              </button>
            </div>
          ) : (
            <button onClick={() => { onConnectWallet(); onClose(); }} className="fx-tap w-full rounded-[20px] py-3" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 14 }}>
              {t("connectWallet")}
            </button>
          )}
        </>
      );
      break;
    case "notifications":
      body = (
        <div className="mt-2">
          <SettingsRow label={t("pushNotif")} sub={t("pushNotifSub")}>
            <ToggleSwitch on={appSettings.pushNotif} onChange={(v) => onUpdateSetting("pushNotif", v)} />
          </SettingsRow>
          <SettingsRow label={t("emailNotif")} sub={t("emailNotifSub")}>
            <ToggleSwitch on={appSettings.emailNotif} onChange={(v) => onUpdateSetting("emailNotif", v)} />
          </SettingsRow>
        </div>
      );
      break;
    case "security":
      body = (
        <div className="mt-2">
          <SettingsRow label={t("twoFA")} sub={t("twoFASub")}>
            <ToggleSwitch on={appSettings.twoFA} onChange={(v) => onUpdateSetting("twoFA", v)} />
          </SettingsRow>
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
    case "appearance":
      body = (
        <div className="flex flex-col gap-2 mt-2">
          {[{ id: "Dark", label: t("themeDark") }, { id: "White", label: t("themeWhite") }].map((th) => (
            <button key={th.id} onClick={() => onUpdateSetting("theme", th.id)} className="fx-tap w-full flex items-center justify-between rounded-[20px] py-3 px-3.5" style={{ background: T.surfaceHi, border: `1px solid ${appSettings.theme === th.id ? T.turquoise : T.line}` }}>
              <span style={{ fontFamily: bodyFont, fontSize: 13, color: T.ice }}>{th.label}</span>
              {appSettings.theme === th.id && <CheckCircle2 size={16} color={T.turquoise} />}
            </button>
          ))}
        </div>
      );
      break;
    case "referral":
      body = (
        <>
          <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5, textAlign: "center" }}>
            {t("referralDesc")}
          </p>
          <div className="flex items-center gap-2 mt-3 rounded-[20px] px-3 py-2.5" style={{ background: T.surfaceHi, border: `1px solid ${T.line}` }}>
            <span style={{ fontFamily: monoFont, color: T.ice, fontSize: 12.5, flex: 1 }}>{"MINTLY-" + (profile.nickname ? profile.nickname.toUpperCase() : "GUEST")}</span>
            <button onClick={copyReferral} className="fx-tap"><Copy size={14} color={T.muted} /></button>
          </div>
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
    case "terms":
      body = <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}>{t("termsText")}</p>;
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
  e.target.value = ""; // allow re-picking the same file later
  if (!file) return;
  setAvatarCropFile(file);
}
function handleAvatarCropConfirm(croppedFile, croppedUrl) {
  setAvatarUrl(croppedUrl); // только превью, в БД пойдёт после загрузки
  setAvatarFile(croppedFile);
  setAvatarCropFile(null);
}

// Загружает файл в Supabase Storage и возвращает публичный URL
async function uploadAvatarIfNeeded(userId) {
  if (!avatarFile) return avatarUrl; // ничего не выбирали — оставляем как было
  const ext = avatarFile.name.split(".").pop();
  const path = `${userId}/${Date.now()}.${ext}`;
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
        setServerError(t("authErrProfileLoad"));
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

// ---------- CREATE (real signUp; a DB trigger auto-creates the
    // profiles row from the metadata below — see SQL setup) ----------
    const { data: existing } = await supabase
      .from("profiles")
      .select("nickname")
      .ilike("nickname", nicknameTrimmed)
      .maybeSingle();
    if (existing) {
      setSubmitting(false);
      setServerError(tf("authErrNicknameTaken", { name: nicknameTrimmed }));
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nickname: nicknameTrimmed,
          bio: bio.trim(),
          avatar_url: null, // ещё не загружен — загрузим ПОСЛЕ signUp, когда будет userId
          emoji: previewEmoji,
          wallet_address: walletAddress || null,
        },
      },
    });
    if (error) {
      setSubmitting(false);
      setServerError(friendlyAuthError(error.message));
      return;
    }

    if (!data.session) {
      // Email confirmation is turned on in the Supabase project — there's
      // no session yet, so we can't unlock the app. Ask the user to verify.
      setSubmitting(false);
      setServerError(t("authConfirmEmailSent"));
      return;
    }

    // Триггер уже создал строку в profiles с avatar_url: null.
    // Теперь, когда есть data.user.id, загружаем файл (если он был выбран)
    // и обновляем эту же строку реальным публичным URL.
    let uploadedUrl = null;
    if (avatarFile) {
      uploadedUrl = await uploadAvatarIfNeeded(data.user.id);
      if (!uploadedUrl) {
        setSubmitting(false);
        return; // ошибка загрузки уже показана внутри uploadAvatarIfNeeded
      }
      const { error: avatarUpdateError } = await supabase
        .from("profiles")
        .update({ avatar_url: uploadedUrl, emoji: null })
        .eq("id", data.user.id);
      if (avatarUpdateError) {
        setSubmitting(false);
        setServerError(friendlyAuthError(avatarUpdateError.message));
        return;
      }
    }

    setSubmitting(false);
    onSubmit({
      nickname: nicknameTrimmed,
      email: email.trim(),
      bio: bio.trim(),
      avatarUrl: uploadedUrl,
      emoji: uploadedUrl ? null : previewEmoji,
    });
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
          <Field label={t("emailLabel")} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} icon={Mail} autoComplete="email" type="email" />
          {touched && !emailValid && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 11, marginTop: -10 }}>{email.trim() === "" ? t("emailRequired") : t("emailInvalid")}</span>}
          {!isEdit && (
            <>
              <Field label={t("passwordLabel")} placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} icon={KeyRound} type="password" autoComplete={isLogin ? "current-password" : "new-password"} />
              {touched && !passwordValid && <span style={{ fontFamily: bodyFont, color: T.rose, fontSize: 11, marginTop: -10 }}>{t("passwordError")}</span>}
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
}) {
  const [loading, setLoading] = useState(true);
  const [verifyStatus, setVerifyStatus] = useState("none");
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
    setTimeout(() => { setVerifyStatus("verified"); showToast(t("profileVerified")); }, 2200);
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
        <div className="flex flex-col items-center text-center gap-2" style={{ marginTop: 10, position: "relative" }}>
          {accountCreated && (
            <button onClick={logOut} className="fx-tap flex items-center gap-1.5" style={{ position: "absolute", top: 0, right: 0, background: "transparent", border: `1px solid rgba(140,140,148,0.3)`, borderRadius: 999, padding: "6px 12px", fontFamily: bodyFont, fontSize: 12, color: T.rose }}>
              <LogOut size={13} /> {t("logOutShort")}
            </button>
          )}
          <div style={{ position: "relative" }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", background: profile.avatarUrl ? `center/cover no-repeat url(${profile.avatarUrl})` : T.surfaceHi, border: profile.avatarUrl ? `2px solid ${T.lineHi}` : `2px dashed ${T.lineHi}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: accountCreated ? 52 : 40 }}>
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
                <button onClick={onOpenLogin} className="fx-tap flex-1 flex items-center justify-center gap-1.5 rounded-[20px] px-4 py-2.5" style={{ background: T.surface, border: `1px solid ${T.lineHi}`, fontFamily: displayFont, fontWeight: 700, fontSize: 12.5, color: T.ice }}>
                  <LogIn size={14} /> {t("loginCta")}
                </button>
                <button onClick={onOpenCreateProfile} className="fx-tap flex-1 flex items-center justify-center gap-1.5 rounded-[20px] px-4 py-2.5" style={{ background: PRISM, color: PRISM_TEXT, fontFamily: displayFont, fontWeight: 700, fontSize: 12.5 }}>
                  <Sparkles size={14} /> {t("createCta")}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-5"><WalletCard connected={connected} walletAddress={walletAddress} tonBalance={tonBalance} tonPriceUsd={tonPriceUsd} onConnect={connectWallet} onDisconnect={disconnectWallet} onCopy={copyAddress} onExplore={exploreWallet} /></div>

        <div className="mt-5">
          <SectionTitle>{t("statsTitle")}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <StatBlock label={t("statTotalProfit")} value={0} color={T.turquoise} suffix=" $" />
            <StatBlock label={t("statCreatedTokens")} value={myTokens.length} />
            <StatBlock label={t("statTokensOwned")} value={0} />
            <StatBlock label={t("statTotalTrades")} value={0} />
            <StatBlock label={t("statFollowers")} value={0} />
            <StatBlock label={t("statFollowing")} value={0} />
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
          <SectionTitle>{t("achievementsTitle")}</SectionTitle>
          {ACHIEVEMENTS.length === 0 ? (
            <GlassCard style={{ padding: 22 }} className="flex flex-col items-center text-center gap-2">
              <MintlyFrame size={40} glow={`${T.violet}44`}><Star size={16} color={T.violet} /></MintlyFrame>
              <p style={{ fontFamily: bodyFont, color: T.muted, fontSize: 12.5, lineHeight: 1.5 }}>{t("noAchievementsYet")}</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {ACHIEVEMENTS.map((a, i) => (
                <GlassCard key={a.label} style={{ padding: "12px 12px", animationDelay: `${i * 50}ms` }} className="flex items-center gap-2">
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${a.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}><a.icon size={15} color={a.color} /></div>
                  <span style={{ fontFamily: bodyFont, fontSize: 11.5, color: T.ice, lineHeight: 1.2 }}>{a.label}</span>
                </GlassCard>
              ))}
            </div>
          )}
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
  const [insetTop, setInsetTop] = useState(0);
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
        // In fullscreen mode Telegram draws the app under the phone's status
        // bar / camera cutout, so top content needs its own safe-area push —
        // without this, headers/first rows sit underneath the system clock.
        setInsetTop(safe && safe.top ? safe.top : 0);
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

  return { height, insetBottom, insetTop, ready };
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
  // Балансовый API (tonapi.io) по умолчанию смотрит в mainnet. Если
  // кошелёк подключён в testnet (например, для проверки покупки на
  // тестовых TON), запрос к mainnet-адресу вернёт пустой/нулевой баланс,
  // и любая покупка будет падать в "недостаточно средств" — это и была
  // причина того, что покупка "не работала" при тесте. Переключатель
  // ниже отправляет запросы в testnet-API вместо mainnet. Важно: сам
  // TonConnectUIProvider (обычно настраивается в index/main файле, не
  // в этом) тоже должен быть сконфигурирован под testnet — иначе
  // подключаемый кошелёк не будет знать, что вы работаете в тестовой сети.
  const TON_TESTNET = true;
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
  const { height, insetBottom, insetTop } = useTelegramViewport();

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
    async function poll() {
      const live = await fetchTonMemePools(18);
      if (cancelled) return;
      if (live && live.length) setTokens(live);
      setTokensLoading(false);
    }
    poll();
    const iv = setInterval(poll, TOKEN_REFRESH_MS);
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
  const [userId, setUserId] = useState(null);

  async function loadProfileForUser(user) {
    setUserId(user ? user.id : null);
    if (!user) { setAccountCreated(false); setProfile(EMPTY_PROFILE); setMyTokens([]); return; }
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("nickname, email, bio, avatar_url, emoji")
      .eq("id", user.id)
      .single();
    if (error || !prof) { setAccountCreated(false); setProfile(EMPTY_PROFILE); setMyTokens([]); return; }
    setProfile({ nickname: prof.nickname, email: prof.email, bio: prof.bio || "", avatarUrl: prof.avatar_url, emoji: prof.emoji });
    setAccountCreated(true);
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
      vol: "$0",
      address: row.address,
      poolAddress: row.pool_address,
      explorerUrl: row.explorer_url,
      supply: row.supply,
      buyAmount: row.buy_amount,
      logoUrl: row.logo_url,
      network: row.network || "mainnet",
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
  async function loadCommunityTokens() {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { console.error("[mintly] failed to load community tokens from Supabase:", error); return; }
    setCommunityTokens((data || []).map(mapTokenRow));
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
    loadCommunityTokens();
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalMode, setProfileModalMode] = useState("create");
  const [settingsItem, setSettingsItem] = useState(null);
  const [manageToken_, setManageToken_] = useState(null);
  const [tradeModal, setTradeModal] = useState(null); // { mode: 'buy' | 'sell' }
  const [appSettings, setAppSettings] = useState(() => {
    const base = { pushNotif: true, emailNotif: false, twoFA: false, language: "RU", theme: "Dark", pinEnabled: false };
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
    const buyNum = parseFloat(String(result.buyAmount || "0").replace(",", ".")) || 0;
    const buyUsd = buyNum * TON_USD;

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
      mcapNum: buyUsd,
      liq: buyUsd ? fmtCompact(buyUsd) : "0",
      vol: "$0",
      address: row.address,
      poolAddress: row.pool_address,
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
      let persistentLogoUrl = req.logoUrl || null;
      if (req.logoFile && userId) {
        try {
          const ext = (req.logoFile.name || "logo.png").split(".").pop();
          const path = `tokens/${userId}/${Date.now()}.${ext}`;
          const { error: logoUploadError } = await supabase.storage
            .from("avatars")
            .upload(path, req.logoFile, { upsert: true });
          if (!logoUploadError) {
            const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
            if (pub && pub.publicUrl) persistentLogoUrl = pub.publicUrl;
          } else {
            console.error("[mintly] token logo upload failed, falling back to local blob URL:", logoUploadError);
          }
        } catch (e) { console.error("[mintly] token logo upload threw:", e); }
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
  }
  function viewLaunchedToken(result) {
    closeLaunchOverlay(result);
    if (result) goTab("profile");
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
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: TON_TESTNET ? "-3" : "-239",
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
        adjustHolding(token.id, rawEstimate);
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
      const held = holdings[token.id] || 0;
      if (rawAmount > held) { showToast(t("insufficientSellAmount")); return; }
      if (!connected) { showToast(t("connectWalletSell")); return; }
      // No live on-chain pool contract is wired up for this demo token, so
      // a real jetton transfer isn't possible — but the sale still has to
      // go through TonConnect like a real trade would: the wallet signs
      // and sends a real, on-chain network-fee transaction to confirm it,
      // instead of just showing a toast with nothing sent anywhere.
      try {
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: TON_TESTNET ? "-3" : "-239",
          messages: [
            {
              address: FEE_ADDRESS,
              amount: toNano(NETWORK_FEE_TON.toFixed(9)).toString(),
            },
          ],
        });
        adjustHolding(token.id, -rawAmount);
        setTradeModal(null);
        showToast(tf("soldToast", { pay: payAmount, ticker: token.ticker, receive: receiveAmount, unit }));
        setTimeout(() => setBalanceRefreshTick((n) => n + 1), 4000);
      } catch (err) {
        showToast(t("txCancelled"));
      }
    }
  }
  return (
    <div style={{ background: T.bg, height, minHeight: height, width: "100%", maxWidth: 480, margin: "0 auto", fontFamily: bodyFont, position: "relative", overflow: "hidden" }}>
      <GlobalStyle />
      <CyberGrid />
      <Toast toast={toast} insetTop={insetTop} />

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
        connected={connected}
        insetBottom={insetBottom}
        insetTop={insetTop}
        onConnectWallet={() => tonConnectUI.openModal()}
        onDisconnectWallet={() => tonConnectUI.disconnect()}
        onCopyAddress={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(walletAddress).catch(() => {});
          showToast(t("addressCopied"));
        }}
        onOpenEditProfile={openEditProfile}
        profile={profile}
        showToast={showToast}
        onTogglePin={handleTogglePin}
        onChangePin={requestChangePin}
        accountCreated={accountCreated}
        onDeleteAccount={deleteAccountForever}
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
      <TradeModal t={token} tradeModal={tradeModal} onClose={() => setTradeModal(null)} onConfirm={confirmTrade} walletTonBalance={tonBalance} tonPriceUsd={tonPriceUsd} heldAmount={holdings[token?.id] || 0} />
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
        <div className="no-scrollbar px-4" style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingTop: insetTop + 56, paddingBottom: 116 + insetBottom }} key={view}>
          {view === "home" && <HomeView onGoTab={goTab} />}
          {view === "mempad" && <MempadView tokens={tokens} loading={tokensLoading} myTokens={communityTokens} onOpen={openToken} onLaunch={() => goTab("create")} />}
          {view === "shop" && <ShopView />}
          {view === "token" && <TokenDetail t={token} onBack={backFromToken} showToast={showToast} onBuy={handleBuy} onSell={handleSell} unlocked={accountCreated && connected} connected={connected} onConnectWallet={() => setConnectModalOpen(true)} themeKey={appSettings.theme} />}
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
              onGoCreate={() => goTab("create")}
              onOpenToken={openToken}
              myTokens={myTokens}
              onClearAllTokens={clearAllMyTokens}
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
            { id: "create", label: t("navCreate"), icon: PlusCircle, locked: !(accountCreated && connected) },
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
