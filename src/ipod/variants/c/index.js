// iPod Classic (6th/7th gen, silver) linktree UI – variant C.
// API per CONTRACT.md: mountIpod(container, { config }) → { el, getShellRect, reveal, press, scroll, getState, destroy }
//
// The LCD UI is laid out in a logical 320×240 px space with container-query units
// (--ipodc-p = 100cqw / 320 is one logical px), so text renders at its real size and stays crisp.
// Modules: wheel.js (click-wheel input), player.js (simulated playback), screens.js (screen
// builders), sound.js (WebAudio ticks), art.js (procedural SVG), util.js (helpers, timers).
import './ipodc.css';
import { IPOD, COLORS } from '../../../shared/ipodSpec.js';
import { prefersReducedMotion as isReduced } from '../../../shared/config.js';
import { h, createTimers } from './util.js';
import { NOISE_SVG, GLYPH, playIndicator, battery, TOAST_ICON, sharedDefs } from './art.js';
import { createSound } from './sound.js';
import { createPlayer } from './player.js';
import { createWheel } from './wheel.js';
import { createScreens } from './screens.js';

const SLIDE_MS = 260;
const EASE = 'cubic-bezier(.32,.08,.24,1)';
let seq = 0;

// UI strings (not content): overridable per site via config.ui, German 6G firmware defaults.
const DEFAULT_UI = {
  nowPlaying: 'Sie hören',
  openSpotify: 'In Spotify öffnen',
  of: 'von',
  volume: 'Lautstärke',
  playing: 'Wiedergabe',
  paused: 'Pause',
  link: 'Link',
  newTab: 'Link, öffnet in neuem Tab',
  mail: 'E-Mail-Link',
  download: 'Download',
  downloadStarted: 'Download gestartet',
  mailOpening: 'E-Mail wird geöffnet',
  linkOpening: 'Wird geöffnet …',
  backHint: 'Zurück mit MENU',
  hint: 'Pfeiltasten oder Click Wheel blättern, Enter wählt, Escape geht zurück, Leertaste spielt oder pausiert.',
};

export function mountIpod(container, { config } = {}) {
  config ??= {};
  const brand = config.brand ?? {};
  const menu = (Array.isArray(config.menu) ? config.menu : []).filter((m) => m && typeof m === 'object');
  const L = { ...DEFAULT_UI };
  for (const [k, v] of Object.entries(config.ui ?? {})) if (k in L && typeof v === 'string') L[k] = v;
  const P = `ipodc${++seq}`;
  let uid = 0;
  const nid = (s) => `${P}-${s}${++uid}`;
  const cleanups = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    cleanups.push(() => t.removeEventListener(type, fn, o));
  };
  const timers = createTimers();
  const soundOn = config.settings?.clickSound !== false;
  const sound = createSound(soundOn);
  let destroyed = false;
  let phase = 'off'; // off → boot → ready

  // ── body: the focus target and the listbox whose options are the current screen's rows
  const hintId = nid('hint');
  const el = h('div', 'ipodc', { tabindex: 0, role: 'listbox', 'aria-describedby': hintId });
  const { screenWindow: sw, screen: sc, wheel: wh } = IPOD;
  const mm = {
    w: IPOD.width, h: IPOD.height, r: IPOD.cornerRadius,
    'win-x': sw.x, 'win-y': sw.y, 'win-w': sw.width, 'win-h': sw.height, 'win-r': sw.radius,
    'lcd-x': (sw.width - sc.width) / 2, 'lcd-y': (sw.height - sc.height) / 2, 'lcd-w': sc.width, 'lcd-h': sc.height,
    'wh-x': wh.cx - wh.diameter / 2, 'wh-y': wh.cy - wh.diameter / 2, 'wh-d': wh.diameter,
    'cb-d': IPOD.centerButton.diameter, 'lab-r': (IPOD.wheelLabels.radiusFactor * wh.diameter) / 2,
    'hold-x': IPOD.holdSwitch.x, 'hold-w': IPOD.holdSwitch.width, 'jack-x': IPOD.headphoneJack.x, 'jack-d': IPOD.headphoneJack.diameter,
  };
  const prop = (k, v) => el.style.setProperty(`--ipodc-${k}`, v);
  for (const k in mm) prop(`mm-${k}`, +mm[k].toFixed(4));
  for (const k in COLORS) prop(`c-${k}`, COLORS[k]);
  prop('noise', `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`);

  // ── screen
  const hidden = { 'aria-hidden': 'true' };
  const win = h('div', 'ipodc-window');
  const lcd = h('div', 'ipodc-lcd');
  const ui = h('div', 'ipodc-ui');
  const bar = h('div', 'ipodc-bar', hidden);
  const ind = h('span', 'ipodc-ind');
  ind.innerHTML = playIndicator(P);
  const titles = h('div', 'ipodc-titles');
  let titleEl = h('span', 'ipodc-title');
  titles.append(titleEl);
  const batt = h('span', 'ipodc-batt');
  batt.innerHTML = battery(P);
  bar.append(ind, titles, batt);
  const stage = h('div', 'ipodc-stage');
  const toast = h('div', 'ipodc-toast', hidden);
  const boot = h('div', 'ipodc-boot', hidden);
  boot.append(h('div', 'ipodc-boot-mono', { text: brand.monogram ?? '' }));
  ui.append(bar, stage, toast, boot);
  lcd.append(ui);
  win.append(lcd, h('div', 'ipodc-glare'));

  // ── click wheel: pointer surface only (keyboard covers every button), hidden from AT
  const wheel = h('div', 'ipodc-wheel', hidden);
  wheel.innerHTML = `<span class="ipodc-wbtn ipodc-wbtn--menu">${IPOD.wheelLabels.menu ?? 'MENU'}</span>`
    + ['next', 'prev', 'play'].map((n) => `<span class="ipodc-wbtn ipodc-wbtn--${n}">${GLYPH[n]}</span>`).join('');
  const centerBtn = h('div', 'ipodc-center');
  wheel.append(centerBtn);
  const edge = h('div', 'ipodc-edge', hidden); // top edge: hold switch and headphone jack
  edge.append(h('span', 'ipodc-hold'), h('span', 'ipodc-jack'));
  el.append(edge, win, wheel, h('div', 'ipodc-sr', { id: hintId, text: L.hint }));
  el.insertAdjacentHTML('beforeend', sharedDefs(`${P}s`));
  // a landmark around the body (display: contents, so it adds no box); the live region sits
  // beside the body because the listbox may only own options
  const live = h('div', 'ipodc-sr', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  const host = h('section', 'ipodc-host', { 'aria-label': 'iPod' });
  host.append(el, live);
  container.append(host);

  /** real px per logical px (to measure wrapped text) */
  const pxPer = () => lcd.clientWidth / IPOD.screen.pxWidth || 1;

  let announceT = 0;
  const announce = (text) => {
    timers.cancel(announceT);
    live.textContent = '';
    announceT = timers.later(() => { live.textContent = text; }, 140);
  };

  // ── player
  const npItem = menu.find((m) => m.type === 'nowplaying');
  const tracks = !npItem ? [] : npItem.tracks?.length
    ? npItem.tracks.filter((t) => t && typeof t === 'object')
    : [{ title: npItem.title, artist: npItem.artist }];
  const player = createPlayer(tracks, (kind) => {
    ind.classList.toggle('is-on', player.started);
    ind.classList.toggle('is-paused', !player.playing);
    current()?.update?.(kind === 'track');
    if (kind === 'track') {
      const t = tracks[player.track];
      announce([t.title, t.artist].filter(Boolean).join(', '));
    }
  });

  // ── toast
  let toastT = 0;
  function showToast(icon, text, sub) {
    toast.innerHTML = TOAST_ICON[icon];
    toast.append(h('b', null, { text }));
    if (sub) toast.append(h('span', null, { text: sub }));
    toast.classList.add('is-on');
    announce(sub ? `${text} ${sub}` : text);
    timers.cancel(toastT);
    toastT = timers.later(() => toast.classList.remove('is-on'), 1700);
  }

  // ── links (a link row is the real <a>)
  let programmatic = false;
  let lastLink = null;
  let lastLinkT = 0;
  function linkGuard(a) { // held keys / double taps open a link once
    const now = performance.now();
    const dup = lastLink === a && now - lastLinkT < 800;
    lastLink = a;
    lastLinkT = now;
    return dup;
  }
  function followLink(a, spec) {
    if (linkGuard(a)) return;
    programmatic = true;
    try { a.click(); } finally { programmatic = false; }
    linkFeedback(a, spec);
  }
  function linkFeedback(a, spec) {
    if (a.hasAttribute('download')) showToast('check', L.downloadStarted, spec.label);
    else if (/^(https?|mailto):$/.test(a.protocol)) {
      let to = a.hostname.replace(/^www\./, '') || a.pathname;
      try { to = decodeURIComponent(to); } catch { /* keep it raw */ }
      showToast('out', a.protocol === 'mailto:' ? L.mailOpening : L.linkOpening, to);
    }
  }

  // ── navigation
  const stack = [];
  const current = () => stack[stack.length - 1];
  const isCurrent = (s) => !!s && current() === s;
  const syncAD = () => {
    const id = current()?.adId();
    if (id) el.setAttribute('aria-activedescendant', id); else el.removeAttribute('aria-activedescendant');
  };

  const anims = new Map(); // screen node → its running slide
  function slideNode(node, from, to) {
    const a = node.animate([{ transform: `translateX(${from}%)` }, { transform: `translateX(${to}%)` }], { duration: SLIDE_MS, easing: EASE });
    anims.set(node, a);
    // wall-clock safety net: a stalled document timeline can never leave screens half-way
    const guard = timers.later(() => a.finish(), SLIDE_MS + 180);
    return a.finished.catch(() => {}).finally(() => {
      timers.cancel(guard);
      if (anims.get(node) === a) anims.delete(node);
    });
  }
  /** current offset (in %) of a node that is mid-slide; stops that slide so a new one continues from there */
  function takeOffset(node) {
    const a = anims.get(node);
    if (!a) return null;
    const x = (new DOMMatrixReadOnly(getComputedStyle(node).transform).m41 / (node.offsetWidth || 1)) * 100;
    anims.delete(node);
    a.cancel();
    return x;
  }
  function slide(outN, inN, dir) {
    if (isReduced() || !inN.animate) {
      for (const a of [...anims.values()]) a.finish();
      return Promise.resolve();
    }
    const from = [takeOffset(outN) ?? 0, takeOffset(inN) ?? dir * 100];
    for (const a of [...anims.values()]) a.finish(); // any third screen still moving lands at once
    return Promise.all([slideNode(outN, from[0], -dir * 100), slideNode(inN, from[1], 0)]);
  }
  /** title bar: the old title leaves before the new one arrives, so they never smudge together */
  function setTitle(text, dir = 0) {
    for (const t of [...titles.children]) if (t !== titleEl) t.remove();
    if (titleEl.textContent === text) return;
    const old = titleEl;
    titleEl = h('span', 'ipodc-title', { text });
    titles.append(titleEl);
    el.setAttribute('aria-label', `${text} – iPod`);
    if (!dir || isReduced() || !old.textContent || !old.animate) return old.remove();
    const kf = (d, o0, at) => [
      { opacity: o0, transform: `translateX(${d * 30 * (1 - o0)}%)` },
      { opacity: 0, transform: `translateX(${d * 22}%)`, offset: at },
      { opacity: 1 - o0, transform: `translateX(${d * 30 * o0}%)` },
    ];
    const o = { duration: SLIDE_MS, easing: EASE };
    const rm = () => old.remove();
    old.animate(kf(-dir, 1, 0.42), { ...o, fill: 'forwards' }).finished.then(rm, rm);
    titleEl.animate(kf(dir, 0, 0.38), { ...o, fill: 'backwards' });
  }

  function show(s) {
    s.node.removeAttribute('aria-hidden');
    stage.append(s.node);
    s.layout();
    s.enteredAt = performance.now();
    syncAD();
    s.onShow?.();
  }
  /** push (dir 1, item given) or pop (dir -1) one level with the horizontal slide */
  function go(dir, item) {
    const from = current();
    if (dir > 0) stack.push(buildScreen(item)); else stack.pop();
    const to = current();
    from.onHide?.();
    from.node.setAttribute('aria-hidden', 'true');
    show(to);
    setTitle(to.title, dir);
    slide(from.node, to.node, dir).then(() => { if (!isCurrent(from)) from.node.remove(); });
    const extra = dir > 0 && (typeof to.summary === 'function' ? to.summary() : to.summary);
    announce([to.title, extra, to.currentLabel()].filter(Boolean).join('. '));
  }
  const open = (item) => go(1, item);
  const back = () => stack.length > 1 && go(-1);

  // ── actions
  let flashT = 0;
  function unflash() {
    flashT = timers.cancel(flashT);
    centerBtn.classList.remove('is-pressed');
    el.classList.remove('is-centre');
    delete wheel.dataset.press;
  }
  function flash(zone) {
    unflash();
    if (zone === 'center') { centerBtn.classList.add('is-pressed'); el.classList.add('is-centre'); } else wheel.dataset.press = zone;
    flashT = timers.later(unflash, 160);
  }
  function press(btn) {
    if (phase !== 'ready' || destroyed) return;
    sound.play('press');
    const s = current();
    if (btn === 'menu') back();
    else if (btn === 'center') s.activate();
    else if (btn === 'play' && tracks.length) {
      player.setPlaying(!player.playing);
      announce(player.playing ? L.playing : L.paused);
    } else if ((btn === 'next' || btn === 'prev') && (s.kind === 'nowplaying' || player.started)) player.skip(btn === 'next' ? 1 : -1);
  }
  const tap = (btn) => { flash(btn); press(btn); };

  function step(dir) {
    if (phase !== 'ready' || destroyed || !dir) return false;
    const s = current();
    const moved = s.move(dir);
    if (moved) sound.play('tick'); else s.bump(dir);
    return moved;
  }
  function scroll(steps) {
    const n = Math.trunc(Number(steps) || 0);
    for (let i = 0; i < Math.abs(n); i++) if (!step(Math.sign(n))) break;
  }
  function jump(to) {
    const s = current();
    if (s.jump(to)) sound.play('tick'); else s.bump(to > s.index ? 1 : -1);
  }

  const { menuScreen, buildScreen } = createScreens({
    L, brand, menu, P, nid, timers, player, isReduced, isCurrent, pxPer, syncAD, announce, showToast, followLink, open,
  });

  const focusRoot = () => { if (document.activeElement !== el) el.focus({ preventScroll: true }); };

  // ── click wheel input (no momentum: the list stops when the finger lifts)
  const stopWheel = createWheel(wheel, on, {
    onDown() { sound.ensure(); focusRoot(); unflash(); },
    onStep: step,
    onPress: tap,
  });
  cleanups.push(stopWheel);
  on(wheel, 'contextmenu', (e) => e.preventDefault());
  on(wheel, 'touchmove', (e) => e.preventDefault(), { passive: false });

  // centre button: acts on pointerup inside it. It is not a <button> and has no click handler,
  // so a touch tap (whose click arrives with detail 0) can never fire a second activation.
  let centerDown = null;
  const centreUp = (e) => {
    if (centerDown !== e.pointerId) return;
    centerDown = null;
    unflash();
    if (e.type !== 'pointerup') return;
    const r = centerBtn.getBoundingClientRect();
    if (Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) <= r.width / 2 + 8) tap('center');
  };
  on(centerBtn, 'pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    stopWheel(); // a thumb sliding from ring to centre never leaves a stuck press highlight
    sound.ensure();
    focusRoot();
    unflash();
    centerDown = e.pointerId;
    centerBtn.classList.add('is-pressed');
    el.classList.add('is-centre');
    try { centerBtn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) on(centerBtn, t, centreUp);

  // ── screen: tap a row to choose it
  const prevent = (e) => e.preventDefault();
  on(stage, 'pointerdown', (e) => { if (phase === 'ready' && !e.button) focusRoot(); }); // mousedown is prevented below
  on(stage, 'mousedown', prevent); // keep focus on the iPod, no text selection
  on(stage, 'dragstart', prevent);
  on(stage, 'click', (e) => {
    if (programmatic) return; // our own activation of a real <a>: let the browser follow it
    const s = current();
    const ready = phase === 'ready';
    const trk = e.target.closest('.ipodc-trk');
    if (trk && ready && s.node.contains(trk) && e.detail < 2) {
      sound.play('press');
      return s.pickTrack(+trk.dataset.i);
    }
    const row = e.target.closest('.ipodc-row');
    if (!row) return;
    const i = ready ? s.rows.indexOf(row) : -1;
    const settling = !isReduced() && performance.now() - s.enteredAt < SLIDE_MS * 0.75;
    // only rows of the screen in place, never the 2nd click of a double-click or an inert row
    if (i < 0 || e.detail > 1 || settling || row.classList.contains('is-dead')) return prevent(e);
    s.setIndex(i);
    sound.play('press');
    const spec = s.specs[i];
    if (spec.onActivate || !row.href) { prevent(e); spec.onActivate?.(); } else if (linkGuard(row)) prevent(e);
    else linkFeedback(row, spec); // native navigation proceeds (new tab / mailto / download)
  });

  // ── mouse wheel / trackpad
  let wAcc = 0;
  let wLast = 0;
  on(el, 'wheel', (e) => {
    if (phase === 'off' || destroyed) return;
    e.preventDefault(); // also during boot: the page behind must never scroll under the iPod
    const now = performance.now();
    const gap = now - wLast;
    wLast = now;
    const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    // line/page mode, a big notch, or a separate notch after a pause (mice that report tiny deltas,
    // ~4 px on macOS) is exactly one step; continuous trackpad streams (~16 ms apart) accumulate
    if (raw && (e.deltaMode || Math.abs(raw) >= 50 || gap > 220 || (gap > 90 && Math.abs(raw) >= 3))) {
      wAcc = 0;
      return step(Math.sign(raw));
    }
    wAcc += raw;
    for (; wAcc >= 34; wAcc -= 34) step(1);
    for (; wAcc <= -34; wAcc += 34) step(-1);
  }, { passive: false });

  // ── keyboard
  const KEYS = {
    ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1,
    Enter: 'center', Escape: 'menu', Backspace: 'menu', ' ': 'play', Spacebar: 'play',
    MediaPlayPause: 'play', MediaTrackNext: 'next', MediaTrackPrevious: 'prev',
  };
  function onKey(e) {
    if (phase !== 'ready' || destroyed || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    const i = current().index;
    let a = KEYS[k];
    if (e.shiftKey && /^Arrow(Left|Right)$/.test(k)) a = a > 0 ? 'next' : 'prev';
    sound.ensure();
    if (k === 'Home' || k === 'End') jump(k === 'Home' ? -Infinity : Infinity);
    else if (k === 'PageDown' || k === 'PageUp') jump(i + (k === 'PageDown' ? 7 : -7)); // one screen minus one row
    else if (typeof a === 'number') step(a);
    else if (!a) return;
    else if (!e.repeat) tap(a);
    e.preventDefault();
  }
  on(el, 'keydown', onKey);
  // With nothing else focused (e.g. right after the intro) the iPod is the obvious keyboard target,
  // but only while it is really on screen and on top (not minimised, hidden or covered).
  on(document, 'keydown', (e) => {
    if (e.key === 'Tab') el.dataset.input = 'key'; // keyboard navigation: show the focus ring
    if ((e.target !== document.body && e.target !== document.documentElement) || phase !== 'ready') return;
    const r = centerBtn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (!r.width || !el.contains(document.elementFromPoint(x, y))) return;
    const se = document.scrollingElement;
    if (se && se.scrollHeight > se.clientHeight + 2 && /^(Arrow|Spacebar$| $|Page|Home$|End$)/.test(e.key)) return; // leave page scrolling alone
    onKey(e);
  });
  // pointer users get no focus ring (focus still moves to the iPod so the keys work afterwards);
  // touch pointerdown is not a user activation for audio: unlock on pointerup / click as well
  on(el, 'pointerdown', () => { el.dataset.input = 'pointer'; sound.ensure(); });
  on(el, 'pointerup', sound.ensure);
  on(el, 'click', sound.ensure);

  // ── resize
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    const w = lcd.clientWidth;
    if (w && Math.abs(w - lastW) >= 0.5) { lastW = w; current().layout(); }
  });
  ro.observe(lcd);

  // ── boot / reveal
  const menuScr = menuScreen();
  stack.push(menuScr);
  show(menuScr);
  setTitle(menuScr.title);

  const wait = (ms) => new Promise((r) => timers.later(r, ms));
  let revealP = null;
  function reveal({ boot: doBoot = true } = {}) {
    revealP ??= (async () => {
      el.classList.add('is-revealed');
      menuScr.layout();
      if (doBoot) {
        const rm = isReduced();
        phase = 'boot';
        await wait(rm ? 40 : 220);
        boot.classList.add('show-mono');
        await wait(rm ? 450 : 950);
        boot.classList.add('is-out');
        await wait(rm ? 80 : 340);
      }
      if (destroyed) return;
      boot.hidden = true;
      current().layout();
      phase = 'ready';
      announce(`${menuScr.title}: ${menuScr.currentLabel()}`);
    })();
    return revealP;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const fn of cleanups) { try { fn(); } catch { /* ignore */ } }
    for (const a of anims.values()) a.cancel();
    timers.clearAll();
    ro.disconnect();
    player.destroy();
    sound.close();
    host.remove();
  }

  return {
    el,
    getShellRect: () => el.getBoundingClientRect(),
    reveal,
    press,
    scroll,
    getState: () => {
      const s = current();
      return { screen: phase === 'ready' ? s.kind : phase, path: stack.slice(1).map((x) => x.id), index: s.index };
    },
    destroy,
  };
}
