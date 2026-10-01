// Screen builders for the logical 320×240 LCD: option rows, the scrolling list screen (also used
// for text pages and the Now Playing footer), the split main menu with its preview pane, and the
// Now Playing layout. All geometry is in logical px; `ctx` is supplied by index.js.
import { h, clamp, fmtTime, safeHref } from './util.js';
import { CHEVRON, SPEAKER_LO, SPEAKER_HI, SPEAKER_NOW, previewIcon } from './art.js';

export const ROW = 27;         // 8 rows per screen, like the 6G
export const STAGE_H = 218;    // 240 minus the 22 px title bar
const TEXT_STEP = 34;          // two text lines per wheel step on text pages
const SETTLE_MS = 90;          // the preview pane waits for the highlight to come to rest
const TRK_VIS = 3;             // rows of the compact track list on Now Playing
const fileName = (p) => String(p ?? '').split(/[?#]/)[0].split('/').pop() || '';

export function createScreens(ctx) {
  const { L, brand, nid, timers } = ctx;

  /** One option row. Links are a real <a> inside the option, so the link keeps its semantics
   *  (described via aria-description) and modifier clicks stay native. */
  function makeRow(spec) {
    const href = spec.href ? safeHref(spec.href) : null;
    const dead = !!spec.href && !href; // rejected link: shown greyed out and inert
    const row = h('div', `ipodc-row${dead ? ' is-dead' : ''}`, { role: 'option', id: nid('o'), 'aria-selected': 'false', 'aria-disabled': dead && 'true' });
    const a = h(href ? 'a' : 'span', 'ipodc-row-a');
    if (href) {
      Object.assign(a, { href, tabIndex: -1, draggable: false });
      let desc = L.link;
      if (spec.download != null) { a.setAttribute('download', spec.download); desc = L.download; } else if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; desc = L.newTab; } else if (/^mailto:/i.test(href)) desc = L.mail;
      row.setAttribute('aria-description', desc);
      row.link = a;
    }
    a.append(h('span', 'ipodc-row-label', { text: spec.label ?? '' }));
    if (spec.detail) a.append(h('span', 'ipodc-row-detail', { text: spec.detail }));
    if (spec.sub) a.insertAdjacentHTML('beforeend', CHEVRON);
    row.append(a);
    return row;
  }

  /** Generic scrolling list screen. `pre` is optional content above the rows (page text). */
  function listScreen({ kind, id, title, rows: specs = [], pre = null, split = false }) {
    specs = specs.filter(Boolean);
    const node = h('div', `ipodc-screen ipodc-screen--${kind}${split ? ' is-split' : ''}`);
    const view = h('div', 'ipodc-view');
    const content = h('div', 'ipodc-content');
    const list = h('div', 'ipodc-list');
    const hl = h('div', 'ipodc-hl');
    const sb = h('div', 'ipodc-sb');
    const thumb = h('div', 'ipodc-sb-thumb');
    const rows = specs.map(makeRow);
    list.append(hl, ...rows);
    if (pre) content.append(pre);
    content.append(list);
    view.append(content);
    sb.append(thumb);
    node.append(view, sb);
    if (!rows.length) {
      list.classList.add('is-empty');
      // nothing to select: the text itself is the active option, so AT reads it on focus
      if (pre) Object.assign(pre, { id: nid('t') }).setAttribute('role', 'option');
      pre?.setAttribute('aria-selected', 'true');
    }
    let bumpAt = 0;

    const s = {
      kind, id, title: title ?? '', node, rows, specs, index: 0, off: 0, listTop: 0, contentH: 0, viewH: STAGE_H, enteredAt: 0,
      adId: () => (rows[s.index] ?? pre)?.id,
      measure() {
        const k = ctx.pxPer();
        s.listTop = pre ? Math.round(pre.offsetHeight / k) : 0;
        s.contentH = s.listTop + rows.length * ROW;
        const vh = Math.round(view.clientHeight / k);
        if (vh > 0) s.viewH = vh;
      },
      layout() {
        // the scrollbar narrows the text column, which can re-wrap the text: measure twice
        node.classList.remove('has-sb');
        s.measure();
        if (s.contentH > s.viewH + 1) { node.classList.add('has-sb'); s.measure(); }
        s.off = clamp(s.off, 0, s.maxOff());
        if (rows.length) s.setIndex(s.index, { instant: true, ensure: kind !== 'page' || s.index > 0 });
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
        content.style.setProperty('--ipodc-off', s.off);
        hl.style.setProperty('--ipodc-i', s.index);
        if (s.contentH > s.viewH + 1) {
          const th = Math.max(14, Math.round((s.viewH * s.viewH) / s.contentH));
          thumb.style.setProperty('--ipodc-th', th);
          thumb.style.setProperty('--ipodc-tt', Math.round((s.viewH - th) * (s.off / Math.max(1, s.maxOff()))));
        }
        if (instant) {
          void node.offsetWidth; // commit the un-animated state before transitions come back
          node.classList.remove('is-instant');
        }
      },
      setIndex(i, { instant = false, ensure = true } = {}) {
        if (!rows.length) return false;
        i = clamp(i, 0, rows.length - 1);
        const changed = i !== s.index;
        rows[s.index].classList.remove('is-sel');
        rows[s.index].setAttribute('aria-selected', 'false');
        s.index = i;
        rows[i].classList.add('is-sel');
        rows[i].setAttribute('aria-selected', 'true');
        if (ensure) s.ensureVisible(i);
        s.paint(instant);
        s.onIndex?.(i, changed);
        if (ctx.isCurrent(s)) ctx.syncAD();
        return changed;
      },
      /** one wheel step; true when something moved */
      move(d) {
        if (rows.length && kind === 'page') {
          if (d > 0) {
            // long text above the actions: scroll the text first, then walk the action rows
            const t = s.rowTop(s.index);
            if (t + ROW > s.off + s.viewH + 0.5) return s.scrollText(Math.min(s.off + TEXT_STEP, t + ROW - s.viewH));
            return s.setIndex(s.index + 1);
          }
          if (s.index > 0) return s.setIndex(s.index - 1);
          return s.scrollText(s.off - TEXT_STEP);
        }
        if (rows.length) return s.setIndex(s.index + d);
        return s.scrollText(s.off + d * TEXT_STEP);
      },
      scrollText(off) {
        off = clamp(off, 0, s.maxOff());
        if (off === s.off) return false;
        s.off = off;
        s.paint();
        return true;
      },
      /** Home / End / Page keys: jump straight to a row (or the text top / bottom) */
      jump(to) {
        if (!rows.length) return s.scrollText(Number.isFinite(to) ? s.off + Math.sign(to) * TEXT_STEP * 3 : to < 0 ? 0 : s.maxOff());
        if (kind === 'page' && to <= 0) { // back to the top of the text, not just the first action
          const moved = s.setIndex(0, { ensure: false });
          return s.scrollText(0) || moved;
        }
        return s.setIndex(to);
      },
      bump(d) {
        const now = performance.now();
        if (ctx.isReduced() || now - bumpAt < 260) return;
        bumpAt = now;
        view.classList.remove('bump-up', 'bump-down');
        void view.offsetWidth;
        view.classList.add(d > 0 ? 'bump-down' : 'bump-up');
      },
      activate() {
        const r = rows[s.index];
        if (!r) { ctx.showToast('back', L.backHint); return false; }
        // centre on an action scrolled out of view reveals it instead of firing blind
        if (!s.rowVisible(s.index)) {
          const t = s.rowTop(s.index);
          return s.scrollText(t < s.off ? t : Math.min(s.off + TEXT_STEP, t + ROW - s.viewH));
        }
        const spec = specs[s.index];
        if (spec.onActivate) spec.onActivate();
        else if (r.link) ctx.followLink(r.link, spec);
        else { s.bump(1); return false; }
        return true;
      },
      currentLabel: () => rows[s.index]?.querySelector('.ipodc-row-label').textContent ?? '',
    };
    view.addEventListener('animationend', () => view.classList.remove('bump-up', 'bump-down'));
    return s;
  }

  // ── cover art: image over a procedural fallback with the monogram
  function coverArt(item, cls) {
    const box = h('div', `ipodc-art ${cls}`);
    const fb = h('div', 'ipodc-art-fb');
    fb.append(h('b', null, { text: brand.monogram ?? '' }));
    box.append(fb);
    const src = item.cover ? safeHref(item.cover) : null;
    if (src) {
      const img = h('img', null, { alt: '', draggable: 'false', decoding: 'async' });
      img.onerror = () => img.remove();
      img.onload = () => { if (!img.naturalWidth) img.remove(); };
      img.src = src;
      box.append(img);
    }
    return box;
  }

  // ── main menu with the split-screen preview pane
  function menuScreen() {
    const { menu } = ctx;
    const s = listScreen({
      kind: 'menu', id: 'menu', title: brand.name || 'iPod', split: true,
      rows: menu.map((item) => ({ label: item.label ?? item.title ?? '', sub: true, onActivate: () => ctx.open(item) })),
    });
    const preview = h('div', 'ipodc-preview', { 'aria-hidden': 'true' });
    s.node.append(preview);
    const panes = new Map();
    let shown = null;
    let settleT = 0;
    const showPane = (i) => {
      let pane = panes.get(i);
      if (!pane) {
        panes.set(i, (pane = buildPreview(menu[i] ?? {})));
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
      settleT = timers.cancel(settleT);
      if (!shown || !changed) showPane(i);
      else settleT = timers.later(() => showPane(s.index), SETTLE_MS);
    };
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
    const icon = () => previewIcon(kind, nid('pv'), brand.monogram, `${ctx.P}s`);
    const pane = h('div', 'ipodc-pv ipodc-pv--icon');
    const ico = h('div', 'ipodc-pv-float');
    ico.innerHTML = icon();
    const refl = h('div', 'ipodc-pv-refl');
    const reflIn = h('div', 'ipodc-pv-float-in');
    reflIn.innerHTML = icon();
    refl.append(reflIn);
    pane.append(h('div', 'ipodc-pv-floor'), refl, ico);
    return pane;
  }

  // ── sub screens
  function buildScreen(item) {
    const title = item.title ?? item.label ?? '';
    const items = (a) => (Array.isArray(a) ? a : []).filter(Boolean);
    switch (item.type) {
      case 'list':
        return listScreen({ kind: 'list', id: item.id ?? 'list', title, rows: items(item.items).map(({ label, detail, href }) => ({ label, detail, href })) });
      case 'downloads':
        return listScreen({
          kind: 'downloads', id: item.id ?? 'downloads', title,
          rows: items(item.items).map((it) => ({
            label: it.label,
            detail: [it.format, /^[–-]?$/.test(it.size ?? '') ? null : it.size].filter(Boolean).join(' · '),
            href: it.file,
            download: fileName(it.file),
          })),
        });
      case 'nowplaying':
        return nowPlayingScreen(item);
      default: {
        const s = listScreen({
          kind: 'page', id: item.id ?? 'page', title, pre: h('div', 'ipodc-text', { text: item.body ?? '' }),
          rows: items(item.actions).map(({ label, detail, href }) => ({ label, detail, href })),
        });
        s.summary = item.body;
        return s;
      }
    }
  }

  // ── Now Playing: cover + reflection, count / title / artist / album / curator, a quiet track
  // list, the 6G progress capsule (volume bar while the wheel turns) and a quiet Spotify footer.
  function nowPlayingScreen(item) {
    const { player, L: S } = ctx;
    const { tracks } = player;
    const spot = item.spotifyUrl ? safeHref(item.spotifyUrl) : null;
    const s = listScreen({
      kind: 'nowplaying', id: item.id ?? 'nowplaying', title: S.nowPlaying,
      rows: spot ? [{ label: S.openSpotify, href: spot, sub: true }] : [],
    });
    const { node } = s;
    const line = (cls, text) => h('div', `ipodc-np-${cls}`, { text });
    const count = line('count');
    const tTitle = line('title');
    const tArtist = line('artist');
    const info = h('div', 'ipodc-np-info');
    info.append(count, tTitle, tArtist, line('album', item.title ?? ''), line('by', item.artist ?? ''));
    const meter = () => {
      const m = h('div', 'ipodc-meter');
      const f = h('div', 'ipodc-meter-fill');
      m.append(f);
      return [m, f];
    };
    const [pMeter, fill] = meter();
    const [vMeter, vFill] = meter();
    const tEl = h('span');
    const tRem = h('span');
    const times = h('div', 'ipodc-np-times');
    times.append(tEl, tRem);
    const prog = h('div', 'ipodc-np-prog');
    prog.append(pMeter, times);
    const vol = h('div', 'ipodc-np-vol');
    vol.innerHTML = SPEAKER_LO;
    vol.append(vMeter);
    vol.insertAdjacentHTML('beforeend', SPEAKER_HI);
    const deco = h('div', 'ipodc-np-deco', { 'aria-hidden': 'true' });
    deco.append(coverArt(item, 'ipodc-np-art'), coverArt(item, 'ipodc-np-refl'), info, prog, vol);
    // compact track list under the meta: tap a title to play it; the playing one carries the blue speaker
    const realTracks = Array.isArray(item.tracks) && item.tracks.length > 0;
    const tlIn = h('div', 'ipodc-np-tracks-in');
    const trkRows = realTracks ? tracks.map((t, i) => {
      const r = h('div', 'ipodc-trk', { 'data-i': i });
      r.innerHTML = SPEAKER_NOW;
      r.append(h('span', 'ipodc-trk-t', { text: t.title ?? '' }));
      if (t.duration) r.append(h('span', 'ipodc-trk-d', { text: t.duration }));
      return r;
    }) : [];
    tlIn.append(...trkRows);
    if (trkRows.length) {
      const tl = h('div', 'ipodc-np-tracks');
      tl.append(tlIn);
      deco.append(tl);
    } else node.classList.add('no-tracks');
    node.prepend(deco);
    if (!spot) node.classList.add('no-cta');
    let trkTop = 0;
    let volT = 0;

    s.update = (instant = false) => {
      const t = tracks[player.track] ?? {};
      const dur = player.duration;
      tTitle.textContent = t.title ?? '';
      tArtist.textContent = t.artist ?? '';
      count.textContent = tracks.length ? `${player.track + 1} ${S.of} ${tracks.length}` : '';
      trkRows.forEach((r, i) => r.classList.toggle('is-cur', i === player.track));
      if (trkRows.length > TRK_VIS) {
        trkTop = clamp(trkTop, player.track - TRK_VIS + 1, player.track); // keep the playing track in view
        tlIn.style.setProperty('--ipodc-tt', trkTop);
      }
      if (instant) node.classList.add('is-instant');
      fill.style.setProperty('--ipodc-f', clamp(player.elapsed / dur, 0, 1).toFixed(4));
      vFill.style.setProperty('--ipodc-f', player.volume);
      if (instant) { void node.offsetWidth; node.classList.remove('is-instant'); }
      tEl.textContent = fmtTime(player.elapsed);
      tRem.textContent = `-${fmtTime(dur - Math.floor(player.elapsed))}`;
    };
    s.summary = () => {
      const t = tracks[player.track] ?? {};
      return [t.title, t.artist, item.title, count.textContent].filter(Boolean).join(', ');
    };
    s.onShow = () => {
      if (!player.started) player.setPlaying(true);
      s.update(true);
    };
    s.onHide = () => {
      volT = timers.cancel(volT);
      node.classList.remove('is-vol');
    };
    // the wheel sets the volume on Now Playing, like the real thing
    s.move = (d) => {
      node.classList.add('is-vol');
      timers.cancel(volT);
      volT = timers.later(() => node.classList.remove('is-vol'), 1600);
      const moved = player.nudge(d);
      if (moved) ctx.announce(`${S.volume} ${Math.round(player.volume * 100)} %`);
      return moved;
    };
    s.jump = () => false;
    s.pickTrack = (i) => {
      if (i === player.track && player.started) return player.setPlaying(!player.playing);
      player.go(i);
      player.setPlaying(true);
    };
    const baseActivate = s.activate;
    s.activate = () => {
      if (!s.rows.length) { player.setPlaying(!player.playing); return true; }
      return baseActivate();
    };
    s.update(true);
    return s;
  }

  return { menuScreen, buildScreen };
}
