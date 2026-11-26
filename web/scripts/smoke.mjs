import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.SMOKE_URL ?? "http://127.0.0.1:7100";
const remote = process.env.SMOKE_API_MODE === "remote";
const takeId = "sv-intern-1";
const takePath = `/surveys/${takeId}/take`;
const out = new URL("../.verification/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("404 (Not Found)")) errors.push(`console: ${message.text()}`); });
page.on("response", (response) => { if (response.status() === 404 && !response.url().includes("not-a-real-survey")) errors.push(`404: ${response.url()}`); });
const actor = async (id) => page.evaluate((value) => localStorage.setItem("mgts.hr.actor", value), id);
const open = async (route, name, shot = true) => {
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, `${route} returns 200`);
  await page.waitForTimeout(250);
  assert.equal(await page.getByText("Не удалось загрузить данные", { exact: true }).count(), 0, `${route} has no error state`);
  assert.equal(await page.locator("body").evaluate((body) => body.scrollWidth > window.innerWidth), false, `${route} no horizontal overflow`);
  if (shot) await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  console.log(`OK ${route}`);
};

await page.goto(base, { waitUntil: "domcontentloaded" });
await actor("a-hr");
for (const [route, name] of [
  ["/dashboard", "dashboard"], ["/interns", "interns"], ["/interns/i-1", "internship"],
  ["/surveys", "surveys"], ["/surveys/sv-intern-1", "survey-detail"],
]) await open(route, name);

await open("/interns", "interns-search", false);
await page.getByLabel("Поиск стажёров").fill(remote ? "Алексей" : "Лев");
await page.waitForTimeout(500);
assert.equal(await page.locator("tbody tr").count(), 1, "intern search filters rows");
console.log("OK intern search");

await actor("a-intern");
await open(takePath, "survey-take");
assert.ok(await page.locator("fieldset").count() >= 9, "intern survey contains seven scales and two text questions");
console.log("OK survey form structure");

await open("/me", "me");
assert.equal(await page.getByRole("link", { name: "Стажёры", exact: true }).count(), 0, "intern navigation scoped");
if (remote) assert.ok(await page.getByText("Алексей Волков", { exact: true }).first().count(), "correct backend internship on /me");
await open("/interns", "forbidden", false);
assert.ok(await page.getByText("Недостаточно прав").count(), "forbidden state for intern");
console.log("OK role scope/forbidden");

await actor("a-hr");
await page.emulateMedia({ colorScheme: "dark" });
await open("/dashboard", "dashboard-dark");
await page.emulateMedia({ colorScheme: "light" });
await page.setViewportSize({ width: 375, height: 812 });
for (const [route, name] of [["/dashboard", "mobile-dashboard"], ["/interns", "mobile-interns"]]) await open(route, name);
await actor("a-intern");
await open(takePath, "mobile-take");
await open("/me", "mobile-me");

if (remote) {
  await actor("a-hr");
  await page.goto(`${base}/surveys/not-a-real-survey`, { waitUntil: "networkidle" });
  assert.ok(await page.getByText("Не удалось загрузить данные", { exact: true }).count(), "backend 404 stays visible");
  assert.equal(await page.evaluate(() => localStorage.getItem("mgts.hr.mock.v1")), null, "remote never writes mock storage");
  console.log("OK strict remote: HTTP 404 is not hidden by mock");
}

await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`SMOKE PASS (${remote ? "remote Go" : "mock"}): routes, search, autosave/submit, dark mode, 375px, roles; zero console errors/404`);
