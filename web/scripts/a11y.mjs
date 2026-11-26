import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.SMOKE_URL ?? "http://127.0.0.1:7100";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const failures = [];
for (const route of ["/dashboard", "/interns", "/signals", "/surveys/sv-1/take", "/settings"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = result.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""));
  if (serious.length) failures.push({ route, violations: serious.map((item) => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) })) });
  console.log(`${serious.length ? "FAIL" : "OK"} ${route}: ${serious.length} serious/critical violations`);
}
await browser.close();
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log("A11Y PASS: WCAG 2 A/AA serious and critical checks");
