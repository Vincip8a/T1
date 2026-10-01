// iPod Classic (6th/7th gen, silver) linktree UI. Variant C: authentic look + physical feel.
// API per CONTRACT.md: mountIpod(container, { config }) → { el, getShellRect, reveal, press, scroll, getState, destroy }
//
// The LCD UI is laid out in a logical 320×240 px space. Instead of a JS-driven transform scale it
// uses container-query units: --ipodc-p = 100cqw / 320 is one logical px, so text is rendered at
// its real size (crisp) and can never be stale after an --ipod-h change.
import './ipodc.css';
import { IPOD, COLORS } from '../../../shared/ipodSpec.js';
import { prefersReducedMotion } from '../../../shared/config.js';
import { NOISE_SVG, CHEVRON, GLYPH, playIndicator, battery, TOAST_ICON, SPEAKER_LO, SPEAKER_HI, SPEAKER_NOW, previewIcon, sharedDefs } from './art.js';
import { createSound } from './sound.js';

const LW = IPOD.screen.pxWidth;          // 320 logical px
const LH = IPOD.screen.pxHeight;         // 240 logical px
const BAR = 22;                          // title bar (incl. its 1 px rule)
const STAGE_H = LH - BAR;                // 218
const ROW = 27;                          // 8 rows per screen, like the 6G
const BASE_STEP = 20;                    // degrees of wheel arc per step at normal speed
const TEXT_STEP = 34;                    // two text lines per step on text pages
const SLIDE_MS = 260;
const SETTLE_MS = 90;                    // preview pane waits for the highlight to rest
let instanceSeq = 0;

// ───────────────────────── helpers ─────────────────────────
function h(tag, cls, attrs) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : String(v));
    }
  }
  return n;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const normDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

function parseDuration(s) {
  const parts = String(s ?? '').split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 210;
  return parts.reduce((acc, n) => acc * 60 + n, 0) || 210;
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function resolveAsset(path) {
  if (!path) return '';
  if (/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(path)) return path;
  const base = import.meta.env?.BASE_URL ?? './';
  return base + String(path).replace(/^\.\//, '');
}
/** Allow only web, mail and phone links plus relative paths; drops javascript:, data: and the like. */
function safeHref(href) {
  const s = String(href ?? '').trim();
  if (!s) return null;
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  if (m) return /^(https?|mailto|tel)$/i.test(m[1]) ? s : null;
  return resolveAsset(s);
}
const fileName = (p) => String(p ?? '').split(/[?#]/)[0].split('/').pop() || '';
/** Decode a URI component without ever throwing on malformed input (e.g. "mailto:a%@b.c"). */
function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// UI strings (not content): overridable per site via config.ui, German defaults.
const DEFAULT_UI = {
  nowPlaying: 'Now Playing',
  openSpotify: 'In Spotify öffnen',
  of: 'von',
  tracks: 'Titel',
  select: 'Auswählen',
  back: 'zurück',
  next: 'Nächster Titel',
  prev: 'Vorheriger Titel',
  playPause: 'Wiedergabe / Pause',
  playing: 'Wiedergabe',
  paused: 'Pause',
  volume: 'Lautstärke',
  wheel: 'Click Wheel',
  download: 'Download',
  downloadStarted: 'Download gestartet',
  mailOpening: 'E-Mail wird geöffnet',
  linkOpening: 'Wird geöffnet …',
  hint: 'Pfeiltasten oder Click Wheel zum Blättern, Enter wählt aus, Escape geht zurück, Leertaste startet oder pausiert die Wiedergabe.',
};

// ───────────────────────── mount ─────────────────────────
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
  const soundOn = config.settings?.clickSound !== false;
  const sound = createSound(soundOn);
  let destroyed = false;

  // ── body
  const hintId = nid('hint');
  const el = h('div', 'ipodc', {
    tabindex: 0,
    role: 'group',
    'aria-roledescription': 'iPod',
    'aria-label': `iPod${brand.name ? ` – ${brand.name}` : ''}`,
    'aria-describedby': hintId,
  });
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
  for (const [k, v] of Object.entries(mm)) el.style.setProperty(`--ipodc-mm-${k}`, String(+v.toFixed(4)));
  for (const [k, v] of Object.entries(COLORS)) el.style.setProperty(`--ipodc-c-${k}`, v);
  el.style.setProperty('--ipodc-lw', String(LW));
  el.style.setProperty('--ipodc-noise', `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`);

  // Live reduced-motion: follows OS changes mid-session (CSS + JS).
  // `isReduced()` reads the media query at the moment of use, so it is right even before the
  // change event has been delivered; the listener keeps the CSS class in sync.
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  const isReduced = () => {
    const r = mq ? mq.matches : prefersReducedMotion();
    if (el.classList.contains('ipodc--reduced') !== r) el.classList.toggle('ipodc--reduced', r);
    return r;
  };
  isReduced();
  if (mq?.addEventListener) {
    mq.addEventListener('change', isReduced);
    cleanups.push(() => mq.removeEventListener('change', isReduced));
  }

  // ── screen
  const win = h('div', 'ipodc-window');
  const lcd = h('div', 'ipodc-lcd');
  const ui = h('div', 'ipodc-ui');
  const bar = h('div', 'ipodc-bar', { 'aria-hidden': 'true' });
  const ind = h('span', 'ipodc-ind');
  ind.innerHTML = playIndicator(P);
  const titles = h('div', 'ipodc-titles');
  let titleEl = h('span', 'ipodc-title');
  titles.append(titleEl);
  const batt = h('span', 'ipodc-batt');
  batt.innerHTML = battery(P);
  bar.append(ind, titles, batt);
  const stage = h('div', 'ipodc-stage');
  const toast = h('div', 'ipodc-toast', { 'aria-hidden': 'true' });
  const boot = h('div', 'ipodc-boot', { 'aria-hidden': 'true' });
  boot.append(h('div', 'ipodc-boot-mono', { text: brand.monogram ?? '' }));
  ui.append(bar, stage, toast, boot);
  lcd.append(ui);
  win.append(lcd, h('div', 'ipodc-glare'));

  // ── click wheel
  const wheel = h('div', 'ipodc-wheel', { role: 'group', 'aria-label': L.wheel });
  const inner = (IPOD.centerButton.diameter / IPOD.wheel.diameter) * 50 + 0.4;
  const sector = (a0, a1) => {
    const p = (r, a) => `${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`;
    const [s, e] = [(a0 * Math.PI) / 180, (a1 * Math.PI) / 180];
    return `M${p(50, s)}A50 50 0 0 1 ${p(50, e)}L${p(inner, e)}A${inner} ${inner} 0 0 0 ${p(inner, s)}Z`;
  };
  const quad = h('div', 'ipodc-quad-wrap', { 'aria-hidden': 'true' });
  quad.innerHTML = `<svg class="ipodc-quad" viewBox="-50 -50 100 100"><defs><radialGradient id="${P}qg" cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse"><stop offset="${(inner / 50).toFixed(3)}" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".13"/></radialGradient></defs>
    <path data-q="menu" d="${sector(-135, -45)}" fill="url(#${P}qg)"/><path data-q="next" d="${sector(-45, 45)}" fill="url(#${P}qg)"/>
    <path data-q="play" d="${sector(45, 135)}" fill="url(#${P}qg)"/><path data-q="prev" d="${sector(135, 225)}" fill="url(#${P}qg)"/></svg>`;
  const mkBtn = (name, label, content) => {
    const b = h('button', `ipodc-wbtn ipodc-wbtn--${name}`, { type: 'button', tabindex: -1, 'aria-label': label, 'data-btn': name });
    b.innerHTML = content;
    return b;
  };
  const centerBtn = h('button', 'ipodc-center', { type: 'button', tabindex: -1, 'aria-label': L.select });
  const menuLabel = IPOD.wheelLabels.menu ?? 'MENU';
  wheel.append(
    quad,
    mkBtn('menu', `${menuLabel} – ${L.back}`, menuLabel),
    mkBtn('next', L.next, GLYPH.next),
    mkBtn('prev', L.prev, GLYPH.prev),
    mkBtn('play', L.playPause, GLYPH.play),
    centerBtn,
  );
  const live = h('div', 'ipodc-sr', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  const hint = h('div', 'ipodc-sr', { id: hintId, text: L.hint });
  // top edge: hold switch (x = left edge) and headphone jack (x = centre), seen just over the rim
  const edge = h('div', 'ipodc-edge', { 'aria-hidden': 'true' });
  edge.append(h('span', 'ipodc-hold'), h('span', 'ipodc-jack'));
  el.append(edge, win, wheel, live, hint);
  el.insertAdjacentHTML('beforeend', sharedDefs(`${P}s`));
  container.append(el);

  /** Real px per logical px (only needed to measure wrapped text). */
  const pxPer = () => (lcd.clientWidth > 0 ? lcd.clientWidth / LW : 1);

  // ───────────────────────── announcements ─────────────────────────
  let announceT = 0;
  const announce = (text) => {
    clearTimeout(announceT);
    live.textContent = '';
    announceT = setTimeout(() => { live.textContent = text; }, 140);
  };

  // ───────────────────────── player ─────────────────────────
  const npItem = menu.find((m) => m.type === 'nowplaying') ?? null;
  const tracks = npItem
    ? (Array.isArray(npItem.tracks) && npItem.tracks.length
      ? npItem.tracks.filter((t) => t && typeof t === 'object')
      : [{ title: npItem.title ?? '', artist: npItem.artist ?? '', duration: '3:30' }])
    : [];
  const player = { track: 0, elapsed: 0, playing: false, started: false, volume: 0.6 };
  let npView = null;
  let ticker = 0;
  let lastT = 0;
  cleanups.push(() => clearInterval(ticker));

  function tickPlayer() {
    const now = performance.now();
    const dt = Math.min(1, (now - lastT) / 1000); // clamp after background throttling
    lastT = now;
    if (!player.playing || !tracks.length) return;
    player.elapsed += dt;
    if (player.elapsed >= parseDuration(tracks[player.track]?.duration)) {
      player.track = (player.track + 1) % tracks.length;
      player.elapsed = 0;
      npView?.update(true);
    }
    renderPlayer();
  }
  function setPlaying(v) {
    if (!tracks.length) return;
    player.playing = v;
    if (v) player.started = true;
    if (v && !ticker) { lastT = performance.now(); ticker = setInterval(tickPlayer, 250); }
    if (!v && ticker) { clearInterval(ticker); ticker = 0; }
    renderPlayer();
  }
  function renderPlayer() {
    ind.classList.toggle('is-on', player.started);
    ind.classList.toggle('is-paused', !player.playing);
    npView?.update();
  }
  function changeTrack(dir) {
    if (!tracks.length) return;
    if (dir < 0 && player.elapsed > 3) player.elapsed = 0;
    else {
      player.track = (player.track + dir + tracks.length) % tracks.length;
      player.elapsed = 0;
    }
    if (!player.started) setPlaying(true);
    npView?.update(true);
    renderPlayer();
    const t = tracks[player.track] ?? {};
    announce(`${t.title ?? ''}${t.artist ? `, ${t.artist}` : ''}`);
  }

  // ───────────────────────── cover art ─────────────────────────
  function coverArt(item, cls) {
    const box = h('div', `ipodc-art ${cls ?? ''}`.trim());
    const fb = h('div', 'ipodc-art-fb');
    fb.append(h('b', null, { text: brand.monogram ?? '' }));
    box.append(fb);
    const src = item?.cover ? safeHref(item.cover) : null;
    if (src) {
      const img = h('img', null, { alt: '', draggable: 'false', decoding: 'async' });
      img.addEventListener('error', () => img.remove(), { once: true });
      img.addEventListener('load', () => { if (!img.naturalWidth) img.remove(); }, { once: true });
      img.src = src;
      box.append(img);
    }
    return box;
  }

  // ───────────────────────── rows & list screens ─────────────────────────
  function makeRow(spec) {
    const href = spec.href ? safeHref(spec.href) : null;
    const row = h(href ? 'a' : 'div', 'ipodc-row', {
      role: 'option',
      id: nid('o'),
      'aria-selected': 'false',
      tabindex: href ? -1 : null,
      draggable: href ? 'false' : null,
    });
    if (href) {
      row.setAttribute('href', href);
      if (spec.download != null) row.setAttribute('download', spec.download);
      else if (/^https?:/i.test(href)) { row.target = '_blank'; row.rel = 'noopener'; }
    }
    row.append(h('span', 'ipodc-row-label', { text: spec.label ?? '' }));
    if (spec.detail) row.append(h('span', 'ipodc-row-detail', { text: spec.detail }));
    if (spec.sub) row.insertAdjacentHTML('beforeend', CHEVRON);
    if (spec.ariaLabel) row.setAttribute('aria-label', spec.ariaLabel);
    return row;
  }

  /** Generic scrolling list screen. All geometry in logical px. */
  function listScreen({ kind, id, title, rows: rawSpecs = [], pre = null, split = false }) {
    const specs = rawSpecs.filter(Boolean);
    const node = h('div', `ipodc-screen ipodc-screen--${kind}${split ? ' is-split' : ''}`);
    const view = h('div', 'ipodc-view');
    const content = h('div', 'ipodc-content');
    const list = h('div', 'ipodc-list', { role: 'listbox', 'aria-label': title || brand.name || 'iPod' });
    const hl = h('div', 'ipodc-hl', { 'aria-hidden': 'true' });
    list.append(hl);
    if (pre) content.append(pre);
    content.append(list);
    view.append(content);
    const sb = h('div', 'ipodc-sb', { 'aria-hidden': 'true' });
    const thumb = h('div', 'ipodc-sb-thumb');
    sb.append(thumb);
    node.append(view, sb);
    const rows = specs.map(makeRow);
    list.append(...rows);
    if (!rows.length) { hl.hidden = true; list.classList.add('is-empty'); }
    let bumpAt = 0;

    const s = {
      kind, id, title: title ?? '', node, rows, specs, index: 0, off: 0,
      listTop: 0, contentH: 0, viewH: STAGE_H, enteredAt: 0,
      onIndex: null, onShow: null, onHide: null,
      measure() {
        const k = pxPer();
        s.listTop = pre ? Math.round(pre.offsetHeight / k) : 0;
        s.contentH = s.listTop + rows.length * ROW;
        const vh = Math.round(view.clientHeight / k);
        if (vh > 0) s.viewH = vh;
      },
      layout() {
        // The scrollbar narrows the text column, which can re-wrap the text: measure twice.
        node.classList.remove('has-sb');
        s.measure();
        if (s.contentH > s.viewH + 1) { node.classList.add('has-sb'); s.measure(); }
        s.off = clamp(s.off, 0, s.maxOff());
        if (rows.length) s.setIndex(s.index, { silent: true, instant: true, ensure: kind !== 'page' || s.index > 0 });
        else s.paint(true);
      },
      maxOff: () => Math.max(0, s.contentH - s.viewH),
      rowTop: (i) => s.listTop + i * ROW,
      rowVisible(i) {
        const t = s.rowTop(i);
        return t >= s.off - 0.5 && t + ROW <= s.off + s.viewH + 0.5;
      },
      ensureVisible(i) {
        const t = s.rowTop(i);
        if (t < s.off) s.off = t;
        else if (t + ROW > s.off + s.viewH) s.off = t + ROW - s.viewH;
        s.off = clamp(s.off, 0, s.maxOff());
      },
      paint(instant = false) {
        if (instant) node.classList.add('is-instant');
        content.style.setProperty('--ipodc-off', String(s.off));
        hl.style.setProperty('--ipodc-i', String(s.index));
        if (s.contentH > s.viewH + 1) {
          const th = Math.max(14, Math.round((s.viewH * s.viewH) / s.contentH));
          const top = Math.round((s.viewH - th) * (s.off / Math.max(1, s.maxOff())));
          thumb.style.setProperty('--ipodc-th', String(th));
          thumb.style.setProperty('--ipodc-tt', String(top));
        }
        if (instant) {
          void node.offsetWidth; // commit the un-animated state before transitions come back
          node.classList.remove('is-instant');
        }
      },
      setIndex(i, { silent = false, instant = false, ensure = true } = {}) {
        if (!rows.length) return false;
        i = clamp(i, 0, rows.length - 1);
        const changed = i !== s.index;
        const prevRow = rows[s.index];
        prevRow?.classList.remove('is-sel');
        prevRow?.setAttribute('aria-selected', 'false');
        s.index = i;
        const r = rows[i];
        r.classList.add('is-sel');
        r.setAttribute('aria-selected', 'true');
        list.setAttribute('aria-activedescendant', r.id);
        if (isCurrent(s)) el.setAttribute('aria-activedescendant', r.id);
        if (ensure) s.ensureVisible(i);
        s.paint(instant);
        s.onIndex?.(i, changed, silent);
        // Speak every highlight change (debounced) – aria-activedescendant alone is unreliable.
        if (changed && !silent && isCurrent(s)) announce(s.currentLabel());
        return changed;
      },
      /** One wheel step. Returns true when something moved. */
      move(d) {
        if (rows.length && kind === 'page') {
          if (d > 0) {
            // Long text above the actions: scroll the text first, then walk the action rows.
            const t = s.rowTop(s.index);
            if (t + ROW > s.off + s.viewH + 0.5) {
              s.off = clamp(Math.min(s.off + TEXT_STEP, t + ROW - s.viewH), 0, s.maxOff());
              s.paint();
              return true;
            }
            return s.setIndex(s.index + 1);
          }
          if (s.index > 0) return s.setIndex(s.index - 1);
          if (s.off > 0) { s.off = Math.max(0, s.off - TEXT_STEP); s.paint(); return true; }
          return false;
        }
        if (rows.length) return s.setIndex(s.index + d);
        const before = s.off;
        s.off = clamp(s.off + d * TEXT_STEP, 0, s.maxOff());
        if (s.off === before) return false;
        s.paint();
        return true;
      },
      bump(d) {
        const now = performance.now();
        if (isReduced() || now - bumpAt < 260) return;
        bumpAt = now;
        view.classList.remove('bump-up', 'bump-down');
        void view.offsetWidth;
        view.classList.add(d > 0 ? 'bump-down' : 'bump-up');
      },
      activate() {
        const r = rows[s.index];
        if (!r) return false;
        // Centre on an action that is scrolled out of view reveals it instead of firing blind:
        // the text advances one step at a time (like turning the wheel), so nothing is skipped.
        if (!s.rowVisible(s.index)) {
          const t = s.rowTop(s.index);
          if (t < s.off) s.off = t;
          else s.off = Math.min(s.off + TEXT_STEP, t + ROW - s.viewH);
          s.off = clamp(s.off, 0, s.maxOff());
          s.paint();
          return true;
        }
        const spec = specs[s.index];
        if (spec.onActivate) { spec.onActivate(); return true; }
        if (r.tagName === 'A') { followLink(r, spec); return true; }
        return false;
      },
      currentLabel: () => rows[s.index]?.querySelector('.ipodc-row-label')?.textContent ?? '',
    };
    on(view, 'animationend', () => view.classList.remove('bump-up', 'bump-down'));
    return s;
  }

  // ── links
  let programmatic = false;
  let lastLink = { row: null, t: 0 };
  function linkGuard(row) {
    const now = performance.now();
    if (lastLink.row === row && now - lastLink.t < 800) return true; // held keys / double taps open once
    lastLink = { row, t: now };
    return false;
  }
  function followLink(row, spec) {
    if (linkGuard(row)) return;
    programmatic = true;
    try { row.click(); } finally { programmatic = false; }
    linkFeedback(row, spec);
  }
  function linkFeedback(row, spec) {
    const href = row.getAttribute('href') ?? '';
    if (row.hasAttribute('download')) showToast('check', L.downloadStarted, spec?.label);
    else if (/^mailto:/i.test(href)) showToast('mail', L.mailOpening, safeDecode(href.slice(7).split('?')[0]));
    else if (/^https?:/i.test(href)) {
      let host = '';
      try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
      showToast('out', L.linkOpening, host);
    }
  }

  // ── main menu with the split-screen preview pane
  function menuScreen() {
    const s = listScreen({
      kind: 'menu',
      id: 'menu',
      title: brand.name || 'iPod',
      split: true,
      rows: menu.map((item) => ({ label: item.label ?? item.title ?? '', sub: true, onActivate: () => open(item) })),
    });
    const preview = h('div', 'ipodc-preview', { 'aria-hidden': 'true' });
    s.node.append(preview);
    const panes = new Map();
    let shown = null;
    let settleT = 0;
    const showPane = (i) => {
      const item = menu[i] ?? { type: 'about' };
      let pane = panes.get(i);
      if (!pane) {
        pane = buildPreview(item);
        panes.set(i, pane);
        preview.append(pane);
        void pane.offsetWidth;
      }
      if (shown === pane) return;
      shown?.classList.remove('is-on');
      preview.append(pane); // newest on top for the cross-fade
      pane.classList.add('is-on');
      shown = pane;
    };
    s.onIndex = (i, changed) => {
      clearTimeout(settleT);
      if (!shown || !changed) showPane(i);
      else settleT = setTimeout(() => showPane(s.index), SETTLE_MS);
    };
    cleanups.push(() => clearTimeout(settleT));
    if (!menu.length) showPane(0);
    return s;
  }

  function buildPreview(item) {
    if (item.type === 'nowplaying') {
      const pane = h('div', 'ipodc-pv ipodc-pv--art');
      pane.append(coverArt(item, 'ipodc-pv-cover'));
      return pane;
    }
    const kind = item.type === 'list' ? 'contacts'
      : item.type === 'downloads' ? 'download'
        : item.type === 'page' && item.actions?.length ? 'chat' : 'monogram';
    const pane = h('div', 'ipodc-pv ipodc-pv--icon');
    const ico = h('div', 'ipodc-pv-float');
    ico.innerHTML = previewIcon(kind, nid('pv'), brand.monogram, `${P}s`);
    const refl = h('div', 'ipodc-pv-refl');
    const reflIn = h('div', 'ipodc-pv-float-in');
    reflIn.innerHTML = previewIcon(kind, nid('pv'), brand.monogram, `${P}s`);
    refl.append(reflIn);
    pane.append(h('div', 'ipodc-pv-floor'), refl, ico);
    return pane;
  }

  // ── sub screens
  function buildScreen(item) {
    const title = item.title ?? item.label ?? '';
    switch (item.type) {
      case 'list':
        return listScreen({
          kind: 'list', id: item.id ?? 'list', title,
          rows: (Array.isArray(item.items) ? item.items : []).filter(Boolean).map((it) => ({
            label: it.label, detail: it.detail, href: it.href,
          })),
        });
      case 'downloads':
        return listScreen({
          kind: 'downloads', id: item.id ?? 'downloads', title,
          rows: (Array.isArray(item.items) ? item.items : []).filter(Boolean).map((it) => {
            const size = it.size && it.size !== '–' && it.size !== '-' ? it.size : null;
            const detail = [it.format, size].filter(Boolean).join(' · ');
            return {
              label: it.label, detail, href: it.file, download: fileName(it.file),
              ariaLabel: `${it.label ?? ''}${detail ? `, ${detail}` : ''}, ${L.download}`,
            };
          }),
        });
      case 'nowplaying':
        return nowPlayingScreen(item);
      case 'page':
      default: {
        const pre = h('div', 'ipodc-text', { text: item.body ?? '' });
        return listScreen({
          kind: 'page', id: item.id ?? 'page', title, pre,
          rows: (Array.isArray(item.actions) ? item.actions : []).filter(Boolean).map((a) => ({ label: a.label, detail: a.detail, href: a.href })),
        });
      }
    }
  }

  function nowPlayingScreen(item) {
    const spot = safeHref(item.spotifyUrl);
    const s = listScreen({
      kind: 'nowplaying', id: item.id ?? 'nowplaying', title: L.nowPlaying,
      rows: spot ? [{ label: L.openSpotify, href: spot, sub: true, spotify: true }] : [],
    });
    const node = s.node;
    const count = h('div', 'ipodc-np-count');
    const art = coverArt(item, 'ipodc-np-art');
    const refl = coverArt(item, 'ipodc-np-refl');
    const info = h('div', 'ipodc-np-info');
    const tTitle = h('div', 'ipodc-np-title');
    const tArtist = h('div', 'ipodc-np-artist');
    const tAlbum = h('div', 'ipodc-np-album', { text: item.title ?? '' });
    info.append(tTitle, tArtist, tAlbum);
    const prog = h('div', 'ipodc-np-prog');
    const meter = h('div', 'ipodc-meter');
    const fill = h('div', 'ipodc-meter-fill');
    meter.append(fill);
    const times = h('div', 'ipodc-np-times');
    const tEl = h('span');
    const tRem = h('span');
    times.append(tEl, tRem);
    prog.append(meter, times);
    const vol = h('div', 'ipodc-np-vol', { 'aria-hidden': 'true' });
    const vMeter = h('div', 'ipodc-meter');
    const vFill = h('div', 'ipodc-meter-fill');
    vMeter.append(vFill);
    vol.insertAdjacentHTML('beforeend', SPEAKER_LO);
    vol.append(vMeter);
    vol.insertAdjacentHTML('beforeend', SPEAKER_HI);
    const deco = h('div', 'ipodc-np-deco', { 'aria-hidden': 'true' });
    deco.append(count, art, refl, info, prog, vol);
    // Compact track list beside the cover: every config track is a selectable option (tap / click,
    // ⏮ ⏭ on the wheel); the playing one carries the blue speaker like the 6G song lists.
    const realTracks = Array.isArray(item.tracks) && item.tracks.length > 0;
    const tl = h('div', 'ipodc-np-tracks', { role: 'listbox', 'aria-label': L.tracks });
    const tlIn = h('div', 'ipodc-np-tracks-in');
    tl.append(tlIn);
    const trkRows = realTracks ? tracks.map((t, i) => {
      const r = h('div', 'ipodc-trk', { role: 'option', id: nid('t'), 'aria-selected': 'false', 'data-i': i });
      r.insertAdjacentHTML('beforeend', SPEAKER_NOW);
      r.append(h('span', 'ipodc-trk-t', { text: t.title ?? '' }));
      if (t.duration) r.append(h('span', 'ipodc-trk-d', { text: t.duration }));
      return r;
    }) : [];
    tlIn.append(...trkRows);
    node.prepend(deco);
    if (trkRows.length) node.append(tl); else node.classList.add('no-tracks');
    if (!spot) node.classList.add('no-cta');
    const TRK_VIS = 3;
    let trkTop = 0;

    let volT = 0;
    const bindings = {
      update(instant = false) {
        const t = tracks[player.track] ?? {};
        const dur = parseDuration(t.duration);
        if (tTitle.textContent !== (t.title ?? '')) tTitle.textContent = t.title ?? '';
        if (tArtist.textContent !== (t.artist ?? '')) tArtist.textContent = t.artist ?? '';
        count.textContent = tracks.length ? `${player.track + 1} ${L.of} ${tracks.length}` : '';
        trkRows.forEach((r, i) => {
          const cur = i === player.track;
          if (r.classList.contains('is-cur') !== cur) {
            r.classList.toggle('is-cur', cur);
            r.setAttribute('aria-selected', String(cur));
          }
        });
        if (trkRows.length > TRK_VIS) {
          // keep the playing track inside the 3-row window
          if (player.track < trkTop) trkTop = player.track;
          else if (player.track >= trkTop + TRK_VIS) trkTop = player.track - TRK_VIS + 1;
          tlIn.style.setProperty('--ipodc-tt', String(trkTop));
        }
        if (instant) node.classList.add('is-instant');
        fill.style.setProperty('--ipodc-f', clamp(player.elapsed / dur, 0, 1).toFixed(4));
        vFill.style.setProperty('--ipodc-f', player.volume.toFixed(4));
        if (instant) { void node.offsetWidth; node.classList.remove('is-instant'); }
        tEl.textContent = fmtTime(player.elapsed);
        tRem.textContent = `-${fmtTime(dur - Math.floor(player.elapsed))}`;
      },
    };
    s.onShow = () => {
      npView = bindings;
      if (!player.started) setPlaying(true);
      bindings.update(true);
      renderPlayer();
    };
    s.onHide = () => {
      if (npView === bindings) npView = null;
      clearTimeout(volT);
      node.classList.remove('is-vol');
    };
    cleanups.push(() => clearTimeout(volT));
    // The wheel sets the volume on Now Playing, like the real thing.
    s.move = (d) => {
      const before = player.volume;
      player.volume = clamp(Math.round((player.volume + d / 16) * 16) / 16, 0, 1);
      node.classList.add('is-vol');
      clearTimeout(volT);
      volT = setTimeout(() => node.classList.remove('is-vol'), 1600);
      bindings.update();
      if (player.volume !== before) announce(`${L.volume} ${Math.round(player.volume * 100)} %`);
      return player.volume !== before;
    };
    s.pickTrack = (i) => {
      if (!tracks[i]) return;
      if (i === player.track && player.started) { setPlaying(!player.playing); return; }
      player.track = i;
      player.elapsed = 0;
      setPlaying(true);
      npView?.update(true);
      const t = tracks[i];
      announce(`${t.title ?? ''}${t.artist ? `, ${t.artist}` : ''}`);
    };
    const baseActivate = s.activate;
    s.activate = () => {
      if (s.rows.length) return baseActivate();
      setPlaying(!player.playing);
      return true;
    };
    bindings.update(true);
    return s;
  }

  // ───────────────────────── navigation ─────────────────────────
  const stack = [];
  let phase = 'off'; // off → boot → ready
  const current = () => stack[stack.length - 1];
  const isCurrent = (s) => !!s && current() === s;
  const running = new Set();

  function finishRunning() {
    for (const a of [...running]) { try { a.finish(); } catch { /* ignore */ } }
  }
  function animate(node, frames, opts) {
    const a = node.animate(frames, opts);
    running.add(a);
    // Wall-clock safety net: a stalled document timeline can never leave screens half-way.
    const guard = setTimeout(() => { try { a.finish(); } catch { /* ignore */ } }, opts.duration + 180);
    return a.finished.catch(() => {}).finally(() => { clearTimeout(guard); running.delete(a); });
  }
  const EASE = 'cubic-bezier(.32,.08,.24,1)';
  function slide(outNode, inNode, dir) {
    if (isReduced() || !outNode || typeof inNode.animate !== 'function') return Promise.resolve();
    const o = { duration: SLIDE_MS, easing: EASE };
    return Promise.all([
      animate(outNode, [{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 100}%)` }], o),
      animate(inNode, [{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }], o),
    ]);
  }
  /** Title bar: the old title leaves before the new one arrives, so they never smudge together. */
  function setTitle(text, dir = 0) {
    for (const t of [...titles.children]) if (t !== titleEl) t.remove();
    if (titleEl.textContent === text) return;
    const old = titleEl;
    const nu = h('span', 'ipodc-title', { text });
    titles.append(nu);
    titleEl = nu;
    if (!dir || isReduced() || !old.textContent || typeof nu.animate !== 'function') { old.remove(); return; }
    const o = { duration: SLIDE_MS, easing: EASE };
    animate(old, [
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: `translateX(${-dir * 22}%)`, offset: 0.42 },
      { opacity: 0, transform: `translateX(${-dir * 30}%)` },
    ], { ...o, fill: 'forwards' }).then(() => old.remove());
    animate(nu, [
      { opacity: 0, transform: `translateX(${dir * 30}%)` },
      { opacity: 0, transform: `translateX(${dir * 22}%)`, offset: 0.38 },
      { opacity: 1, transform: 'translateX(0)' },
    ], { ...o, fill: 'backwards' });
  }

  function show(s) {
    s.node.removeAttribute('aria-hidden');
    stage.append(s.node);
    s.layout();
    s.enteredAt = performance.now();
    const r = s.rows[s.index];
    if (r) el.setAttribute('aria-activedescendant', r.id); else el.removeAttribute('aria-activedescendant');
    s.onShow?.();
  }

  function open(item) {
    finishRunning();
    const s = buildScreen(item);
    const prev = current();
    prev?.onHide?.();
    prev?.node.setAttribute('aria-hidden', 'true');
    stack.push(s);
    show(s);
    setTitle(s.title, 1);
    slide(prev?.node, s.node, 1).then(() => { if (prev && !isCurrent(prev)) prev.node.remove(); });
    if (isReduced() && prev) prev.node.remove();
    const lbl = s.currentLabel();
    announce(`${s.title}${lbl ? `, ${lbl}` : ''}`);
  }

  function back() {
    if (stack.length < 2) return false;
    finishRunning();
    const top = stack.pop();
    top.onHide?.();
    top.node.setAttribute('aria-hidden', 'true');
    const prev = current();
    show(prev);
    setTitle(prev.title, -1);
    slide(top.node, prev.node, -1).then(() => top.node.remove());
    if (isReduced()) top.node.remove();
    announce(`${prev.title}, ${prev.currentLabel()}`);
    return true;
  }

  // ───────────────────────── toast ─────────────────────────
  let toastT = 0;
  function showToast(icon, text, sub) {
    toast.innerHTML = TOAST_ICON[icon] ?? '';
    toast.append(h('b', null, { text }));
    if (sub) toast.append(h('span', null, { text: sub }));
    toast.classList.add('is-on');
    announce(sub ? `${text} ${sub}` : text);
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('is-on'), 1700);
  }

  // ───────────────────────── actions ─────────────────────────
  let flashT = 0;
  function flash(zone) {
    if (zone === 'center') {
      centerBtn.classList.add('is-pressed');
      setTimeout(() => centerBtn.classList.remove('is-pressed'), 120);
      return;
    }
    clearTimeout(flashT);
    wheel.dataset.press = zone;
    flashT = setTimeout(() => { delete wheel.dataset.press; }, 130);
  }

  function press(btn) {
    if (phase !== 'ready' || destroyed) return;
    sound.play('press');
    const s = current();
    switch (btn) {
      case 'menu': back(); break;
      case 'center': s?.activate(); break;
      case 'play':
        if (!tracks.length) break;
        setPlaying(!player.playing);
        announce(player.playing ? L.playing : L.paused);
        break;
      case 'next':
      case 'prev':
        if (tracks.length && (s?.kind === 'nowplaying' || player.started)) changeTrack(btn === 'next' ? 1 : -1);
        break;
      default: break;
    }
  }

  let lastHaptic = 0;
  function haptic() {
    if (!soundOn) return;
    const now = performance.now();
    if (now - lastHaptic < 35) return;
    lastHaptic = now;
    try { navigator.vibrate?.(4); } catch { /* ignore */ }
  }

  function step(dir, src) {
    if (phase !== 'ready' || destroyed || !dir) return false;
    const s = current();
    if (!s) return false;
    const moved = s.move(dir);
    if (moved) {
      sound.play('tick');
      if (src === 'touch') haptic();
    } else s.bump?.(dir);
    return moved;
  }

  function scroll(steps) {
    const n = Math.trunc(Number(steps) || 0);
    const d = Math.sign(n);
    for (let i = 0; i < Math.abs(n); i++) if (!step(d, 'api')) break;
  }

  const focusRoot = () => { if (document.activeElement !== el) el.focus({ preventScroll: true }); };

  // ───────────────────────── click wheel input ─────────────────────────
  let wp = null;
  let momRaf = 0;
  const stopMomentum = () => { cancelAnimationFrame(momRaf); momRaf = 0; };
  cleanups.push(stopMomentum);
  const zoneOf = (deg) => {
    if (deg > -45 && deg <= 45) return 'next';
    if (deg > 45 && deg <= 135) return 'play';
    if (deg > -135 && deg <= -45) return 'menu';
    return 'prev';
  };
  function velocity(p) {
    const sm = p.samples;
    if (sm.length < 2) return 0;
    const a = sm[0];
    const b = sm[sm.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0.008 ? (b.a - a.a) / dt : 0;
  }

  on(wheel, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest?.('.ipodc-center')) return;
    sound.ensure();
    stopMomentum();
    const r = wheel.getBoundingClientRect();
    const R = r.width / 2;
    const cx = r.left + R;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    if (Math.hypot(dx, dy) > R + 2) return;
    e.preventDefault();
    focusRoot();
    const a = toDeg(Math.atan2(dy, dx));
    wp = {
      id: e.pointerId, type: e.pointerType, cx, cy, R, zone: zoneOf(a), last: a,
      acc: 0, total: 0, cum: 0, drag: false, samples: [{ t: e.timeStamp, a: 0 }],
    };
    try { wheel.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    clearTimeout(flashT);
    wheel.dataset.press = wp.zone;
  });
  on(wheel, 'pointermove', (e) => {
    if (!wp || e.pointerId !== wp.id) return;
    const dx = e.clientX - wp.cx;
    const dy = e.clientY - wp.cy;
    if (Math.hypot(dx, dy) < wp.R * 0.22) { wp.last = null; return; } // angle is meaningless near the middle
    const a = toDeg(Math.atan2(dy, dx));
    if (wp.last == null) { wp.last = a; return; }
    const d = normDeg(a - wp.last);
    wp.last = a;
    // Accumulate from the very first degree, so a slow arc never loses steps.
    wp.acc += d;
    wp.total += Math.abs(d);
    wp.cum += d;
    const t = e.timeStamp;
    wp.samples.push({ t, a: wp.cum });
    while (wp.samples.length > 2 && t - wp.samples[0].t > 100) wp.samples.shift();
    if (!wp.drag) {
      if (wp.total < 7) return;
      wp.drag = true; // it's a spin, not a press
      delete wheel.dataset.press;
      wheel.classList.add('is-spinning');
    }
    // Acceleration: the faster you spin, the less arc each step needs.
    const v = Math.abs(velocity(wp));
    const stepDeg = v < 360 ? BASE_STEP : v < 800 ? 15 : 11;
    while (wp.acc >= stepDeg) { wp.acc -= stepDeg; if (!step(1, wp.type)) { wp.acc = 0; break; } }
    while (wp.acc <= -stepDeg) { wp.acc += stepDeg; if (!step(-1, wp.type)) { wp.acc = 0; break; } }
  });
  const endWheel = (e) => {
    if (!wp || e.pointerId !== wp.id) return;
    const p = wp;
    wp = null;
    wheel.classList.remove('is-spinning');
    if (e.type !== 'pointerup') { delete wheel.dataset.press; return; }
    if (!p.drag) { flash(p.zone); press(p.zone); return; }
    delete wheel.dataset.press;
    const v0 = velocity(p);
    const lastS = p.samples[p.samples.length - 1];
    if (!isReduced() && Math.abs(v0) > 520 && e.timeStamp - lastS.t < 60) momentum(v0, p.acc, p.type);
  };
  on(wheel, 'pointerup', endWheel);
  on(wheel, 'pointercancel', endWheel);
  on(wheel, 'lostpointercapture', endWheel);
  on(wheel, 'contextmenu', (e) => e.preventDefault());
  on(wheel, 'touchmove', (e) => e.preventDefault(), { passive: false });

  // Momentum: a fast flick keeps coasting a few items with friction and stops at the list end.
  function momentum(v, acc, type) {
    let last = -1; // seeded from the first rAF timestamp: never mix clocks
    v = clamp(v, -1500, 1500);
    const loop = (now) => {
      if (last < 0) { last = now; momRaf = requestAnimationFrame(loop); return; }
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      v *= Math.exp(-dt * 7);
      acc += v * dt;
      while (acc >= BASE_STEP) { acc -= BASE_STEP; if (!step(1, type)) { stopMomentum(); return; } }
      while (acc <= -BASE_STEP) { acc += BASE_STEP; if (!step(-1, type)) { stopMomentum(); return; } }
      if (Math.abs(v) < 150) { stopMomentum(); return; }
      momRaf = requestAnimationFrame(loop);
    };
    momRaf = requestAnimationFrame(loop);
  }

  // centre button
  let centerDown = null;
  on(centerBtn, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    sound.ensure();
    stopMomentum();
    focusRoot();
    centerDown = e.pointerId;
    centerBtn.classList.add('is-pressed');
    try { centerBtn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  on(centerBtn, 'pointerup', (e) => {
    if (centerDown !== e.pointerId) return;
    centerDown = null;
    centerBtn.classList.remove('is-pressed');
    const r = centerBtn.getBoundingClientRect();
    const inside = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) <= r.width / 2 + 8;
    if (inside) press('center');
  });
  const cancelCenter = () => { centerDown = null; centerBtn.classList.remove('is-pressed'); };
  on(centerBtn, 'pointercancel', cancelCenter);
  on(centerBtn, 'lostpointercapture', () => { if (centerDown != null) cancelCenter(); });
  // Assistive tech / programmatic activation of the (visually hidden) buttons
  on(centerBtn, 'click', (e) => { if (e.detail === 0) { flash('center'); press('center'); } });
  on(wheel, 'click', (e) => {
    const b = e.target.closest?.('.ipodc-wbtn');
    if (b && e.detail === 0) { flash(b.dataset.btn); press(b.dataset.btn); }
  });

  // ───────────────────────── screen: tap to choose, drag to scroll ─────────────────────────
  let sp = null;
  let suppressClick = false;
  on(stage, 'pointerdown', (e) => {
    if (phase !== 'ready' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    focusRoot(); // mousedown is prevented below, so focus the iPod explicitly
    sound.ensure();
    stopMomentum();
    sp = { id: e.pointerId, y: e.clientY, x: e.clientX, acc: 0, drag: false, type: e.pointerType };
    suppressClick = false;
  });
  on(stage, 'pointermove', (e) => {
    if (!sp || e.pointerId !== sp.id) return;
    const dy = e.clientY - sp.y;
    if (!sp.drag) {
      if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(e.clientX - sp.x)) return;
      sp.drag = true;
      suppressClick = true;
      try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    sp.acc += dy;
    sp.y = e.clientY;
    const unit = ROW * pxPer() * 0.8;
    while (sp.acc <= -unit) { sp.acc += unit; step(1, sp.type); }
    while (sp.acc >= unit) { sp.acc -= unit; step(-1, sp.type); }
  });
  const endSp = (e) => { if (sp && e.pointerId === sp.id) sp = null; };
  on(stage, 'pointerup', endSp);
  on(stage, 'pointercancel', endSp);
  on(stage, 'mousedown', (e) => e.preventDefault()); // keep focus on the iPod body, no text selection
  on(stage, 'touchmove', (e) => e.preventDefault(), { passive: false });
  on(stage, 'dragstart', (e) => e.preventDefault());
  on(stage, 'click', (e) => {
    if (programmatic) return; // our own activation of a real <a>: let the browser follow it
    const row = e.target.closest?.('.ipodc-row');
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    const trk = e.target.closest?.('.ipodc-trk');
    if (trk && phase === 'ready' && current()?.node.contains(trk) && e.detail < 2) {
      sound.play('press');
      current().pickTrack?.(Number(trk.dataset.i));
      return;
    }
    if (!row) return;
    const s = current();
    const settling = !isReduced() && performance.now() - (s?.enteredAt ?? 0) < SLIDE_MS * 0.75;
    // Only rows of the screen that is actually in place, and never the 2nd click of a double-click.
    if (phase !== 'ready' || !s || !s.node.contains(row) || e.detail > 1 || settling) { e.preventDefault(); return; }
    const i = s.rows.indexOf(row);
    if (i < 0) { e.preventDefault(); return; }
    s.setIndex(i);
    sound.play('press');
    const spec = s.specs[i];
    if (spec.onActivate) { e.preventDefault(); spec.onActivate(); return; }
    if (row.tagName === 'A') {
      if (linkGuard(row)) { e.preventDefault(); return; }
      linkFeedback(row, spec); // native navigation proceeds (new tab / mailto / download)
    } else e.preventDefault();
  });

  // ───────────────────────── mouse wheel / trackpad ─────────────────────────
  let wAcc = 0;
  let wLast = 0;
  on(el, 'wheel', (e) => {
    if (phase === 'off' || destroyed) return;
    e.preventDefault(); // also during boot: the page behind must never scroll under the iPod
    if (phase !== 'ready') return;
    stopMomentum();
    const now = performance.now();
    if (now - wLast > 220) wAcc = 0;
    wLast = now;
    const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (e.deltaMode !== 0) { step(Math.sign(raw), 'wheel'); return; } // line/page mode: one notch = one step
    if (Math.abs(raw) >= 50) { step(Math.sign(raw), 'wheel'); wAcc = 0; return; } // discrete mouse notch
    wAcc += raw;
    while (wAcc >= 34) { wAcc -= 34; step(1, 'wheel'); }
    while (wAcc <= -34) { wAcc += 34; step(-1, 'wheel'); }
  }, { passive: false });

  // ───────────────────────── keyboard ─────────────────────────
  function onKey(e) {
    if (phase !== 'ready' || destroyed || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': sound.ensure(); stopMomentum(); step(1, 'key'); break;
      case 'ArrowUp': case 'ArrowLeft': sound.ensure(); stopMomentum(); step(-1, 'key'); break;
      case 'Enter': if (!e.repeat) { sound.ensure(); flash('center'); press('center'); } break;
      case 'Escape': case 'Backspace': if (!e.repeat) { sound.ensure(); flash('menu'); press('menu'); } break;
      case ' ': case 'Spacebar': if (!e.repeat) { sound.ensure(); flash('play'); press('play'); } break;
      case 'MediaTrackNext': flash('next'); press('next'); break;
      case 'MediaTrackPrevious': flash('prev'); press('prev'); break;
      case 'MediaPlayPause': flash('play'); press('play'); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }
  on(el, 'keydown', onKey);
  // With nothing else focused (e.g. right after the intro), the iPod is the obvious keyboard target,
  // but only while it is really on screen and on top (not minimised, hidden or covered).
  const onTop = () => {
    if (!el.isConnected || phase !== 'ready') return false;
    const r = centerBtn.getBoundingClientRect();
    if (!r.width) return false;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return !!hit && el.contains(hit);
  };
  on(document, 'keydown', (e) => {
    if (e.target !== document.body && e.target !== document.documentElement) return;
    if (e.defaultPrevented || !onTop()) return;
    const se = document.scrollingElement;
    const pageScrolls = se && se.scrollHeight > se.clientHeight + 2;
    if (pageScrolls && /^(Arrow|Spacebar$| $)/.test(e.key)) return; // leave page scrolling alone
    onKey(e);
  });
  on(el, 'pointerdown', () => sound.ensure());
  // touch pointerdown is not a user activation for audio: unlock on pointerup / click as well
  on(el, 'pointerup', () => sound.ensure());
  on(el, 'click', () => sound.ensure());

  // ───────────────────────── resize ─────────────────────────
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

  // ───────────────────────── boot / reveal ─────────────────────────
  const menuScr = menuScreen();
  stack.push(menuScr);
  show(menuScr);
  setTitle(menuScr.title);

  let revealP = null;
  function reveal({ boot: doBoot = true } = {}) {
    if (revealP) return revealP;
    revealP = (async () => {
      el.classList.add('is-revealed');
      menuScr.layout();
      if (doBoot) {
        phase = 'boot';
        await wait(isReduced() ? 40 : 220);
        boot.classList.add('show-mono');
        await wait(isReduced() ? 450 : 950);
        boot.classList.add('is-out');
        await wait(isReduced() ? 80 : 340);
      }
      if (destroyed) return;
      boot.hidden = true;
      current()?.layout();
      phase = 'ready';
      announce(`${menuScr.title}: ${menuScr.currentLabel()}`);
    })();
    return revealP;
  }

  function getState() {
    const s = current();
    return {
      screen: phase === 'ready' ? (s?.kind ?? 'menu') : phase,
      path: stack.slice(1).map((x) => x.id),
      index: s?.index ?? 0,
    };
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* ignore */ } }
    for (const a of running) { try { a.cancel(); } catch { /* ignore */ } }
    ro?.disconnect();
    clearTimeout(toastT);
    clearTimeout(announceT);
    clearTimeout(flashT);
    sound.close();
    el.remove();
  }

  return {
    el,
    getShellRect: () => el.getBoundingClientRect(),
    reveal,
    press: (btn) => press(btn),
    scroll,
    getState,
    destroy,
  };
}
