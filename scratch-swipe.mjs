import { chromium } from "playwright-core";
const бр = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const с = await бр.newPage({ viewport: { width: 420, height: 860 }, isMobile: true, hasTouch: true });
await с.addInitScript(() => {
  window.__свайпы = [];
  window.Telegram = { WebApp: {
    ready() {}, expand() {}, onEvent() {}, offEvent() {}, isFullscreen: false,
    initData: "", initDataUnsafe: {}, themeParams: {}, colorScheme: "dark",
    requestFullscreen() {},
    disableVerticalSwipes() { window.__свайпы.push("выкл"); },
    enableVerticalSwipes() { window.__свайпы.push("вкл"); },
  } };
});
const ош = [];
с.on("pageerror", (e) => ош.push(String(e)));
await с.goto("http://localhost:4173/", { waitUntil: "domcontentloaded" });
await с.waitForTimeout(11000);
const мимо = с.getByText("Продолжить без входа");
if (await мимо.count()) { await мимо.first().click(); await с.waitForTimeout(3000); }
await с.evaluate(() => {
  const э = document.querySelector(".подложка");
  const д = document.createElement("div");
  д.style.height = "2000px";
  э && э.appendChild(д);
});
await с.waitForTimeout(300);
console.log("прокрутка есть:", await с.evaluate(() => {
  const э = document.querySelector(".подложка");
  return э ? э.scrollHeight - э.clientHeight : null;
}));
const проба = async (y, подпись) => {
  await с.evaluate(() => { window.__свайпы = []; });
  await с.touchscreen.tap(210, y);
  await с.waitForTimeout(200);
  const л = await с.evaluate(() => window.__свайпы);
  console.log(подпись, "y=" + y, "→", л.length ? л.join(",") : "без изменений");
};
await проба(40, "верхняя полоса");
await проба(500, "середина списка");
await проба(60, "верхняя полоса");
await проба(700, "низ списка");
await с.evaluate(() => {
  const г = document.createElement("div");
  г.setAttribute("data-chart", "1");
  г.style.cssText = "position:fixed;left:0;top:0;width:100%;height:80px;z-index:9999";
  document.body.appendChild(г);
});
await проба(40, "график в верхней полосе");
console.log("ошибок:", ош.length, ош.slice(0, 2).join(" | "));
await бр.close();
