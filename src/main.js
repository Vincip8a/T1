// Orchestrator: desktop/window → hidden DOM iPod → 3D exploded-view intro → handoff → linktree.
// The intro (three.js) is a lazily loaded chunk: the desktop and the hidden iPod mount without
// waiting for it. Without WebGL, or if the intro fails in any way, the iPod is revealed directly.
import './base.css';
import { loadConfig, prefersReducedMotion, introEnabled } from './shared/config.js';
import { createDesktop } from './window/index.js';
import { mountIpod } from './ipod/index.js';

const params = new URLSearchParams(location.search);
// test hooks (window.__ipod / window.__intro) only in dev or with ?debug
const DEBUG = import.meta.env.DEV || params.has('debug');
const app = document.getElementById('app');

/** WebGL 2 probe (the intro renders with WebGL 2). The probe context is released right away. The built
 *  page's preload script (vite.config.js) already probed: its answer is window.__gl2. */
function hasWebGL2() {
  if (typeof window.__gl2 === 'boolean') return window.__gl2;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// the intro plays once per browser session: coming back from the Impressum (or a reload) shows the iPod
// at once (vite.config.js's preload script reads the same key)
const INTRO_SEEN = 'ipodc-intro-seen';
const introSeen = () => { try { return sessionStorage.getItem(INTRO_SEEN) === '1'; } catch { return false; } };
const markIntroSeen = () => { try { sessionStorage.setItem(INTRO_SEEN, '1'); } catch { /* storage blocked */ } };

/** The desktop without content, for the config error window and while config.json is slow: the
 *  Impressum and Datenschutz links must stay reachable, so config.legal as it was at build time
 *  (vite.config.js defines __LEGAL__), else the static pages next to this one. */
function bareDesktop(windowTitle) {
  const legal = typeof __LEGAL__ === 'object' && __LEGAL__ ? __LEGAL__ : { impressum: 'impressum.html', datenschutz: 'datenschutz.html' };
  return createDesktop(app, { config: { brand: { windowTitle }, legal } });
}

/** The short German error in the window: in a desktop of its own, or (`desktop`) in the one that is up */
function showConfigError(desktop = bareDesktop('iPod')) {
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
  desktop.el.classList.remove('is-waiting');
  desktop.setInteractive(true);
  desktop.contentEl.replaceChildren(box);
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
    btn.remove(); // a focused button drops focus to <body>; main() then focuses the iPod at once
  };
}

// how long the intro chunk may take before the iPod is revealed without it
const INTRO_CHUNK_MS = 6000;
// how long the intro's setup (shaders, textures) may take: a device that needs longer could not play it
// smoothly either (the frame watch would cut it short), so the iPod comes without it. Not with the test
// hooks (dev, ?debug): software WebGL in a test browser is slow, and the hooks need the intro.
const INTRO_SETUP_MS = 4000;
// an empty desktop (wallpaper, menu bar, window with the spinner) while config.json takes this long
const SHELL_MS = 300;

let usedKeyboard = false;
const noteKeyboard = () => { usedKeyboard = true; };
window.addEventListener('keydown', noteKeyboard, true);

// what is on screen, for the last-resort error path below
let desktop = null;
let ipod = null;

async function main() {
  // The built index.html already fetches the intro chunk with <link rel="modulepreload"> while this
  // entry loads (vite.config.js, unless config.json turns the intro off), so it is imported only
  // once config.json says the intro plays: no download or evaluation for nothing.
  // A slow config.json gets the empty desktop with the spinner instead of a flat blue page.
  let shell = null;
  const shellT = setTimeout(() => {
    shell = bareDesktop('');
    shell.contentEl.append(Object.assign(document.createElement('div'), { className: 'dt-placeholder' }));
    shell.setInteractive(false);
    shell.el.classList.add('is-waiting');
  }, SHELL_MS);
  let config;
  try {
    config = await loadConfig(undefined, window.__configP); // index.html starts the fetch early
    if (!config || typeof config !== 'object') throw new Error('config.json: no object');
  } catch (err) {
    // the visitor sees the short note; the site owner gets the reason (HTTP status, JSON syntax error)
    console.error('[config] config.json could not be loaded:', err);
    clearTimeout(shellT);
    shell?.destroy();
    showConfigError();
    return;
  }
  clearTimeout(shellT);
  shell?.destroy(); // (the real desktop replaces it in the same task: no flash)

  const brand = config.brand ?? {};
  if (brand.name) document.title = `${brand.name} · Links`;
  // reduced motion: the intro would only fade in its last frame, which is the DOM iPod itself
  const introModP = introEnabled(config) && !introSeen() && !prefersReducedMotion() && hasWebGL2() ? import('./intro/index.js') : null;
  introModP?.catch(() => {}); // handled where it is awaited

  // "Links" in the menu bar brings the main menu up (while the intro runs it skips it: the iPod with its
  // links comes next), and restoring or a press on the metal focuses the iPod's key target (ipod and
  // skipIntro are assigned before any click can happen)
  let skipIntro = null;
  const onLinks = (e) => {
    skipIntro?.();
    ipod?.home({ keyboard: e?.detail === 0 }); // (before the reveal it waits for it; none after a failed start)
  };
  desktop = createDesktop(app, { config, onLinks, onFocus: () => ipod?.focus() });
  if (introModP) desktop.el.classList.add('is-waiting'); // before the iPod mounts: a throw there keeps it
  ipod = mountIpod(desktop.contentEl, { config });
  if (DEBUG) window.__ipod = ipod;

  let intro = null;
  let removeSkip = null;
  if (introModP) {
    desktop.setInteractive(false);
    let skipped = false;
    let onSkipped;
    const skipP = new Promise((r) => { onSkipped = r; });
    skipIntro = () => { skipped = true; onSkipped(); intro?.skip(); };
    removeSkip = createSkipControl(skipIntro);
    // (is-waiting: a quiet Aqua spinner in the empty window if the chunk takes a moment, after 600 ms)
    try {
      // a skip, or a chunk that is slow or stalls, must not keep the iPod hidden: whatever comes
      // first wins, and a chunk that lands after that is ignored
      const mod = await Promise.race([introModP, skipP, new Promise((r) => setTimeout(r, INTRO_CHUNK_MS))]);
      if (!skipped && mod?.runIntro) {
        const { runIntro } = mod;
        const win = desktop.contentEl.closest('.dt-win');
        intro = runIntro({
          getTargetRect: () => ipod.getShellRect(), getFrameRect: () => win?.getBoundingClientRect(),
          reducedMotion: prefersReducedMotion(), config,
        });
        markIntroSeen();
        // its setup runs as short tasks (the skip button keeps working, the spinner keeps turning);
        // the test hook and the watchdog below start once it has settled. A setup over its budget
        // ends the intro (the catch below reveals the iPod)
        let setupT = 0;
        const setupLate = DEBUG ? null : new Promise((_, reject) => {
          setupT = setTimeout(() => reject(new Error('intro setup too slow')), INTRO_SETUP_MS);
        });
        try { await Promise.race([intro.ready, intro.done, setupLate].filter(Boolean)); } finally { clearTimeout(setupT); }
        desktop.el.classList.remove('is-waiting');
        if (DEBUG) window.__intro = intro;
        // safety net: a render loop that died must never leave the iPod hidden. The race does not
        // rely on the intro at all; a late skip() only asks for the aligned frame (the canvas goes
        // with dispose() below either way)
        // (the intro watches its own frame rate and skips frames or hands off early, so its length plus a
        // margin is enough; a test hook that paused it on purpose keeps it)
        let watchdog = 0;
        const late = new Promise((r) => {
          const arm = () => { watchdog = setTimeout(() => (intro.paused ? arm() : r('late')), ((intro.duration || 0) + 6) * 1000); };
          arm();
        });
        if (await Promise.race([intro.done, late]) === 'late') {
          try { intro.skip(); } catch { /* render loop already broken */ }
        }
        clearTimeout(watchdog);
      }
    } catch {
      // intro chunk failed to load or the intro threw: reveal the iPod directly
      try { intro?.dispose(); } catch { /* already gone */ }
      intro = null;
    }
  }

  // the iPod shows (its boot screen) at once: it takes keyboard focus now, so a skip never leaves focus
  // on <body> for the length of the boot (keys act once the main menu is up)
  const revealed = ipod.reveal({ boot: true });
  if (introModP) {
    desktop.el.classList.remove('is-waiting');
    removeSkip(); // (a focused skip button drops focus to <body>, and in this same task it moves on below)
    skipIntro = null;
  }
  // the iPod listens for keys on its own element: focus it so ↑/↓/Enter/Esc work right away.
  // Without prior keyboard use this focus must not draw the ring (the iPod's own pointer state
  // hides it; Tab switches the ring back on).
  // (a click on the window during the intro leaves focus on the window itself: tabIndex -1)
  const active = document.activeElement;
  if (!active || active === document.body || active.tabIndex < 0) {
    if (!usedKeyboard) ipod.el.dataset.input = 'pointer';
    ipod.el.focus({ preventScroll: true, focusVisible: usedKeyboard });
  }
  await revealed;
  try { intro?.dispose(); } catch { /* already gone */ }
  intro = null; // the controller holds the whole scene: nothing may keep it once it is gone
  desktop.setInteractive(true);
  window.removeEventListener('keydown', noteKeyboard, true);
}

main().catch((err) => {
  // last resort: never leave a blank page, and tell the developer why
  console.error('[main] start-up failed:', err);
  if (ipod?.el.classList.contains('is-revealed')) return; // the iPod is up and works
  try {
    if (desktop) {
      desktop.el.classList.remove('is-waiting');
      showConfigError(desktop);
    } else if (!app.childElementCount) showConfigError();
  } catch (e) {
    console.error('[main] error window failed:', e);
  }
});
