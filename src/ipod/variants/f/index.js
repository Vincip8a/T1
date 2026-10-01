// iPod Classic (6th/7th gen, silver) linktree – variant f.
// Body in HTML/CSS/SVG sized from IPOD (mm), 320×240 logical screen scaled to the LCD,
// click-wheel input with momentum, WebAudio ticks, keyboard + a11y, per-type screens.
import './ipodf.css';
import { IPOD, COLORS } from '../../../shared/ipodSpec.js';
import { prefersReducedMotion } from '../../../shared/config.js';
import { createWheel } from './wheel.js';
import { createClicker } from './audio.js';
import { createPlayer } from './player.js';
import { ListScreen, PageScreen, NowPlayingScreen, createPane, el, UI } from './screens.js';

const STR = {
  spotify: 'In Spotify öffnen',
  downloadStarted: 'Download gestartet',
  nowPlaying: 'Sie hören',
  select: 'Auswählen',
  wheel: 'Clickwheel: drehen zum Scrollen; oben MENU, rechts Weiter, unten Wiedergabe/Pause, links Zurück',
};

const resolveUrl = (p) => (/^(https?:|mailto:|tel:|data:|blob:)/i.test(p) ? p : new URL(p, document.baseURI).href);

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

export function mountIpod(container, { config }) {
  const reduced = () => prefersReducedMotion();
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
          <div class="ipodf-boot" aria-hidden="true"><span class="ipodf-boot-mono"></span></div>
        </div>
      </div>
      <div class="ipodf-glare"></div>
    </div>
    <div class="ipodf-wheel">
      <div class="ipodf-ring" role="group" aria-label="${STR.wheel}">${wheelLabelsSvg()}</div>
      <div class="ipodf-center" role="button" aria-label="${STR.select}" tabindex="-1"></div>
    </div>
    <div class="ipodf-sr" aria-live="polite" aria-atomic="true"></div>`;
  const $ = (s) => root.querySelector(s);
  const lcd = $('.ipodf-lcd');
  const ui = $('.ipodf-ui');
  const stack = $('.ipodf-stack');
  const toast = $('.ipodf-toast');
  const boot = $('.ipodf-boot');
  const bootMono = $('.ipodf-boot-mono');
  const ring = $('.ipodf-ring');
  const center = $('.ipodf-center');
  const live = $('.ipodf-sr');
  bootMono.textContent = config.brand.monogram ?? '';
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
  let liveTimer = 0;

  const top = () => screens[screens.length - 1];
  const announce = (text) => {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = text; }, 90);
  };
  const syncActive = () => {
    const id = top()?.activeId;
    if (id) root.setAttribute('aria-activedescendant', id); else root.removeAttribute('aria-activedescendant');
  };
  const onChange = (screen) => { announce(screen.currentLabel()); syncActive(); };

  player.on((type) => {
    ui.classList.toggle('is-playing', player.playing);
    ui.classList.toggle('is-paused', !player.playing && player.started);
    if (type === 'track' && !player.playing && player.started) announce(top()?.currentLabel() ?? '');
  });

  let toastTimer = 0;
  const showToast = (text) => {
    toast.textContent = text;
    clearTimeout(toastTimer);
    toast.classList.add('is-show');
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), 1250);
  };

  const openLink = (rowEl) => { rowEl?.click(); };

  // ---- screens ----
  const pane = createPane({ config, resolveUrl, reducedMotion: reduced });

  function makeScreen(item, index) {
    if (item.type === 'list') {
      return new ListScreen({
        type: 'list', id: item.id, title: item.title ?? item.label,
        rows: (item.items ?? []).map((it) => ({ label: it.label, detail: it.detail, href: it.href, item: it })),
        onSelect: (row, i, rowEl) => { clicker.press(); openLink(rowEl); },
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
        onSelect: (row, i, rowEl) => { openLink(rowEl); showToast(STR.downloadStarted); },
        onChange,
      });
    }
    if (item.type === 'nowplaying') {
      return new NowPlayingScreen({
        id: item.id, item, index, player, config, resolveUrl, actionLabel: STR.spotify, titleText: STR.nowPlaying,
        onSelect: (row, i, rowEl) => openLink(rowEl),
        onChange,
      });
    }
    return new PageScreen({
      id: item.id, title: item.title ?? item.label, body: item.body,
      actions: (item.actions ?? []).map((a) => ({ label: a.label, href: a.href, item: a })),
      onSelect: (row, i, rowEl) => openLink(rowEl),
      onChange,
    });
  }

  const main = new ListScreen({
    type: 'menu', id: 'menu', title: config.brand.name, split: true, pane,
    rows: (config.menu ?? []).map((m) => ({ label: m.label, chevron: true, item: m })),
    onSelect: (row, i) => push(makeScreen(row.item, i)),
    onChange,
  });
  screens.push(main);
  stack.append(main.el);
  main.activate();
  syncActive();

  function push(screen) { transition(screen, 1); }
  function pop() {
    if (screens.length < 2) return false;
    transition(null, -1);
    return true;
  }
  function transition(next, dir) {
    const prev = top();
    if (dir > 0) screens.push(next);
    else { screens.pop(); next = top(); }
    prev.deactivate();
    const prevEl = prev.el;
    stack.append(next.el);
    next.activate();
    if (next.type === 'nowplaying' && !player.started) player.play();
    syncActive();
    announce(`${next.type === 'nowplaying' ? STR.nowPlaying : next.el.querySelector('.ipodf-title')?.textContent ?? ''}. ${next.currentLabel()}`);
    const finish = () => { if (dir > 0) prevEl.remove(); else prev.destroy(); };
    if (reduced()) { finish(); return; }
    const nextEl = next.el;
    nextEl.classList.remove('is-anim');
    prevEl.classList.remove('is-anim');
    nextEl.style.transform = `translateX(${dir * 100}%)`;
    prevEl.style.transform = 'translateX(0)';
    void nextEl.offsetWidth; // commit the start positions before enabling the transition
    nextEl.classList.add('is-anim');
    prevEl.classList.add('is-anim');
    nextEl.style.transform = 'translateX(0)';
    prevEl.style.transform = `translateX(${-dir * 100}%)`;
    setTimeout(() => {
      if (top()?.el === nextEl) { nextEl.classList.remove('is-anim'); nextEl.style.transform = ''; }
      finish();
    }, 300);
  }

  // ---- actions ----
  const flash = (sector) => {
    if (sector === 'center') { center.classList.add('is-pressed'); setTimeout(() => center.classList.remove('is-pressed'), 120); }
    else { ring.dataset.press = sector; setTimeout(() => { if (ring.dataset.press === sector) delete ring.dataset.press; }, 120); }
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
    if (!['menu', 'center', 'play', 'next', 'prev'].includes(button)) return;
    clicker.press();
    flash(button);
    act(button);
  };
  const scroll = (steps) => {
    const n = Math.trunc(Number(steps) || 0);
    const dir = Math.sign(n);
    for (let i = 0; i < Math.abs(n); i++) {
      if (top().move(dir)) clicker.tick();
    }
  };

  // ---- input ----
  const wheel = createWheel(ring, {
    stepDeg: 20,
    onStep: (dir) => { if (top().move(dir)) clicker.tick(); },
    onPressStart: (sector) => { ring.dataset.press = sector; },
    onPressEnd: () => { delete ring.dataset.press; },
    onPress: (sector) => { clicker.press(); act(sector); },
    reducedMotion: reduced,
  });

  let centerPointer = null;
  const onCenterDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    wheel.stop();
    centerPointer = e.pointerId;
    try { center.setPointerCapture(e.pointerId); } catch {}
    center.classList.add('is-pressed');
    e.preventDefault();
  };
  const onCenterUp = (e) => {
    if (centerPointer !== e.pointerId) return;
    centerPointer = null;
    center.classList.remove('is-pressed');
    const r = center.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (e.type === 'pointerup' && inside) { clicker.press(); act('center'); }
  };
  center.addEventListener('pointerdown', onCenterDown);
  center.addEventListener('pointerup', onCenterUp);
  center.addEventListener('pointercancel', onCenterUp);

  const onRootDown = () => {
    clicker.prime();
    if (document.activeElement !== root) root.focus({ preventScroll: true });
  };
  root.addEventListener('pointerdown', onRootDown);

  let wheelAcc = 0;
  let wheelLast = 0;
  const onWheel = (e) => {
    e.preventDefault();
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
    clicker.prime();
    switch (e.key) {
      case 'ArrowUp': case 'ArrowLeft': scroll(-1); break;
      case 'ArrowDown': case 'ArrowRight': scroll(1); break;
      case 'Enter': press('center'); break;
      case 'Escape': case 'Backspace': press('menu'); break;
      case ' ': case 'Spacebar': press('play'); break;
      case 'PageDown': scroll(4); break;
      case 'PageUp': scroll(-4); break;
      case 'Home': scroll(-99); break;
      case 'End': scroll(99); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };
  root.addEventListener('keydown', onKey);

  // ---- API ----
  const delay = (ms) => new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 120) : ms));

  async function reveal({ boot: doBoot = true } = {}) {
    fit();
    root.style.visibility = 'visible';
    root.classList.add('is-on'); // opacity transition in CSS
    if (doBoot && !revealed) {
      boot.classList.remove('is-mono', 'is-off', 'is-hidden');
      await delay(280);
      boot.classList.add('is-mono');
      await delay(900);
      boot.classList.add('is-off');
      await delay(340);
      boot.classList.add('is-hidden');
    } else {
      boot.classList.add('is-off', 'is-hidden');
      await delay(260);
    }
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
      wheel.destroy();
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      root.removeEventListener('pointerdown', onRootDown);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('keydown', onKey);
      center.removeEventListener('pointerdown', onCenterDown);
      center.removeEventListener('pointerup', onCenterUp);
      center.removeEventListener('pointercancel', onCenterUp);
      player.destroy();
      clicker.destroy();
      clearTimeout(toastTimer);
      clearTimeout(liveTimer);
      for (const s of screens) s.destroy();
      screens.length = 0;
      root.remove();
    },
  };
  return api;
}
