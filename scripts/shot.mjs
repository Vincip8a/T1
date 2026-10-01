// Screenshot a page.
//   node scripts/shot.mjs <url> <out.png> [--w 1440] [--h 900] [--wait 1500] [--eval "js"] [--mobile] [--dpr 1]
// --eval runs in the page after the wait, then waits 300 ms more. Prints console errors.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { launch, parseArgs, collectErrors } from './browser.mjs';

const { pos, opts } = parseArgs(process.argv.slice(2));
const [url, out] = pos;
if (!url || !out) {
  console.error('usage: node scripts/shot.mjs <url> <out.png> [--w W --h H --wait MS --eval JS --mobile --dpr N]');
  process.exit(1);
}
const mobile = !!opts.mobile;
const width = Number(opts.w ?? (mobile ? 390 : 1440));
const height = Number(opts.h ?? (mobile ? 844 : 900));

const browser = await launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: Number(opts.dpr ?? (mobile ? 2 : 1)),
  isMobile: mobile,
  hasTouch: mobile,
});
const errors = collectErrors(page);
try {
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(Number(opts.wait ?? 1500));
if (opts.eval) {
  await page.evaluate(opts.eval);
  await page.waitForTimeout(300);
}
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out, timeout: 90000 });
} finally {
  await browser.close(); // always close, so crashed runs don't leave Chromium burning CPU
}
console.log(`saved ${out}`);
if (errors.length) console.log(errors.join('\n'));
