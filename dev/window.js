// Dev harness: desktop + window with a grey placeholder where the iPod goes.
import '../src/base.css';
import { loadConfig } from '../src/shared/config.js';
import { createDesktop } from '../src/window/index.js';
const config = await loadConfig(new URL('../config.json', location.href).href);
const desktop = createDesktop(document.getElementById('app'), { config });
const ph = document.createElement('div');
ph.style.cssText = 'height:var(--ipod-h);aspect-ratio:61.8/103.5;background:#c8cbcf;border-radius:12px';
desktop.contentEl.append(ph);
window.__desktop = desktop;
