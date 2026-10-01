// Shared headless-Chromium launcher with software WebGL (SwiftShader) so Three.js renders in CI/containers.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const CANDIDATES = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);

export async function launch() {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
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
