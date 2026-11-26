import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:7100';
const outDir = process.env.SCREENSHOT_DIR || path.resolve('.runtime/screenshots');
const routes = (process.env.ROUTES || '/dashboard,/interns,/surveys,/signals,/reviews,/me,/ai').split(',');
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 375, height: 812 },
];

let playwright;
try {
  playwright = await import(path.resolve('node_modules/playwright/index.mjs'));
} catch {
  try {
    playwright = await import(path.resolve('node_modules/@playwright/test/index.mjs'));
  } catch {
    console.error('Install playwright in web/ before running visual-check.');
    process.exit(1);
  }
}

await mkdir(outDir, { recursive: true });
const browser = await playwright.chromium.launch({ headless: true });
const failures = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  for (const route of routes) {
    const name = route === '/' ? 'home' : route.replaceAll('/', '-').replace(/^-/, '');
    const url = new URL(route, baseURL).toString();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      if (response && response.status() >= 400) {
        failures.push(`${route}: HTTP ${response.status()}`);
      }
      await page.screenshot({
        path: path.join(outDir, `${name}-${viewport.name}.png`),
        fullPage: true,
      });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) failures.push(`${route} (${viewport.name}): horizontal overflow`);
      if (errors.length) failures.push(`${route} (${viewport.name}): ${errors.join('; ')}`);
      console.log(`captured ${route} (${viewport.name})`);
    } catch (error) {
      failures.push(`${route} (${viewport.name}): ${error.message}`);
    }
  }
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Visual smoke passed. Screenshots: ${outDir}`);
