// Orchestrator: desktop/window → hidden DOM iPod → 3D exploded-view intro → handoff → linktree.
// The intro (three.js) is a lazily loaded chunk: the desktop and the hidden iPod mount without
// waiting for it. Without WebGL, or if the intro fails in any way, the iPod is revealed directly.
import './base.css';
import { loadConfig, prefersReducedMotion } from './shared/config.js';
import { createDesktop } from './window/index.js';
import { mountIpod } from './ipod/index.js';

const params = new URLSearchParams(location.search);
// test hooks (window.__ipod / window.__intro) only in dev or with ?debug
const DEBUG = import.meta.env.DEV || params.has('debug');
const app = document.getElementById('app');

/** WebGL 2 probe (the intro renders with WebGL 2). The probe context is released right away. */
function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function showConfigError() {
  const desktop = createDesktop(app, { config: { brand: { windowTitle: 'iPod' } } });
  const box = document.createElement('div');
  box.className = 'app-error';
  box.setAttribute('role', 'alert');
  const title = document.createElement('strong');
  title.textContent = 'Die Inhalte konnten gerade nicht geladen werden.';
  const text = document.createElement('p');
  text.textContent = 'Bitte lade die Seite in einem Moment neu.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Neu laden';
  retry.addEventListener('click', () => location.reload());
  box.append(title, text, retry);
  desktop.contentEl.append(box);
}

/** "Intro überspringen" (button + Esc) for as long as the intro runs. */
function createSkipControl(onSkip) {
  const btn = document.createElement('button');
  btn.className = 'intro-skip';
  btn.type = 'button';
  btn.textContent = 'Intro überspringen';
  btn.addEventListener('click', onSkip);
  const onKey = (e) => { if (e.key === 'Escape') onSkip(); };
  window.addEventListener('keydown', onKey);
  document.body.prepend(btn); // first Tab stop
  return () => {
    window.removeEventListener('keydown', onKey);
    btn.remove(); // a focused button drops focus to <body>; main() then focuses the iPod
  };
}

// how long the intro chunk may take before the iPod is revealed without it
const INTRO_CHUNK_MS = 6000;

let usedKeyboard = false;
const noteKeyboard = () => { usedKeyboard = true; };
window.addEventListener('keydown', noteKeyboard, true);

async function main() {
  // start the intro chunk download immediately, in parallel with config.json
  const webgl = hasWebGL2();
  let introModP = webgl ? import('./intro/index.js') : null;
  introModP?.catch(() => {}); // handled where it is awaited

  let config;
  try {
    config = await loadConfig();
    if (!config || typeof config !== 'object') throw new Error('config.json: no object');
  } catch {
    showConfigError();
    return;
  }

  const brand = config.brand ?? {};
  if (brand.name) document.title = `${brand.name} · Links`;
  const introOff = [false, 'never', 'off'].includes(config.settings?.intro);
  if (introOff) introModP = null;

  // "Links" in the menu bar brings the main menu up, and restoring or a press on the metal focuses the
  // iPod's key target (ipod is assigned before any click can happen)
  const desktop = createDesktop(app, { config, onLinks: () => ipod.home(), onFocus: () => ipod.focus() });
  const ipod = mountIpod(desktop.contentEl, { config });
  if (DEBUG) window.__ipod = ipod;

  let intro = null;
  if (introModP) {
    desktop.setInteractive(false);
    let skipped = false;
    let onSkipped;
    const skipP = new Promise((r) => { onSkipped = r; });
    const removeSkip = createSkipControl(() => { skipped = true; onSkipped(); intro?.skip(); });
    try {
      // a skip, or a chunk that is slow or stalls, must not keep the iPod hidden: whatever comes
      // first wins, and a chunk that lands after that is ignored
      const mod = await Promise.race([introModP, skipP, new Promise((r) => setTimeout(r, INTRO_CHUNK_MS))]);
      if (!skipped && mod?.runIntro) {
        const { runIntro } = mod;
        intro = runIntro({ getTargetRect: () => ipod.getShellRect(), reducedMotion: prefersReducedMotion(), config });
        if (DEBUG) window.__intro = intro;
        // safety net: a render loop that died must never leave the iPod hidden
        const watchdog = setTimeout(() => intro.skip(), ((intro.duration || 0) * 3 + 12) * 1000);
        await intro.done;
        clearTimeout(watchdog);
      }
    } catch {
      // intro chunk failed to load or the intro threw: reveal the iPod directly
      try { intro?.dispose(); } catch { /* already gone */ }
      intro = null;
    }
    removeSkip();
  }

  await ipod.reveal({ boot: true });
  try { intro?.dispose(); } catch { /* already gone */ }
  desktop.setInteractive(true);
  // the iPod listens for keys on its own element: focus it so ↑/↓/Enter/Esc work right away.
  // Without prior keyboard use this focus must not draw the ring (the iPod's own pointer state
  // hides it; Tab switches the ring back on).
  // (a click on the window during the intro leaves focus on the window itself: tabIndex -1)
  const active = document.activeElement;
  if (!active || active === document.body || active.tabIndex < 0) {
    if (!usedKeyboard) ipod.el.dataset.input = 'pointer';
    ipod.el.focus({ preventScroll: true, focusVisible: usedKeyboard });
  }
  window.removeEventListener('keydown', noteKeyboard, true);
}

main().catch(() => {
  // last resort: never leave a blank page
  if (!app.childElementCount) showConfigError();
});
