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
