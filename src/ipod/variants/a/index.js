// iPod Classic (6th/7th gen, silver) linktree UI. Variant A: pixel fidelity first.
// API per CONTRACT.md: mountIpod(container, { config }) → { el, getShellRect, reveal, press, scroll, getState, destroy }
import './ipoda.css';
import { IPOD, COLORS } from '../../../shared/ipodSpec.js';
import { prefersReducedMotion } from '../../../shared/config.js';

const ROW_H = 27;          // logical px (≈ 1/8 of the 240 px screen)
const STEP_DEG = 20;       // wheel arc per scroll step
const TEXT_STEP = 34;      // two text lines per wheel step on text pages
const SLIDE_MS = 240;
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
function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isHttp = (href) => /^https?:/i.test(href ?? '');

function parseDuration(s) {
  const parts = String(s ?? '').split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 210;
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
  return base + path.replace(/^\.\//, '');
}
const fileName = (p) => String(p ?? '').split(/[?#]/)[0].split('/').pop() || true;

// Fine brushed-aluminium grain (procedural, no external assets)
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.03" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5  1.1 0 0 0 -0.05  0 0 0 0 0.5  0 0 0 0 1"/><feColorMatrix type="saturate" values="0"/></filter><rect width="240" height="240" filter="url(#n)"/></svg>`;

// ───────────────────────── icons ─────────────────────────
const CHEVRON = '<svg class="ipoda-row-chev" viewBox="0 0 7 12" aria-hidden="true"><path d="M1.2 1.2 5.6 6l-4.4 4.8" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="square" stroke-linejoin="miter"/></svg>';

const ICON_NEXT = '<svg viewBox="0 0 20 9" aria-hidden="true"><path d="M0 0l7.2 4.5L0 9zM7.2 0l7.2 4.5L7.2 9zM15.6 0h2.2v9h-2.2z"/></svg>';
const ICON_PREV = '<svg viewBox="0 0 20 9" aria-hidden="true"><path d="M20 0l-7.2 4.5L20 9zM12.8 0L5.6 4.5l7.2 4.5zM4.4 0H2.2v9h2.2z"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 20 9" aria-hidden="true"><path d="M1 0l7.4 4.5L1 9zM11.6 0h2.5v9h-2.5zM16.2 0h2.5v9h-2.5z"/></svg>';

function titleBarPlayIcon(p) {
  return svg(`<svg viewBox="0 0 10 10" aria-hidden="true"><defs><linearGradient id="${p}pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0ff"/><stop offset=".5" stop-color="#3f8fe6"/><stop offset="1" stop-color="#1d5fbf"/></linearGradient></defs>
  <g class="ipoda-play-g"><path d="M1.2 .6 9.2 5l-8 4.4z" fill="url(#${p}pg)" stroke="#123f80" stroke-width=".8" stroke-linejoin="round"/></g>
  <g class="ipoda-pause-g" fill="url(#${p}pg)" stroke="#123f80" stroke-width=".8"><rect x="1.4" y=".8" width="2.6" height="8.4" rx=".3"/><rect x="6" y=".8" width="2.6" height="8.4" rx=".3"/></g></svg>`);
}
function batteryIcon(p) {
  return svg(`<svg viewBox="0 0 23 11" aria-hidden="true"><defs>
  <linearGradient id="${p}bs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9ccd0"/></linearGradient>
  <linearGradient id="${p}bf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4f7a6"/><stop offset=".45" stop-color="#7fd23f"/><stop offset=".55" stop-color="#55b51d"/><stop offset="1" stop-color="#3f9a12"/></linearGradient></defs>
  <rect x=".5" y=".5" width="19.5" height="10" rx="1.6" fill="url(#${p}bs)" stroke="#55595f"/>
  <rect x="20" y="3.2" width="2.2" height="4.6" rx=".6" fill="#8b8f95" stroke="#55595f" stroke-width=".6"/>
  <rect x="2" y="2" width="16.5" height="7" rx=".7" fill="url(#${p}bf)"/>
  <rect x="2" y="2" width="16.5" height="3" rx=".7" fill="#fff" opacity=".28"/></svg>`);
}
const TOAST_CHECK = '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="none" stroke="#fff" stroke-width="2"/><path d="M7.5 13.4l3.7 3.7 7.3-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Large glossy preview icons (classic iPod split-screen style), 100×100 viewBox
function previewIcon(kind, p, monogram) {
  const gloss = `<linearGradient id="${p}gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient>`;
  switch (kind) {
    case 'contacts':
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${gloss}
        <linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8dbdf0"/><stop offset=".5" stop-color="#3f7fd0"/><stop offset="1" stop-color="#1f4f9a"/></linearGradient>
        <linearGradient id="${p}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a8f96"/><stop offset=".5" stop-color="#f4f5f6"/><stop offset="1" stop-color="#9aa0a7"/></linearGradient></defs>
        <rect x="20" y="8" width="66" height="84" rx="7" fill="url(#${p}a)" stroke="#173f7d" stroke-width="1.5"/>
        <rect x="27" y="8" width="2" height="84" fill="#173f7d" opacity=".35"/>
        <circle cx="58" cy="40" r="12" fill="#fff"/>
        <path d="M36 74c0-13 10-21 22-21s22 8 22 21z" fill="#fff"/>
        <g fill="url(#${p}r)" stroke="#5f656c" stroke-width=".8">
          <rect x="13" y="20" width="16" height="6" rx="3"/><rect x="13" y="38" width="16" height="6" rx="3"/>
          <rect x="13" y="56" width="16" height="6" rx="3"/><rect x="13" y="74" width="16" height="6" rx="3"/></g>
        <path d="M27 9h52a6 6 0 0 1 6 6v24C64 46 44 46 27 41z" fill="url(#${p}gl)" opacity=".55"/></svg>`;
    case 'chat':
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${gloss}
        <linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0ff"/><stop offset=".5" stop-color="#3f8fe6"/><stop offset="1" stop-color="#1d5fbf"/></linearGradient>
        <linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbfc"/><stop offset="1" stop-color="#c3c8ce"/></linearGradient></defs>
        <path d="M44 22h40a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10h-4l2 12-14-12H44a10 10 0 0 1-10-10V32a10 10 0 0 1 10-10z" fill="url(#${p}b)" stroke="#8d939a" stroke-width="1.4"/>
        <path d="M14 36h42a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H34L18 88l3-12h-7A10 10 0 0 1 4 66V46a10 10 0 0 1 10-10z" fill="url(#${p}a)" stroke="#164f9e" stroke-width="1.4"/>
        <path d="M14 37h42a9 9 0 0 1 9 9v6C46 58 26 58 5 53v-7a9 9 0 0 1 9-9z" fill="url(#${p}gl)" opacity=".6"/>
        <g fill="#fff"><circle cx="21" cy="57" r="3.6"/><circle cx="35" cy="57" r="3.6"/><circle cx="49" cy="57" r="3.6"/></g></svg>`;
    case 'download':
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${gloss}
        <linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dde2"/></linearGradient>
        <linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0ff"/><stop offset=".5" stop-color="#3f8fe6"/><stop offset="1" stop-color="#1d5fbf"/></linearGradient></defs>
        <path d="M22 6h40l18 18v68a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="url(#${p}a)" stroke="#8d939a" stroke-width="1.4"/>
        <path d="M62 6v15a3 3 0 0 0 3 3h15" fill="#e7eaee" stroke="#8d939a" stroke-width="1.4"/>
        <g stroke="#b9bfc6" stroke-width="2.4" stroke-linecap="round"><path d="M28 34h30M28 42h40M28 50h36M28 58h22"/></g>
        <circle cx="68" cy="72" r="19" fill="url(#${p}b)" stroke="#164f9e" stroke-width="1.4"/>
        <path d="M68 61v19M60 73l8 8 8-8" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M51 68a17 17 0 0 1 34 0c-10 4-24 4-34 0z" fill="url(#${p}gl)" opacity=".55"/></svg>`;
    default: { // monogram badge
      const m = String(monogram ?? '').slice(0, 3);
      const fs = m.length > 2 ? 26 : 34;
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${gloss}
        <radialGradient id="${p}a" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#d9dce0"/><stop offset="1" stop-color="#9ea3aa"/></radialGradient>
        <linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d6168"/><stop offset="1" stop-color="#2b2e33"/></linearGradient></defs>
        <circle cx="50" cy="50" r="42" fill="url(#${p}a)" stroke="#80868e" stroke-width="1.5"/>
        <circle cx="50" cy="50" r="35" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>
        <circle cx="50" cy="50" r="36.2" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="1"/>
        <text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, Liberation Sans, sans-serif" font-weight="700" font-size="${fs}" letter-spacing="-1.5" fill="url(#${p}b)">${m.replace(/[<&>]/g, '')}</text>
        <path d="M14 44a36 36 0 0 1 72 0c-22 8-50 8-72 0z" fill="url(#${p}gl)" opacity=".5"/></svg>`;
    }
  }
}

// ───────────────────────── audio ─────────────────────────
function createClicker(enabled) {
  let ctx = null;
  const buffers = {};
  function build(kind) {
    const sr = ctx.sampleRate;
    const dur = kind === 'tick' ? 0.007 : 0.016;
    const n = Math.ceil(sr * dur);
    const b = ctx.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    const f = kind === 'tick' ? 3100 : 1650;
    const decay = kind === 'tick' ? 0.0009 : 0.0028;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.exp(-t / decay);
      d[i] = env * (0.55 * Math.sin(2 * Math.PI * f * t) + 0.45 * (Math.random() * 2 - 1));
    }
    return b;
  }
  return {
    ensure() {
      if (!enabled) return;
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume();
      } catch { /* audio unavailable */ }
    },
    play(kind = 'tick') {
      if (!enabled || !ctx || ctx.state !== 'running') return;
      try {
        buffers[kind] ??= build(kind);
        const src = ctx.createBufferSource();
        src.buffer = buffers[kind];
        const g = ctx.createGain();
        g.gain.value = kind === 'tick' ? 0.16 : 0.22;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = kind === 'tick' ? 1200 : 500;
        src.connect(hp).connect(g).connect(ctx.destination);
        src.start();
      } catch { /* ignore */ }
    },
    close() { try { ctx?.close(); } catch { /* ignore */ } ctx = null; },
  };
}

// ───────────────────────── mount ─────────────────────────
export function mountIpod(container, { config } = {}) {
  config ??= {};
  const reduced = prefersReducedMotion();
  const brand = config.brand ?? {};
  const menu = Array.isArray(config.menu) ? config.menu : [];
  const P = `ipoda${++instanceSeq}`;
  let optSeq = 0;
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  const clicker = createClicker(config.settings?.clickSound !== false);

  // ── body
  const el = h('div', 'ipoda', {
    tabindex: 0,
    role: 'group',
    'aria-roledescription': 'iPod',
    'aria-label': `iPod${brand.name ? ` – ${brand.name}` : ''}. Pfeiltasten scrollen, Enter wählt aus, Escape geht zurück, Leertaste Play/Pause.`,
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
  };
  for (const [k, v] of Object.entries(mm)) el.style.setProperty(`--ipoda-mm-${k}`, String(+v.toFixed(4)));
  for (const [k, v] of Object.entries(COLORS)) el.style.setProperty(`--ipoda-c-${k}`, v);
  el.style.setProperty('--ipoda-noise', `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`);

  // ── screen
  const win = h('div', 'ipoda-window');
  const lcd = h('div', 'ipoda-lcd');
  const ui = h('div', 'ipoda-ui');
  const bar = h('div', 'ipoda-bar', { 'aria-hidden': 'true' });
  const barPlay = h('span', 'ipoda-bar-play');
  barPlay.append(titleBarPlayIcon(P));
  const barTitle = h('span', 'ipoda-bar-title');
  const batt = h('span', 'ipoda-batt');
  batt.append(batteryIcon(P));
  bar.append(barPlay, barTitle, batt);
  const stage = h('div', 'ipoda-stage');
  const toast = h('div', 'ipoda-toast', { 'aria-hidden': 'true' });
  const boot = h('div', 'ipoda-boot is-hidden', { 'aria-hidden': 'true' });
  boot.append(h('div', 'ipoda-boot-logo', { text: brand.monogram ?? '' }));
  ui.append(bar, stage, toast, boot);
  lcd.append(ui);
  win.append(lcd, h('div', 'ipoda-glare'));

  // ── wheel
  const wheel = h('div', 'ipoda-wheel');
  const inner = (IPOD.centerButton.diameter / IPOD.wheel.diameter) * 50 + 0.6;
  const sector = (a0, a1) => {
    const p = (r, a) => `${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`;
    const [s, e] = [(a0 * Math.PI) / 180, (a1 * Math.PI) / 180];
    return `M${p(50, s)}A50 50 0 0 1 ${p(50, e)}L${p(inner, e)}A${inner} ${inner} 0 0 0 ${p(inner, s)}Z`;
  };
  const quad = svg(`<svg class="ipoda-quad" viewBox="-50 -50 100 100" aria-hidden="true">
    <path data-q="menu" d="${sector(-135, -45)}"/><path data-q="next" d="${sector(-45, 45)}"/>
    <path data-q="play" d="${sector(45, 135)}"/><path data-q="prev" d="${sector(135, 225)}"/></svg>`);
  const mkBtn = (name, label, content) => {
    const b = h('button', `ipoda-wbtn ipoda-wbtn--${name}`, { type: 'button', tabindex: -1, 'aria-label': label, 'data-btn': name });
    b.innerHTML = content;
    return b;
  };
  const centerBtn = h('button', 'ipoda-center', { type: 'button', tabindex: -1, 'aria-label': 'Auswählen' });
  wheel.append(
    quad,
    mkBtn('menu', 'Menü (zurück)', IPOD.wheelLabels.menu ?? 'MENU'),
    mkBtn('next', 'Nächster Titel', ICON_NEXT),
    mkBtn('prev', 'Vorheriger Titel', ICON_PREV),
    mkBtn('play', 'Wiedergabe/Pause', ICON_PLAY),
    centerBtn,
  );
  const live = h('div', 'ipoda-sr', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  el.append(win, wheel, live);
  container.append(el);

  // LCD scale: logical 320×240 → real LCD size (crisp text, transform only)
  const fit = () => {
    const w = lcd.clientWidth;
    if (w > 0) ui.style.setProperty('--ipoda-s', String(w / IPOD.screen.pxWidth));
  };
  fit();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(fit);
    ro.observe(lcd);
  }

  // ───────────────────────── announcements ─────────────────────────
  let announceT = 0;
  const announce = (text) => {
    clearTimeout(announceT);
    announceT = setTimeout(() => { live.textContent = text; }, 120);
  };

  // ───────────────────────── player (Now Playing) ─────────────────────────
  const npItem = menu.find((m) => m?.type === 'nowplaying') ?? null;
  const tracks = npItem
    ? (npItem.tracks?.length ? npItem.tracks : [{ title: npItem.title ?? '', artist: npItem.artist ?? '', duration: '3:30' }])
    : [];
  const player = { track: 0, elapsed: 0, playing: false, started: false, volume: 0.6 };
  let npView = null; // active Now Playing DOM bindings
  let lastTick = performance.now();
  const playTimer = setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    if (!player.playing || !tracks.length) return;
    player.elapsed += dt;
    const dur = parseDuration(tracks[player.track].duration);
    if (player.elapsed >= dur) {
      player.track = (player.track + 1) % tracks.length;
      player.elapsed = 0;
    }
    renderPlayer();
  }, 250);
  cleanups.push(() => clearInterval(playTimer));

  function renderPlayer() {
    barPlay.classList.toggle('is-on', player.started);
    barPlay.classList.toggle('is-paused', !player.playing);
    npView?.update();
  }
  function changeTrack(dir) {
    if (!tracks.length) return;
    if (dir < 0 && player.elapsed > 3) player.elapsed = 0;
    else {
      player.track = (player.track + dir + tracks.length) % tracks.length;
      player.elapsed = 0;
    }
    player.started = true;
    renderPlayer();
    const t = tracks[player.track];
    announce(`${t.title}, ${t.artist ?? ''}`);
  }

  // ───────────────────────── cover art ─────────────────────────
  function coverArt(item, cls = '') {
    const box = h('div', `ipoda-art ${cls}`.trim());
    const fb = h('div', 'ipoda-art-fb');
    fb.append(h('b', null, { text: brand.monogram ?? '' }));
    box.append(fb);
    if (item?.cover) {
      const img = h('img', null, { alt: '', draggable: 'false', decoding: 'async' });
      img.addEventListener('error', () => img.remove(), { once: true });
      img.addEventListener('load', () => { if (!img.naturalWidth) img.remove(); }, { once: true });
      img.src = resolveAsset(item.cover);
      box.append(img);
    }
    return box;
  }

  // ───────────────────────── rows / lists ─────────────────────────
  function makeRow({ label, detail, sub, href, download, external }) {
    const row = h(href ? 'a' : 'div', 'ipoda-row', {
      role: 'option',
      id: `${P}-o${++optSeq}`,
      'aria-selected': 'false',
      tabindex: href ? -1 : null,
      draggable: href ? 'false' : null,
    });
    if (href) {
      row.setAttribute('href', href);
      if (download) row.setAttribute('download', download === true ? '' : download);
      else if (external) { row.target = '_blank'; row.rel = 'noopener'; }
    }
    row.append(h('span', 'ipoda-row-label', { text: label ?? '' }));
    if (detail) row.append(h('span', 'ipoda-row-detail', { text: detail }));
    if (sub) row.insertAdjacentHTML('beforeend', CHEVRON);
    return row;
  }

  /**
   * Generic list screen. opts: { kind, id, title, rows:[{...rowSpec, onActivate?}], pre?: Node, split?: bool }
   */
  function listScreen(opts) {
    const node = h('div', `ipoda-screen ipoda-screen--${opts.kind}${opts.split ? ' ipoda-screen--split' : ''}`);
    const view = h('div', 'ipoda-view');
    const content = h('div', 'ipoda-content');
    const list = h('div', 'ipoda-list', { role: 'listbox', 'aria-label': opts.title ?? '' });
    if (opts.pre) content.append(opts.pre);
    content.append(list);
    view.append(content);
    const sb = h('div', 'ipoda-sb', { 'aria-hidden': 'true' });
    const thumb = h('div', 'ipoda-sb-thumb');
    sb.append(thumb);
    node.append(view, sb);
    const specs = opts.rows ?? [];
    const rows = specs.map((s) => makeRow(s));
    list.append(...rows);

    const scr = {
      kind: opts.kind, id: opts.id, title: opts.title ?? '', node, rows, index: 0, list,
      onIndex: null,
      setIndex(i, { silent = false } = {}) {
        if (!rows.length) return false;
        i = clamp(i, 0, rows.length - 1);
        const changed = i !== scr.index;
        rows[scr.index]?.classList.remove('is-sel');
        rows[scr.index]?.setAttribute('aria-selected', 'false');
        scr.index = i;
        const r = rows[i];
        r.classList.add('is-sel');
        r.setAttribute('aria-selected', 'true');
        list.setAttribute('aria-activedescendant', r.id);
        if (isCurrent(scr)) el.setAttribute('aria-activedescendant', r.id);
        scr.ensureVisible();
        scr.onIndex?.(i);
        if (changed && !silent) announce(r.querySelector('.ipoda-row-label')?.textContent ?? '');
        return changed;
      },
      ensureVisible() {
        const r = rows[scr.index];
        if (!r) return;
        const vh = view.clientHeight;
        let top = r.offsetTop;
        if (scr.index === 0) top = 0; // keep any leading text visible
        const bottom = r.offsetTop + r.offsetHeight;
        if (top < view.scrollTop) view.scrollTop = top;
        else if (bottom > view.scrollTop + vh) view.scrollTop = bottom - vh;
        scr.updateScrollbar();
      },
      updateScrollbar() {
        const vh = view.clientHeight;
        const ch = content.scrollHeight;
        const over = ch > vh + 1;
        if (over !== sb.classList.contains('is-on')) {
          sb.classList.toggle('is-on', over);
          view.classList.toggle('has-sb', over);
        }
        if (!over) return;
        const th = Math.max(14, Math.round((vh * vh) / ch));
        const maxTop = vh - th;
        const ratio = view.scrollTop / Math.max(1, ch - vh);
        thumb.style.height = `${th}px`;
        thumb.style.top = `${Math.round(maxTop * ratio)}px`;
      },
      layout() {
        scr.updateScrollbar();
        scr.setIndex(scr.index, { silent: true });
        scr.updateScrollbar();
      },
      scroll(d) {
        if (rows.length) return scr.setIndex(scr.index + d);
        // text-only page: scroll the text by one row
        const before = view.scrollTop;
        view.scrollTop = clamp(before + d * TEXT_STEP, 0, Math.max(0, content.scrollHeight - view.clientHeight));
        scr.updateScrollbar();
        return view.scrollTop !== before;
      },
      activate() {
        const r = rows[scr.index];
        if (!r) return false;
        r.click();
        return true;
      },
      handleRowClick(row, e) {
        const i = rows.indexOf(row);
        if (i < 0) return;
        if (e.detail > 0) scr.setIndex(i);
        const spec = specs[i];
        if (spec.onActivate) {
          e.preventDefault();
          spec.onActivate(i);
          return;
        }
        if (spec.download) showToast('Download gestartet');
      },
    };
    return scr;
  }

  // ── main menu (split screen with preview pane)
  function menuScreen() {
    const scr = listScreen({
      kind: 'menu',
      id: 'menu',
      title: brand.name || 'iPod',
      split: true,
      rows: menu.map((item) => ({ label: item.label, sub: true, onActivate: () => open(item) })),
    });
    const preview = h('div', 'ipoda-preview', { 'aria-hidden': 'true' });
    scr.node.append(preview);
    const panes = new Map();
    let shown = null;
    scr.onIndex = (i) => {
      const item = menu[i];
      if (!item) return;
      let pane = panes.get(i);
      if (!pane) {
        pane = buildPreview(item);
        panes.set(i, pane);
        preview.append(pane);
        void pane.offsetWidth; // start the fade from 0
      }
      if (shown === pane) return;
      shown?.classList.remove('is-on');
      pane.classList.add('is-on');
      preview.append(pane); // newest on top for the cross-fade
      shown = pane;
    };
    return scr;
  }

  function buildPreview(item) {
    if (item.type === 'nowplaying') {
      const pane = h('div', 'ipoda-pv ipoda-pv--art');
      pane.append(coverArt(item));
      const cap = h('div', 'ipoda-pv-caption', { text: item.title ?? '' });
      if (item.artist) cap.append(h('span', null, { text: item.artist }));
      pane.append(cap);
      return pane;
    }
    const kind = item.type === 'list' ? 'contacts'
      : item.type === 'downloads' ? 'download'
        : item.type === 'page' && item.actions?.length ? 'chat' : 'monogram';
    const pane = h('div', 'ipoda-pv ipoda-pv--icon');
    const ico = h('div', 'ipoda-pv-float');
    ico.innerHTML = previewIcon(kind, `${P}pv${optSeq++}`, brand.monogram);
    const refl = h('div', 'ipoda-pv-refl');
    const reflIn = h('div', 'ipoda-pv-refl-in');
    reflIn.innerHTML = previewIcon(kind, `${P}pv${optSeq++}`, brand.monogram);
    refl.append(reflIn);
    pane.append(refl, ico);
    return pane;
  }

  // ── sub screens
  function buildScreen(item) {
    const title = item.title ?? item.label ?? '';
    switch (item.type) {
      case 'list':
        return listScreen({
          kind: 'list', id: item.id, title,
          rows: (item.items ?? []).map((it) => ({ label: it.label, detail: it.detail, href: it.href, external: isHttp(it.href) })),
        });
      case 'downloads':
        return listScreen({
          kind: 'downloads', id: item.id, title,
          rows: (item.items ?? []).map((it) => ({
            label: it.label,
            detail: [it.format, it.size && it.size !== '–' && it.size !== '-' ? it.size : null].filter(Boolean).join(' · '),
            href: resolveAsset(it.file),
            download: fileName(it.file),
          })),
        });
      case 'nowplaying':
        return nowPlayingScreen(item);
      case 'page':
      default: {
        const pre = h('p', 'ipoda-text', { text: item.body ?? '' });
        return listScreen({
          kind: 'page', id: item.id, title, pre,
          rows: (item.actions ?? []).map((a) => ({ label: a.label, detail: a.detail, href: a.href, external: isHttp(a.href) })),
        });
      }
    }
  }

  function nowPlayingScreen(item) {
    const scr = listScreen({
      kind: 'nowplaying', id: item.id, title: 'Now Playing',
      rows: item.spotifyUrl ? [{ label: 'In Spotify öffnen', href: item.spotifyUrl, external: true, sub: true }] : [],
    });
    const node = scr.node;
    node.classList.add('ipoda-np');
    const art = coverArt(item, 'ipoda-np-art');
    const refl = coverArt(item, 'ipoda-np-refl');
    refl.setAttribute('aria-hidden', 'true');
    const info = h('div', 'ipoda-np-info');
    const tTitle = h('div', 'ipoda-np-title');
    const tArtist = h('div', 'ipoda-np-artist');
    const tAlbum = h('div', 'ipoda-np-album', { text: item.title ?? '' });
    const tCount = h('div', 'ipoda-np-count');
    info.append(tTitle, tArtist, tAlbum, tCount);
    const prog = h('div', 'ipoda-np-prog');
    const meter = h('div', 'ipoda-meter');
    const fill = h('div', 'ipoda-meter-fill');
    meter.append(fill);
    const times = h('div', 'ipoda-np-times');
    const tEl = h('span');
    const tRem = h('span');
    times.append(tEl, tRem);
    prog.append(meter, times);
    const vol = h('div', 'ipoda-np-vol', { 'aria-hidden': 'true' });
    const vMeter = h('div', 'ipoda-meter');
    const vFill = h('div', 'ipoda-meter-fill');
    vMeter.append(vFill);
    vol.innerHTML = '<svg viewBox="0 0 13 11"><path d="M1 3.5h2.5L7 .8v9.4L3.5 7.5H1z" fill="#55595f"/></svg>';
    vol.append(vMeter);
    vol.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 13 11"><path d="M0 3.5h2.5L6 .8v9.4L2.5 7.5H0z" fill="#55595f"/><path d="M8 3.2a3 3 0 0 1 0 4.6M9.8 1.6a5.4 5.4 0 0 1 0 7.8" fill="none" stroke="#55595f" stroke-width="1.1" stroke-linecap="round"/></svg>');
    node.prepend(art, refl, info, prog, vol);

    let volT = 0;
    const bindings = {
      update() {
        const t = tracks[player.track] ?? {};
        const dur = parseDuration(t.duration);
        if (tTitle.textContent !== (t.title ?? '')) tTitle.textContent = t.title ?? '';
        if (tArtist.textContent !== (t.artist ?? '')) tArtist.textContent = t.artist ?? '';
        tCount.textContent = `${player.track + 1} von ${tracks.length}`;
        fill.style.width = `${clamp(player.elapsed / dur, 0, 1) * 100}%`;
        tEl.textContent = fmtTime(player.elapsed);
        tRem.textContent = `-${fmtTime(dur - Math.floor(player.elapsed))}`;
        vFill.style.width = `${player.volume * 100}%`;
      },
    };
    scr.onShow = () => {
      npView = bindings;
      if (!player.started) { player.started = true; player.playing = true; }
      renderPlayer();
    };
    scr.onHide = () => { if (npView === bindings) npView = null; node.classList.remove('is-vol'); };
    // Wheel on Now Playing = volume, like the real thing
    scr.scroll = (d) => {
      const before = player.volume;
      player.volume = clamp(Math.round((player.volume + d / 16) * 16) / 16, 0, 1);
      node.classList.add('is-vol');
      clearTimeout(volT);
      volT = setTimeout(() => node.classList.remove('is-vol'), 1600);
      bindings.update();
      return player.volume !== before;
    };
    bindings.update();
    return scr;
  }

  // ───────────────────────── navigation ─────────────────────────
  const stack = [];
  let phase = 'off'; // off → boot → ready
  const current = () => stack[stack.length - 1];
  const isCurrent = (s) => current() === s;
  const running = new Set();

  function setTitle(t) { barTitle.textContent = t; }

  function slide(outNode, inNode, dir) {
    for (const a of running) a.finish();
    if (reduced || !outNode) return Promise.resolve();
    const opts = { duration: SLIDE_MS, easing: 'cubic-bezier(.3,.05,.25,1)' };
    const a1 = outNode.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 100}%)` }], opts);
    const a2 = inNode.animate([{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }], opts);
    running.add(a1); running.add(a2);
    // Wall-clock safety net: if the document timeline stalls (throttled/background tab, a
    // renderer that stops producing frames), never leave the screens half-way.
    const guard = setTimeout(() => { if (running.has(a1)) { a1.finish(); a2.finish(); } }, SLIDE_MS + 160);
    return Promise.all([a1.finished, a2.finished]).catch(() => {})
      .finally(() => { clearTimeout(guard); running.delete(a1); running.delete(a2); });
  }
  const detachLater = (scr) => () => { if (!isCurrent(scr)) scr.node.remove(); };

  function show(scr) {
    stage.append(scr.node);
    setTitle(scr.title);
    scr.layout();
    const r = scr.rows[scr.index];
    if (r) el.setAttribute('aria-activedescendant', r.id); else el.removeAttribute('aria-activedescendant');
    scr.onShow?.();
  }

  function open(item) {
    const scr = buildScreen(item);
    const prev = current();
    prev?.onHide?.();
    stack.push(scr);
    show(scr);
    slide(prev?.node, scr.node, 1).then(detachLater(prev));
    const r = scr.rows[scr.index];
    announce(`${scr.title}${r ? `, ${r.querySelector('.ipoda-row-label')?.textContent ?? ''}` : ''}`);
  }

  function back() {
    if (stack.length < 2) return false;
    const top = stack.pop();
    top.onHide?.();
    const prev = current();
    show(prev);
    slide(top.node, prev.node, -1).then(() => top.node.remove());
    announce(prev.title);
    return true;
  }

  // ───────────────────────── toast ─────────────────────────
  let toastT = 0;
  function showToast(text) {
    toast.innerHTML = TOAST_CHECK;
    toast.append(document.createTextNode(text));
    toast.classList.add('is-on');
    announce(text);
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('is-on'), 1700);
  }

  // ───────────────────────── input → actions ─────────────────────────
  function flash(btn) {
    const target = btn === 'center' ? centerBtn : quad.querySelector(`[data-q="${btn}"]`);
    if (!target) return;
    target.classList.add('is-pressed');
    setTimeout(() => target.classList.remove('is-pressed'), 130);
  }

  function press(btn, { visual = true } = {}) {
    if (visual) flash(btn);
    if (phase !== 'ready') return;
    clicker.play('press');
    const scr = current();
    switch (btn) {
      case 'menu': back(); break;
      case 'center': scr?.activate(); break;
      case 'play':
        if (!tracks.length) break;
        player.playing = !player.playing;
        player.started = true;
        renderPlayer();
        announce(player.playing ? 'Wiedergabe' : 'Pause');
        break;
      case 'next':
      case 'prev':
        if (tracks.length && (scr?.kind === 'nowplaying' || player.started)) changeTrack(btn === 'next' ? 1 : -1);
        break;
      default: break;
    }
  }

  function scroll(steps) {
    if (phase !== 'ready') return;
    const n = Math.trunc(Number(steps) || 0);
    const dir = Math.sign(n);
    for (let i = 0; i < Math.abs(n); i++) {
      if (current()?.scroll(dir)) clicker.play('tick');
    }
  }

  // ── stage row clicks / taps (screen is directly tappable too)
  on(stage, 'click', (e) => {
    const row = e.target.closest?.('.ipoda-row');
    const scr = current();
    if (!row || !scr || !scr.node.contains(row)) { if (row) e.preventDefault(); return; }
    if (phase !== 'ready') { e.preventDefault(); return; }
    if (e.detail > 0) clicker.play('press');
    scr.handleRowClick(row, e);
  });
  on(stage, 'dragstart', (e) => e.preventDefault());

  // ── wheel: rotational drag + clicks on the four buttons
  let drag = null;
  const quadrantAt = (ang) => {
    const d = ((ang * 180) / Math.PI + 360) % 360; // 0 = right, 90 = down
    if (d >= 225 && d < 315) return 'menu';
    if (d >= 315 || d < 45) return 'next';
    if (d >= 45 && d < 135) return 'play';
    return 'prev';
  };
  on(wheel, 'pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    clicker.ensure();
    el.focus({ preventScroll: true });
    if (e.target.closest('.ipoda-center')) return;
    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > r.width / 2 + 2) return;
    e.preventDefault();
    const ang = Math.atan2(dy, dx);
    const q = quadrantAt(ang);
    drag = { id: e.pointerId, cx, cy, last: ang, acc: 0, travel: 0, steps: 0, q, minR: r.width * 0.12 };
    try { wheel.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    quad.querySelector(`[data-q="${q}"]`)?.classList.add('is-pressed');
  });
  on(wheel, 'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.cx;
    const dy = e.clientY - drag.cy;
    if (Math.hypot(dx, dy) < drag.minR) return; // too close to the centre: angle is unstable
    const ang = Math.atan2(dy, dx);
    let d = ang - drag.last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    drag.last = ang;
    const deg = (d * 180) / Math.PI;
    drag.acc += deg;
    drag.travel += Math.abs(deg);
    if (drag.travel > 7 && drag.q) {
      quad.querySelector(`[data-q="${drag.q}"]`)?.classList.remove('is-pressed');
      drag.q = null;
      wheel.classList.add('is-dragging');
    }
    while (Math.abs(drag.acc) >= STEP_DEG) {
      const s = Math.sign(drag.acc);
      drag.acc -= s * STEP_DEG;
      drag.steps++;
      scroll(s); // clockwise (screen coords) = down
    }
  });
  const endDrag = (e, cancelled) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { q } = drag;
    if (q) quad.querySelector(`[data-q="${q}"]`)?.classList.remove('is-pressed');
    wheel.classList.remove('is-dragging');
    drag = null;
    if (q && !cancelled) press(q, { visual: false });
  };
  on(wheel, 'pointerup', (e) => endDrag(e, false));
  on(wheel, 'pointercancel', (e) => endDrag(e, true));
  on(wheel, 'contextmenu', (e) => e.preventDefault());

  // centre button
  let centerDown = false;
  on(centerBtn, 'pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    centerDown = true;
    centerBtn.classList.add('is-pressed');
    try { centerBtn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  on(centerBtn, 'pointerup', (e) => {
    if (!centerDown) return;
    centerDown = false;
    centerBtn.classList.remove('is-pressed');
    const r = centerBtn.getBoundingClientRect();
    const inside = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) <= r.width / 2 + 6;
    if (inside) press('center', { visual: false });
  });
  on(centerBtn, 'pointercancel', () => { centerDown = false; centerBtn.classList.remove('is-pressed'); });
  // keyboard / assistive-tech activation of the hidden buttons
  on(centerBtn, 'click', (e) => { if (e.detail === 0) press('center'); });
  on(wheel, 'click', (e) => {
    const b = e.target.closest?.('.ipoda-wbtn');
    if (b && e.detail === 0) press(b.dataset.btn);
  });

  // mouse wheel / trackpad over the iPod
  let wheelAcc = 0;
  let wheelIdle = 0;
  on(el, 'wheel', (e) => {
    e.preventDefault();
    const dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (e.deltaMode === 1 || e.deltaMode === 2) { scroll(Math.sign(dy)); return; }
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { wheelAcc = 0; }, 200);
    wheelAcc += dy;
    const th = 48;
    while (Math.abs(wheelAcc) >= th) {
      const s = Math.sign(wheelAcc);
      wheelAcc -= s * th;
      scroll(s);
    }
  }, { passive: false });

  // keyboard
  on(el, 'keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    clicker.ensure();
    let handled = true;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': scroll(1); break;
      case 'ArrowUp': case 'ArrowLeft': scroll(-1); break;
      case 'Enter': press('center'); break;
      case 'Escape': case 'Backspace': press('menu'); break;
      case ' ': case 'Spacebar': press('play'); break;
      case 'MediaTrackNext': press('next'); break;
      case 'MediaTrackPrevious': press('prev'); break;
      case 'MediaPlayPause': press('play'); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  });
  // touch pointerdown is not a user activation: also unlock audio on pointerup / click
  for (const t of ['pointerdown', 'pointerup', 'click']) on(el, t, () => clicker.ensure());

  // ───────────────────────── boot / reveal ─────────────────────────
  const menuScr = menuScreen();
  stack.push(menuScr);
  show(menuScr);

  let revealPromise = null;
  function reveal({ boot: doBoot = true } = {}) {
    if (revealPromise) return revealPromise;
    revealPromise = (async () => {
      fit();
      el.classList.add('is-revealed');
      if (doBoot) {
        phase = 'boot';
        boot.classList.remove('is-hidden');
        ui.classList.add('is-on');
        await wait(reduced ? 60 : 160);
        boot.classList.add('show-logo');
        await wait(reduced ? 600 : 900);
        menuScr.layout();
        boot.classList.add('is-out');
        await wait(300);
        boot.classList.add('is-hidden');
        boot.classList.remove('is-out', 'show-logo');
      } else {
        ui.classList.add('is-on');
      }
      menuScr.layout();
      phase = 'ready';
      announce(`${menuScr.title}: ${menu[menuScr.index]?.label ?? ''}`);
    })();
    return revealPromise;
  }

  function getState() {
    const scr = current();
    return {
      screen: phase === 'ready' ? scr?.kind ?? 'menu' : phase,
      path: stack.slice(1).map((s) => s.id),
      index: scr?.index ?? 0,
    };
  }

  function destroy() {
    for (const fn of cleanups.splice(0)) fn();
    for (const a of running) a.cancel();
    ro?.disconnect();
    clearTimeout(toastT);
    clearTimeout(announceT);
    clearTimeout(wheelIdle);
    clicker.close();
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
