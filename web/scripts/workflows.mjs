import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const base = process.env.SMOKE_URL ?? "http://127.0.0.1:7100";
const remote = process.env.SMOKE_API_MODE === "remote";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
const open = async (route) => { await page.goto(`${base}${route}`, { waitUntil: "networkidle" }); await page.waitForTimeout(180); assert.equal(await page.getByText("Не удалось загрузить данные", { exact: true }).count(), 0, `${route} has no error state`); };
const actor = async (id, route) => { await page.evaluate((actorId) => localStorage.setItem("mgts.hr.actor", actorId), id); await open(route); };

await open("/surveys");
await page.getByRole("button", { name: "Создать анкету", exact: true }).first().click();
await page.getByLabel("Название", { exact: true }).fill("Smoke · контрольная волна");
await page.getByRole("button", { name: "Создать черновик" }).click();
await page.waitForURL(/\/surveys\/[^/]+$/);
await page.getByRole("button", { name: "Добавить вопрос", exact: true }).click();
await page.getByRole("button", { name: "Сохранить", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
await page.waitForTimeout(300);
assert.ok(await page.getByRole("button", { name: "Опубликована", exact: true }).count());
await page.getByRole("button", { name: "Назначение", exact: true }).click();
await page.getByLabel("Программа, поток или стажировки").fill("i-1");
await page.getByRole("button", { name: "Назначить аудиторию" }).click();
await page.waitForTimeout(300);
console.log("OK survey create/edit/save/publish/assign");

await open("/feedback");
await page.getByRole("button", { name: "Запросить", exact: true }).click();
await page.getByRole("button", { name: "Отправить запрос" }).click();
await page.waitForTimeout(250);
assert.ok(await page.getByText("Запросы отзывов").count());
await page.getByRole("button", { name: "Написать отзыв", exact: true }).click();
await page.getByLabel("Основной текст").fill("Smoke: конкретный результат и наблюдаемый вклад в командную задачу.");
await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
await page.waitForTimeout(300);
assert.ok(await page.getByText(/Smoke: конкретный результат/).first().count());
console.log("OK feedback request/create/publish");

await open("/reviews");
await page.getByRole("button", { name: "Новое review" }).click();
await page.getByLabel("Результаты, вклад и следующий шаг").fill("Smoke review: измеримый результат, личный вклад и следующий шаг.");
await page.getByRole("button", { name: "Создать черновик" }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Сохранить", exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Анализ AI" }).click();
await page.waitForTimeout(250);
assert.ok(await page.getByText("AI-разбор").count());
await page.getByRole("button", { name: "Провести калибровку" }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Объявить результат" }).click();
await page.waitForTimeout(250);
assert.ok(await page.getByText(/Результат доступен стажёру/).count());
console.log("OK review create/save/AI/calibrate/announce");

await open("/diagnostics");
await page.getByRole("button", { name: "Запустить", exact: true }).click();
await page.getByRole("button", { name: "Запустить и пригласить" }).click();
await page.waitForTimeout(250);
const complete = page.getByRole("button", { name: "Сформировать результат" }).first();
if (await complete.count()) await complete.click();
else assert.ok(await page.getByRole("button", { name: "Открыть результат" }).first().count());
console.log("OK diagnostics quorum/result");

await open("/development");
await page.getByRole("button", { name: "Добавить цель", exact: true }).click();
await page.getByLabel("Цель", { exact: true }).fill("Smoke цель развития");
await page.getByLabel("Критерий и способ достижения").fill("Проверяемый результат end-to-end сценария");
await page.getByRole("button", { name: "Добавить в план" }).click();
await page.waitForTimeout(300);
const goal = page.locator("section").filter({ hasText: "Smoke цель развития" }).last();
await goal.getByRole("button", { name: "Завершить" }).click();
await page.waitForTimeout(250);
console.log("OK development add/complete goal");

await open("/ai");
await page.getByRole("button", { name: "Редактор текста" }).click();
await page.getByRole("button", { name: "Создать новую версию" }).click();
await page.waitForTimeout(250);
assert.ok(await page.getByText(remote ? /Уточнение:/ : /Конкретный результат подтверждён/).first().count());
console.log("OK AI edit");

await open("/integrations");
await page.getByRole("button", { name: "Синхронизировать", exact: true }).first().click();
await page.waitForTimeout(300);
assert.ok(await page.getByText(/синхронизация завершена/i).first().count());
console.log("OK integration sync/journal");

await open("/settings");
const visibility = page.getByRole("switch", { name: "Показывать стажёру отзывы о нём" });
if (await visibility.getAttribute("aria-checked") === "true") await visibility.click();
await page.getByRole("button", { name: "Сохранить настройки" }).click();
await page.waitForTimeout(250);
await actor("a-intern", "/me");
assert.ok(await page.getByText("Опубликованные отзывы скрыты или ещё не получены").count());
console.log("OK show_feedback_to_intern=false hides feedback");

await actor("a-manager", "/interns");
assert.equal(await page.locator("tbody tr").count(), remote ? 4 : 3, "manager sees own team");
await actor("a-mentor", "/interns");
assert.equal(await page.locator("tbody tr").count(), remote ? 3 : 2, "mentor sees assigned interns");
await actor("a-intern", "/interns");
assert.ok(await page.getByText("Недостаточно прав").count());
console.log("OK manager/mentor/intern scopes");

await actor("a-hr", "/settings");
const restore = page.getByRole("switch", { name: "Показывать стажёру отзывы о нём" });
if (await restore.getAttribute("aria-checked") === "false") { await restore.click(); await page.getByRole("button", { name: "Сохранить настройки" }).click(); }
await open("/dashboard");
await page.keyboard.press("Control+K");
await page.getByText("Тёмная тема", { exact: true }).click();
await page.waitForTimeout(200);
assert.ok(await page.locator("html.dark").count(), "command palette switches theme");
console.log("OK command palette/theme");

await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`WORKFLOWS PASS (${remote ? "remote Go" : "mock"}): primary mutations, RBAC scopes, settings, palette`);
