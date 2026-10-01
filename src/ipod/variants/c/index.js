// iPod Classic (6th/7th gen, silver) linktree UI – variant C.
// API per CONTRACT.md: mountIpod(container, { config }) → { el, getShellRect, reveal, press, scroll, getState, destroy }
//
// The LCD UI is laid out in a logical 320×240 px space with container-query units
// (--ipodc-p = 100cqw / 320 is one logical px), so text renders at its real size and stays crisp.
// Modules: wheel.js (click-wheel input), player.js (simulated playback), screens.js (screen
// builders), sound.js (WebAudio ticks), art.js (procedural SVG), util.js (helpers, timers).
import './ipodc.css';
import { IPOD, COLORS } from '../../../shared/ipodSpec.js';
import { prefersReducedMotion } from '../../../shared/config.js';
import { h, createTimers } from './util.js';
import { NOISE_SVG, GLYPH, playIndicator, battery, TOAST_ICON, sharedDefs } from './art.js';
import { createSound } from './sound.js';
import { createPlayer } from './player.js';
import { createWheel } from './wheel.js';
import { createScreens, ROW } from './screens.js';

const LW = IPOD.screen.pxWidth; // 320 logical px
const SLIDE_MS = 260;
const PAGE = 7;                 // rows per PageUp / PageDown (one screen minus one)
const EASE = 'cubic-bezier(.32,.08,.24,1)';
let instanceSeq = 0;

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
  hint: 'Pfeiltasten oder Click Wheel zum Blättern, Bild auf/ab und Pos1/Ende springen, Enter wählt aus, Escape geht zurück, Leertaste startet oder pausiert, Umschalt+Pfeil links/rechts wechselt den Titel.',
};

export function mountIpod(container, { config } = {}) {
  config ??= {};
  const brand = config.brand ?? {};
  const menu = (Array.isArray(config.menu) ? config.menu : []).filter((m) => m && typeof m === 'object');
  const L = { ...DEFAULT_UI };
  for (const [k, v] of Object.entries(config.ui ?? {})) if (typeof v === 'string' && k in L) L[k] = v;
  const P = `ipodc${++instanceSeq}`;
  let uid = 0;
  const nid = (s) => `${P}-${s}${++uid}`;
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  const timers = createTimers();
  const soundOn = config.settings?.clickSound !== false;
  const sound = createSound(soundOn);
  const isReduced = prefersReducedMotion; // read live at the moment of use (CSS follows the media query itself)
  let destroyed = false;
  let phase = 'off'; // off → boot → ready

  // ── body: the focus target and the listbox whose options are the current screen's rows
  const hintId = nid('hint');
  const el = h('div', 'ipodc', { tabindex: 0, role: 'listbox', 'aria-describedby': hintId });
  const sw = IPOD.screenWindow;
  const mm = {
    w: IPOD.width, h: IPOD.height, r: IPOD.cornerRadius,
    'win-x': sw.x, 'win-y': sw.y, 'win-w': sw.width, 'win-h': sw.height, 'win-r': sw.radius,
    'lcd-x': (sw.width - IPOD.screen.width) / 2, 'lcd-y': (sw.height - IPOD.screen.height) / 2,
    'lcd-w': IPOD.screen.width, 'lcd-h': IPOD.screen.height,
    'wh-x': IPOD.wheel.cx - IPOD.wheel.diameter / 2, 'wh-y': IPOD.wheel.cy - IPOD.wheel.diameter / 2,
    'wh-d': IPOD.wheel.diameter, 'cb-d': IPOD.centerButton.diameter,
    'lab-r': (IPOD.wheelLabels.radiusFactor * IPOD.wheel.diameter) / 2,
    'hold-x': IPOD.holdSwitch.x, 'hold-w': IPOD.holdSwitch.width,
    'jack-x': IPOD.headphoneJack.x, 'jack-d': IPOD.headphoneJack.diameter,
  };
  for (const [k, v] of Object.entries(mm)) el.style.setProperty(`--ipodc-mm-${k}`, +v.toFixed(4));
  for (const [k, v] of Object.entries(COLORS)) el.style.setProperty(`--ipodc-c-${k}`, v);
  el.style.setProperty('--ipodc-noise', `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`);

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
  // the live region sits beside the body (outside the listbox, which may only own options)
  const live = h('div', 'ipodc-sr', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  const hint = h('div', 'ipodc-sr', { id: hintId, text: L.hint });
  const edge = h('div', 'ipodc-edge', hidden); // top edge: hold switch and headphone jack
  edge.append(h('span', 'ipodc-hold'), h('span', 'ipodc-jack'));
  el.append(edge, win, wheel, hint);
  el.insertAdjacentHTML('beforeend', sharedDefs(`${P}s`));
  container.append(el, live);

  /** real px per logical px (to measure wrapped text) */
  const pxPer = () => (lcd.clientWidth > 0 ? lcd.clientWidth / LW : 1);

  let announceT = 0;
  const announce = (text) => {
    timers.cancel(announceT);
    live.textContent = '';
    announceT = timers.later(() => { live.textContent = text; }, 140);
  };

  // ── player
  const npItem = menu.find((m) => m.type === 'nowplaying');
  const tracks = !npItem ? [] : Array.isArray(npItem.tracks) && npItem.tracks.length
    ? npItem.tracks.filter((t) => t && typeof t === 'object')
    : [{ title: npItem.title ?? '', artist: npItem.artist ?? '', duration: '3:30' }];
  const player = createPlayer(tracks, (kind) => {
    ind.classList.toggle('is-on', player.started);
    ind.classList.toggle('is-paused', !player.playing);
    current()?.update?.(kind === 'track');
    if (kind === 'track') {
      const t = tracks[player.track];
      announce(`${t.title ?? ''}${t.artist ? `, ${t.artist}` : ''}`);
    }
  });

  // ── toast
  let toastT = 0;
  function showToast(icon, text, sub) {
    toast.innerHTML = TOAST_ICON[icon] ?? '';
    toast.append(h('b', null, { text }));
    if (sub) toast.append(h('span', null, { text: sub }));
    toast.classList.add('is-on');
    announce(sub ? `${text} ${sub}` : text);
    timers.cancel(toastT);
    toastT = timers.later(() => toast.classList.remove('is-on'), 1700);
  }

  // ── links
  let programmatic = false;
  let lastLink = { a: null, t: 0 };
  function linkGuard(a) { // held keys / double taps open a link once
    const now = performance.now();
    if (lastLink.a === a && now - lastLink.t < 800) return true;
    lastLink = { a, t: now };
    return false;
  }
  function followLink(a, spec) {
    if (linkGuard(a)) return;
    programmatic = true;
    try { a.click(); } finally { programmatic = false; }
    linkFeedback(a, spec);
  }
  function linkFeedback(a, spec) {
    const href = a.getAttribute('href');
    if (a.hasAttribute('download')) showToast('check', L.downloadStarted, spec?.label);
    else if (/^mailto:/i.test(href)) {
      let to = href.slice(7).split('?')[0];
      try { to = decodeURIComponent(to); } catch { /* keep it raw */ }
      showToast('mail', L.mailOpening, to);
    } else if (/^https?:/i.test(href)) showToast('out', L.linkOpening, a.hostname.replace(/^www\./, ''));
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
    const guard = timers.later(() => { if (anims.get(node) === a) a.finish(); }, SLIDE_MS + 180);
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
    if (isReduced() || !outN || typeof inN.animate !== 'function') {
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
    if (!dir || isReduced() || !old.textContent || typeof old.animate !== 'function') { old.remove(); return; }
    old.getAnimations().forEach((a) => a.cancel());
    const o = { duration: SLIDE_MS, easing: EASE };
    const kf = (d, o0, o1, at) => [
      { opacity: o0, transform: `translateX(${d * (o0 ? 0 : 30)}%)` },
      { opacity: 0, transform: `translateX(${d * 22}%)`, offset: at },
      { opacity: o1, transform: `translateX(${d * (o1 ? 0 : 30)}%)` },
    ];
    old.animate(kf(-dir, 1, 0, 0.42), { ...o, fill: 'forwards' }).finished.then(() => old.remove(), () => old.remove());
    titleEl.animate(kf(dir, 0, 1, 0.38), { ...o, fill: 'backwards' });
  }

  function show(s) {
    s.node.removeAttribute('aria-hidden');
    stage.append(s.node);
    s.layout();
    s.enteredAt = performance.now();
    syncAD();
    s.onShow?.();
  }
  const describe = (s) => {
    const extra = typeof s.summary === 'function' ? s.summary() : s.summary;
    return [s.title, extra, s.currentLabel()].filter(Boolean).join('. ');
  };
  function open(item) {
    const s = buildScreen(item);
    const prev = current();
    prev.onHide?.();
    prev.node.setAttribute('aria-hidden', 'true');
    stack.push(s);
    show(s);
    setTitle(s.title, 1);
    slide(prev.node, s.node, 1).then(() => { if (!isCurrent(prev)) prev.node.remove(); });
    announce(describe(s));
  }
  function back() {
    if (stack.length < 2) return false;
    const top = stack.pop();
    top.onHide?.();
    top.node.setAttribute('aria-hidden', 'true');
    const prev = current();
    show(prev);
    setTitle(prev.title, -1);
    slide(top.node, prev.node, -1).then(() => top.node.remove());
    announce(`${prev.title}. ${prev.currentLabel()}`);
    return true;
  }

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

  let lastHaptic = 0;
  function step(dir, src) {
    if (phase !== 'ready' || destroyed || !dir) return false;
    const s = current();
    const moved = s.move(dir);
    if (!moved) s.bump(dir);
    else {
      sound.play('tick');
      const now = performance.now();
      if (src === 'touch' && soundOn && now - lastHaptic > 35) {
        lastHaptic = now;
        try { navigator.vibrate?.(4); } catch { /* not allowed */ }
      }
    }
    return moved;
  }
  function scroll(steps) {
    const n = Math.trunc(Number(steps) || 0);
    for (let i = 0; i < Math.abs(n); i++) if (!step(Math.sign(n), 'api')) break;
  }
  function jump(to) {
    if (phase !== 'ready' || destroyed) return;
    const s = current();
    if (s.jump(to)) sound.play('tick'); else s.bump(to > s.index ? 1 : -1);
  }

  const { menuScreen, buildScreen } = createScreens({
    L, brand, menu, P, nid, timers, player, isReduced, isCurrent, pxPer, syncAD, announce, showToast, followLink, open,
  });

  const focusRoot = () => { if (document.activeElement !== el) el.focus({ preventScroll: true }); };

  // ── click wheel input (no momentum: the list stops when the finger lifts)
  const wheelIn = createWheel(wheel, {
    onDown() { sound.ensure(); focusRoot(); unflash(); },
    onStep: step,
    onPress: tap,
  });
  cleanups.push(() => wheelIn.destroy());
  on(wheel, 'contextmenu', (e) => e.preventDefault());
  on(wheel, 'touchmove', (e) => e.preventDefault(), { passive: false });

  // centre button: acts on pointerup inside it. It is not a <button> and has no click handler,
  // so a touch tap (whose click arrives with detail 0) can never fire a second activation.
  let centerDown = null;
  const centreUp = (e) => {
    if (centerDown !== e.pointerId) return;
    centerDown = null;
    centerBtn.classList.remove('is-pressed');
    el.classList.remove('is-centre');
    if (e.type !== 'pointerup') return;
    const r = centerBtn.getBoundingClientRect();
    if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) <= r.width / 2 + 8) tap('center');
  };
  on(centerBtn, 'pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    wheelIn.stop(); // a thumb sliding from ring to centre never leaves a stuck press highlight
    sound.ensure();
    focusRoot();
    unflash();
    centerDown = e.pointerId;
    centerBtn.classList.add('is-pressed');
    el.classList.add('is-centre');
    try { centerBtn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  });
  on(centerBtn, 'pointerup', centreUp);
  on(centerBtn, 'pointercancel', centreUp);
  on(centerBtn, 'lostpointercapture', centreUp);

  // ── screen: tap to choose, drag to scroll
  let sp = null;
  let suppressClick = false;
  on(stage, 'pointerdown', (e) => {
    if (phase !== 'ready' || e.button) return;
    focusRoot(); // mousedown is prevented below, so focus the iPod explicitly
    sp = { id: e.pointerId, y: e.clientY, x: e.clientX, acc: 0, drag: false, type: e.pointerType };
    suppressClick = false;
  });
  on(stage, 'pointermove', (e) => {
    if (!sp || e.pointerId !== sp.id) return;
    const dy = e.clientY - sp.y;
    if (!sp.drag) {
      if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(e.clientX - sp.x)) return;
      sp.drag = suppressClick = true;
      try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    }
    sp.acc += dy;
    sp.y = e.clientY;
    const unit = ROW * pxPer() * 0.8;
    while (sp.acc <= -unit) { sp.acc += unit; step(1, sp.type); }
    while (sp.acc >= unit) { sp.acc -= unit; step(-1, sp.type); }
  });
  const endSp = (e) => { if (sp?.id === e.pointerId) sp = null; };
  on(stage, 'pointerup', endSp);
  on(stage, 'pointercancel', endSp);
  on(stage, 'mousedown', (e) => e.preventDefault()); // keep focus on the iPod, no text selection
  on(stage, 'touchmove', (e) => e.preventDefault(), { passive: false });
  on(stage, 'dragstart', (e) => e.preventDefault());
  on(stage, 'click', (e) => {
    if (programmatic) return; // our own activation of a real <a>: let the browser follow it
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    const s = current();
    const ready = phase === 'ready' && s;
    const trk = e.target.closest('.ipodc-trk');
    if (trk && ready && s.node.contains(trk) && e.detail < 2) {
      sound.play('press');
      s.pickTrack?.(+trk.dataset.i);
      return;
    }
    const row = e.target.closest('.ipodc-row');
    if (!row) return;
    const i = ready ? s.rows.indexOf(row) : -1;
    const settling = !isReduced() && performance.now() - (s?.enteredAt ?? 0) < SLIDE_MS * 0.75;
    // only rows of the screen in place, never the 2nd click of a double-click or an inert row
    if (i < 0 || e.detail > 1 || settling || row.classList.contains('is-dead')) { e.preventDefault(); return; }
    s.setIndex(i);
    sound.play('press');
    const spec = s.specs[i];
    if (spec.onActivate || !row.href) { e.preventDefault(); spec.onActivate?.(); } else if (linkGuard(row)) e.preventDefault();
    else linkFeedback(row, spec); // native navigation proceeds (new tab / mailto / download)
  });

  // ── mouse wheel / trackpad
  let wAcc = 0;
  let wLast = 0;
  on(el, 'wheel', (e) => {
    if (phase === 'off' || destroyed) return;
    e.preventDefault(); // also during boot: the page behind must never scroll under the iPod
    if (phase !== 'ready') return;
    const now = performance.now();
    const gap = now - wLast;
    wLast = now;
    const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    // line/page mode, a big notch, or a separate notch after a pause (mice that report tiny deltas,
    // ~4 px on macOS) is exactly one step; continuous trackpad streams (~16 ms apart) accumulate
    if (raw && (e.deltaMode || Math.abs(raw) >= 50 || gap > 220 || (gap > 90 && Math.abs(raw) >= 3))) { wAcc = 0; step(Math.sign(raw), 'wheel'); return; }
    wAcc += raw;
    while (wAcc >= 34) { wAcc -= 34; step(1, 'wheel'); }
    while (wAcc <= -34) { wAcc += 34; step(-1, 'wheel'); }
  }, { passive: false });

  // ── keyboard
  function onKey(e) {
    if (phase !== 'ready' || destroyed || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    const once = (btn) => { if (!e.repeat) { sound.ensure(); tap(btn); } };
    sound.ensure();
    switch (k) {
      case 'ArrowLeft': case 'ArrowRight':
        if (e.shiftKey) { once(k === 'ArrowRight' ? 'next' : 'prev'); break; }
        step(k === 'ArrowRight' ? 1 : -1, 'key');
        break;
      case 'ArrowDown': case 'ArrowUp': step(k === 'ArrowDown' ? 1 : -1, 'key'); break;
      case 'PageDown': case 'PageUp': jump(current().index + (k === 'PageDown' ? PAGE : -PAGE)); break;
      case 'Home': jump(-Infinity); break;
      case 'End': jump(Infinity); break;
      case 'Enter': once('center'); break;
      case 'Escape': case 'Backspace': once('menu'); break;
      case ' ': case 'Spacebar': case 'MediaPlayPause': once('play'); break;
      case 'MediaTrackNext': once('next'); break;
      case 'MediaTrackPrevious': once('prev'); break;
      default: return;
    }
    e.preventDefault();
  }
  on(el, 'keydown', onKey);
  // With nothing else focused (e.g. right after the intro) the iPod is the obvious keyboard target,
  // but only while it is really on screen and on top (not minimised, hidden or covered).
  const onTop = () => {
    const r = centerBtn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (!r.width || x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
    return el.contains(document.elementFromPoint(x, y));
  };
  on(document, 'keydown', (e) => {
    if (e.key === 'Tab') el.dataset.input = 'key'; // keyboard navigation: show the focus ring
    if (e.target !== document.body && e.target !== document.documentElement) return;
    if (e.defaultPrevented || phase !== 'ready' || !onTop()) return;
    const se = document.scrollingElement;
    if (se && se.scrollHeight > se.clientHeight + 2 && /^(Arrow|Spacebar$| $|Page|Home$|End$)/.test(e.key)) return; // leave page scrolling alone
    onKey(e);
  });
  // pointer users get no focus ring (focus still moves to the iPod so the keys work afterwards)
  on(el, 'pointerdown', () => { el.dataset.input = 'pointer'; sound.ensure(); });
  // touch pointerdown is not a user activation for audio: unlock on pointerup / click as well
  on(el, 'pointerup', () => sound.ensure());
  on(el, 'click', () => sound.ensure());

  // ── resize
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    let lastW = 0;
    ro = new ResizeObserver(() => {
      const w = lcd.clientWidth;
      if (!w || Math.abs(w - lastW) < 0.5) return;
      lastW = w;
      current()?.layout();
    });
    ro.observe(lcd);
  }

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
    for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* ignore */ } }
    for (const a of anims.values()) a.cancel();
    timers.clearAll();
    ro?.disconnect();
    player.destroy();
    sound.close();
    live.remove();
    el.remove();
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
