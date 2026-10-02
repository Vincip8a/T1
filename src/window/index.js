// Aqua-era desktop + brushed-metal window that frames the iPod.
// API (see ARCHITECTURE.md): createDesktop(host, { config, onLinks, onFocus }) -> { el, contentEl, setInteractive, destroy }
import './window.css';
import { prefersReducedMotion } from '../shared/config.js';
import { safeHref } from '../shared/href.js';
import { aspect } from '../shared/ipodSpec.js';
import { h } from '../shared/dom.js';

const MOBILE_MQ = '(max-width: 639.98px)';
const MENUBAR_H = 22;

const SVG_NS = 'http://www.w3.org/2000/svg';

// gsap runs only the genie (minimise / restore): loaded on idle once the window is interactive,
// so it stays out of the entry chunk. A failed load falls back to the instant (reduced-motion) path.
let gsapP = null;
let gsap = null;
const loadGsap = () => (gsapP ??= import('gsap').then((m) => (gsap = m.gsap ?? m.default)).catch(() => { gsapP = null; return null; }));
/** clamp where `lo` wins when the range is empty (a window larger than the viewport sticks to the top left) */
const clampLo = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

function glyph(pathD) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', pathD);
  svg.append(p);
  return svg;
}

export function createDesktop(host, { config, onLinks, onFocus }) {
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
  barLeft.append(h('span', 'dt-mono', { 'aria-hidden': 'true', text: brand.monogram ?? '' }));
  barLeft.append(h('strong', 'dt-brand', { text: brand.name ?? '' }));
  const linksBtn = h('button', 'dt-bar-item dt-bar-links', { type: 'button', text: 'Links' });
  const mailHref = brand.email ? `mailto:${brand.email}` : null;
  const contact = mailHref
    ? h('a', 'dt-bar-item', { href: mailHref, text: 'Kontakt' })
    : h('span', 'dt-bar-item', { text: 'Kontakt' });
  barLeft.append(linksBtn, contact);
  const clock = h('time', 'dt-clock');
  // right side: small legal links (config.legal), then the clock
  const barRight = h('div', 'dt-bar-right');
  const legal = config?.legal ?? {};
  const legalNav = h('nav', 'dt-legal', { 'aria-label': 'Rechtliches' });
  for (const [key, label] of [['impressum', 'Impressum'], ['datenschutz', 'Datenschutz']]) {
    const href = legal[key] ? safeHref(legal[key]) : null; // same rule as the iPod links
    if (href) legalNav.append(h('a', 'dt-legal-link', { href, text: label }));
  }
  if (legalNav.childElementCount) barRight.append(legalNav);
  barRight.append(clock);
  bar.append(barLeft, barRight);

  // window
  const stage = h('main', 'dt-stage');
  const pos = h('div', 'dt-pos');
  const win = h('section', 'dt-win', { 'aria-label': brand.windowTitle ?? 'Fenster', tabindex: '-1' });
  const titlebar = h('div', 'dt-titlebar');
  const lights = h('div', 'dt-lights');
  const btnClose = h('button', 'dt-tl dt-tl-close', { type: 'button', 'aria-label': 'Schließen' });
  const btnMin = h('button', 'dt-tl dt-tl-min', { type: 'button', 'aria-label': 'Minimieren' });
  const btnZoom = h('button', 'dt-tl dt-tl-zoom', { type: 'button', 'aria-label': 'Zoomen', 'aria-pressed': 'false' });
  btnClose.append(glyph('M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8'));
  btnMin.append(glyph('M2.6 6h6.8'));
  btnZoom.append(glyph('M2.8 6h6.4M6 2.8v6.4'));
  lights.append(btnClose, btnMin, btnZoom);
  const title = h('h1', 'dt-title', { text: brand.windowTitle ?? '' });
  titlebar.append(lights, title, h('span', 'dt-title-spacer'));

  const contentEl = h('div', 'dt-content');
  contentEl.style.setProperty('--ipod-aspect', String(aspect)); // the iPod's width / height (mobile sizing)
  const status = h('footer', 'dt-status', { text: brand.tagline ?? '' });
  win.append(titlebar, contentEl, status);
  pos.append(win);
  stage.append(pos);

  // minimised icon
  const icon = h('button', 'dt-icon', { type: 'button', 'aria-label': 'iPod wiederherstellen' });
  const iconArt = h('span', 'dt-icon-art', { 'aria-hidden': 'true' });
  iconArt.append(h('i', 'dt-icon-screen'), h('i', 'dt-icon-wheel'));
  icon.append(iconArt, h('span', 'dt-icon-label', { text: 'iPod' }));

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
  let zoomAnim = null;
  let tl = null;
  let destroyed = false;

  const applyOffset = () => {
    pos.style.setProperty('--dx', `${ox}px`);
    pos.style.setProperty('--dy', `${oy}px`);
  };

  // a window larger than the stage (browser zoom) stays centred and the stage scrolls: no dragging
  const fits = () => win.offsetWidth <= stage.clientWidth && win.offsetHeight <= stage.clientHeight;

  // clamp the current offset so the window stays inside the viewport (below the menu bar)
  const clampOffset = () => {
    if (isMobile() || !fits()) { ox = oy = 0; applyOffset(); return; }
    const r = win.getBoundingClientRect();
    const baseL = r.left - ox, baseT = r.top - oy;
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    ox = clampLo(ox, -baseL, vw - (baseL + r.width));
    oy = clampLo(oy, MENUBAR_H - baseT, vh - (baseT + r.height));
    applyOffset();
  };
  on(window, 'resize', clampOffset);
  on(mobileMq, 'change', clampOffset);

  // FLIP: the layout jumps to the new size once (the iPod re-measures its text once), and the frame
  // glides from the old rect with a transform only, instead of animating --ipod-h every frame
  const setZoomed = (z) => {
    const from = win.getBoundingClientRect();
    zoomed = z;
    el.classList.toggle('is-zoomed', z);
    btnZoom.setAttribute('aria-pressed', String(z));
    clampOffset(); // final size and position, at once
    if (prefersReducedMotion() || !win.animate) return;
    const to = win.getBoundingClientRect();
    if (!to.width || !to.height) return;
    const flip = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    zoomAnim?.cancel();
    const anim = win.animate([{ transformOrigin: '0 0', transform: flip }, { transformOrigin: '0 0', transform: 'none' }],
      { duration: 340, easing: 'cubic-bezier(.3,.7,.2,1)' });
    zoomAnim = anim;
    // wall-clock safety net (as for the iPod's slides): a stalled document timeline never leaves the
    // window scaled
    setTimeout(() => { if (anim.playState === 'running') anim.finish(); }, 340 + 180);
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

  // the iPod is the window's key view: restoring, "Links" and clicks on the metal put focus on it
  // (onFocus is the iPod's own focus(): its key target, i.e. the selected row on a screen of links;
  //  the selector is only a fallback for a desktop without an iPod, e.g. the config error window)
  const focusContent = () => {
    if (onFocus) { onFocus(); return; }
    const target = contentEl.querySelector('.ipodc [tabindex="0"], .ipodc[tabindex="0"], a[href], button') ?? win;
    target.focus({ preventScroll: true });
  };

  const setMinimisedState = (m) => {
    minimised = m;
    el.dataset.state = m ? 'minimised' : 'open';
    win.toggleAttribute('inert', m);
  };

  const minimise = async () => {
    if (!interactive || minimised || busy) return;
    busy = true;
    if (prefersReducedMotion() || !(await loadGsap()) || destroyed) {
      busy = false;
      if (destroyed) return;
      setMinimisedState(true);
      icon.focus({ preventScroll: true });
      return;
    }
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

  const restore = async () => {
    if (!minimised || busy) return;
    busy = true;
    if (prefersReducedMotion() || !(await loadGsap()) || destroyed) {
      busy = false;
      if (destroyed) return;
      setMinimisedState(false);
      focusContent();
      return;
    }
    const { dx, dy } = iconTarget();
    el.classList.add('is-genie');
    setMinimisedState(false);
    gsap.set(win, { x: dx, y: dy, scaleX: 0.1, scaleY: 0.06, clipPath: FUNNEL_END, opacity: 0.2 });
    tl = gsap.timeline({
      onComplete: () => {
        gsap.set(win, { clearProps: 'all' });
        el.classList.remove('is-genie');
        busy = false;
        focusContent();
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
    if (onLinks) onLinks(); else focusContent();
  });
  // a press on the metal, the title bar, the status bar or a traffic light keeps keyboard focus on
  // the iPod (the window itself would otherwise take it, and the iPod keys would stop working)
  on(win, 'mousedown', (e) => {
    // (the traffic lights do not take focus on a click either, like Aqua's)
    const ctl = e.target.closest('a[href], button, input, textarea, [tabindex="0"]');
    if (e.button || (ctl && !ctl.matches('.dt-tl'))) return;
    e.preventDefault();
    if (!contentEl.contains(document.activeElement)) focusContent();
  });

  /* ---------- drag by title bar ---------- */
  let drag = null;
  on(titlebar, 'pointerdown', (e) => {
    if (!interactive || minimised || busy || isMobile() || !fits()) return;
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
    ox = clampLo(drag.ox + e.clientX - drag.sx, -drag.baseL, vw - (drag.baseL + drag.w));
    oy = clampLo(drag.oy + e.clientY - drag.sy, MENUBAR_H - drag.baseT, vh - (drag.baseT + drag.h));
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
  // on a phone the window always spans the screen, so the zoom light is disabled there (and looks it)
  const syncZoomLight = () => {
    el.classList.toggle('is-zoom-off', isMobile());
    btnZoom.setAttribute('aria-disabled', String(!interactive || isMobile()));
  };
  on(mobileMq, 'change', syncZoomLight);
  const applyInteractive = (v) => {
    interactive = !!v;
    el.classList.toggle('is-locked', !interactive);
    // locked (intro): the lights are no tab stops either, their focus ring would sit under the 3D canvas
    lights.inert = !interactive;
    for (const b of [btnClose, btnMin]) b.setAttribute('aria-disabled', String(!interactive));
    syncZoomLight();
    if (!interactive) endDrag();
  };
  const setInteractive = (v) => {
    applyInteractive(v);
    if (interactive && !gsap) (window.requestIdleCallback ?? setTimeout)(() => { if (!destroyed) loadGsap(); });
  };

  const destroy = () => {
    destroyed = true;
    clearTimeout(clockTimer);
    zoomAnim?.cancel();
    tl?.kill();
    gsap?.killTweensOf(win);
    cleanups.forEach((fn) => fn());
    el.remove();
  };

  applyInteractive(true);
  return { el, contentEl, setInteractive, destroy };
}
