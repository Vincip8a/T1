// Capture frames of the exploded-view intro at given times via the window.__intro test hook.
//   node scripts/intro-frames.mjs <url> <outDir> [--times 0,0.5,1,...] [--w 1440 --h 900] [--mobile]
// Requires the page to expose window.__intro = { duration, seek(t), pause() } (see CONTRACT.md).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, parseArgs, collectErrors } from './browser.mjs';

const { pos, opts } = parseArgs(process.argv.slice(2));
const [url, outDir] = pos;
if (!url || !outDir) {
  console.error('usage: node scripts/intro-frames.mjs <url> <outDir> [--times 0,1,2] [--w W --h H --mobile]');
  process.exit(1);
}
const mobile = !!opts.mobile;
const browser = await launch();
const page = await browser.newPage({
  viewport: { width: Number(opts.w ?? (mobile ? 390 : 1440)), height: Number(opts.h ?? (mobile ? 844 : 900)) },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
});
const errors = collectErrors(page);
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__intro && typeof window.__intro.seek === 'function', null, { timeout: 15000 });
await page.evaluate(() => window.__intro.pause());
const duration = await page.evaluate(() => window.__intro.duration);
const times = opts.times
  ? String(opts.times).split(',').map(Number)
  : Array.from({ length: 9 }, (_, i) => +(duration * i / 8).toFixed(2));
mkdirSync(outDir, { recursive: true });
for (const t of times) {
  await page.evaluate((tt) => window.__intro.seek(tt), t);
  await page.waitForTimeout(250);
  const file = join(outDir, `t${String(t.toFixed(2)).padStart(5, '0')}.png`);
  await page.screenshot({ path: file });
  console.log(`saved ${file}`);
}
console.log(`duration=${duration}s`);
await browser.close();
if (errors.length) console.log(errors.join('\n'));
