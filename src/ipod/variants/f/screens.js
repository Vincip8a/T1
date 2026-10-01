// Screen renderers for the 320×240 logical LCD: title bar, a shared ListBox (highlight,
// windowed scrolling, scrollbar), the list screen (optionally split with the preview pane),
// the text page with action rows, and the Now Playing layout with its track list.

export const UI = { w: 320, h: 240, title: 20, row: 27 }; // integer row pitch → even baselines
const BODY_H = UI.h - UI.title;
let uid = 0;

export function el(tag, cls, attrs, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
  if (html != null) e.innerHTML = html;
  return e;
}

const SVG_CHEV = '<svg class="ipodf-row-chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1.5 1.5 7 7l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SVG_PLAY = '<svg class="ipodf-ic-play" viewBox="0 0 10 12" width="8" height="10" aria-hidden="true"><path d="M0 0l10 6-10 6z" fill="#1d1d1d"/></svg>';
const SVG_PAUSE = '<svg class="ipodf-ic-pause" viewBox="0 0 10 12" width="8" height="10" aria-hidden="true"><path d="M0 0h3.6v12H0zM6.4 0H10v12H6.4z" fill="#1d1d1d"/></svg>';
const SVG_BATT = '<svg class="ipodf-ic-batt" viewBox="0 0 26 12" width="24" height="11" aria-hidden="true">'
  + '<rect x=".5" y=".5" width="22" height="11" rx="2" fill="#f7f7f7" stroke="#4d4d4d"/>'
  + '<rect x="23.5" y="3.5" width="2" height="5" rx=".8" fill="#4d4d4d"/>'
  + '<rect x="2" y="2" width="17.5" height="8" rx="1" fill="#44ad3c"/>'
  + '<rect x="2" y="2" width="17.5" height="4" rx="1" fill="#8ee57c" opacity=".85"/></svg>';
// small (quiet) and large (loud) speaker glyphs for the volume bar
const SVG_SPK_LOW = '<svg viewBox="0 0 16 14" width="12" height="11" aria-hidden="true"><path d="M1 5h3l4-3v10l-4-3H1z" fill="#333"/><path d="M10.5 4.8a3.4 3.4 0 0 1 0 4.4" fill="none" stroke="#333" stroke-width="1.4" stroke-linecap="round"/></svg>';
const SVG_SPK_HIGH = '<svg viewBox="0 0 20 16" width="18" height="15" aria-hidden="true"><path d="M1 5.5h3.5L9 1.5v13l-4.5-4H1z" fill="#333"/><path d="M11.5 5a4.3 4.3 0 0 1 0 6M14 2.6a7.6 7.6 0 0 1 0 10.8M16.5 .6a10.8 10.8 0 0 1 0 14.8" fill="none" stroke="#333" stroke-width="1.4" stroke-linecap="round"/></svg>';
// the marker a list shows next to the track that is playing
const SVG_MARK = '<svg class="ipodf-row-mark" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 4h2.6L7 1.2v9.6L3.6 8H1z" fill="currentColor"/><path d="M8.6 3.6a3.4 3.4 0 0 1 0 4.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

const ICONS = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
  page: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></svg>',
  downloads: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
  nowplaying: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
};
const HUES = [212, 24, 278, 148, 338, 190];

/** Title bar: play/pause state at the left (as on the real Classic), centred title, battery right. */
export function titleBar(text) {
  const bar = el('div', 'ipodf-titlebar', null,
    `<span class="ipodf-status is-left">${SVG_PLAY}${SVG_PAUSE}</span><span class="ipodf-title"></span><span class="ipodf-status is-right">${SVG_BATT}</span>`);
  bar.querySelector('.ipodf-title').textContent = text;
  return bar;
}

/** Cover-art tile content: image with a gradient+monogram fallback, or a typed icon tile. */
export function tileInner({ item, index = 0, config, resolveUrl, forceMono = false }) {
  const hue = HUES[index % HUES.length];
  const inner = el('div', 'ipodf-tile-inner');
  inner.style.background = `linear-gradient(155deg, hsl(${hue} 72% 64%) 0%, hsl(${hue + 18} 68% 42%) 60%, hsl(${hue + 30} 70% 30%) 100%)`;
  const mono = () => { const m = el('span', 'ipodf-tile-mono'); m.textContent = config.brand.monogram ?? ''; inner.append(m); };
  if (item.type === 'nowplaying' && item.cover && !forceMono) {
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.src = resolveUrl(item.cover);
    img.addEventListener('error', () => { img.remove(); mono(); const n = el('span', 'ipodf-tile-cap'); n.textContent = item.title ?? ''; inner.append(n); });
    inner.append(img);
  } else if (item.type === 'page' || forceMono) {
    mono();
  } else {
    inner.innerHTML = ICONS[item.type] ?? ICONS.page;
  }
  return inner;
}

/** The right-hand preview pane of the split main menu. Art nodes are built once per item and reused. */
export function createPane({ config, resolveUrl, reducedMotion, timers }) {
  const root = el('div', 'ipodf-pane', { 'aria-hidden': 'true' });
  const cache = new Map();
  let current = null;
  let currentKey = null;
  const build = (item, index) => {
    const art = el('div', 'ipodf-art');
    const tile = el('div', 'ipodf-art-tile');
    tile.append(tileInner({ item, index, config, resolveUrl }));
    const refl = el('div', 'ipodf-art-refl');
    refl.append(tileInner({ item, index, config, resolveUrl }));
    art.append(tile, refl);
    return art;
  };
  return {
    el: root,
    show(item, index) {
      if (!item) return;
      const key = item.id ?? index;
      if (key === currentKey) return;
      currentKey = key;
      let art = cache.get(key);
      if (!art) { art = build(item, index); cache.set(key, art); }
      const old = current;
      current = art;
      art._out = timers.cancel(art._out);
      art.classList.remove('is-out', 'is-in');
      if (art.parentNode !== root) root.append(art);
      if (reducedMotion()) { if (old && old !== art) old.remove(); return; }
      void art.offsetWidth; // restart the entrance animation on a reused node
      art.classList.add('is-in');
      if (old && old !== art) {
        old.classList.remove('is-in');
        old.classList.add('is-out');
        old._out = timers.later(() => { old.remove(); old.classList.remove('is-out'); }, 320);
      }
    },
    destroy() { cache.clear(); current = null; currentKey = null; },
  };
}

/** One row: a role=option box whose content is a real <a> for links (keeps modifier clicks native). */
function makeRow(r, id) {
  const row = el('div', 'ipodf-row', { role: 'option', id, 'aria-selected': 'false' });
  const isLink = !!r.href;
  const inner = el(isLink ? 'a' : 'span', 'ipodf-row-in');
  if (isLink) {
    inner.href = r.href;
    inner.tabIndex = -1;
    if (r.download) inner.setAttribute('download', '');
    else if (/^https?:/i.test(r.href)) { inner.target = '_blank'; inner.rel = 'noopener'; }
    row.setAttribute('aria-description', r.download ? 'Download' : /^mailto:/i.test(r.href) ? 'E-Mail-Link' : /^https?:/i.test(r.href) ? 'Link, öffnet in neuem Tab' : 'Link');
  }
  if (r.mark) inner.insertAdjacentHTML('beforeend', SVG_MARK);
  const label = el('span', 'ipodf-row-label');
  label.textContent = r.label ?? '';
  inner.append(label);
  if (r.detail) { const d = el('span', 'ipodf-row-detail'); d.textContent = r.detail; inner.append(d); }
  if (r.chevron) inner.insertAdjacentHTML('beforeend', SVG_CHEV);
  row.append(inner);
  row.link = isLink ? inner : null;
  return row;
}

/**
 * A listbox with the blue highlight, windowed scrolling and a scrollbar.
 * `height` is the viewport in logical px (Infinity → static list that never scrolls, used in pages).
 * onSelect(row, i, rowEl, { pointer }) – onChange(box, reason, announceText?)
 */
export class ListBox {
  constructor({ rows, label, height = BODY_H, onSelect, onChange, onOverscroll }) {
    this.rows = rows; this.onSelect = onSelect; this.onChange = onChange; this.onOverscroll = onOverscroll;
    this.index = 0; this.first = 0;
    this.uid = ++uid;
    this.height = height;
    this.visible = Number.isFinite(height) ? Math.max(1, Math.floor(height / UI.row)) : Infinity;
    this.el = el('div', 'ipodf-body' + (Number.isFinite(height) ? '' : ' is-static'));
    this.list = el('div', 'ipodf-list', { role: 'listbox', 'aria-label': label });
    this.rowEls = rows.map((r, i) => {
      const row = makeRow(r, `ipodf-o${this.uid}-${i}`);
      row.addEventListener('click', (e) => this.onRowClick(e, i));
      this.list.append(row);
      return row;
    });
    this.sb = el('div', 'ipodf-scrollbar', { 'aria-hidden': 'true' }, '<div class="ipodf-scrollthumb"></div>');
    this.el.append(this.list, this.sb);
    this.layout();
  }
  get count() { return this.rows.length; }
  get activeId() { return this.rowEls[this.index]?.id; }
  get activeRow() { return this.rows[this.index]; }
  currentLabel() { const r = this.rows[this.index]; return r ? [r.label, r.detail].filter(Boolean).join(', ') : ''; }
  onRowClick(e, i) {
    if (!e.isTrusted) return; // programmatic clicks fall through to the browser (link activation)
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; // modifier clicks: native link behaviour
    e.preventDefault();
    if (this.setIndex(i)) this.onChange?.(this, 'click');
    this.select({ pointer: true }); // first tap/click activates
  }
  setIndex(i) {
    if (!this.rows.length) return false;
    const n = Math.max(0, Math.min(this.rows.length - 1, i));
    if (n === this.index && this.rowEls[n].classList.contains('is-active')) return false;
    this.index = n;
    this.layout();
    return true;
  }
  move(dir) {
    const moved = this.setIndex(this.index + dir);
    if (moved) { this.onChange?.(this, 'move'); return true; }
    return this.onOverscroll ? !!this.onOverscroll(dir) : false;
  }
  select(opts) { if (this.rows.length) this.onSelect?.(this.rows[this.index], this.index, this.rowEls[this.index], opts ?? {}); }
  layout() {
    if (this.index < this.first) this.first = this.index;
    if (this.index >= this.first + this.visible) this.first = this.index - this.visible + 1;
    this.rowEls.forEach((r, i) => { r.classList.toggle('is-active', i === this.index); r.setAttribute('aria-selected', i === this.index ? 'true' : 'false'); });
    if (this.activeId) this.list.setAttribute('aria-activedescendant', this.activeId);
    const overflow = this.rows.length > this.visible;
    this.list.style.transform = overflow ? `translateY(${-this.first * UI.row}px)` : '';
    this.el.classList.toggle('has-scroll', overflow);
    if (overflow) {
      const thumb = this.sb.firstElementChild;
      const h = Math.max(14, this.height * this.visible / this.rows.length);
      thumb.style.height = `${h}px`;
      thumb.style.top = `${(this.height - h) * (this.first / Math.max(1, this.rows.length - this.visible))}px`;
    }
  }
}

/** A full list screen; split=true adds the preview pane on the right (main menu). */
export class ListScreen {
  constructor({ type, id, title, rows, split = false, pane = null, onSelect, onChange }) {
    this.type = type; this.id = id;
    this.el = el('div', 'ipodf-screen' + (split ? ' is-split' : ''));
    this.el.append(titleBar(title));
    const main = el('div', 'ipodf-main');
    this.box = new ListBox({ rows, label: title, onSelect, onChange: (box, reason, text) => { this.pane?.show(box.activeRow?.item, box.index); onChange?.(this, reason, text); } });
    main.append(this.box.el);
    if (split && pane) { this.pane = pane; main.append(pane.el); }
    this.el.append(main);
  }
  get index() { return this.box.index; }
  get count() { return this.box.count; }
  get activeId() { return this.box.activeId; }
  currentLabel() { return this.box.currentLabel(); }
  move(dir) { return this.box.move(dir); }
  select() { this.box.select(); }
  activate() { this.pane?.show(this.box.activeRow?.item, this.box.index); }
  deactivate() {}
  destroy() { this.el.remove(); }
}

/** Text page with selectable action rows beneath the paragraph. The wheel scrolls the page. */
export class PageScreen {
  constructor({ id, title, body, actions = [], onSelect, onChange, onEmptySelect }) {
    this.type = 'page'; this.id = id; this.onEmptySelect = onEmptySelect;
    this.y = 0;
    this.el = el('div', 'ipodf-screen');
    this.el.append(titleBar(title));
    this.page = el('div', 'ipodf-page');
    this.inner = el('div', 'ipodf-page-inner');
    const p = el('p', 'ipodf-page-text');
    p.textContent = body ?? '';
    this.inner.append(p);
    this.box = new ListBox({ rows: actions, label: title, height: Infinity, onSelect, onChange: (box, reason, text) => { this.layout(); onChange?.(this, reason, text); } });
    if (actions.length) this.inner.append(this.box.el);
    this.page.append(this.inner);
    this.el.append(this.page);
  }
  get index() { return this.box.index; }
  get count() { return this.box.count; }
  get activeId() { return this.box.activeId; }
  currentLabel() { return this.box.currentLabel(); }
  move(dir) {
    if (this.box.count) return this.box.move(dir);
    const max = Math.max(0, this.inner.offsetHeight - BODY_H);
    const y = Math.max(0, Math.min(max, this.y + dir * UI.row));
    if (y === this.y) return false;
    this.y = y;
    this.inner.style.transform = `translateY(${-this.y}px)`;
    return true;
  }
  select() { if (this.box.count) this.box.select(); else this.onEmptySelect?.(this); }
  /** keep the highlighted action fully inside the viewport, using measured row geometry */
  layout() {
    if (this.box.count) {
      const row = this.box.rowEls[this.box.index];
      const top = this.box.el.offsetTop + row.offsetTop;
      const bottom = top + row.offsetHeight;
      const max = Math.max(0, this.inner.offsetHeight - BODY_H);
      if (top < this.y) this.y = top;
      if (bottom > this.y + BODY_H) this.y = bottom - BODY_H;
      this.y = Math.max(0, Math.min(max, this.y));
    }
    this.inner.style.transform = `translateY(${-this.y}px)`;
  }
  activate() { this.layout(); }
  deactivate() {}
  destroy() { this.el.remove(); }
}

const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const NP_HEAD = 112; // logical px of cover / meta / progress above the track list

/**
 * "Sie hören": cover, track meta and progress on top, the track list (plus the Spotify row)
 * as a listbox below. The wheel moves the highlight; past either end it adjusts the volume,
 * which shows the Classic's volume bar in place of the progress bar.
 */
export class NowPlayingScreen {
  constructor({ id, item, index = 0, player, config, resolveUrl, actionLabel, titleText, volumeLabel, onSelect, onChange, timers }) {
    this.type = 'nowplaying'; this.id = id; this.item = item; this.player = player; this.onChange = onChange; this.timers = timers;
    this.volumeLabel = volumeLabel ?? 'Volume';
    this.el = el('div', 'ipodf-screen');
    this.el.append(titleBar(titleText ?? item.title ?? ''));
    const np = el('div', 'ipodf-np');
    this.np = np;
    const head = el('div', 'ipodf-np-head');
    const cover = el('div', 'ipodf-np-cover');
    cover.append(tileInner({ item, index, config, resolveUrl }));
    const meta = el('div', 'ipodf-np-meta', null,
      '<span class="ipodf-np-count"></span><span class="ipodf-np-track"></span><span class="ipodf-np-artist"></span><span class="ipodf-np-album"></span><span class="ipodf-np-by"></span>');
    this.$ = { count: meta.children[0], track: meta.children[1], artist: meta.children[2], album: meta.children[3], by: meta.children[4] };
    this.$.album.textContent = item.title ?? '';
    this.$.by.textContent = item.artist ?? '';
    const prog = el('div', 'ipodf-np-prog', null,
      '<span class="ipodf-np-time is-left">0:00</span><div class="ipodf-np-bar"><div class="ipodf-np-fill"></div></div><span class="ipodf-np-time is-right">-0:00</span>');
    this.$.tl = prog.children[0]; this.$.fill = prog.children[1].firstElementChild; this.$.tr = prog.children[2];
    const vol = el('div', 'ipodf-np-vol', { 'aria-hidden': 'true' },
      `<span class="ipodf-np-spk is-l">${SVG_SPK_LOW}</span><div class="ipodf-np-bar"><div class="ipodf-np-fill"></div></div><span class="ipodf-np-spk is-r">${SVG_SPK_HIGH}</span>`);
    this.$.vol = vol; this.$.volFill = vol.children[1].firstElementChild; this.$.prog = prog;
    head.append(cover, meta, prog, vol);

    const tracks = player.tracks ?? [];
    const rows = tracks.map((t, i) => ({ label: t.title ?? '', detail: t.duration, mark: true, kind: 'track', trackIndex: i }));
    if (item.spotifyUrl) rows.push({ label: actionLabel, href: item.spotifyUrl, kind: 'link' });
    this.box = new ListBox({
      rows, label: item.title ?? '', height: UI.h - UI.title - NP_HEAD,
      onSelect: (row, i, rowEl, opts) => {
        if (row.kind === 'track') { player.select(row.trackIndex); onSelect?.(row, i, rowEl, { ...opts, handled: true }); }
        else onSelect?.(row, i, rowEl, opts);
      },
      onChange: (box, reason, text) => onChange?.(this, reason, text),
      onOverscroll: (dir) => this.nudgeVolume(dir),
    });
    this.box.el.classList.add('ipodf-np-list');
    this.box.setIndex(Math.max(0, player.idx));
    np.append(head, this.box.el);
    this.el.append(np);
    this.volTimer = 0;
    this.render();
  }
  get index() { return this.box.index; }
  get count() { return this.box.count; }
  get activeId() { return this.box.activeId; }
  currentLabel() { return this.box.currentLabel(); }
  move(dir) { return this.box.move(dir); }
  select() { this.box.select(); }
  nudgeVolume(dir) {
    const p = this.player;
    const changed = p.nudgeVolume(dir * 0.0625);
    const pct = Math.round(p.volume * 100);
    this.$.volFill.style.width = `${pct}%`;
    this.np.classList.add('is-vol');
    this.volTimer = this.timers.cancel(this.volTimer);
    this.volTimer = this.timers.later(() => this.np.classList.remove('is-vol'), 1300);
    if (changed) this.onChange?.(this, 'volume', `${this.volumeLabel} ${pct} %`);
    return changed;
  }
  render() {
    const p = this.player;
    const t = p.track;
    const n = p.tracks.length;
    this.$.count.textContent = n ? `${p.idx + 1} von ${n}` : '';
    this.$.track.textContent = t?.title ?? this.item.title ?? '';
    this.$.artist.textContent = t?.artist ?? '';
    this.box.rowEls.forEach((r, i) => r.classList.toggle('is-now', this.box.rows[i].kind === 'track' && this.box.rows[i].trackIndex === p.idx));
    this.renderTime();
  }
  renderTime() {
    const p = this.player;
    const d = p.duration;
    const tl = fmt(p.elapsed);
    const tr = `-${fmt(d - p.elapsed)}`;
    const w = `${(Math.min(100, (p.elapsed / d) * 100)).toFixed(1)}%`;
    if (this.$.tl.textContent !== tl) this.$.tl.textContent = tl;
    if (this.$.tr.textContent !== tr) this.$.tr.textContent = tr;
    if (this.$.fill.style.width !== w) this.$.fill.style.width = w;
  }
  activate() {
    this.off?.();
    this.off = this.player.on((type) => (type === 'time' ? this.renderTime() : this.render()));
    this.render();
  }
  deactivate() { this.off?.(); this.off = null; }
  destroy() { this.deactivate(); this.volTimer = this.timers.cancel(this.volTimer); this.el.remove(); }
}
