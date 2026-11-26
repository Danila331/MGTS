import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.SMOKE_URL ?? "http://127.0.0.1:7100";
const out = new URL("../../.runtime/ux-final/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
const open = async (route) => { await page.goto(`${base}${route}`, { waitUntil: "networkidle" }); await page.waitForTimeout(250); };
const shot = async (name) => { await page.screenshot({ path: `${out}${name}.png`, fullPage: true }); console.log(`SHOT ${name}`); };
const resetScroll = () => page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("main > div").forEach((element) => { element.scrollTop = 0; }); });

await open("/signals");
const first = page.locator('section[aria-label="Очередь сигналов"] ul li button').first();
assert.ok(await first.getByText("Критичный", { exact: true }).count(), "critical signal is first");
assert.equal(await first.getAttribute("aria-current"), "true", "first sorted signal is selected");
console.log("OK sorted first signal");

for (const route of ["dashboard", "signals", "reviews"]) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(`/${route}`);
  if (route === "reviews") { await page.getByRole("button").filter({ hasText: "Откалиброван" }).first().click(); await resetScroll(); }
  await shot(`${route}-desktop`);
  await page.setViewportSize({ width: 375, height: route === "reviews" ? 1400 : 812 });
  await open(`/${route}`);
  if (route === "reviews") { await page.getByRole("button").filter({ hasText: "Откалиброван" }).first().click(); await resetScroll(); }
  if (route === "dashboard") {
    const queue = await page.getByRole("heading", { name: "Очередь внимания" }).boundingBox();
    const chart = await page.getByRole("heading", { name: "Динамика измерений" }).boundingBox();
    assert.ok(queue && chart && queue.y < chart.y, "mobile queue precedes chart");
    const columns = await page.locator("section.grid.grid-cols-2").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    assert.equal(columns, 2, "mobile KPI has two columns");
  }
  const small = await page.locator("button:visible:not([data-nextjs-dev-tools-button]), a:visible, select:visible, summary:visible").evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width < 43.5 || rect.height < 43.5 ? [{ tag: element.tagName, text: element.textContent?.trim().slice(0, 60), aria: element.getAttribute("aria-label"), html: element.outerHTML.slice(0, 220), width: rect.width, height: rect.height }] : [];
  }));
  assert.deepEqual(small, [], `${route} mobile targets are at least 44px`);
  await shot(`${route}-mobile`);
  console.log(`OK ${route} mobile order/targets`);
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`UX SCREENSHOTS PASS: ${out}`);
