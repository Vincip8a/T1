// iPod Classic (6th/7th gen, silver) linktree UI.
// API per ARCHITECTURE.md: mountIpod(container, { config }) → { el, getShellRect, reveal, press, scroll, home, focus, getState, destroy }
//
// The LCD UI is laid out in a logical 320×240 px space with container-query units
// (--ipodc-p = 100cqw / 320 is one logical px), so text renders at its real size and stays crisp.
// Modules: wheel.js (click-wheel input), player.js (simulated playback), screens.js (screen
// builders), sound.js (WebAudio ticks), art.js (procedural SVG), util.js (helpers, timers).
import './ipodc.css';
import { IPOD, COLORS } from '../shared/ipodSpec.js';
import { prefersReducedMotion as isReduced, isOff } from '../shared/config.js';
import { h, createTimers } from './util.js';
import { firstText } from '../shared/href.js';
import { GLYPH, playIndicator, battery, sharedDefs } from './art.js';
import { createSound } from './sound.js';
import { createPlayer } from './player.js';
import { createWheel } from './wheel.js';
import { createScreens } from './screens.js';

const SLIDE_MS = 260;
// a freshly opened screen ignores the centre button / Enter this long: a double press opens an item,
// never also the first link on the screen it opened (going back with MENU is not guarded)
const SETTLE_MS = 450;
const EASE = 'cubic-bezier(.32,.08,.24,1)';
const SCREEN_TYPES = ['list', 'page', 'nowplaying', 'downloads'];
let seq = 0;

// UI strings (not content): German 6G firmware wording.
const DEFAULT_UI = {
  nowPlaying: 'Sie hören',
  openIn: 'In {service} öffnen', // {service}: Spotify, Apple Music, … (serviceName in src/shared/href.js)
  openPlaylist: 'Playlist öffnen',
  tracklist: 'Titelliste',
  of: 'von',
  volume: 'Lautstärke',
  playing: 'Wiedergabe',
  paused: 'Pause',
  link: 'Link',
  newTab: 'Link, öffnet in neuem Tab',
  mail: 'E-Mail-Link',
  download: 'Download',
  downloadStarted: 'Download gestartet',
  backHint: 'Zurück mit MENU',
  back: 'Zurück',
  empty: 'Keine Einträge',
  hint: 'Pfeiltasten blättern, Enter wählt, Escape zurück, Leertaste Wiedergabe.',
};

export function mountIpod(container, { config } = {}) {
  config ??= {};
  const brand = config.brand ?? {};
  // entries without a name or with an unknown type would be blank or broken rows: skip them, with a hint
  const menu = (Array.isArray(config.menu) ? config.menu : []).filter((m) => {
    const ok = m && typeof m === 'object' && firstText(m.label, m.title) && SCREEN_TYPES.includes(m.type);
    if (!ok) console.warn('[ipod] config.json: menu entry skipped (needs label or title and type list | page | nowplaying | downloads):', m);
    return ok;
  });
  const L = DEFAULT_UI;
  const P = `ipodc${++seq}`;
  let uid = 0;
  const nid = (s) => `${P}-${s}${++uid}`;
  const cleanups = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    cleanups.push(() => t.removeEventListener(type, fn, o));
  };
  const timers = createTimers();
  const soundOn = !isOff(config.settings?.clickSound);
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

  // ── skeleton: top edge (hold switch, headphone jack), display window with the 320×240 UI, click
  // wheel (a pointer surface only: the keyboard covers every button, so it is hidden from AT)
  const hid = 'aria-hidden="true"';
  el.innerHTML = `<div class="ipodc-edge" ${hid}><i class="ipodc-hold"></i><i class="ipodc-jack"></i></div>`
    + '<div class="ipodc-window"><div class="ipodc-lcd"><div class="ipodc-ui">'
    + `<div class="ipodc-bar" ${hid}><span class="ipodc-ind">${playIndicator(P)}</span><div class="ipodc-title"></div><span class="ipodc-batt">${battery(P)}</span></div>`
    + `<div class="ipodc-stage"></div><div class="ipodc-toast" ${hid}></div><div class="ipodc-boot" ${hid}><div class="ipodc-boot-mono"></div></div>`
    + `</div></div><div class="ipodc-glare"></div></div><div class="ipodc-wheel" ${hid}><span class="ipodc-wbtn ipodc-wbtn--menu">${IPOD.wheelLabels.menu ?? 'MENU'}</span>`
    + ['next', 'prev', 'play'].map((n) => `<span class="ipodc-wbtn ipodc-wbtn--${n}">${GLYPH[n]}</span>`).join('')
    + `<div class="ipodc-center"></div></div>${sharedDefs(`${P}s`)}`;
  const [lcd, ind, titleEl, stage, toast, boot, wheel, centerBtn] = ['lcd', 'ind', 'title', 'stage', 'toast', 'boot', 'wheel', 'center']
    .map((c) => el.querySelector(`.ipodc-${c}`));
  boot.firstChild.textContent = brand.monogram ?? '';
  // a landmark around the body (display: contents, so it adds no box); the key hint (aria-describedby)
  // and the live region sit beside the body because the listbox may only own options
  const hint = h('div', 'ipodc-sr', { id: hintId, text: L.hint });
  const live = h('div', 'ipodc-sr', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  // the iPod's name ("<screen title>, iPod"): an element, not aria-label, so the title can carry its
  // own language (config.json lang, e.g. "Work Together" in English); aria-hidden, as the title bar is
  const nameId = nid('name');
  const nameEl = h('div', 'ipodc-sr', { id: nameId, 'aria-hidden': 'true' });
  el.setAttribute('aria-labelledby', nameId);
  // the wheel is aria-hidden, so touch screen-reader users (VoiceOver, TalkBack) get MENU as an
  // invisible button; it is outside the tab order (keyboard users have Esc / Backspace)
  const backBtn = h('button', 'ipodc-sr', { type: 'button', tabindex: -1, hidden: '' });
  backBtn.textContent = L.back;
  const host = h('section', 'ipodc-host', { 'aria-label': 'iPod' });
  host.append(el, nameEl, hint, backBtn, live);
  container.append(host);

  /** real px per logical px (to measure wrapped text) */
  const pxPer = () => lcd.clientWidth / IPOD.screen.pxWidth || 1;

  let announceT = 0;
  /** `content`: text, or a list of texts and elements (a part in another language is a span with lang) */
  const announce = (content) => {
    timers.cancel(announceT);
    live.textContent = '';
    announceT = timers.later(() => { live.replaceChildren(...[].concat(content)); }, 140);
  };
  const inLang = (text, lang) => (lang ? h('span', null, { text, lang }) : text);

  // ── player
  const npItem = menu.find((m) => m.type === 'nowplaying');
  const tracks = !npItem ? [] : Array.isArray(npItem.tracks) && npItem.tracks.length
    ? npItem.tracks.filter((t) => t && typeof t === 'object')
    : [{ title: firstText(npItem.title, npItem.label), artist: npItem.artist }];
  const player = createPlayer(tracks, (kind) => {
    ind.classList.toggle('is-on', player.started);
    ind.classList.toggle('is-paused', !player.playing);
    current()?.update?.(kind === 'track');
    // track changes are news only on Now Playing: the silent player keeps running behind other screens
    if (kind === 'track' && current()?.kind === 'nowplaying') {
      const t = tracks[player.track];
      announce([t.title, t.artist].filter(Boolean).join(', '));
    }
  });

  // ── toast
  let toastT = 0;
  function showToast(text, sub) {
    toast.replaceChildren(h('b', null, { text }));
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
    if (a.hasAttribute('download')) showToast(L.downloadStarted, spec.label);
  }

  // ── navigation
  const stack = [];
  const current = () => stack[stack.length - 1];
  const isCurrent = (s) => !!s && current() === s;
  /** the element with keyboard focus: the iPod (a listbox with aria-activedescendant), or on a screen
   *  of links the current row itself (roving tabindex), so screen readers meet real links */
  const keyTarget = () => {
    const s = current();
    return (s?.roving && s.rows[s.index]) || el;
  };
  const syncAD = () => {
    const s = current();
    const id = s?.adId();
    if (id) el.setAttribute('aria-activedescendant', id); else el.removeAttribute('aria-activedescendant');
    el.setAttribute('role', s?.roving ? 'group' : 'listbox');
    el.tabIndex = s?.roving ? -1 : 0;
    if (s?.roving) s.rows.forEach((r, i) => { r.tabIndex = i === s.index ? 0 : -1; });
    // focus follows the selection while it is anywhere in the iPod
    const t = keyTarget();
    if (el.contains(document.activeElement) && document.activeElement !== t) t.focus({ preventScroll: true });
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
  /** title bar: centred title of the current screen (also names the listbox); on navigation the new
   *  title glides in from the side the screen comes from */
  function setTitle(text, dir, lang = null) {
    titleEl.textContent = text;
    if (lang) titleEl.lang = lang; else titleEl.removeAttribute('lang');
    nameEl.replaceChildren(inLang(text, lang), ', iPod');
    if (dir && !isReduced()) titleEl.animate?.({ opacity: [0, 1], transform: [`translateX(${dir * 14}%)`, 'none'] }, { duration: SLIDE_MS, easing: EASE });
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
    passDir = 0;
    from.onHide?.();
    from.node.setAttribute('aria-hidden', 'true');
    for (const r of from.rows) r.tabIndex = -1;
    to.opened = dir > 0;
    show(to);
    setTitle(to.title, dir, to.lang);
    backBtn.hidden = stack.length < 2;
    slide(from.node, to.node, dir).then(() => { if (!isCurrent(from)) from.node.remove(); });
    const extra = dir > 0 && (typeof to.summary === 'function' ? to.summary() : to.summary);
    // a focused link row is read by the screen reader itself
    const focused = to.roving && document.activeElement === keyTarget();
    // (one period between the parts, also when a part already ends in one; title and row label in their own language)
    const parts = [[to.title, to.lang], [extra], [!focused && to.currentLabel(), to.currentLang()]].filter(([x]) => x)
      .map(([x, lang]) => inLang(String(x).replace(/[.!?:]\s*$/, ''), lang));
    announce(parts.flatMap((p, i) => (i ? ['. ', p] : [p])));
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
  /** `at`: when the press began (the centre acts on release, a slow second tap still counts as early) */
  function press(btn, at = performance.now()) {
    if (phase !== 'ready' || destroyed) return;
    sound.play('press');
    const s = current();
    if (btn === 'menu') back();
    else if (btn === 'center') { if (!s.opened || at - s.enteredAt >= SETTLE_MS) s.activate(); }
    else if (btn === 'play' && tracks.length) {
      player.setPlaying(!player.playing);
      announce(player.playing ? L.playing : L.paused);
    } else if ((btn === 'next' || btn === 'prev') && (s.kind === 'nowplaying' || player.started)) player.skip(btn === 'next' ? 1 : -1);
  }
  const tap = (btn, at) => { flash(btn); press(btn, at); };

  /** quiet: at a list end, no bump (the mouse wheel then scrolls the page instead) */
  function step(dir, quiet = false) {
    if (phase !== 'ready' || destroyed || !dir) return false;
    const s = current();
    const moved = s.move(dir);
    if (moved) sound.play('tick'); else if (!quiet) s.bump(dir);
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

  const focusRoot = () => { const t = keyTarget(); if (document.activeElement !== t) t.focus({ preventScroll: true }); };

  // ── click wheel input (no momentum: the list stops when the finger lifts)
  const stopWheel = createWheel(wheel, on, {
    onDown() { sound.ensure(); focusRoot(); unflash(); },
    onStep: step,
    onPress: tap,
  });
  cleanups.push(stopWheel);
  on(wheel, 'contextmenu', (e) => e.preventDefault());
  on(backBtn, 'click', () => { press('menu'); if (stack.length < 2) focusRoot(); });

  // centre button: acts on pointerup inside it. It is not a <button> and has no click handler,
  // so a touch tap (whose click arrives with detail 0) can never fire a second activation.
  let centerDown = null;
  let centerDownAt = 0;
  const centreUp = (e) => {
    if (centerDown !== e.pointerId) return;
    centerDown = null;
    unflash();
    if (e.type !== 'pointerup') return;
    const r = centerBtn.getBoundingClientRect();
    if (Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) <= r.width / 2 + 8) tap('center', centerDownAt);
  };
  on(centerBtn, 'pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    stopWheel(); // a thumb sliding from ring to centre never leaves a stuck press highlight
    sound.ensure();
    focusRoot();
    unflash();
    centerDown = e.pointerId;
    centerDownAt = e.timeStamp; // when the finger came down, even if the main thread was busy then
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
    // only rows of the screen in place, never the 2nd click of a double-click
    if (i < 0 || e.detail > 1 || settling) return prevent(e);
    s.setIndex(i);
    sound.play('press');
    const spec = s.specs[i];
    if (spec.onActivate || !row.href) { prevent(e); spec.onActivate?.(); } else if (linkGuard(row)) prevent(e);
    else linkFeedback(row, spec); // native navigation proceeds (new tab / mailto / download)
  });

  // ── mouse wheel / trackpad
  // The page behind never scrolls under the iPod, except when browser zoom made the window larger than
  // the screen (the stage scrolls then): once the list is at its end in that direction, the wheel
  // scrolls the page, so the click wheel below the fold can be reached.
  let wAcc = 0;
  let wLast = 0;
  let passDir = 0; // the list is at its end this way and the page can scroll: the wheel scrolls the page
  const pageCanScroll = (dir) => {
    for (let n = host.parentElement; n && n !== document.body; n = n.parentElement) {
      if (!/(auto|scroll)/.test(getComputedStyle(n).overflowY)) continue;
      const max = n.scrollHeight - n.clientHeight;
      if (max > 1) return dir > 0 ? n.scrollTop < max - 1 : n.scrollTop > 0;
    }
    return false;
  };
  on(el, 'wheel', (e) => {
    // Ctrl + wheel (and a trackpad pinch, which arrives as one) zooms the page, as everywhere else
    if (e.ctrlKey || phase === 'off' || destroyed) return;
    const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    const dir = Math.sign(raw);
    const page = phase === 'ready' && dir !== 0 && Math.abs(e.deltaY) >= Math.abs(e.deltaX) && pageCanScroll(dir);
    if (page && passDir === dir) return; // native page scroll
    passDir = 0;
    e.preventDefault(); // also during boot
    const now = performance.now();
    const gap = now - wLast;
    wLast = now;
    const stepOrPass = (d) => {
      const moved = step(d, page);
      if (!moved && page) { passDir = d; wAcc = 0; }
      return moved;
    };
    // line/page mode, a big notch, or a separate notch after a pause (mice that report tiny deltas)
    // is exactly one step; continuous trackpad streams (~16 ms apart) accumulate
    if (raw && (e.deltaMode || Math.abs(raw) >= 50 || gap > 150)) {
      wAcc = 0;
      return stepOrPass(dir);
    }
    wAcc += raw;
    for (; wAcc >= 34; wAcc -= 34) if (!stepOrPass(1)) break;
    for (; wAcc <= -34; wAcc += 34) if (!stepOrPass(-1)) break;
  }, { passive: false });

  // ── keyboard
  const KEYS = {
    ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1,
    Enter: 'center', Escape: 'menu', Backspace: 'menu', ' ': 'play',
  };
  function onKey(e) {
    if (phase !== 'ready' || destroyed || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    const i = current().index;
    let a = KEYS[k];
    if (e.shiftKey && /^Arrow(Left|Right)$/.test(k)) a = a > 0 ? 'next' : 'prev';
    sound.ensure();
    if (k === 'Home' || k === 'End') jump(k === 'Home' ? -Infinity : Infinity);
    else if (k === 'PageDown' || k === 'PageUp') jump(i + (k === 'PageDown' ? 4 : -4)); // half a screen
    else if (typeof a === 'number') step(a);
    else if (!a) return;
    else if (!e.repeat) tap(a, e.timeStamp);
    e.preventDefault();
    // browser zoom made the stage scroll (focus moves with preventScroll): a key never changes the
    // selection out of sight, the screen comes back into view
    if (pageCanScroll(1) || pageCanScroll(-1)) lcd.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  on(el, 'keydown', onKey);
  // the focus ring follows the last input, like :focus-visible: any key except a lone modifier or a
  // shortcut shows it (arrows inside the iPod too), any pointer press anywhere hides it again (capture
  // phase: it runs before handlers that move focus, and also for keys on rows that are detached next)
  on(document, 'keydown', (e) => {
    if (!e.metaKey && !e.ctrlKey && !/^(Shift|Control|Alt|Meta)$/.test(e.key)) el.dataset.input = 'key';
  }, true);
  on(document, 'pointerdown', () => { el.dataset.input = 'pointer'; }, true);
  // pointer users get no focus ring (focus still moves to the iPod so the keys work afterwards);
  // touch pointerdown is not a user activation for audio: unlock on pointerup / click as well
  on(el, 'pointerdown', sound.ensure);
  on(el, 'pointerup', sound.ensure);
  on(el, 'click', sound.ensure);

  // ── resize: re-measure (text wrapping) whenever the LCD changes size
  const ro = new ResizeObserver(() => current().layout());
  ro.observe(lcd);

  // ── boot / reveal
  const menuScr = menuScreen();
  stack.push(menuScr);
  show(menuScr);
  setTitle(menuScr.title);

  /** "Links" in the menu bar: back to the main menu in one slide, MENU flashes, focus (with its ring when
   *  "Links" was activated from the keyboard). Pressed before the iPod is ready (intro, boot screen), it
   *  runs once it is. */
  let homeAfterBoot = null;
  function home({ keyboard = el.dataset.input === 'key' } = {}) {
    if (destroyed) return;
    if (phase !== 'ready') { homeAfterBoot = { keyboard }; return; }
    flash('menu');
    sound.play('press');
    if (stack.length > 2) stack.splice(1, stack.length - 2); // slide straight from the top screen
    back();
    el.dataset.input = keyboard ? 'key' : 'pointer';
    keyTarget().focus({ preventScroll: true, focusVisible: keyboard });
  }

  // destroy() clears the timers, so it also settles every pending wait: reveal() then returns early
  const waiting = new Set();
  const wait = (ms) => new Promise((r) => {
    waiting.add(r);
    timers.later(() => { waiting.delete(r); r(); }, ms);
  });
  let revealP = null;
  function reveal({ boot: doBoot = true } = {}) {
    revealP ??= (async () => {
      el.classList.add('is-revealed');
      menuScr.layout();
      if (doBoot) {
        const rm = isReduced();
        phase = 'boot';
        await wait(rm ? 40 : 220);
        if (destroyed) return;
        boot.classList.add('show-mono');
        await wait(rm ? 450 : 950);
        if (destroyed) return;
        boot.classList.add('is-out');
        await wait(rm ? 80 : 340);
      }
      if (destroyed) return;
      boot.hidden = true;
      current().layout();
      phase = 'ready';
      if (homeAfterBoot) { const o = homeAfterBoot; homeAfterBoot = null; home(o); }
      // focus moving onto the iPod (main.js does that next) already reads the selected row
      timers.later(() => { if (!el.contains(document.activeElement)) announce([`${menuScr.title}: `, inLang(menuScr.currentLabel(), menuScr.currentLang())]); }, 60);
    })();
    return revealP;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const fn of cleanups) { try { fn(); } catch { /* ignore */ } }
    for (const a of anims.values()) a.cancel();
    timers.clearAll();
    waiting.forEach((r) => r());
    waiting.clear();
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
    home,
    focus: focusRoot,
    getState: () => {
      const s = current();
      return { screen: phase === 'ready' ? s.kind : phase, path: stack.slice(1).map((x) => x.id), index: s.index };
    },
    destroy,
  };
}
