// Screen renderers for the 320×240 logical LCD: title bar, list (optionally split with the
// preview pane), text page with action rows, and the Now Playing layout.

export const UI = { w: 320, h: 240, title: 20, row: 27.5 };
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
export const SVG_SPEAKER = '<svg viewBox="0 0 16 14" aria-hidden="true"><path d="M1 5h3l4-3v10l-4-3H1z" fill="#333"/><path d="M10 4.5a3.5 3.5 0 0 1 0 5M12 2.5a6 6 0 0 1 0 9" fill="none" stroke="#333" stroke-width="1.4" stroke-linecap="round"/></svg>';

const ICONS = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
  page: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></svg>',
  downloads: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
  nowplaying: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
};
const HUES = [212, 24, 278, 148, 338, 190];

export function titleBar(text) {
  const bar = el('div', 'ipodf-titlebar', null, `<span class="ipodf-title"></span><span class="ipodf-status">${SVG_PLAY}${SVG_PAUSE}${SVG_BATT}</span>`);
  bar.querySelector('.ipodf-title').textContent = text;
  return bar;
}

/** Cover-art tile content: image with a gradient+monogram fallback, or a typed icon tile. */
export function tileInner({ item, index = 0, config, resolveUrl, forceMono = false }) {
  const hue = HUES[index % HUES.length];
  const inner = el('div', 'ipodf-tile-inner');
  inner.style.background = `linear-gradient(155deg, hsl(${hue} 72% 64%) 0%, hsl(${hue + 18} 68% 42%) 60%, hsl(${hue + 30} 70% 30%) 100%)`;
  const mono = () => { inner.append(el('span', 'ipodf-tile-mono', null, '')); inner.lastChild.textContent = config.brand.monogram ?? ''; };
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

/** The right-hand preview pane of the split main menu. */
export function createPane({ config, resolveUrl, reducedMotion }) {
  const root = el('div', 'ipodf-pane', { 'aria-hidden': 'true' });
  let current = null;
  let currentKey = null;
  return {
    el: root,
    show(item, index) {
      const key = item?.id ?? index;
      if (key === currentKey) return;
      currentKey = key;
      const art = el('div', 'ipodf-art');
      const tile = el('div', 'ipodf-art-tile');
      tile.append(tileInner({ item, index, config, resolveUrl }));
      const refl = el('div', 'ipodf-art-refl');
      refl.append(tileInner({ item, index, config, resolveUrl }));
      art.append(tile, refl);
      const old = current;
      current = art;
      root.append(art);
      if (reducedMotion()) { old?.remove(); return; }
      art.classList.add('is-in');
      if (old) { old.classList.add('is-out'); setTimeout(() => old.remove(), 320); }
    },
  };
}

function makeRow(r, id) {
  const isLink = !!r.href;
  const row = el(isLink ? 'a' : 'div', 'ipodf-row', { role: 'option', id, 'aria-selected': 'false', tabindex: '-1' });
  if (isLink) {
    row.href = r.href;
    if (r.download) row.setAttribute('download', '');
    else if (/^https?:/i.test(r.href)) { row.target = '_blank'; row.rel = 'noopener'; }
  }
  const label = el('span', 'ipodf-row-label');
  label.textContent = r.label ?? '';
  row.append(label);
  if (r.detail) { const d = el('span', 'ipodf-row-detail'); d.textContent = r.detail; row.append(d); }
  if (r.chevron) row.insertAdjacentHTML('beforeend', SVG_CHEV);
  return row;
}

/** A listbox with highlight, windowed scrolling and a scrollbar; optionally split with a pane. */
export class ListScreen {
  constructor({ type, id, title, rows, split = false, pane = null, onSelect, onChange }) {
    this.type = type; this.id = id; this.rows = rows; this.onSelect = onSelect; this.onChange = onChange;
    this.index = 0; this.first = 0;
    this.uid = ++uid;
    this.el = el('div', 'ipodf-screen' + (split ? ' is-split' : ''));
    this.el.append(titleBar(title));
    const main = el('div', 'ipodf-main');
    this.body = el('div', 'ipodf-body');
    this.list = el('div', 'ipodf-list', { role: 'listbox', 'aria-label': title });
    this.rowEls = rows.map((r, i) => {
      const row = makeRow(r, `ipodf-o${this.uid}-${i}`);
      row.addEventListener('click', (e) => this.onRowClick(e, i));
      this.list.append(row);
      return row;
    });
    this.sb = el('div', 'ipodf-scrollbar', { 'aria-hidden': 'true' }, '<div class="ipodf-scrollthumb"></div>');
    this.body.append(this.list, this.sb);
    main.append(this.body);
    if (split && pane) { this.pane = pane; main.append(pane.el); }
    this.el.append(main);
    this.visible = Math.floor(BODY_H / UI.row);
    this.layout();
  }
  get count() { return this.rows.length; }
  get activeId() { return this.rowEls[this.index]?.id; }
  currentLabel() { const r = this.rows[this.index]; return r ? [r.label, r.detail].filter(Boolean).join(', ') : ''; }
  onRowClick(e, i) {
    if (!e.isTrusted) return; // programmatic clicks fall through to the browser
    e.preventDefault();
    if (i !== this.index) { this.setIndex(i); this.onChange?.(this, 'click'); } else this.select();
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
    if (moved) this.onChange?.(this, 'move');
    return moved;
  }
  select() { if (this.rows.length) this.onSelect?.(this.rows[this.index], this.index, this.rowEls[this.index]); }
  layout() {
    if (this.index < this.first) this.first = this.index;
    if (this.index >= this.first + this.visible) this.first = this.index - this.visible + 1;
    this.rowEls.forEach((r, i) => { r.classList.toggle('is-active', i === this.index); r.setAttribute('aria-selected', i === this.index ? 'true' : 'false'); });
    if (this.activeId) this.list.setAttribute('aria-activedescendant', this.activeId);
    this.list.style.transform = `translateY(${-this.first * UI.row}px)`;
    const overflow = this.rows.length > this.visible;
    this.body.classList.toggle('has-scroll', overflow);
    if (overflow) {
      const thumb = this.sb.firstElementChild;
      const h = Math.max(14, BODY_H * this.visible / this.rows.length);
      thumb.style.height = `${h}px`;
      thumb.style.top = `${(BODY_H - h) * (this.first / Math.max(1, this.rows.length - this.visible))}px`;
    }
    this.pane?.show(this.rows[this.index]?.item, this.index);
  }
  activate() { this.pane?.show(this.rows[this.index]?.item, this.index); }
  deactivate() {}
  destroy() { this.el.remove(); }
}

/** Text page with selectable action rows beneath the paragraph. The wheel scrolls the page. */
export class PageScreen {
  constructor({ id, title, body, actions = [], onSelect, onChange }) {
    this.type = 'page'; this.id = id; this.rows = actions; this.onSelect = onSelect; this.onChange = onChange;
    this.index = 0; this.y = 0;
    this.uid = ++uid;
    this.el = el('div', 'ipodf-screen');
    this.el.append(titleBar(title));
    this.page = el('div', 'ipodf-page');
    this.inner = el('div', 'ipodf-page-inner');
    const p = el('p', 'ipodf-page-text');
    p.textContent = body ?? '';
    this.inner.append(p);
    this.list = el('div', 'ipodf-list', { role: 'listbox', 'aria-label': title });
    this.list.style.position = 'relative';
    this.rowEls = actions.map((r, i) => {
      const row = makeRow(r, `ipodf-o${this.uid}-${i}`);
      row.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        e.preventDefault();
        if (i !== this.index) { this.setIndex(i); this.onChange?.(this, 'click'); } else this.select();
      });
      this.list.append(row);
      return row;
    });
    if (actions.length) this.inner.append(this.list);
    this.page.append(this.inner);
    this.el.append(this.page);
    this.layout();
  }
  get count() { return this.rows.length; }
  get activeId() { return this.rowEls[this.index]?.id; }
  currentLabel() { return this.rows[this.index]?.label ?? ''; }
  setIndex(i) {
    const n = Math.max(0, Math.min(this.rows.length - 1, i));
    if (n === this.index) return false;
    this.index = n;
    this.layout();
    return true;
  }
  move(dir) {
    let moved;
    if (this.rows.length) moved = this.setIndex(this.index + dir);
    else {
      const max = Math.max(0, this.inner.offsetHeight - BODY_H);
      const y = Math.max(0, Math.min(max, this.y + dir * UI.row));
      moved = y !== this.y;
      this.y = y;
      this.layout();
    }
    if (moved) this.onChange?.(this, 'move');
    return moved;
  }
  select() { if (this.rows.length) this.onSelect?.(this.rows[this.index], this.index, this.rowEls[this.index]); }
  layout() {
    this.rowEls.forEach((r, i) => { r.classList.toggle('is-active', i === this.index); r.setAttribute('aria-selected', i === this.index ? 'true' : 'false'); });
    if (this.activeId) this.list.setAttribute('aria-activedescendant', this.activeId);
    if (this.rows.length) {
      const row = this.rowEls[this.index];
      const top = this.list.offsetTop + row.offsetTop;
      const max = Math.max(0, this.inner.offsetHeight - BODY_H);
      if (top < this.y) this.y = top;
      if (top + UI.row > this.y + BODY_H) this.y = top + UI.row - BODY_H;
      this.y = Math.max(0, Math.min(max, this.y));
    }
    this.inner.style.transform = `translateY(${-this.y}px)`;
  }
  activate() { this.layout(); }
  deactivate() {}
  destroy() { this.el.remove(); }
}

const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** The "Sie hören" layout bound to the shared player. Scrolling shows the volume bar. */
export class NowPlayingScreen {
  constructor({ id, item, index = 0, player, config, resolveUrl, actionLabel, titleText, onSelect, onChange }) {
    this.type = 'nowplaying'; this.id = id; this.item = item; this.player = player; this.onSelect = onSelect; this.onChange = onChange;
    this.index = 0;
    this.uid = ++uid;
    this.el = el('div', 'ipodf-screen');
    this.el.append(titleBar(titleText ?? item.title ?? ''));
    const np = el('div', 'ipodf-np');
    this.np = np;
    const cover = el('div', 'ipodf-np-cover');
    cover.append(tileInner({ item, index, config, resolveUrl }));
    const refl = el('div', 'ipodf-np-refl', { 'aria-hidden': 'true' });
    refl.append(tileInner({ item, index, config, resolveUrl }));
    const meta = el('div', 'ipodf-np-meta', null,
      '<span class="ipodf-np-count"></span><span class="ipodf-np-track"></span><span class="ipodf-np-artist"></span><span class="ipodf-np-album"></span><span class="ipodf-np-by"></span>');
    this.$ = {
      count: meta.children[0], track: meta.children[1], artist: meta.children[2], album: meta.children[3], by: meta.children[4],
    };
    this.$.album.textContent = item.title ?? '';
    this.$.by.textContent = item.artist ?? '';
    const prog = el('div', 'ipodf-np-prog', null,
      '<span class="ipodf-np-time is-left">0:00</span><div class="ipodf-np-bar"><div class="ipodf-np-fill"></div></div><span class="ipodf-np-time is-right">-0:00</span>');
    this.$.tl = prog.children[0]; this.$.fill = prog.children[1].firstElementChild; this.$.tr = prog.children[2];
    const vol = el('div', 'ipodf-np-vol', { 'aria-hidden': 'true' },
      `<span class="is-l">${SVG_SPEAKER}</span><div class="ipodf-np-bar"><div class="ipodf-np-fill"></div></div><span class="is-r">${SVG_SPEAKER}</span>`);
    this.$.vol = vol; this.$.volFill = vol.children[1].firstElementChild; this.$.prog = prog;
    const action = el('div', 'ipodf-np-action');
    this.list = el('div', 'ipodf-list', { role: 'listbox', 'aria-label': item.title ?? '' });
    this.list.style.position = 'relative';
    this.rows = [{ label: actionLabel, href: item.spotifyUrl, chevron: true }];
    const row = makeRow(this.rows[0], `ipodf-o${this.uid}-0`);
    row.classList.add('is-active');
    row.setAttribute('aria-selected', 'true');
    row.addEventListener('click', (e) => { if (!e.isTrusted) return; e.preventDefault(); this.select(); });
    this.rowEls = [row];
    this.list.append(row);
    this.list.setAttribute('aria-activedescendant', row.id);
    action.append(this.list);
    np.append(cover, refl, meta, prog, vol, action);
    this.el.append(np);
    this.volTimer = 0;
    this.render();
  }
  get count() { return 1; }
  get activeId() { return this.rowEls[0].id; }
  currentLabel() { const t = this.player.track; return t ? `${t.title}, ${t.artist}` : this.rows[0].label; }
  move(dir) {
    this.player.nudgeVolume(dir * 0.0625);
    this.$.volFill.style.width = `${this.player.volume * 100}%`;
    this.np.classList.add('is-vol');
    clearTimeout(this.volTimer);
    this.volTimer = setTimeout(() => this.np.classList.remove('is-vol'), 1300);
    this.onChange?.(this, 'move');
    return true;
  }
  select() { this.onSelect?.(this.rows[0], 0, this.rowEls[0]); }
  render() {
    const p = this.player;
    const t = p.track;
    const n = p.tracks.length;
    this.$.count.textContent = n ? `${p.idx + 1} von ${n}` : '';
    this.$.track.textContent = t?.title ?? this.item.title ?? '';
    this.$.artist.textContent = t?.artist ?? '';
    this.renderTime();
  }
  renderTime() {
    const p = this.player;
    const d = p.duration;
    this.$.tl.textContent = fmt(p.elapsed);
    this.$.tr.textContent = `-${fmt(d - p.elapsed)}`;
    this.$.fill.style.width = `${Math.min(100, (p.elapsed / d) * 100)}%`;
  }
  activate() {
    this.off?.();
    this.off = this.player.on((type) => (type === 'time' ? this.renderTime() : this.render()));
    this.render();
  }
  deactivate() { this.off?.(); this.off = null; }
  destroy() { this.deactivate(); clearTimeout(this.volTimer); this.el.remove(); }
}
