import React from "react";
import ReactDOM from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import TonLaunchApp from "./App";
import Desktop from "./Desktop";
import { разобратьВозвратOAuth } from "./oauthВозврат";
import "./index.css";

// Показываем текст ошибки прямо на экране, если что-то сломается —
// это временная диагностика, чтобы увидеть проблему без консоли разработчика.
function showFatalError(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack || ""}` : String(err);
  const el = document.createElement("pre");
  el.style.cssText = "background:#1a0000;color:#ff8080;padding:16px;font-size:12px;white-space:pre-wrap;word-break:break-word;position:fixed;inset:0;overflow:auto;z-index:99999;margin:0;";
  el.textContent = "ОШИБКА ЗАГРУЗКИ ПРИЛОЖЕНИЯ:\n\n" + msg;
  document.body.appendChild(el);
}
window.addEventListener("error", (e) => showFatalError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showFatalError(e.reason));

const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  // Свайп вниз по мини-приложению по умолчанию тянет всё окно (жест
  // закрытия). Посреди списка это мешает — из-под интерфейса видно
  // чёрный фон Telegram, — поэтому по умолчанию жест выключен. Но и
  // насовсем выключать его нельзя: закрывают приложение именно им, и с
  // запретом окно на потягивание только вздрагивало.
  //
  // Разводим по месту: пока есть куда прокручивать — жест наш, список
  // едет плавно; список стоит в самом верху — жест отдаём Telegram, и
  // приложение закрывается как обычно. Решение принимается в момент
  // касания, до первого движения пальца.
  tg.disableVerticalSwipes?.();

  if (tg.disableVerticalSwipes && tg.enableVerticalSwipes) {
    let отдан = false;
    const отдать = (кому: boolean) => {
      if (кому === отдан) return;
      отдан = кому;
      try { кому ? tg.enableVerticalSwipes() : tg.disableVerticalSwipes(); } catch { /* старый клиент */ }
    };
    // Ближайший предок, который действительно прокручивается: у самого
    // элемента под пальцем прокрутки может не быть вовсе.
    const вВерху = (эл: Element | null) => {
      for (let у: Element | null = эл; у && у !== document.body; у = у.parentElement) {
        const с = getComputedStyle(у);
        if (/(auto|scroll)/.test(с.overflowY) && у.scrollHeight - у.clientHeight > 4) return у.scrollTop <= 0;
      }
      return (window.scrollY || 0) <= 0;
    };
    document.addEventListener(
      "touchstart",
      (e) => {
        const цель = e.target;
        отдать(цель instanceof Element ? вВерху(цель) : true);
      },
      { passive: true, capture: true }
    );
  }
}

// iOS игнорирует user-scalable=no, поэтому щипок гасим сами.
//
// Двойной тап раньше гасился здесь же: любой touchend в пределах 350 мс
// после предыдущего отменялся. Это отменяло и сам клик — при быстрых
// нажатиях подряд (например по предметам в магазине) второе нажатие
// просто не доходило до интерфейса, и казалось, что выбор не срабатывает.
// Масштабирование по двойному тапу выключает touch-action: manipulation
// в стилях, и делает это не ломая нажатия.
if (typeof document !== "undefined") {
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend", (e) => e.preventDefault());

  // Щипок в Android-обёртке приходит не жестом, а двумя касаниями: там
  // gesture-события не срабатывают вовсе, и страницу удавалось растянуть
  // и увести вбок. Вернуть её обратно человеку нечем — в Telegram нет
  // адресной строки, чтобы перезагрузить, — поэтому глушим на входе.
  const мультитач = (e) => {
    if (!e.touches || e.touches.length <= 1) return;
    // График живёт по своим правилам: щипок там — это масштаб свечей, а
    // не страницы. Он помечает себя сам, и внутри него жест не трогаем —
    // иначе в Telegram двумя пальцами не приблизить график.
    const цель = e.target;
    if (цель && цель.closest && цель.closest('[data-chart="1"]')) return;
    e.preventDefault();
  };
  // Гасим с самого касания: к moveу браузер уже решил, что начинается
  // масштабирование, и отменять бывает поздно.
  document.addEventListener("touchstart", мультитач, { passive: false, capture: true });
  document.addEventListener("touchmove", мультитач, { passive: false, capture: true });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

  // Тот же щипок на трекпаде и мыши с Ctrl — в десктопном Telegram.
  document.addEventListener("wheel", (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  // Если страницу всё же сдвинули (например обёрткой), возвращаем её
  // к левому краю: перекошенный экран сам собой не выправляется.
  window.addEventListener("scroll", () => {
    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
  }, { passive: true });
}

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

/* Мини-приложение рассчитано на телефон в Telegram, витрина — на монитор.
   Внутри Telegram всегда показываем мини-приложение, даже на широком
   экране десктопного клиента: там свои жесты, отступы и кнопка «назад».
   Снаружи — витрина, если экран действительно большой; «/pro» и «/app»
   позволяют выбрать вручную. */
function десктопнаяВитрина() {
  const путь = window.location.pathname.replace(/\/+$/, "");
  if (путь === "/app") return false;
  if (путь === "/pro") return true;
  if (tg && tg.initData) return false;
  return window.innerWidth >= 1100 && !("ontouchstart" in window && window.innerWidth < 1400);
}

const Корень = десктопнаяВитрина() ? Desktop : TonLaunchApp;

function нарисовать() {
  try {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <TonConnectUIProvider
          manifestUrl={manifestUrl}
          actionsConfiguration={{
            // Внутри Telegram окно кошелька закрывалось раньше, чем по нему
            // успевали нажать. Без указанной стратегии возврата TonConnect
            // не знает, куда возвращать человека после подписи, и сворачивает
            // своё окно само.
            returnStrategy: "back",
            skipRedirectToWallet: "never",
          }}
        >
          <Корень />
        </TonConnectUIProvider>
      </React.StrictMode>
    );
  } catch (err) {
    showFatalError(err);
  }
}

/* Сначала разбираем возврат от Google, потом рисуем: иначе приложение
   успевает решить, что человек не вошёл, и показывает форму входа поверх
   уже состоявшегося входа. Отрисовку не блокируем ошибкой обмена — без
   сессии сайт всё равно должен открыться. */
разобратьВозвратOAuth().catch(() => {}).then(нарисовать);
