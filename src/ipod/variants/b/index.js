// iPod Classic (6th/7th gen, silver) – variant B: "feel first".
// HTML/CSS/SVG body, click wheel with angle accumulation, acceleration + momentum, WebAudio ticks,
// iPod-style horizontal slide navigation and a highlight that glides (with a clipped white-text layer
// so the text colour follows the bar pixel-exactly).
import gsap from 'gsap';
import { IPOD, COLORS } from '../../../shared/ipodSpec.js';
import { prefersReducedMotion } from '../../../shared/config.js';
import './ipodb.css';

// Logical LCD (rendered at 320×240 and scaled to the real LCD size).
const W = IPOD.screen.pxWidth;
const H = IPOD.screen.pxHeight;
const TITLE_H = 22;
const BODY_H = H - TITLE_H;
const ROW_H = 27; // ~1/8 of the usable screen height

const SLIDE_DUR = 0.34;
const SLIDE_EASE = 'power3.out';
const BASE_STEP_DEG = 20;

let instances = 0;

// ---------- small helpers ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

const parseDur = (s) => {
  const [m, sec] = String(s || '0:00').split(':').map(Number);
  return (m || 0) * 60 + (sec || 0) || 180;
};
const fmt = (t) => {
  t = Math.max(0, Math.floor(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const normDeg = (d) => ((d + 540) % 360) - 180;

// Content paths in config.json are relative to the site root (where config.json lives).
// The dev harness lives in /dev/, so resolve one level up there.
const assetBase = () => new URL(/\/dev\/[^/]*$/.test(location.pathname) ? '../' : './', document.baseURI);
const resolveAsset = (p) => {
  try { return new URL(p, assetBase()).href; } catch { return p; }
};
const isHttp = (href) => /^https?:/i.test(href || '');

// ---------- inline SVG glyphs ----------
const SVG = {
  next: '<svg viewBox="0 0 24 12" aria-hidden="true"><path d="M2 1.2l8 4.8-8 4.8zM10.5 1.2l8 4.8-8 4.8z"/><rect x="19.4" y="1.2" width="2.4" height="9.6" rx=".4"/></svg>',
  prev: '<svg viewBox="0 0 24 12" aria-hidden="true"><path d="M22 1.2l-8 4.8 8 4.8zM13.5 1.2l-8 4.8 8 4.8z"/><rect x="2.2" y="1.2" width="2.4" height="9.6" rx=".4"/></svg>',
  playpause: '<svg viewBox="0 0 24 12" aria-hidden="true"><path d="M2 1.2l8.2 4.8L2 10.8z"/><rect x="13.4" y="1.2" width="3" height="9.6" rx=".4"/><rect x="18.6" y="1.2" width="3" height="9.6" rx=".4"/></svg>',
  battery: `<svg class="ipodb-batt" viewBox="0 0 24 11" aria-hidden="true"><defs><linearGradient id="ipodb-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9f08a"/><stop offset=".5" stop-color="#7ccc3a"/><stop offset="1" stop-color="#3f9a18"/></linearGradient><linearGradient id="ipodb-bo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9da1a6"/><stop offset="1" stop-color="#55595e"/></linearGradient></defs><rect x=".6" y=".6" width="20.4" height="9.8" rx="2" fill="#fff" stroke="url(#ipodb-bo)" stroke-width="1.1"/><rect x="2" y="2" width="15.4" height="7" rx="1" fill="url(#ipodb-bg)"/><rect x="21.4" y="3.4" width="2" height="4.2" rx=".8" fill="#6b6f74"/></svg>`,
  playSmall: '<svg viewBox="0 0 10 10" aria-hidden="true"><defs><linearGradient id="ipodb-pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc3f5"/><stop offset="1" stop-color="#1f62c0"/></linearGradient></defs><path d="M1.5 .8l7.4 4.2-7.4 4.2z" fill="url(#ipodb-pl)" stroke="#164f9e" stroke-width=".6" stroke-linejoin="round"/></svg>',
  pauseSmall: '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.6" y="1" width="2.6" height="8" rx=".5" fill="#2a6fc9"/><rect x="5.8" y="1" width="2.6" height="8" rx=".5" fill="#2a6fc9"/></svg>',
  chevron: '<svg class="ipodb-chev" viewBox="0 0 8 12" aria-hidden="true"><path d="M1.6 1.2L6.4 6l-4.8 4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0l-4.5-4.5M12 14l4.5-4.5M4.5 16.5v3h15v-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  spk0: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3.5v11L5 10H2z" fill="currentColor"/></svg>',
  spk1: '<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M2 6h3l4-3.5v11L5 10H2z" fill="currentColor"/><path d="M12 5.2a4 4 0 010 5.6M14.6 3a7 7 0 010 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

// ---------- audio ----------
function createAudio(enabled) {
  let ctx = null;
  let master = null;
  let tickBuf = null;
  let pressBuf = null;
  let lastTick = 0;
  const makeBuf = (len, fn) => {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = fn(i / ctx.sampleRate, i);
    return b;
  };
  return {
    ensure() {
      if (!enabled) return;
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) { enabled = false; return; }
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = 0.5;
          master.connect(ctx.destination);
          // Tick: a ~4 ms click – the piezo "tk" of a real click wheel.
          let seed = 7;
          const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
          tickBuf = makeBuf(0.006, (t) => {
            const env = Math.exp(-t * 1400);
            return (rnd() * 0.55 + Math.sin(2 * Math.PI * 3900 * t) * 0.6) * env;
          });
          // Press: a slightly lower, fuller "clack" (button dome).
          pressBuf = makeBuf(0.03, (t) => {
            const env = Math.exp(-t * 260);
            const env2 = Math.exp(-t * 900);
            return (Math.sin(2 * Math.PI * 1250 * t) * 0.5 + Math.sin(2 * Math.PI * 310 * t) * 0.35) * env + rnd() * 0.45 * env2;
          });
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      } catch { enabled = false; }
    },
    play(kind) {
      if (!enabled || !ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (kind === 'tick') {
        if (now - lastTick < 0.012) return; // never smear ticks into a buzz
        lastTick = now;
      }
      const src = ctx.createBufferSource();
      src.buffer = kind === 'tick' ? tickBuf : pressBuf;
      src.playbackRate.value = 0.96 + Math.random() * 0.08;
      const g = ctx.createGain();
      g.gain.value = kind === 'tick' ? 0.22 : 0.3;
      src.connect(g).connect(master);
      src.start(now);
    },
    close() { try { ctx?.close(); } catch { /* ignore */ } },
  };
}

// ---------- procedural textures (rendered once to bitmaps; cheap to composite) ----------
let texCache = null;
function textures() {
  if (texCache) return texCache;
  texCache = {};
  try {
    let seed = 1234567;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Brushed aluminium: long horizontal streaks of slightly lighter/darker metal.
    const bw = 512, bh = 128;
    const c = document.createElement('canvas');
    c.width = bw; c.height = bh;
    const x = c.getContext('2d');
    const img = x.createImageData(bw, bh);
    for (let y = 0; y < bh; y++) {
      const rowBase = (rnd() - 0.5) * 2;
      let v = 0;
      for (let i = 0; i < bw; i++) {
        v = v * 0.96 + (rnd() - 0.5) * 0.35; // horizontal correlation → streaks
        const val = rowBase * 0.6 + v + (rnd() - 0.5) * 0.25;
        const o = (y * bw + i) * 4;
        const light = val > 0;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = light ? 255 : 40;
        img.data[o + 3] = Math.min(255, Math.abs(val) * (light ? 10 : 7));
      }
    }
    x.putImageData(img, 0, 0);
    texCache.brush = `url("${c.toDataURL('image/png')}")`;
    // Matte grain for the click wheel.
    const gw = 96;
    c.width = gw; c.height = gw;
    const gimg = x.createImageData(gw, gw);
    for (let i = 0; i < gw * gw; i++) {
      const val = rnd() - 0.5;
      gimg.data[i * 4] = gimg.data[i * 4 + 1] = gimg.data[i * 4 + 2] = val > 0 ? 255 : 0;
      gimg.data[i * 4 + 3] = Math.abs(val) * 10;
    }
    x.putImageData(gimg, 0, 0);
    texCache.grain = `url("${c.toDataURL('image/png')}")`;
  } catch { /* textures are optional */ }
  return texCache;
}

// =====================================================================================
export function mountIpod(container, { config }) {
  const uid = `ipodb${++instances}`;
  const brand = config.brand || {};
  const menu = Array.isArray(config.menu) ? config.menu : [];
  const soundOn = config.settings?.clickSound !== false;
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = prefersReducedMotion();
  const onMq = () => { reduced = prefersReducedMotion(); root.classList.toggle('ipodb--reduced', reduced); };

  const audio = createAudio(soundOn);
  const cleanups = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  // ---------- body ----------
  const root = h('div', {
    class: 'ipodb',
    tabindex: '0',
    role: 'application',
    'aria-roledescription': 'iPod',
    'aria-label': `iPod – ${brand.name || ''}. Pfeiltasten blättern, Enter wählt aus, Escape geht zurück, Leertaste spielt ab.`,
  });
  root.classList.toggle('ipodb--reduced', reduced);
  // Geometry from the spec (mm) → CSS custom properties consumed as calc(var(--ipodb-mm) * var(--x)).
  const g = {
    w: IPOD.width, r: IPOD.cornerRadius,
    'sw-x': IPOD.screenWindow.x, 'sw-y': IPOD.screenWindow.y, 'sw-w': IPOD.screenWindow.width,
    'sw-h': IPOD.screenWindow.height, 'sw-r': IPOD.screenWindow.radius,
    'lcd-w': IPOD.screen.width, 'lcd-h': IPOD.screen.height,
    'lcd-x': (IPOD.screenWindow.width - IPOD.screen.width) / 2,
    'lcd-y': (IPOD.screenWindow.height - IPOD.screen.height) / 2,
    'wh-x': IPOD.wheel.cx - IPOD.wheel.diameter / 2, 'wh-y': IPOD.wheel.cy - IPOD.wheel.diameter / 2,
    'wh-d': IPOD.wheel.diameter, 'cb-d': IPOD.centerButton.diameter,
    'lbl-r': (IPOD.wheel.diameter / 2) * IPOD.wheelLabels.radiusFactor,
  };
  for (const [k, v] of Object.entries(g)) root.style.setProperty(`--ipodb-${k}`, String(+v.toFixed(4)));
  root.style.setProperty('--ipodb-hl-top', COLORS.uiHighlightTop);
  root.style.setProperty('--ipodb-hl-bot', COLORS.uiHighlightBottom);
  root.style.setProperty('--ipodb-alu', COLORS.aluminium);
  root.style.setProperty('--ipodb-alu-l', COLORS.aluminiumLight);
  root.style.setProperty('--ipodb-alu-d', COLORS.aluminiumDark);
  root.style.setProperty('--ipodb-wheel', COLORS.wheel);
  root.style.setProperty('--ipodb-wheel-lbl', COLORS.wheelLabel);
  root.style.setProperty('--ipodb-cb', COLORS.centerButton);
  root.style.setProperty('--ipodb-glass', COLORS.screenWindow);
  root.style.setProperty('--ipodb-lcd-off', COLORS.lcdOff);

  const tex = textures();
  if (tex.brush) root.style.setProperty('--ipodb-tex-brush', tex.brush);
  if (tex.grain) root.style.setProperty('--ipodb-tex-grain', tex.grain);
  const face = h('div', { class: 'ipodb-face', 'aria-hidden': 'true' });

  // Screen window + LCD
  const titleText = h('div', { class: 'ipodb-title' }, h('span', { class: 'ipodb-title-t', text: brand.name || 'iPod' }));
  const playInd = h('span', { class: 'ipodb-playind', 'aria-hidden': 'true' });
  const titlebar = h('div', { class: 'ipodb-titlebar', 'aria-hidden': 'true' }, playInd, titleText, h('span', { class: 'ipodb-battwrap', html: SVG.battery }));
  const viewport = h('div', { class: 'ipodb-viewport' });
  const toastEl = h('div', { class: 'ipodb-toast', 'aria-hidden': 'true' });
  const bootMono = h('div', { class: 'ipodb-boot-mono', text: brand.monogram || '' });
  const bootEl = h('div', { class: 'ipodb-boot', 'aria-hidden': 'true' }, bootMono);
  const stage = h('div', { class: 'ipodb-stage' }, titlebar, viewport, toastEl, bootEl);
  const lcd = h('div', { class: 'ipodb-lcd' }, stage);
  const glare = h('div', { class: 'ipodb-glare', 'aria-hidden': 'true' });
  const screenWin = h('div', { class: 'ipodb-window' }, lcd, glare);

  // Click wheel
  const mkBtn = (name, label, html, cls) =>
    h('button', { type: 'button', class: `ipodb-btn ipodb-btn--${cls}`, 'data-btn': name, tabindex: '-1', 'aria-label': label, html });
  const btnMenu = mkBtn('menu', 'Menü / zurück', `<span>${IPOD.wheelLabels.menu}</span>`, 'menu');
  const btnNext = mkBtn('next', 'Nächster Titel', SVG.next, 'next');
  const btnPrev = mkBtn('prev', 'Vorheriger Titel', SVG.prev, 'prev');
  const btnPlay = mkBtn('play', 'Wiedergabe / Pause', SVG.playpause, 'play');
  const btnCenter = h('button', { type: 'button', class: 'ipodb-center', 'data-btn': 'center', tabindex: '-1', 'aria-label': 'Auswählen' });
  const wheelShade = h('div', { class: 'ipodb-wheel-shade', 'aria-hidden': 'true' });
  const wheel = h('div', { class: 'ipodb-wheel' }, h('div', { class: 'ipodb-wheel-face', 'aria-hidden': 'true' }), wheelShade, btnMenu, btnNext, btnPrev, btnPlay, btnCenter);
  const wheelWrap = h('div', { class: 'ipodb-wheelwrap', role: 'group', 'aria-label': 'Click Wheel' }, wheel);

  const live = h('div', { class: 'ipodb-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
  root.append(face, screenWin, wheelWrap, live);
  container.append(root);

  // Scale the 320×240 logical screen to the LCD.
  let scale = 1;
  const fit = () => {
    const w = lcd.clientWidth;
    if (!w) return;
    scale = w / W;
    stage.style.transform = `scale(${scale})`;
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(lcd);
  cleanups.push(() => ro.disconnect());

  // ---------- state ----------
  let booted = false;
  let destroyed = false;
  const stack = [];
  const current = () => stack[stack.length - 1];
  let slideTl = null;

  const playlistItem = menu.find((m) => m.type === 'nowplaying');
  const tracks = playlistItem?.tracks?.length ? playlistItem.tracks : [];
  const player = { track: 0, playing: false, started: false, elapsed: 0, volume: 0.62 };

  // ---------- cover art (config cover → gradient placeholder with monogram on error) ----------
  let coverOk = null; // null = loading, true/false
  const coverWaiters = new Set();
  const coverSrc = playlistItem?.cover ? resolveAsset(playlistItem.cover) : null;
  if (coverSrc) {
    const img = new Image();
    img.onload = () => { coverOk = true; coverWaiters.forEach((f) => f()); };
    img.onerror = () => { coverOk = false; coverWaiters.forEach((f) => f()); };
    img.src = coverSrc;
  } else coverOk = false;
  function makeCover(cls = '') {
    const el = h('div', { class: `ipodb-cover ${cls}` },
      h('div', { class: 'ipodb-cover-ph' }, h('div', { class: 'ipodb-cover-rings' }), h('span', { text: brand.monogram || '' })));
    const apply = () => {
      if (coverOk) {
        el.classList.add('has-img');
        el.style.backgroundImage = `url("${coverSrc}")`;
      }
    };
    if (coverOk === null) coverWaiters.add(apply); else apply();
    return el;
  }

  // ---------- highlight-list view (used by menu / list / page / downloads) ----------
  let rowSeq = 0;
  function makeListView({ id, kind, title, item, rows, header = null, split = false }) {
    const el = h('div', { class: `ipodb-screen ipodb-screen--${kind}${split ? ' ipodb-screen--split' : ''}` });
    const listId = `${uid}-l${++rowSeq}`;
    const listbox = h('div', { class: 'ipodb-list', role: 'listbox', id: listId, 'aria-label': title });
    const scroller = h('div', { class: 'ipodb-scroller' });
    const rowsWrap = h('div', { class: 'ipodb-rowswrap' });
    const hl = h('div', { class: 'ipodb-hl', 'aria-hidden': 'true' });
    const base = h('div', { class: 'ipodb-rows' });
    const inv = h('div', { class: 'ipodb-rows ipodb-rows--inv', 'aria-hidden': 'true' });
    const sbar = h('div', { class: 'ipodb-sbar', 'aria-hidden': 'true' }, h('div', { class: 'ipodb-sbar-thumb' }));
    const rowEls = [];

    rows.forEach((r, i) => {
      const rid = `${uid}-r${++rowSeq}`;
      const inner = () => [
        h('span', { class: 'ipodb-row-l', text: r.label }),
        r.detail ? h('span', { class: 'ipodb-row-d', text: r.detail }) : null,
        r.chevron ? h('span', { class: 'ipodb-row-c', html: SVG.chevron }) : null,
      ];
      const attrs = { class: 'ipodb-row', role: 'option', id: rid, 'aria-selected': i === 0 ? 'true' : 'false', 'data-i': String(i), tabindex: '-1' };
      let row;
      if (r.href) {
        row = h('a', { ...attrs, href: r.href, draggable: 'false' }, inner());
        if (r.download) row.setAttribute('download', r.downloadName || '');
        else if (isHttp(r.href)) { row.target = '_blank'; row.rel = 'noopener noreferrer'; }
      } else {
        row = h('div', attrs, inner());
      }
      row.setAttribute('aria-label', [r.label, r.detail].filter(Boolean).join(', '));
      base.append(row);
      inv.append(h('div', { class: 'ipodb-row' }, inner()));
      rowEls.push(row);
    });
    if (!rows.length) { hl.hidden = true; rowsWrap.classList.add('is-empty'); }

    rowsWrap.append(hl, base, inv);
    if (header) scroller.append(header);
    scroller.append(rowsWrap);
    listbox.append(scroller);
    el.append(listbox, sbar);
    if (rows.length) listbox.setAttribute('aria-activedescendant', rowEls[0].id);

    const anim = { hl: 0, sc: 0, bump: 0 };
    let headerH = 0;
    let index = 0;
    let scrollY = 0;
    const listH = BODY_H;
    const measure = () => {
      headerH = header ? header.offsetHeight : 0;
      return headerH;
    };
    const contentH = () => headerH + rows.length * ROW_H + (header ? 6 : 0);
    const maxScroll = () => Math.max(0, contentH() - listH);

    const apply = () => {
      const y = anim.hl + anim.bump;
      hl.style.transform = `translate3d(0,${y}px,0)`;
      const total = rows.length * ROW_H;
      inv.style.clipPath = `inset(${Math.max(0, y)}px 0 ${Math.max(0, total - y - ROW_H)}px 0)`;
      scroller.style.transform = `translate3d(0,${-anim.sc}px,0)`;
      const ms = maxScroll();
      if (ms > 0) {
        sbar.classList.add('is-on');
        const trackH = listH - 4;
        const th = Math.max(18, (trackH * listH) / contentH());
        sbar.firstChild.style.transform = `translate3d(0,${(anim.sc / ms) * (trackH - th)}px,0)`;
        sbar.firstChild.style.height = `${th}px`;
      } else sbar.classList.remove('is-on');
    };

    const ensureVisible = () => {
      if (!rows.length) return;
      const top = headerH + index * ROW_H;
      if (!header && index === 0) scrollY = 0;
      if (top < scrollY) scrollY = top;
      else if (top + ROW_H > scrollY + listH) scrollY = top + ROW_H - listH;
      if (!header && index === rows.length - 1) scrollY = maxScroll();
      scrollY = Math.min(Math.max(0, scrollY), maxScroll());
    };
    const rowVisible = (i) => {
      const top = headerH + i * ROW_H;
      return top >= scrollY - 1 && top + ROW_H <= scrollY + listH + 1;
    };
    const scrollText = (d) => {
      const ns = Math.max(0, Math.min(maxScroll(), scrollY + d * 22));
      if (ns === scrollY) return false;
      scrollY = ns;
      if (reduced) { anim.sc = ns; apply(); } else gsap.to(anim, { sc: ns, duration: 0.16, ease: 'power2.out', overwrite: 'auto', onUpdate: apply });
      return true;
    };

    let lastMoveT = 0;
    const animateTo = (instant) => {
      const now = performance.now();
      const gap = now - lastMoveT;
      lastMoveT = now;
      if (instant || reduced) {
        gsap.killTweensOf(anim, 'hl,sc');
        anim.hl = index * ROW_H; anim.sc = scrollY; apply();
        return;
      }
      // Faster spins → shorter glide, so the bar never lags behind the ticks.
      const dur = Math.max(0.05, Math.min(0.13, gap / 1000 * 0.9));
      gsap.to(anim, { hl: index * ROW_H, sc: scrollY, duration: dur, ease: 'power2.out', overwrite: 'auto', onUpdate: apply });
    };

    const setIndex = (i, instant = false) => {
      if (!rows.length) return false;
      i = Math.max(0, Math.min(rows.length - 1, i));
      const prev = index;
      index = i;
      if (!headerH && header) measure();
      ensureVisible();
      rowEls[prev]?.setAttribute('aria-selected', 'false');
      rowEls[i].setAttribute('aria-selected', 'true');
      listbox.setAttribute('aria-activedescendant', rowEls[i].id);
      root.setAttribute('aria-activedescendant', rowEls[i].id);
      animateTo(instant);
      view.onIndex?.(i, prev);
      return i !== prev;
    };

    const view = {
      id, kind, title, item, el, rows, rowEls, listbox,
      get index() { return index; },
      get count() { return rows.length; },
      layout() { measure(); if (!header) ensureVisible(); anim.hl = index * ROW_H; anim.sc = scrollY; apply(); },
      move(d) {
        if (header && !headerH) measure();
        if (!rows.length) return scrollText(d);
        if (!header) return setIndex(index + d);
        // Text page with actions: read the text first, then walk the action rows.
        if (d > 0) {
          if (!rowVisible(index)) return scrollText(1);
          if (index < rows.length - 1) return setIndex(index + 1);
          return scrollText(1);
        }
        if (index > 0) return setIndex(index - 1);
        return scrollText(-1);
      },
      /** Centre on a page whose highlighted action is still below the fold: reveal it first. */
      revealRow() {
        if (!rows.length || rowVisible(index)) return false;
        ensureVisible();
        animateTo(false);
        return true;
      },
      setIndex,
      bump(d) {
        if (reduced) return;
        gsap.killTweensOf(anim, 'bump');
        gsap.fromTo(anim, { bump: 0 }, { bump: d * 3.5, duration: 0.07, ease: 'power2.out', yoyo: true, repeat: 1, onUpdate: apply });
      },
      currentRow() { return rows[index]; },
      currentLabel() { return rows.length ? [rows[index].label, rows[index].detail].filter(Boolean).join(', ') : ''; },
    };
    apply();
    return view;
  }

  // ---------- previews for the split-screen root menu ----------
  function makePreview(item, i) {
    const pv = h('div', { class: `ipodb-pv ipodb-pv--${item.type}` });
    const art = h('div', { class: 'ipodb-pv-art' });
    art.style.setProperty('--kx', `${[-5, 4, -3, 5, -4][i % 5]}%`);
    art.style.setProperty('--ky', `${[3, -4, 4, -2, -3][i % 5]}%`);
    art.style.animationDelay = `${-i * 3.1}s`;
    if (item.type === 'nowplaying') {
      art.append(makeCover('ipodb-cover--fill'));
    } else if (item.type === 'list') {
      art.classList.add('ipodb-art-list');
      art.append(
        h('div', { class: 'ipodb-art-avatar', text: brand.monogram || '' }),
        h('div', { class: 'ipodb-art-chips' }, ...(item.items || []).slice(0, 5).map((x, k) =>
          h('span', { class: 'ipodb-art-chip', style: `animation-delay:${k * 0.6}s`, text: x.label }))),
      );
    } else if (item.type === 'downloads') {
      art.classList.add('ipodb-art-dl');
      const files = (item.items || []).slice(0, 3);
      files.forEach((f, k) => art.append(h('div', { class: 'ipodb-art-sheet', style: `--k:${k}` },
        h('b', { text: f.format || 'FILE' }), h('i'), h('i'), h('i'))));
      art.append(h('div', { class: 'ipodb-art-arrow', html: SVG.download }));
    } else if (item.type === 'page' && item.actions?.length) {
      art.classList.add('ipodb-art-page');
      art.append(h('div', { class: 'ipodb-art-q', text: '“' }), h('p', { text: item.body || '' }));
    } else {
      art.classList.add('ipodb-art-mono');
      art.append(h('div', { class: 'ipodb-art-mono-m', text: brand.monogram || '' }), h('p', { text: brand.tagline || '' }));
    }
    pv.append(art);
    return pv;
  }

  // ---------- screens ----------
  function buildRoot() {
    const rows = menu.map((m) => ({ label: m.label, chevron: true, item: m }));
    const v = makeListView({ id: 'root', kind: 'menu', title: brand.name || 'iPod', rows, split: true });
    const pane = h('div', { class: 'ipodb-pane', 'aria-hidden': 'true' });
    const pvs = menu.map((m, i) => makePreview(m, i));
    pane.append(...pvs, h('div', { class: 'ipodb-pane-shadow' }));
    v.el.append(pane);
    let pvTimer = 0;
    const showPv = (i) => pvs.forEach((p, k) => p.classList.toggle('is-on', k === i));
    showPv(0);
    // Like the real Classic, the preview follows the highlight with a short settle delay.
    v.onIndex = (i) => {
      clearTimeout(pvTimer);
      pvTimer = setTimeout(() => showPv(i), reduced ? 0 : 110);
    };
    v.activate = () => {
      const m = menu[v.index];
      if (m) open(m);
    };
    return v;
  }

  function linkRow(x) {
    return { label: x.label, detail: x.detail, href: x.href };
  }

  function buildItemView(m) {
    const title = m.title || m.label;
    if (m.type === 'list') {
      const v = makeListView({ id: m.id, kind: 'list', title, item: m, rows: (m.items || []).map(linkRow) });
      v.activate = () => followRow(v);
      return v;
    }
    if (m.type === 'page') {
      const header = h('div', { class: 'ipodb-page-body' }, h('p', { text: m.body || '' }));
      if (!m.actions?.length) {
        // A text-only page (e.g. "Über mich") gets a quiet signature instead of empty white.
        header.append(h('div', { class: 'ipodb-page-sig', 'aria-hidden': 'true' },
          h('span', { class: 'ipodb-page-mono', text: brand.monogram || '' }),
          h('span', { class: 'ipodb-page-tag', text: brand.tagline || brand.name || '' })));
      }
      const rows = (m.actions || []).map((a) => ({ label: a.label, href: a.href, detail: a.detail }));
      const v = makeListView({ id: m.id, kind: 'page', title, item: m, rows, header });
      v.activate = () => followRow(v);
      return v;
    }
    if (m.type === 'downloads') {
      const rows = (m.items || []).map((d) => ({
        label: d.label,
        detail: [d.format, d.size && d.size !== '–' && d.size !== '-' ? d.size : null].filter(Boolean).join(' · '),
        href: resolveAsset(d.file),
        download: true,
        downloadName: (d.file || '').split('/').pop(),
      }));
      const v = makeListView({ id: m.id, kind: 'downloads', title, item: m, rows });
      v.activate = () => followRow(v);
      return v;
    }
    if (m.type === 'nowplaying') return buildNowPlaying(m);
    // Unknown types degrade to an empty page.
    const v = makeListView({ id: m.id || 'x', kind: 'page', title, item: m, rows: [], header: h('div', { class: 'ipodb-page-body' }, h('p', { text: m.body || '' })) });
    v.activate = () => {};
    return v;
  }

  let npView = null;
  function buildNowPlaying(m) {
    const el = h('div', { class: 'ipodb-screen ipodb-screen--np' });
    const counter = h('div', { class: 'ipodb-np-count' });
    const cover = makeCover('ipodb-np-cover');
    const refl = makeCover('ipodb-np-refl');
    refl.setAttribute('aria-hidden', 'true');
    const tTitle = h('div', { class: 'ipodb-np-title' });
    const tArtist = h('div', { class: 'ipodb-np-artist' });
    const tAlbum = h('div', { class: 'ipodb-np-album', text: m.title || '' });
    const meta = h('div', { class: 'ipodb-np-meta' }, tTitle, tArtist, tAlbum);
    const rid = `${uid}-r${++rowSeq}`;
    const spot = h('a', {
      class: 'ipodb-np-spot', id: rid, role: 'option', 'aria-selected': 'true', tabindex: '-1',
      href: m.spotifyUrl || '#', target: '_blank', rel: 'noopener noreferrer', draggable: 'false',
    }, h('span', { text: 'In Spotify öffnen' }), h('span', { class: 'ipodb-row-c', html: SVG.chevron }));
    const listbox = h('div', { class: 'ipodb-np-actions', role: 'listbox', 'aria-label': m.title || 'Now Playing', 'aria-activedescendant': rid }, spot);
    const fill = h('div', { class: 'ipodb-np-fill' });
    const bar = h('div', { class: 'ipodb-np-bar' }, fill);
    const tEl = h('span', { class: 'ipodb-np-el' });
    const tRem = h('span', { class: 'ipodb-np-rem' });
    const prog = h('div', { class: 'ipodb-np-prog' }, bar, h('div', { class: 'ipodb-np-times' }, tEl, tRem));
    const vfill = h('div', { class: 'ipodb-np-fill' });
    const vol = h('div', { class: 'ipodb-np-vol' }, h('span', { class: 'ipodb-np-spk', html: SVG.spk0 }), h('div', { class: 'ipodb-np-bar' }, vfill), h('span', { class: 'ipodb-np-spk', html: SVG.spk1 }));
    const bottom = h('div', { class: 'ipodb-np-bottom' }, prog, vol);
    el.append(counter, h('div', { class: 'ipodb-np-art' }, cover, refl), meta, listbox, bottom);

    let lastSec = -1;
    let volTimer = 0;
    const v = {
      id: m.id, kind: 'nowplaying', title: 'Now Playing', item: m, el, listbox,
      index: 0, count: 1, rowEls: [spot],
      layout() { v.refresh(true); },
      refresh(full) {
        const t = tracks[player.track];
        if (!t) return;
        const dur = parseDur(t.duration);
        if (full) {
          counter.textContent = `${player.track + 1} von ${tracks.length}`;
          tTitle.textContent = t.title || '';
          tArtist.textContent = t.artist || m.artist || '';
          lastSec = -1;
        }
        fill.style.transform = `scaleX(${Math.min(1, player.elapsed / dur)})`;
        const sec = Math.floor(player.elapsed);
        if (sec !== lastSec) {
          lastSec = sec;
          tEl.textContent = fmt(player.elapsed);
          tRem.textContent = `-${fmt(dur - player.elapsed)}`;
        }
        vfill.style.transform = `scaleX(${player.volume})`;
      },
      move(d) {
        // Like the real thing: turning the wheel on Now Playing changes the volume.
        const nv = Math.max(0, Math.min(1, +(player.volume + d * 0.0625).toFixed(4)));
        el.classList.add('show-vol');
        clearTimeout(volTimer);
        volTimer = setTimeout(() => el.classList.remove('show-vol'), 1600);
        if (nv === player.volume) return false;
        player.volume = nv;
        v.refresh();
        return true;
      },
      setIndex() { return false; },
      bump() {},
      activate() { spot.click(); return 'open'; },
      currentRow() { return { label: 'In Spotify öffnen', href: m.spotifyUrl }; },
      currentLabel() { return 'In Spotify öffnen'; },
      trackChanged() {
        if (reduced) { v.refresh(true); return; }
        gsap.fromTo(meta, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: 0.28, ease: 'power2.out', overwrite: true });
        v.refresh(true);
      },
    };
    npView = v;
    return v;
  }

  // ---------- activation of rows (centre / Enter / tap) ----------
  let programmaticClick = false;
  function followRow(v) {
    if (v.revealRow?.()) return;
    const r = v.currentRow?.();
    const a = v.rowEls?.[v.index];
    if (!r || !a || !r.href) return;
    programmaticClick = true;
    try { a.click(); } finally { programmaticClick = false; }
    afterOpen(r);
  }
  function afterOpen(r) {
    if (!r) return;
    if (r.download) toast('Download gestartet', SVG.download);
    else if (isHttp(r.href)) toast(`${r.label} wird geöffnet`, SVG.open);
  }

  let toastTl = null;
  function toast(text, icon) {
    toastEl.innerHTML = '';
    toastEl.append(h('span', { class: 'ipodb-toast-i', html: icon || '' }), h('span', { text }));
    announce(text);
    toastTl?.kill();
    if (reduced) {
      toastEl.style.opacity = '1';
      toastTl = gsap.delayedCall(1.4, () => { toastEl.style.opacity = '0'; });
      return;
    }
    toastTl = gsap.timeline()
      .fromTo(toastEl, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.18, ease: 'back.out(2)' })
      .to(toastEl, { opacity: 0, scale: 0.97, duration: 0.25, ease: 'power1.in' }, '+=1.15');
  }

  // ---------- title bar ----------
  function setTitle(text, dir) {
    const old = titleText.querySelector('.ipodb-title-t:last-child');
    if (old && old.textContent === text) return;
    const n = h('span', { class: 'ipodb-title-t', text });
    if (reduced || !dir || !old) {
      titleText.replaceChildren(n);
      return;
    }
    titleText.querySelectorAll('.ipodb-title-t').forEach((x) => { if (x !== old) x.remove(); });
    titleText.append(n);
    gsap.fromTo(n, { opacity: 0, x: dir * 18 }, { opacity: 1, x: 0, duration: 0.26, ease: 'power2.out' });
    gsap.to(old, { opacity: 0, x: -dir * 18, duration: 0.18, ease: 'power1.in', onComplete: () => old.remove() });
  }
  function updatePlayInd() {
    playInd.innerHTML = player.started ? (player.playing ? SVG.playSmall : SVG.pauseSmall) : '';
  }

  // ---------- navigation ----------
  function finishSlide() {
    if (slideTl) { slideTl.progress(1); slideTl = null; }
  }
  function slide(fromV, toV, dir, onDone) {
    finishSlide();
    toV.el.classList.add('is-active');
    if (reduced) {
      gsap.set(toV.el, { xPercent: 0 });
      fromV.el.classList.remove('is-active');
      onDone?.();
      return;
    }
    gsap.set(toV.el, { xPercent: dir * 100 });
    slideTl = gsap.timeline({
      onComplete: () => {
        fromV.el.classList.remove('is-active');
        gsap.set(fromV.el, { xPercent: 0 });
        slideTl = null;
        onDone?.();
      },
    });
    slideTl.to(fromV.el, { xPercent: -dir * 100, duration: SLIDE_DUR, ease: SLIDE_EASE }, 0)
      .to(toV.el, { xPercent: 0, duration: SLIDE_DUR, ease: SLIDE_EASE }, 0);
  }

  // Guards against a double tap opening a link on the screen that just slid in.
  let lastNavT = -1e9;
  const justNavigated = () => performance.now() - lastNavT < 260;
  function push(v) {
    lastNavT = performance.now();
    const from = current();
    viewport.append(v.el);
    v.layout();
    stack.push(v);
    setTitle(v.title, 1);
    slide(from, v, 1);
    syncAria();
    announce(`${v.title}. ${v.currentLabel?.() || ''}`);
  }
  function pop() {
    if (stack.length < 2) {
      current()?.bump?.(-1);
      return false;
    }
    lastNavT = performance.now();
    const from = stack.pop();
    const to = current();
    setTitle(to.title, -1);
    slide(from, to, -1, () => {
      from.el.remove();
      if (from === npView) npView = null;
    });
    syncAria();
    announce(`${to.title}. ${to.currentLabel?.() || ''}`);
    return true;
  }
  function open(m) {
    const v = buildItemView(m);
    push(v);
    if (m.type === 'nowplaying' && !player.started && tracks.length) {
      player.started = true;
      player.playing = true;
      updatePlayInd();
    }
  }
  function syncAria() {
    const v = current();
    const id = v?.rowEls?.[v.index]?.id;
    if (id) root.setAttribute('aria-activedescendant', id);
    else root.removeAttribute('aria-activedescendant');
  }

  let announceT = 0;
  function announce(text) {
    clearTimeout(announceT);
    announceT = setTimeout(() => { live.textContent = text; }, 140);
  }

  // ---------- playback simulation ----------
  function changeTrack(d) {
    if (!tracks.length) return;
    if (d < 0 && player.elapsed > 3) player.elapsed = 0;
    else {
      player.track = (player.track + d + tracks.length) % tracks.length;
      player.elapsed = 0;
    }
    player.started = true;
    updatePlayInd();
    npView?.trackChanged();
    const t = tracks[player.track];
    announce(`${t.title} – ${t.artist || ''}`);
  }
  let lastT = performance.now();
  const tickPlayer = () => {
    const now = performance.now();
    const dt = Math.min(0.25, (now - lastT) / 1000);
    lastT = now;
    if (!player.playing || !tracks.length) return;
    player.elapsed += dt;
    if (player.elapsed >= parseDur(tracks[player.track].duration)) changeTrack(1);
    npView?.refresh();
  };
  gsap.ticker.add(tickPlayer);
  cleanups.push(() => gsap.ticker.remove(tickPlayer));

  // ---------- core actions ----------
  let lastHaptic = 0;
  function haptic(src) {
    if (src !== 'touch' || !soundOn) return;
    const now = performance.now();
    if (now - lastHaptic < 35) return;
    lastHaptic = now;
    try { navigator.vibrate?.(4); } catch { /* ignore */ }
  }

  function step(dir, src) {
    const v = current();
    if (!v || destroyed) return false;
    const moved = v.move(dir);
    if (moved) {
      audio.play('tick');
      haptic(src);
      syncAria();
      if (v.kind === 'nowplaying') announce(`Lautstärke ${Math.round(player.volume * 100)} %`);
      else announce(v.currentLabel());
    } else v.bump(dir);
    return moved;
  }

  function press(button) {
    if (destroyed) return;
    finishSlideIfBack(button);
    audio.play('press');
    switch (button) {
      case 'menu':
        pop();
        break;
      case 'center': {
        const v = current();
        v?.activate?.();
        break;
      }
      case 'play':
        if (!tracks.length) break;
        player.started = true;
        player.playing = !player.playing;
        updatePlayInd();
        announce(player.playing ? 'Wiedergabe' : 'Pause');
        npView?.refresh();
        break;
      case 'next':
      case 'prev':
        if (player.started || current()?.kind === 'nowplaying') changeTrack(button === 'next' ? 1 : -1);
        break;
      default:
        break;
    }
  }
  // Rapid MENU taps should feel instant: complete the running slide first.
  function finishSlideIfBack(button) {
    if (button === 'menu' || button === 'center') finishSlide();
  }

  // ---------- pressed visuals ----------
  let pressClearT = 0;
  function showPress(zone) {
    clearTimeout(pressClearT);
    wheelWrap.dataset.press = zone;
  }
  function clearPress(delay = 0) {
    clearTimeout(pressClearT);
    if (delay) pressClearT = setTimeout(() => { delete wheelWrap.dataset.press; }, delay);
    else delete wheelWrap.dataset.press;
  }
  function flashPress(zone) {
    showPress(zone);
    clearPress(130);
  }

  // ---------- click wheel pointer input ----------
  let wp = null;
  let momentumRaf = 0;
  const stopMomentum = () => { cancelAnimationFrame(momentumRaf); momentumRaf = 0; };
  const wheelGeom = () => {
    const r = wheel.getBoundingClientRect();
    const rad = r.width / 2;
    return { cx: r.left + rad, cy: r.top + r.height / 2, r: rad, rc: rad * (IPOD.centerButton.diameter / IPOD.wheel.diameter) };
  };
  const zoneOf = (dx, dy) => {
    const a = Math.atan2(dy, dx) * 180 / Math.PI; // 0 = right, 90 = down
    if (a > -45 && a <= 45) return 'next';
    if (a > 45 && a <= 135) return 'play';
    if (a > -135 && a <= -45) return 'menu';
    return 'prev';
  };

  function onWheelDown(e) {
    if (!booted || destroyed) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const gm = wheelGeom();
    const dx = e.clientX - gm.cx;
    const dy = e.clientY - gm.cy;
    const dist = Math.hypot(dx, dy);
    if (dist > gm.r * 1.3) return;
    e.preventDefault();
    audio.ensure();
    stopMomentum();
    if (document.activeElement !== root) root.focus({ preventScroll: true });
    try { wheel.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const zone = dist < gm.rc ? 'center' : zoneOf(dx, dy);
    wp = {
      id: e.pointerId, type: e.pointerType, gm, zone, sx: e.clientX, sy: e.clientY,
      last: dist > gm.rc * 0.55 ? Math.atan2(dy, dx) * 180 / Math.PI : null,
      acc: 0, total: 0, cum: 0, drag: false, samples: [{ t: e.timeStamp, a: 0 }],
    };
    // Show the pressed state almost immediately, but give a drag a moment to declare itself.
    wp.pressT = setTimeout(() => { if (wp && !wp.drag) showPress(zone); }, zone === 'center' ? 0 : 60);
  }

  function onWheelMove(e) {
    if (!wp || e.pointerId !== wp.id) return;
    e.preventDefault();
    const { gm } = wp;
    const dx = e.clientX - gm.cx;
    const dy = e.clientY - gm.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < gm.rc * 0.55) { wp.last = null; return; } // angle is meaningless near the middle
    const a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (wp.last == null) { wp.last = a; return; }
    const d = normDeg(a - wp.last);
    wp.last = a;
    wp.total += Math.abs(d);
    wp.cum += d;
    const t = e.timeStamp;
    wp.samples.push({ t, a: wp.cum });
    while (wp.samples.length > 2 && t - wp.samples[0].t > 90) wp.samples.shift();
    if (!wp.drag) {
      const travel = Math.hypot(e.clientX - wp.sx, e.clientY - wp.sy);
      if (wp.total < 9 && travel < gm.r * 0.18) return;
      wp.drag = true;
      clearTimeout(wp.pressT);
      clearPress();
      wheelWrap.classList.add('is-spinning');
    }
    wp.acc += d;
    const w = Math.abs(velocity(wp));
    // Acceleration: the faster you spin, the less arc each step needs.
    const stepDeg = w < 320 ? BASE_STEP_DEG : w < 720 ? 15 : 11;
    while (wp.acc >= stepDeg) { wp.acc -= stepDeg; if (!step(1, wp.type)) wp.acc = Math.min(wp.acc, 0); }
    while (wp.acc <= -stepDeg) { wp.acc += stepDeg; if (!step(-1, wp.type)) wp.acc = Math.max(wp.acc, 0); }
  }

  function velocity(p) {
    const s = p.samples;
    if (s.length < 2) return 0;
    const a = s[0];
    const b = s[s.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0.008 ? (b.a - a.a) / dt : 0;
  }

  function onWheelUp(e) {
    if (!wp || e.pointerId !== wp.id) return;
    const p = wp;
    wp = null;
    clearTimeout(p.pressT);
    wheelWrap.classList.remove('is-spinning');
    try { wheel.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (e.type === 'pointercancel') { clearPress(); return; }
    if (!p.drag) {
      flashPress(p.zone);
      if (p.zone === 'center' && justNavigated()) return;
      press(p.zone);
      return;
    }
    clearPress();
    const v0 = velocity(p);
    if (!reduced && Math.abs(v0) > 480 && e.timeStamp - p.samples[p.samples.length - 1].t < 60) momentum(v0, p.acc, p.type);
  }

  // Momentum: a fast flick keeps coasting a few items with friction, stopping at the list end.
  function momentum(v, acc, type) {
    let last = performance.now();
    v = Math.max(-1600, Math.min(1600, v));
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      v *= Math.exp(-dt * 6.5);
      acc += v * dt;
      while (acc >= BASE_STEP_DEG) { acc -= BASE_STEP_DEG; if (!step(1, type)) { stopMomentum(); return; } }
      while (acc <= -BASE_STEP_DEG) { acc += BASE_STEP_DEG; if (!step(-1, type)) { stopMomentum(); return; } }
      if (Math.abs(v) < 140) { stopMomentum(); return; }
      momentumRaf = requestAnimationFrame(loop);
    };
    momentumRaf = requestAnimationFrame(loop);
  }

  listen(wheel, 'pointerdown', onWheelDown);
  listen(wheel, 'pointermove', onWheelMove);
  listen(wheel, 'pointerup', onWheelUp);
  listen(wheel, 'pointercancel', onWheelUp);
  listen(wheel, 'lostpointercapture', (e) => { if (wp && e.pointerId === wp.id) { clearTimeout(wp.pressT); wp = null; clearPress(); wheelWrap.classList.remove('is-spinning'); } });
  listen(wheel, 'contextmenu', (e) => e.preventDefault());
  // iOS Safari: belt and braces against page scroll while spinning.
  listen(wheel, 'touchmove', (e) => e.preventDefault(), { passive: false });
  // Accessible activation of the wheel buttons (screen readers / programmatic clicks).
  for (const b of [btnMenu, btnNext, btnPrev, btnPlay, btnCenter]) {
    listen(b, 'click', (e) => {
      e.stopPropagation();
      if (!booted) return;
      audio.ensure();
      flashPress(b.dataset.btn);
      press(b.dataset.btn);
    });
  }

  // ---------- screen: tap to choose, drag to scroll ----------
  let sp = null;
  let suppressClick = false;
  listen(viewport, 'pointerdown', (e) => {
    if (!booted || (e.pointerType === 'mouse' && e.button !== 0)) return;
    audio.ensure();
    stopMomentum();
    sp = { id: e.pointerId, y: e.clientY, x: e.clientX, acc: 0, drag: false, type: e.pointerType };
    suppressClick = false;
  });
  listen(viewport, 'pointermove', (e) => {
    if (!sp || e.pointerId !== sp.id) return;
    const dy = e.clientY - sp.y;
    if (!sp.drag) {
      if (Math.abs(dy) < 7 || Math.abs(dy) < Math.abs(e.clientX - sp.x)) return;
      sp.drag = true;
      suppressClick = true;
      try { viewport.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    sp.acc += dy;
    sp.y = e.clientY;
    const unit = ROW_H * scale * 0.85;
    while (sp.acc <= -unit) { sp.acc += unit; step(1, sp.type); }
    while (sp.acc >= unit) { sp.acc -= unit; step(-1, sp.type); }
  });
  const endSp = (e) => { if (sp && e.pointerId === sp.id) sp = null; };
  listen(viewport, 'pointerup', endSp);
  listen(viewport, 'pointercancel', endSp);
  listen(viewport, 'click', (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; return; }
    if (programmaticClick || !booted) return;
    if (justNavigated()) { e.preventDefault(); e.stopPropagation(); return; }
    const row = e.target.closest('.ipodb-row[role="option"], .ipodb-np-spot');
    const v = current();
    if (!row || !v || !v.el.contains(row)) { if (!row) e.preventDefault(); return; }
    audio.ensure();
    audio.play('press');
    if (row.classList.contains('ipodb-np-spot')) { afterOpen(v.currentRow()); return; }
    const i = Number(row.dataset.i);
    v.setIndex(i);
    syncAria();
    if (row.tagName === 'A') {
      // Native navigation proceeds (new tab / mailto / download); just give feedback.
      afterOpen(v.rows[i]);
    } else {
      e.preventDefault();
      // Let the highlight land on the row before sliding to the next level.
      setTimeout(() => v.activate?.(), reduced ? 0 : 90);
    }
  }, true);
  listen(viewport, 'touchmove', (e) => e.preventDefault(), { passive: false });
  listen(viewport, 'dragstart', (e) => e.preventDefault());

  // ---------- mouse wheel / trackpad ----------
  let wAcc = 0;
  let wLast = 0;
  listen(root, 'wheel', (e) => {
    if (!booted) return;
    e.preventDefault();
    stopMomentum();
    const now = performance.now();
    if (now - wLast > 220) wAcc = 0;
    wLast = now;
    const dy = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    if (Math.abs(dy) >= 60 && e.deltaMode !== 0) { step(Math.sign(dy), 'wheel'); return; }
    if (Math.abs(dy) >= 90) { step(Math.sign(dy), 'wheel'); wAcc = 0; return; } // discrete mouse notch
    wAcc += dy;
    while (wAcc >= 34) { wAcc -= 34; step(1, 'wheel'); }
    while (wAcc <= -34) { wAcc += 34; step(-1, 'wheel'); }
  }, { passive: false });

  // ---------- keyboard ----------
  function onKey(e) {
    if (!booted || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': audio.ensure(); step(1, 'key'); break;
      case 'ArrowUp': case 'ArrowLeft': audio.ensure(); step(-1, 'key'); break;
      case 'Enter': if (e.repeat) break; audio.ensure(); flashPress('center'); if (!justNavigated()) press('center'); break;
      case 'Escape': case 'Backspace': if (e.repeat) break; audio.ensure(); flashPress('menu'); press('menu'); break;
      case ' ': case 'Spacebar': if (e.repeat) break; audio.ensure(); flashPress('play'); press('play'); break;
      case 'MediaTrackNext': flashPress('next'); press('next'); break;
      case 'MediaTrackPrevious': flashPress('prev'); press('prev'); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }
  listen(root, 'keydown', onKey);
  // When nothing else has focus, the iPod is the obvious keyboard target.
  listen(document, 'keydown', (e) => {
    if (e.target !== document.body && e.target !== document.documentElement) return;
    if (!root.isConnected || !root.getClientRects().length || getComputedStyle(root).visibility === 'hidden') return;
    onKey(e);
  });
  listen(root, 'pointerdown', (e) => {
    audio.ensure();
    if (document.activeElement !== root && !wheel.contains(e.target)) root.focus({ preventScroll: true });
  });

  if (mq?.addEventListener) { mq.addEventListener('change', onMq); cleanups.push(() => mq.removeEventListener('change', onMq)); }

  // ---------- initial screen ----------
  const rootView = buildRoot();
  viewport.append(rootView.el);
  rootView.el.classList.add('is-active');
  stack.push(rootView);
  rootView.layout();
  syncAria();

  // ---------- API ----------
  const api = {
    el: root,
    getShellRect: () => root.getBoundingClientRect(),
    reveal({ boot = true } = {}) {
      root.classList.add('is-revealed');
      fit();
      stack.forEach((v) => v.layout());
      const finish = () => { booted = true; bootEl.classList.add('is-done'); root.classList.add('is-on'); };
      if (!boot) {
        finish();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const r = reduced;
        const tl = gsap.timeline({ onComplete: () => { resolve(); } });
        gsap.set(bootMono, { opacity: 0, scale: r ? 1 : 0.94 });
        gsap.set(bootEl, { opacity: 1 });
        tl.to(bootMono, { opacity: 1, scale: 1, duration: r ? 0.15 : 0.32, ease: 'power2.out' }, 0.14)
          .add(() => root.classList.add('is-on'), 0.14) // backlight comes up with the logo
          .to(bootMono, { opacity: 0, duration: 0.2, ease: 'power1.in' }, 0.78)
          .to(bootEl, { opacity: 0, duration: r ? 0.12 : 0.24, ease: 'power1.out' }, 0.9)
          .add(finish);
        if (!r) tl.fromTo(rootView.el, { opacity: 0 }, { opacity: 1, duration: 0.24 }, 0.9);
      });
    },
    press(button) {
      if (!['menu', 'center', 'play', 'next', 'prev'].includes(button)) return;
      flashPress(button);
      press(button);
    },
    scroll(steps) {
      const n = Math.trunc(Number(steps) || 0);
      const dir = Math.sign(n);
      for (let i = 0; i < Math.abs(n); i++) step(dir, 'api');
    },
    getState() {
      const v = current();
      return {
        screen: v?.kind ?? 'menu',
        path: stack.slice(1).map((x) => x.id),
        index: v?.index ?? 0,
        title: v?.title,
        playing: player.playing,
        track: player.track,
      };
    },
    destroy() {
      destroyed = true;
      stopMomentum();
      finishSlide();
      toastTl?.kill();
      clearTimeout(announceT);
      cleanups.forEach((f) => f());
      stack.forEach((v) => gsap.killTweensOf(v.el));
      audio.close();
      root.remove();
    },
  };
  return api;
}

