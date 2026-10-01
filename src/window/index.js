// Aqua-era desktop + brushed-metal window that frames the iPod.
// API (see CONTRACT.md): createDesktop(host, { config }) -> { el, contentEl, setInteractive, destroy }
import gsap from 'gsap';
import './window.css';
import { prefersReducedMotion } from '../shared/config.js';

const MOBILE_MQ = '(max-width: 639.98px)';
const MENUBAR_H = 22;

const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

function h(tag, cls, attrs = {}, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

function glyph(pathD) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', pathD);
  svg.append(p);
  return svg;
}

export function createDesktop(host, { config }) {
  const brand = config?.brand ?? {};
  const mobileMq = window.matchMedia(MOBILE_MQ);
  const isMobile = () => mobileMq.matches;
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  /* ---------- structure ---------- */
  const el = h('div', 'dt');
  el.dataset.state = 'open';

  const wall = h('div', 'dt-wall', { 'aria-hidden': 'true' });
  wall.append(h('div', 'dt-wall-drift'), h('div', 'dt-wall-grain'));

  // menu bar
  const bar = h('header', 'dt-bar');
  const barLeft = h('nav', 'dt-bar-left', { 'aria-label': 'Menüleiste' });
  barLeft.append(h('span', 'dt-mono', { 'aria-hidden': 'true' }, brand.monogram ?? ''));
  barLeft.append(h('strong', 'dt-brand', {}, brand.name ?? ''));
  const linksBtn = h('button', 'dt-bar-item', { type: 'button' }, 'Links');
  const mailHref = brand.email ? `mailto:${brand.email}` : null;
  const contact = mailHref
    ? h('a', 'dt-bar-item', { href: mailHref }, 'Kontakt')
    : h('span', 'dt-bar-item', {}, 'Kontakt');
  barLeft.append(linksBtn, contact);
  const clock = h('time', 'dt-clock');
  bar.append(barLeft, clock);

  // window
  const stage = h('main', 'dt-stage');
  const pos = h('div', 'dt-pos');
  const win = h('section', 'dt-win', { 'aria-label': brand.windowTitle ?? 'Fenster', tabindex: '-1' });
  const titlebar = h('div', 'dt-titlebar');
  const lights = h('div', 'dt-lights');
  const btnClose = h('button', 'dt-tl dt-tl-close', { type: 'button', 'aria-label': 'Schließen' });
  const btnMin = h('button', 'dt-tl dt-tl-min', { type: 'button', 'aria-label': 'Minimieren' });
  const btnZoom = h('button', 'dt-tl dt-tl-zoom', { type: 'button', 'aria-label': 'Zoomen' });
  btnClose.append(glyph('M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8'));
  btnMin.append(glyph('M2.6 6h6.8'));
  btnZoom.append(glyph('M2.8 6h6.4M6 2.8v6.4'));
  lights.append(btnClose, btnMin, btnZoom);
  const title = h('h1', 'dt-title', {}, brand.windowTitle ?? '');
  titlebar.append(lights, title, h('span', 'dt-title-spacer'));

  const contentEl = h('div', 'dt-content');
  const status = h('footer', 'dt-status', {}, brand.tagline ?? '');
  win.append(titlebar, contentEl, status);
  pos.append(win);
  stage.append(pos);

  // minimised icon
  const icon = h('button', 'dt-icon', { type: 'button', 'aria-label': 'iPod wiederherstellen' });
  const iconArt = h('span', 'dt-icon-art', { 'aria-hidden': 'true' });
  iconArt.append(h('i', 'dt-icon-screen'), h('i', 'dt-icon-wheel'));
  icon.append(iconArt, h('span', 'dt-icon-label', {}, 'iPod'));

  el.append(wall, bar, stage, icon);
  host.append(el);

  /* ---------- clock ---------- */
  const fmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
  let clockTimer = 0;
  const tickClock = () => {
    const now = new Date();
    clock.textContent = fmt.format(now);
    clock.dateTime = now.toISOString();
    clockTimer = setTimeout(tickClock, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  };
  tickClock();

  /* ---------- state ---------- */
  let interactive = true;
  let minimised = false;
  let busy = false;
  let zoomed = false;
  let ox = 0; // drag offset (px) relative to the centred position
  let oy = 0;
  let zoomTimer = 0;
  let tl = null;

  const applyOffset = () => {
    pos.style.setProperty('--dx', `${ox}px`);
    pos.style.setProperty('--dy', `${oy}px`);
  };

  // clamp the current offset so the window stays inside the viewport (below the menu bar)
  const clampOffset = () => {
    if (isMobile()) { ox = oy = 0; applyOffset(); return; }
    const r = win.getBoundingClientRect();
    const baseL = r.left - ox, baseT = r.top - oy;
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    ox = clamp(ox, -baseL, vw - (baseL + r.width));
    oy = clamp(oy, MENUBAR_H - baseT, vh - (baseT + r.height));
    applyOffset();
  };
  on(window, 'resize', clampOffset);
  on(mobileMq, 'change', clampOffset);

  const setZoomed = (z) => {
    zoomed = z;
    el.classList.toggle('is-zoomed', z);
    btnZoom.setAttribute('aria-pressed', String(z));
    if (!prefersReducedMotion()) {
      el.classList.add('is-zooming');
      clearTimeout(zoomTimer);
      zoomTimer = setTimeout(() => { el.classList.remove('is-zooming'); clampOffset(); }, 380);
    }
    requestAnimationFrame(clampOffset);
  };
  const toggleZoom = () => {
    if (!interactive || minimised || busy || isMobile()) return;
    setZoomed(!zoomed);
  };

  /* ---------- minimise / restore (genie-ish) ---------- */
  const FUNNEL_FROM = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  const FUNNEL_MID = 'polygon(0% 0%, 100% 0%, 66% 100%, 34% 100%)';
  const FUNNEL_END = 'polygon(36% 0%, 64% 0%, 52% 100%, 48% 100%)';

  const iconTarget = () => {
    const a = iconArt.getBoundingClientRect();
    const w = win.getBoundingClientRect();
    return { dx: a.left + a.width / 2 - (w.left + w.width / 2), dy: a.top + a.height / 2 - (w.top + w.height / 2) };
  };

  const setMinimisedState = (m) => {
    minimised = m;
    el.dataset.state = m ? 'minimised' : 'open';
    win.toggleAttribute('inert', m);
  };

  const minimise = () => {
    if (!interactive || minimised || busy) return;
    if (prefersReducedMotion()) {
      setMinimisedState(true);
      icon.focus({ preventScroll: true });
      return;
    }
    busy = true;
    const { dx, dy } = iconTarget();
    el.classList.add('is-genie');
    gsap.killTweensOf(win);
    tl = gsap.timeline({
      onComplete: () => {
        setMinimisedState(true);
        gsap.set(win, { clearProps: 'all' });
        el.classList.remove('is-genie');
        busy = false;
        icon.focus({ preventScroll: true });
      },
    });
    tl.fromTo(win, { clipPath: FUNNEL_FROM }, { clipPath: FUNNEL_MID, duration: 0.2, ease: 'sine.in' })
      .to(win, {
        x: dx, y: dy, scaleX: 0.1, scaleY: 0.06, clipPath: FUNNEL_END, opacity: 0.2,
        duration: 0.42, ease: 'power3.in',
      }, '>-0.02');
    icon.classList.add('is-arriving');
    setTimeout(() => icon.classList.remove('is-arriving'), 700);
  };

  const restore = () => {
    if (!minimised || busy) return;
    if (prefersReducedMotion()) {
      setMinimisedState(false);
      win.focus({ preventScroll: true });
      return;
    }
    busy = true;
    const { dx, dy } = iconTarget();
    el.classList.add('is-genie');
    setMinimisedState(false);
    gsap.set(win, { x: dx, y: dy, scaleX: 0.1, scaleY: 0.06, clipPath: FUNNEL_END, opacity: 0.2 });
    tl = gsap.timeline({
      onComplete: () => {
        gsap.set(win, { clearProps: 'all' });
        el.classList.remove('is-genie');
        busy = false;
        win.focus({ preventScroll: true });
      },
    });
    tl.to(win, { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, clipPath: FUNNEL_MID, duration: 0.4, ease: 'power3.out' })
      .to(win, { clipPath: FUNNEL_FROM, duration: 0.22, ease: 'sine.out' }, '>-0.06');
  };

  /* ---------- traffic lights ---------- */
  const guard = (fn) => (e) => {
    e.stopPropagation();
    if (!interactive) return;
    fn();
  };
  on(btnClose, 'click', guard(minimise));
  on(btnMin, 'click', guard(minimise));
  on(btnZoom, 'click', guard(toggleZoom));
  on(icon, 'click', restore);
  on(icon, 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restore(); }
  });
  on(linksBtn, 'click', () => {
    if (minimised) { restore(); return; }
    const first = contentEl.querySelector('[tabindex], a[href], button');
    (first ?? win).focus?.({ preventScroll: true });
  });

  /* ---------- drag by title bar ---------- */
  let drag = null;
  on(titlebar, 'pointerdown', (e) => {
    if (!interactive || minimised || busy || isMobile()) return;
    if (e.button !== 0 || e.target.closest('.dt-tl')) return;
    const r = win.getBoundingClientRect();
    drag = {
      id: e.pointerId, sx: e.clientX, sy: e.clientY, ox, oy,
      baseL: r.left - ox, baseT: r.top - oy, w: r.width, h: r.height, moved: false,
    };
    titlebar.setPointerCapture?.(e.pointerId);
  });
  on(titlebar, 'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
    if (!drag.moved) { drag.moved = true; el.classList.add('is-dragging'); }
    ox = clamp(drag.ox + e.clientX - drag.sx, -drag.baseL, vw - (drag.baseL + drag.w));
    oy = clamp(drag.oy + e.clientY - drag.sy, MENUBAR_H - drag.baseT, vh - (drag.baseT + drag.h));
    applyOffset();
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    try { titlebar.releasePointerCapture?.(drag.id); } catch { /* already released */ }
    drag = null;
    el.classList.remove('is-dragging');
  };
  on(titlebar, 'pointerup', endDrag);
  on(titlebar, 'pointercancel', endDrag);
  on(titlebar, 'dblclick', (e) => {
    if (e.target.closest('.dt-tl')) return;
    toggleZoom();
  });

  /* ---------- public API ---------- */
  const setInteractive = (v) => {
    interactive = !!v;
    el.classList.toggle('is-locked', !interactive);
    for (const b of [btnClose, btnMin, btnZoom]) {
      b.setAttribute('aria-disabled', String(!interactive));
    }
    if (!interactive) endDrag();
  };

  const destroy = () => {
    clearTimeout(clockTimer);
    clearTimeout(zoomTimer);
    tl?.kill();
    gsap.killTweensOf(win);
    cleanups.forEach((fn) => fn());
    el.remove();
  };

  setInteractive(true);
  return { el, contentEl, setInteractive, destroy };
}
