/**
 * Exports the app icons from the dev "brand" sheet (src/brand/BrandScreen.tsx) into assets/.
 * Needs the web dev server running (`pnpm --filter @dozari/mobile exec expo start --web --port 8081`) and a
 * Chromium that playwright-core can launch: CHROME_PATH=/path/to/chrome node scripts/export-brand.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.APP_URL ?? 'http://localhost:8081/';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('Set CHROME_PATH to a Chromium/Chrome executable');
mkdirSync('assets', { recursive: true });

// [element id, output file, transparent background?]
const OUT = [
  ['brand-icon', 'assets/icon.png', false],
  ['brand-android-fg', 'assets/adaptive-icon.png', true],
  ['brand-android-bg', 'assets/adaptive-background.png', false],
  ['brand-mono', 'assets/adaptive-monochrome.png', true],
  ['brand-notification', 'assets/notification-icon.png', true],
  ['brand-favicon', 'assets/favicon.png', true],
  ['brand-logo-stacked', 'assets/logo-stacked.png', true],
  ['brand-logo-light', 'assets/logo-light.png', false],
];

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
await page.goto(URL);
await page.waitForTimeout(9000); // splash
await page.locator('[role=button]').nth(1).click(); // gallery
await page.waitForTimeout(1500);
await page.getByText('برند و آیکن اپ').click();
await page.waitForTimeout(2500);

// the Expo dev-tools button floats above the page and would end up in the screenshots
await page.evaluate(() => {
  const root = document.getElementById('root');
  document.querySelectorAll('body *').forEach((n) => {
    if (root?.contains(n)) return;
    if (getComputedStyle(n).position === 'fixed') n.remove();
  });
});

for (const [id, file, transparent] of OUT) {
  const el = page.locator(`#${id}`);
  await el.scrollIntoViewIfNeeded();
  if (transparent) {
    await el.evaluate((node) => {
      for (let n = node; n; n = n.parentElement) n.style.background = 'transparent';
    });
  }
  await el.screenshot({ path: file, omitBackground: transparent });
  console.log('wrote', file);
}
await browser.close();
