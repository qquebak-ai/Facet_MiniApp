import React from "react";
import ReactDOM from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import TonLaunchApp from "./App";
import "./index.css";

// Telegram Mini Apps SDK — подключается тегом <script> в index.html.
// Если сайт открыт не внутри Telegram (например, в обычном браузере при
// разработке), window.Telegram будет undefined — это нормально, просто
// пропускаем инициализацию.
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand(); // разворачивает MiniApp на весь экран
}

// Ссылка на манифест TonConnect — файл лежит в public/, поэтому
// на собранном сайте он доступен по корневому пути /tonconnect-manifest.json
const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <TonLaunchApp />
    </TonConnectUIProvider>
  </React.StrictMode>
);
