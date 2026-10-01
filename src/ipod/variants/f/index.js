// iPod Classic (6th/7th gen, silver) linktree – variant f.
// Body in HTML/CSS/SVG sized from IPOD (mm), 320×240 logical screen scaled to the LCD,
// click-wheel input, WebAudio ticks, keyboard + a11y, per-type screens.
import './ipodf.css';
import { IPOD, COLORS } from '../../../shared/ipodSpec.js';
import { prefersReducedMotion } from '../../../shared/config.js';
import { createWheel } from './wheel.js';
import { createClicker } from './audio.js';
import { createPlayer } from './player.js';
import { createTimers } from './timers.js';
import { ListScreen, PageScreen, NowPlayingScreen, createPane, el, UI } from './screens.js';

const STR = {
  spotify: 'In Spotify öffnen',
  downloadStarted: 'Download gestartet',
  backHint: 'MENU: zurück',
  nowPlaying: 'Sie hören',
  volume: 'Lautstärke',
  select: 'Auswählen',
  menu: 'MENU',
  prev: 'Zurück / vorheriger Titel',
  next: 'Weiter / nächster Titel',
  play: 'Wiedergabe / Pause',
  wheel: 'Clickwheel: drehen zum Scrollen; oben MENU, rechts Weiter, unten Wiedergabe/Pause, links Zurück',
};
const BUTTONS = ['menu', 'center', 'play', 'next', 'prev'];
const SLIDE_MS = 300;

// Relative config paths (cover, downloads) are relative to the site root; the dev harness lives one level down.
const siteRoot = () => (/\/dev\/[^/]*$/.test(location.pathname) ? new URL('../', document.baseURI).href : document.baseURI);
const resolveUrl = (p) => (/^(https?:|mailto:|tel:|data:|blob:)/i.test(p) ? p : new URL(p, siteRoot()).href);

function wheelLabelsSvg() {
  const c = COLORS.wheelLabel;
  const r = 50 * IPOD.wheelLabels.radiusFactor;
  const skip = '<path d="M-5.6 -2.9 L-0.9 0 L-5.6 2.9z"/><path d="M-0.6 -2.9 L4.1 0 L-0.6 2.9z"/><rect x="4.3" y="-2.9" width="1.25" height="5.8" rx=".3"/>';
  return `<svg class="ipodf-labels" viewBox="0 0 100 100" aria-hidden="true">
    <text x="50" y="${(50 - r + 2.3).toFixed(2)}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="6.3" font-weight="700" letter-spacing=".35" fill="${c}">${IPOD.wheelLabels.menu}</text>
    <g fill="${c}" transform="translate(${50 + r} 50)">${skip}</g>
    <g fill="${c}" transform="translate(${50 - r} 50) scale(-1 1)">${skip}</g>
    <g fill="${c}" transform="translate(50 ${50 + r})"><path d="M-6.2 -2.9 L-1.3 0 L-6.2 2.9z"/><rect x="0.6" y="-2.9" width="1.6" height="5.8" rx=".3"/><rect x="3.4" y="-2.9" width="1.6" height="5.8" rx=".3"/></g>
  </svg>`;
}

/** Accessible buttons for the four wheel sectors: invisible, positioned on the printed labels. */
function sectorButtons() {
  const rf = IPOD.wheelLabels.radiusFactor;
  const spot = { menu: [50, 50 - 50 * rf], next: [50 + 50 * rf, 50], play: [50, 50 + 50 * rf], prev: [50 - 50 * rf, 50] };
  return ['menu', 'prev', 'next', 'play'].map((s) => {
    const [x, y] = spot[s];
    return `<button type="button" class="ipodf-sbtn" data-sector="${s}" aria-label="${STR[s]}" tabindex="-1" style="left:${x}%;top:${y}%"></button>`;
  }).join('');
}

export function mountIpod(container, { config }) {
  const reduced = () => prefersReducedMotion();
  const timers = createTimers();
  const root = el('div', 'ipodf', {
    tabindex: '0', role: 'application', 'aria-label': `iPod – ${config.brand.name}`, 'aria-roledescription': 'iPod',
    'aria-description': 'Pfeiltasten scrollen, Enter wählt aus, Escape geht zurück, Leertaste spielt/pausiert.',
  });
  const vars = {
    w: IPOD.width, r: IPOD.cornerRadius,
    'sw-x': IPOD.screenWindow.x, 'sw-y': IPOD.screenWindow.y, 'sw-w': IPOD.screenWindow.width, 'sw-h': IPOD.screenWindow.height, 'sw-r': IPOD.screenWindow.radius,
    'lcd-w': IPOD.screen.width, 'lcd-h': IPOD.screen.height,
    'wh-cx': IPOD.wheel.cx, 'wh-cy': IPOD.wheel.cy, 'wh-d': IPOD.wheel.diameter, 'cb-d': IPOD.centerButton.diameter,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(`--ipodf-${k}`, String(v));
  const cols = { window: COLORS.screenWindow, lcdoff: COLORS.lcdOff, wheel: COLORS.wheel, center: COLORS.centerButton, 'hi-top': COLORS.uiHighlightTop, 'hi-bot': COLORS.uiHighlightBottom };
  for (const [k, v] of Object.entries(cols)) root.style.setProperty(`--ipodf-c-${k}`, v);

  root.innerHTML = `
    <div class="ipodf-window">
      <div class="ipodf-lcd">
        <div class="ipodf-ui">
          <div class="ipodf-stack"></div>
          <div class="ipodf-toast" role="status"></div>
          <div class="ipodf-boot" aria-hidden="true">
            <span class="ipodf-boot-mono"></span><span class="ipodf-boot-name"></span>
            <span class="ipodf-boot-bar"><i></i></span>
          </div>
        </div>
        <div class="ipodf-glare"></div>
      </div>
    </div>
    <div class="ipodf-wheel">
      <div class="ipodf-ring" role="group" aria-label="${STR.wheel}">${wheelLabelsSvg()}${sectorButtons()}</div>
      <button type="button" class="ipodf-center" aria-label="${STR.select}" tabindex="-1"></button>
    </div>
    <div class="ipodf-sr" aria-live="polite" aria-atomic="true"></div>`;
  const $ = (s) => root.querySelector(s);
  const lcd = $('.ipodf-lcd');
  const ui = $('.ipodf-ui');
  const stack = $('.ipodf-stack');
  const toast = $('.ipodf-toast');
  const boot = $('.ipodf-boot');
  const ring = $('.ipodf-ring');
  const center = $('.ipodf-center');
  const live = $('.ipodf-sr');
  $('.ipodf-boot-mono').textContent = config.brand.monogram ?? '';
  $('.ipodf-boot-name').textContent = config.brand.name ?? '';
  container.append(root);

  // LCD scale: 320 logical px → actual LCD width (valid while visibility:hidden too)
  const fit = () => {
    const w = lcd.getBoundingClientRect().width || lcd.offsetWidth;
    if (w) root.style.setProperty('--ipodf-s', String(w / UI.w));
  };
  fit();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(lcd);
  window.addEventListener('resize', fit);

  // ---- state ----
  const clicker = createClicker({ enabled: config.settings?.clickSound !== false });
  const playlistItem = (config.menu ?? []).find((m) => m.type === 'nowplaying');
  const player = createPlayer(playlistItem?.tracks ?? []);
  const screens = [];
  let revealed = false;
  let destroyed = false;
  let liveTimer = 0;
  const ready = () => revealed && !destroyed;

  const top = () => screens[screens.length - 1];
  const announce = (text) => {
    liveTimer = timers.cancel(liveTimer);
    liveTimer = timers.later(() => { live.textContent = text; }, 90);
  };
  const syncActive = () => {
    const id = top()?.activeId;
    if (id) root.setAttribute('aria-activedescendant', id); else root.removeAttribute('aria-activedescendant');
  };
  const onChange = (screen, reason, text) => { announce(text ?? screen.currentLabel()); syncActive(); };

  player.on((type) => {
    ui.classList.toggle('is-playing', player.playing);
    ui.classList.toggle('is-paused', !player.playing && player.started);
    if (type === 'track') { const t = player.track; if (t) announce(`${t.title}, ${t.artist ?? ''}`); }
  });

  let toastTimer = 0;
  const showToast = (text) => {
    toast.textContent = text;
    toastTimer = timers.cancel(toastTimer);
    toast.classList.add('is-show');
    toastTimer = timers.later(() => toast.classList.remove('is-show'), 1250);
  };

  const openLink = (rowEl) => { (rowEl?.link ?? rowEl)?.click(); };
  // a pointer click on a row is a "press" too: one click sound, no second one from the action
  const viaPointer = (opts) => { if (opts?.pointer) { clicker.prime(); clicker.press(); } };

  // ---- screens ----
  const pane = createPane({ config, resolveUrl, reducedMotion: reduced, timers });

  function makeScreen(item, index) {
    if (item.type === 'list') {
      return new ListScreen({
        type: 'list', id: item.id, title: item.title ?? item.label,
        rows: (item.items ?? []).map((it) => ({ label: it.label, detail: it.detail, href: it.href, item: it })),
        onSelect: (row, i, rowEl, opts) => { viaPointer(opts); openLink(rowEl); },
        onChange,
      });
    }
    if (item.type === 'downloads') {
      return new ListScreen({
        type: 'downloads', id: item.id, title: item.title ?? item.label,
        rows: (item.items ?? []).map((it) => ({
          label: it.label,
          detail: [it.format, it.size].filter((s) => s && s !== '–' && s !== '-').join(' · '),
          href: it.file ? resolveUrl(it.file) : undefined, download: true, item: it,
        })),
        onSelect: (row, i, rowEl, opts) => { viaPointer(opts); if (row.href) { openLink(rowEl); showToast(STR.downloadStarted); } },
        onChange,
      });
    }
    if (item.type === 'nowplaying') {
      return new NowPlayingScreen({
        id: item.id, item, index, player, config, resolveUrl, timers,
        actionLabel: STR.spotify, titleText: STR.nowPlaying, volumeLabel: STR.volume,
        onSelect: (row, i, rowEl, opts) => { viaPointer(opts); if (!opts?.handled) openLink(rowEl); },
        onChange,
      });
    }
    return new PageScreen({
      id: item.id, title: item.title ?? item.label, body: item.body,
      actions: (item.actions ?? []).map((a) => ({ label: a.label, href: a.href, item: a })),
      onSelect: (row, i, rowEl, opts) => { viaPointer(opts); openLink(rowEl); },
      onEmptySelect: () => showToast(STR.backHint),
      onChange,
    });
  }

  const main = new ListScreen({
    type: 'menu', id: 'menu', title: config.brand.name, split: true, pane,
    rows: (config.menu ?? []).map((m) => ({ label: m.label, chevron: true, item: m })),
    onSelect: (row, i, rowEl, opts) => { viaPointer(opts); push(makeScreen(row.item, i)); },
    onChange,
  });
  screens.push(main);
  stack.append(main.el);
  main.activate();
  syncActive();

  // ---- navigation with the Classic's horizontal slide ----
  // One pending transition at a time. A new one settles the old one first (removing only
  // elements that are no longer the top screen) and starts from the current, mid-slide offsets.
  let pending = null;
  const shiftOf = (node) => { // current translateX in % of the screen width, only while mid-slide
    if (!node?.isConnected || !node.classList.contains('is-anim')) return null;
    try { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return (m.m41 / UI.w) * 100; } catch { return null; }
  };
  const settle = () => {
    if (!pending) return;
    const { timer, prev, prevEl, nextEl, dir } = pending;
    pending = null;
    timers.cancel(timer);
    for (const node of [nextEl, prevEl]) { node.classList.remove('is-anim'); node.style.transform = ''; }
    if (prevEl !== top()?.el) { prevEl.remove(); if (dir < 0) prev.destroy(); }
  };
  function push(screen) { transition(screen, 1); }
  function pop() {
    if (screens.length < 2) return false;
    transition(null, -1);
    return true;
  }
  function transition(next, dir) {
    const prev = top();
    const animating = !reduced();
    const fromPrev = pending && animating ? shiftOf(prev.el) : null;
    const fromNext = pending && animating && next?.el?.isConnected ? shiftOf(next.el) : null;
    const fromTop = pending && animating && dir < 0 ? shiftOf(screens[screens.length - 2].el) : null;
    settle();
    if (dir > 0) screens.push(next);
    else { screens.pop(); next = top(); }
    prev.deactivate();
    const prevEl = prev.el;
    const nextEl = next.el;
    stack.append(nextEl); // on top of prev in paint order
    next.activate();
    if (next.type === 'nowplaying' && !player.started) player.play();
    syncActive();
    announce(`${next.type === 'nowplaying' ? STR.nowPlaying : next.el.querySelector('.ipodf-title')?.textContent ?? ''}. ${next.currentLabel()}`);
    if (!animating) { if (prevEl !== nextEl) prevEl.remove(); if (dir < 0) prev.destroy(); return; }
    const startNext = dir < 0 ? (fromTop ?? fromNext ?? dir * 100) : (fromNext ?? dir * 100);
    const startPrev = fromPrev ?? 0;
    nextEl.classList.remove('is-anim');
    prevEl.classList.remove('is-anim');
    nextEl.style.transform = `translateX(${startNext}%)`;
    prevEl.style.transform = `translateX(${startPrev}%)`;
    void nextEl.offsetWidth; // commit the start positions before enabling the transition
    nextEl.classList.add('is-anim');
    prevEl.classList.add('is-anim');
    nextEl.style.transform = 'translateX(0)';
    prevEl.style.transform = `translateX(${-dir * 100}%)`;
    pending = { prev, prevEl, nextEl, dir, timer: timers.later(settle, SLIDE_MS) };
  }

  // ---- actions ----
  let flashTimer = 0;
  const flash = (sector) => {
    flashTimer = timers.cancel(flashTimer);
    if (sector === 'center') { center.classList.add('is-pressed'); flashTimer = timers.later(() => center.classList.remove('is-pressed'), 120); }
    else { ring.dataset.press = sector; flashTimer = timers.later(() => { if (ring.dataset.press === sector) delete ring.dataset.press; }, 120); }
  };
  const act = (button) => {
    switch (button) {
      case 'center': top().select(); break;
      case 'menu': pop(); break;
      case 'play': player.toggle(); break;
      case 'next': player.next(); break;
      case 'prev': player.prev(); break;
    }
  };
  const press = (button) => {
    if (!ready() || !BUTTONS.includes(button)) return;
    clicker.press();
    flash(button);
    act(button);
  };
  const scroll = (steps) => {
    if (!ready()) return;
    const n = Math.trunc(Number(steps) || 0);
    const dir = Math.sign(n);
    for (let i = 0; i < Math.abs(n); i++) {
      if (top().move(dir)) { clicker.tick(); syncActive(); }
    }
  };

  // ---- input ----
  const wheel = createWheel(ring, {
    stepDeg: 20,
    onStep: (dir) => { if (ready() && top().move(dir)) { clicker.tick(); syncActive(); } },
    onPressStart: (sector) => { if (ready()) ring.dataset.press = sector; },
    onPressEnd: () => { delete ring.dataset.press; },
    onPress: (sector) => { if (ready()) { clicker.press(); act(sector); } },
  });
  for (const b of ring.querySelectorAll('.ipodf-sbtn')) b.addEventListener('click', () => press(b.dataset.sector));

  let centerPointer = null;
  let centerHandled = false;
  const onCenterDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    wheel.stop();
    centerPointer = e.pointerId;
    try { center.setPointerCapture(e.pointerId); } catch {}
    if (ready()) center.classList.add('is-pressed');
    e.preventDefault();
  };
  const onCenterUp = (e) => {
    if (centerPointer !== e.pointerId) return;
    centerPointer = null;
    center.classList.remove('is-pressed');
    const r = center.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (e.type === 'pointerup') {
      centerHandled = true; // the click event that follows must not act twice
      timers.later(() => { centerHandled = false; }, 0);
      if (inside && ready()) { clicker.press(); act('center'); }
    }
  };
  const onCenterClick = () => { if (centerHandled) { centerHandled = false; return; } press('center'); }; // keyboard / AT activation
  center.addEventListener('pointerdown', onCenterDown);
  center.addEventListener('pointerup', onCenterUp);
  center.addEventListener('pointercancel', onCenterUp);
  center.addEventListener('click', onCenterClick);

  const onRootDown = () => {
    clicker.prime();
    if (document.activeElement !== root) root.focus({ preventScroll: true });
  };
  root.addEventListener('pointerdown', onRootDown);

  let wheelAcc = 0;
  let wheelLast = 0;
  const onWheel = (e) => {
    e.preventDefault();
    if (!ready()) return;
    const now = performance.now();
    if (now - wheelLast > 260) wheelAcc = 0;
    wheelLast = now;
    const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 120 : 1;
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    wheelAcc += d;
    const thr = 44;
    let steps = 0;
    while (wheelAcc >= thr && steps < 2) { wheelAcc -= thr; steps++; }
    while (wheelAcc <= -thr && steps > -2) { wheelAcc += thr; steps--; }
    if (steps) { clicker.prime(); scroll(steps); }
  };
  root.addEventListener('wheel', onWheel, { passive: false });

  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!ready()) return;
    const isButton = e.target !== root && e.target.tagName === 'BUTTON';
    switch (e.key) {
      case 'ArrowUp': case 'ArrowLeft': clicker.prime(); scroll(-1); break;
      case 'ArrowDown': case 'ArrowRight': clicker.prime(); scroll(1); break;
      case 'PageDown': clicker.prime(); scroll(4); break;
      case 'PageUp': clicker.prime(); scroll(-4); break;
      case 'Home': clicker.prime(); scroll(-99); break;
      case 'End': clicker.prime(); scroll(99); break;
      case 'Enter': case ' ': case 'Spacebar': case 'Escape': case 'Backspace':
        if (isButton && (e.key === 'Enter' || e.key === ' ')) return; // the focused button's own click handles it
        if (e.repeat) break; // a held key must not re-trigger presses (link spam, pop cascade)
        clicker.prime();
        press(e.key === 'Enter' ? 'center' : e.key === 'Escape' || e.key === 'Backspace' ? 'menu' : 'play');
        break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };
  root.addEventListener('keydown', onKey);

  // ---- API ----
  const delay = (ms) => new Promise((r) => timers.later(r, reduced() ? Math.min(ms, 120) : ms));

  async function reveal({ boot: doBoot = true } = {}) {
    fit();
    root.style.visibility = 'visible';
    root.classList.add('is-on'); // opacity transition in CSS
    if (doBoot && !revealed) {
      boot.classList.remove('is-mono', 'is-off', 'is-hidden');
      await delay(280);
      boot.classList.add('is-mono');
      await delay(1000);
      boot.classList.add('is-off');
      await delay(340);
      boot.classList.add('is-hidden');
    } else {
      boot.classList.add('is-off', 'is-hidden');
      await delay(260);
    }
    if (destroyed) return;
    revealed = true;
    announce(`${config.brand.name}. ${main.currentLabel()}`);
  }

  const api = {
    el: root,
    getShellRect: () => root.getBoundingClientRect(),
    reveal,
    press,
    scroll,
    getState: () => {
      const t = top();
      return { screen: revealed ? t.type : 'boot', path: screens.slice(1).map((s) => s.id), index: t.index };
    },
    destroy() {
      destroyed = true;
      timers.clearAll();
      pending = null;
      wheel.destroy();
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      root.removeEventListener('pointerdown', onRootDown);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('keydown', onKey);
      center.removeEventListener('pointerdown', onCenterDown);
      center.removeEventListener('pointerup', onCenterUp);
      center.removeEventListener('pointercancel', onCenterUp);
      center.removeEventListener('click', onCenterClick);
      player.destroy();
      clicker.destroy();
      pane.destroy();
      for (const s of screens) s.destroy();
      screens.length = 0;
      root.remove();
    },
  };
  return api;
}
