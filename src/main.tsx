import React from "react";
import ReactDOM from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import TonLaunchApp from "./App";
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
  // закрытия). Из-за него из-под интерфейса видно чёрный фон Telegram,
  // поэтому вертикальные свайпы выключаем — метод появился в Bot API
  // 7.7, в старых клиентах его просто нет.
  tg.disableVerticalSwipes?.();
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
        <TonLaunchApp />
      </TonConnectUIProvider>
    </React.StrictMode>
  );
} catch (err) {
  showFatalError(err);
}
