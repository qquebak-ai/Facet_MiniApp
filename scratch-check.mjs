import { chromium } from "playwright-core";
const бр = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const с = await бр.newPage({ viewport: { width: 420, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const ош = [];
с.on("pageerror", (e) => ош.push(String(e)));
await с.goto("http://localhost:4173/", { waitUntil: "domcontentloaded" });
await с.waitForTimeout(11000);
const мимо = с.getByText("Продолжить без входа");
if (await мимо.count()) { await мимо.first().click(); await с.waitForTimeout(2500); }
await с.screenshot({ path: "/tmp/claude-0/home.png" });
const баннер = с.locator('[aria-label="Открыть мемпад"]');
console.log("баннер найден:", await баннер.count());
if (await баннер.count()) {
  await баннер.first().click();
  await с.waitForTimeout(1500);
  await с.screenshot({ path: "/tmp/claude-0/after.png" });
  console.log("после нажатия заголовок Мемпад:", await с.getByRole("heading", { name: "Мемпад" }).count());
}
console.log("ошибок:", ош.length, ош.slice(0, 2).join(" | "));
await бр.close();
