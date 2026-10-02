// Shared headless-Chromium launcher with software WebGL (SwiftShader) so Three.js renders in CI/containers.
// Chromium is found like the asset tools find it (tools/lib/render.mjs): CHROME_PATH, then the
// Playwright browsers (PLAYWRIGHT_BROWSERS_PATH or its cache), then a system Chrome/Chromium.
import { chromium } from 'playwright';
import { findChromium } from '../tools/lib/render.mjs';

export async function launch() {
  // nothing found: Playwright's own default (needs `npx playwright install chromium`)
  const executablePath = await findChromium().catch(() => undefined);
  return chromium.launch({
    executablePath,
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
}

export function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) opts[key] = true;
      else { opts[key] = next; i++; }
    } else pos.push(a);
  }
  return { pos, opts };
}

/** Attach console/pageerror collectors; returns the array they push into. */
export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  return errors;
}
