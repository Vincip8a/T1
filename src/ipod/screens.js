// Screen builders for the logical 320×240 LCD: option rows, the scrolling list screen (also used
// for text pages and the Now Playing footer), the split main menu with its preview pane, and the
// Now Playing layout. All geometry is in logical px; `ctx` is supplied by index.js.
import { h, clamp, fmtTime, safeHref } from './util.js';
import { linkAttrs, fileName, rowLabel, langOf, serviceName, firstText } from '../shared/href.js';
import { CHEVRON, SPEAKER_LO, SPEAKER_HI, SPEAKER_NOW, previewIcon } from './art.js';

const ROW = 27;        // 8 rows per screen, like the 6G
const TEXT_STEP = 34;  // two text lines per wheel step on text pages
const TRK_VIS = 3;     // rows of the compact track list on Now Playing

export function createScreens(ctx) {
  const { L, brand, nid, timers } = ctx;
  const mono = brand.monogram ?? '';

  /** One row. A link row IS the real <a>: on screens of links it takes keyboard focus itself (roving
   *  tabindex, see listScreen), so screen readers meet a real link; modifier clicks stay native.
   *  Other rows are options of the iPod listbox. */
  function makeRow(spec) {
    // the link rule is shared with the <noscript> list (src/shared/href.js): a file hosted elsewhere opens
    // in a new tab like any web link (browsers ignore `download` there) and gets no "Download gestartet"
    const link = spec.href ? linkAttrs(spec.href, { download: spec.download, origin: location.origin }) : null;
    const row = h(link ? 'a' : 'div', 'ipodc-row', { role: 'option', id: nid('o'), 'aria-selected': 'false', lang: spec.lang });
    if (link) {
      Object.assign(row, { href: link.href, tabIndex: -1, draggable: false });
      let desc = L.link;
      if (link.download != null) {
        row.download = link.download;
        desc = L.download;
      } else if (link.newTab) {
        row.target = '_blank';
        row.rel = 'noopener';
        desc = L.newTab;
      } else if (link.mail) desc = L.mail;
      row.setAttribute('aria-description', desc);
    }
    row.append(h('span', 'ipodc-row-label', { text: spec.label ?? '' }));
    if (spec.detail) row.append(h('span', 'ipodc-row-detail', { text: spec.detail }));
    if (spec.sub) row.insertAdjacentHTML('beforeend', CHEVRON);
    return row;
  }

  /** Generic scrolling list screen. `pre` is optional content above the rows (page text). */
  function listScreen(kind, id, title, specs, pre) {
    specs = specs.filter(Boolean);
    // an empty list says so (centred grey note, like the 6G), it never shows a bare white screen
    if (!specs.length && !pre && kind !== 'nowplaying') pre = h('div', 'ipodc-empty', { text: L.empty });
    const node = h('div', `ipodc-screen ipodc-screen--${kind}`);
    const view = h('div', 'ipodc-view');
    const content = h('div', 'ipodc-content');
    const list = h('div', 'ipodc-list');
    const hl = h('div', 'ipodc-hl');
    const sb = h('div', 'ipodc-sb');
    const thumb = h('div', 'ipodc-sb-thumb');
    const rows = specs.map(makeRow);
    // a screen with links is a group of real links with a roving tabindex (index.js moves DOM focus to
    // the current row); a screen without links stays an option list of the iPod listbox
    const roving = rows.some((r) => r.href);
    if (roving) for (const r of rows) { r.removeAttribute('role'); r.removeAttribute('aria-selected'); r.tabIndex = -1; }
    const css = (n, k, v) => n.style.setProperty(`--ipodc-${k}`, v);
    list.append(hl, ...rows);
    if (pre) content.append(pre);
    content.append(list);
    view.append(content);
    sb.append(thumb);
    node.append(view, sb);
    if (!rows.length) {
      list.classList.add('is-empty');
      // nothing to select: the text itself is the active option, so AT reads it on focus
      if (pre) for (const [k, v] of [['id', nid('t')], ['role', 'option'], ['aria-selected', 'true']]) pre.setAttribute(k, v);
    }
    let bumpAt = 0;
    const page = kind === 'page';

    const s = {
      kind, id, title: title ?? '', node, rows, specs, roving, index: 0, off: 0, top: 0, contentH: 0, viewH: 218, enteredAt: 0,
      adId: () => (roving ? null : (rows[s.index] ?? pre)?.id),
      measure() {
        const k = ctx.pxPer();
        s.top = pre ? Math.round(pre.offsetHeight / k) : 0;
        s.contentH = s.top + rows.length * ROW;
        s.viewH = Math.round(view.clientHeight / k) || s.viewH;
      },
      layout() {
        // the scrollbar narrows the text column, which can re-wrap the text: measure twice
        node.classList.remove('has-sb');
        s.measure();
        if (s.contentH > s.viewH + 1) { node.classList.add('has-sb'); s.measure(); }
        s.off = clamp(s.off, 0, s.maxOff());
        if (rows.length) s.setIndex(s.index, true, !page || s.index > 0);
        else s.paint(true);
      },
      maxOff: () => Math.max(0, s.contentH - s.viewH),
      /** how far the text must scroll to show row i fully (0 when it is in view) */
      need(i) {
        const t = s.top + i * ROW;
        const n = t < s.off ? t - s.off : Math.max(0, t + ROW - s.off - s.viewH);
        return n < -0.5 || n > 0.5 ? n : 0;
      },
      paint(instant) {
        if (instant) node.classList.add('is-instant');
        css(content, 'off', s.off);
        css(hl, 'i', s.index);
        if (s.contentH > s.viewH + 1) {
          const th = Math.max(14, Math.round((s.viewH * s.viewH) / s.contentH));
          css(thumb, 'th', th);
          css(thumb, 'tt', Math.round(((s.viewH - th) * s.off) / s.maxOff()));
        }
        if (instant) {
          void node.offsetWidth; // commit the un-animated state before transitions come back
          node.classList.remove('is-instant');
        }
      },
      setIndex(i, instant, ensure = true) {
        if (!rows.length) return false;
        i = clamp(i, 0, rows.length - 1);
        const changed = i !== s.index;
        for (const [n, on] of [[rows[s.index], false], [rows[i], true]]) {
          n.classList.toggle('is-sel', on);
          if (!roving) n.setAttribute('aria-selected', on);
        }
        s.index = i;
        if (ensure) s.off = clamp(s.off + s.need(i), 0, s.maxOff());
        s.paint(instant);
        s.onIndex?.(i, changed);
        if (ctx.isCurrent(s)) ctx.syncAD();
        return changed;
      },
      /** one wheel step; true when something moved */
      move(d) {
        if (!rows.length) return s.scrollText(s.off + d * TEXT_STEP);
        if (page) {
          // long text above the actions: scroll the text first, then walk the action rows
          if (d > 0 && s.need(s.index) > 0.5) return s.scrollText(s.off + Math.min(TEXT_STEP, s.need(s.index)));
          if (d < 0 && !s.index) return s.scrollText(s.off - TEXT_STEP);
        }
        return s.setIndex(s.index + d);
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
        if (page && to <= 0) return s.setIndex(0, false, false) | s.scrollText(0); // back to the top of the text
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
        if (!r) return ctx.showToast(L.backHint);
        // centre on an action scrolled out of view reveals it instead of firing blind
        const n = s.need(s.index);
        if (n) return s.scrollText(s.off + (n < 0 ? n : Math.min(TEXT_STEP, n)));
        const spec = specs[s.index];
        if (spec.onActivate) spec.onActivate();
        else if (r.href) ctx.followLink(r, spec);
        else s.bump(1);
      },
      currentLabel: () => specs[s.index]?.label ?? '',
      currentLang: () => specs[s.index]?.lang ?? null,
    };
    view.addEventListener('animationend', () => view.classList.remove('bump-up', 'bump-down'));
    return s;
  }

  // ── cover art: image over a procedural fallback with the monogram
  function coverArt(item, cls) {
    const box = h('div', `ipodc-art ${cls}`);
    const fb = h('div', 'ipodc-art-fb');
    fb.append(h('b', null, { text: mono }));
    box.append(fb);
    const src = item.cover && safeHref(item.cover);
    if (src) {
      const img = h('img', null, { alt: '', draggable: 'false', src });
      img.onerror = () => img.remove();
      box.append(img);
    }
    return box;
  }

  // ── main menu with the split-screen preview pane
  function menuScreen() {
    const { menu } = ctx;
    const s = listScreen('menu', 'menu', firstText(brand.name, 'iPod'),
      menu.map((item) => ({ label: firstText(item.label, item.title), lang: langOf(item), sub: true, onActivate: () => ctx.open(item) })));
    s.node.classList.add('is-split');
    const preview = h('div', 'ipodc-preview', { 'aria-hidden': 'true' });
    s.node.append(preview);
    const panes = [];
    let shown = null;
    let settleT = 0;
    const showPane = (i) => {
      let pane = panes[i];
      if (!pane) {
        preview.append((pane = panes[i] = buildPreview(menu[i] ?? {})));
        void pane.offsetWidth;
      }
      if (shown === pane) return;
      shown?.classList.remove('is-on');
      preview.append(pane); // newest on top for the cross-fade
      pane.classList.add('is-on');
      shown = pane;
    };
    // the preview pane waits for the highlight to come to rest
    s.onIndex = (i, changed) => {
      settleT = timers.cancel(settleT);
      if (!shown || !changed) showPane(i);
      else settleT = timers.later(() => showPane(s.index), 90);
    };
    if (!menu.length) showPane(0);
    return s;
  }

  function buildPreview(item) {
    const pane = h('div', 'ipodc-pv ipodc-pv--icon');
    if (item.type === 'nowplaying') {
      pane.className = 'ipodc-pv ipodc-pv--art';
      pane.append(coverArt(item, 'ipodc-pv-cover'));
      return pane;
    }
    const kind = { list: 'contacts', downloads: 'download' }[item.type] ?? (item.actions?.length ? 'chat' : 'monogram');
    const icon = () => previewIcon(kind, mono, `${ctx.P}s`);
    pane.innerHTML = `<div class="ipodc-pv-floor"></div><div class="ipodc-pv-refl"><div class="ipodc-pv-float-in">${icon()}</div></div><div class="ipodc-pv-float">${icon()}</div>`;
    return pane;
  }

  // ── sub screens
  function buildScreen(item) {
    const s = buildScreenOf(item);
    // of the label and title (the screen title gets it, see go() in index.js); Now Playing's title is the
    // firmware's own "Sie hören"
    s.lang = s.kind === 'nowplaying' ? null : langOf(item);
    return s;
  }
  function buildScreenOf(item) {
    const title = firstText(item.title, item.label);
    const id = item.id ?? item.type;
    const items = (a) => (Array.isArray(a) ? a : []).filter((x) => x && typeof x === 'object');
    // a row without a label shows its detail, host, e-mail or file name (rowLabel); one with nothing to
    // show is skipped with a hint, like a broken menu entry
    const named = (row, src) => {
      const label = rowLabel(src);
      if (!label) console.warn(`[ipod] config.json: row in "${title}" skipped (needs a label or an address):`, src);
      return label && { ...row, label, detail: label === row.detail ? null : row.detail, lang: langOf(src) };
    };
    const links = (a) => items(a).map((x) => named({ detail: x.detail, href: x.href }, x));
    switch (item.type) {
      case 'list':
        return listScreen('list', id, title, links(item.items));
      case 'downloads':
        return listScreen('downloads', id, title, items(item.items).map((it) => named({
          detail: [it.format, /^[–-]?$/.test(it.size ?? '') ? 0 : it.size].filter(Boolean).join(' · '),
          href: it.file,
          download: fileName(it.file),
        }, it)));
      case 'nowplaying':
        return nowPlayingScreen(item, id);
      default: {
        const s = listScreen('page', id, title, links(item.actions), h('div', 'ipodc-text', { text: item.body ?? '' }));
        s.summary = item.body;
        return s;
      }
    }
  }

  // ── Now Playing: cover + reflection, count / title / artist / album / curator, a quiet track
  // list, the 6G progress capsule (volume bar while the wheel turns) and a quiet Spotify footer.
  function nowPlayingScreen(item, id) {
    const { player } = ctx;
    const { tracks } = player;
    const spot = item.spotifyUrl && safeHref(item.spotifyUrl);
    // "In Spotify öffnen", "In Apple Music öffnen", … from the address; "Playlist öffnen" for any other
    const service = spot && serviceName(spot);
    const openLabel = service ? L.openIn.replace('{service}', service) : L.openPlaylist;
    const s = listScreen('nowplaying', id, L.nowPlaying, spot ? [{ label: openLabel, href: spot, sub: true }] : []);
    const { node } = s;
    const line = (cls, text) => h('div', `ipodc-np-${cls}`, { text });
    const [count, tTitle, tArtist] = ['count', 'title', 'artist'].map((c) => line(c));
    const info = h('div', 'ipodc-np-info');
    // without tracks (config.json has none) the player plays the playlist itself: its title and curator
    // are the track lines already, so no album / curator lines, count or progress (no invented 3:30)
    const own = Array.isArray(item.tracks) && item.tracks.length > 0;
    const album = firstText(item.title, item.label);
    info.append(count, tTitle, tArtist);
    if (own) info.append(line('album', album), line('by', item.artist ?? ''));
    const meter = (wrap) => {
      const m = h('div', 'ipodc-meter');
      const f = h('div', 'ipodc-meter-fill');
      m.append(f);
      wrap.append(m);
      return f;
    };
    const prog = h('div', 'ipodc-np-prog');
    const fill = meter(prog);
    const times = h('div', 'ipodc-np-times');
    const tEl = h('span');
    const tRem = h('span');
    times.append(tEl, tRem);
    prog.append(times);
    const vol = h('div', 'ipodc-np-vol');
    vol.innerHTML = SPEAKER_LO;
    const vFill = meter(vol);
    vol.insertAdjacentHTML('beforeend', SPEAKER_HI);
    const deco = h('div', 'ipodc-np-deco', { 'aria-hidden': 'true' });
    deco.append(coverArt(item, 'ipodc-np-art'), coverArt(item, 'ipodc-np-refl'), info, prog, vol);
    // compact track list under the meta: tap a title to play it; the playing one carries the blue speaker
    const tlIn = h('div', 'ipodc-np-tracks-in');
    const trkRows = own ? tracks.map((t, i) => {
      const r = h('div', 'ipodc-trk', { 'data-i': i });
      r.innerHTML = SPEAKER_NOW;
      r.append(h('span', 'ipodc-trk-t', { text: t.title ?? '' }), h('span', 'ipodc-trk-d', { text: t.duration ?? '' }));
      return r;
    }) : [];
    if (trkRows.length) {
      tlIn.append(...trkRows);
      const tl = h('div', 'ipodc-np-tracks');
      tl.append(tlIn);
      deco.append(tl);
    } else node.classList.add('no-tracks');
    node.prepend(deco);
    if (!spot) node.classList.add('no-cta');
    // the drawn screen is aria-hidden: assistive tech gets the same facts as text, the playing track and
    // the track list (the current one marked). Without the Spotify row the iPod is a listbox, and this
    // block is its one option, so it is read on focus.
    const sr = h('div', 'ipodc-sr ipodc-np-sr');
    const srNow = h('p');
    const srList = h('ul', null, { 'aria-label': L.tracklist });
    const option = !s.rows.length;
    // as the listbox's option, its text is its name (and a list's aria-label would replace the titles):
    // the list is introduced by a line of text instead
    if (option) srList.removeAttribute('aria-label');
    const srRows = trkRows.map((_, i) => {
      const t = tracks[i];
      return h('li', null, { text: [t.title, t.artist, t.duration].filter(Boolean).join(', ') });
    });
    srList.append(...srRows);
    sr.append(srNow);
    if (srRows.length) sr.append(...(option ? [h('p', null, { text: `${L.tracklist}:` })] : []), srList);
    node.append(sr);
    if (option) {
      for (const [k, v] of [['id', nid('t')], ['role', 'option'], ['aria-selected', 'true']]) sr.setAttribute(k, v);
      s.adId = () => sr.id;
    }
    let trkTop = 0;
    let volT = 0;

    s.update = (instant) => {
      const t = tracks[player.track] ?? {};
      const dur = player.duration;
      tTitle.textContent = t.title ?? '';
      tArtist.textContent = t.artist ?? '';
      count.textContent = own && tracks.length ? `${player.track + 1} ${L.of} ${tracks.length}` : '';
      trkRows.forEach((r, i) => r.classList.toggle('is-cur', i === player.track));
      trkTop = clamp(trkTop, player.track - TRK_VIS + 1, player.track); // keep the playing track in view
      tlIn.style.setProperty('--ipodc-tt', trkTop);
      if (instant) node.classList.add('is-instant');
      fill.style.setProperty('--ipodc-f', clamp(player.elapsed / dur, 0, 1).toFixed(4));
      vFill.style.setProperty('--ipodc-f', player.volume);
      if (instant) { void node.offsetWidth; node.classList.remove('is-instant'); }
      tEl.textContent = fmtTime(player.elapsed);
      tRem.textContent = `-${fmtTime(dur - Math.floor(player.elapsed))}`;
      const now = [count.textContent, [t.title, t.artist].filter(Boolean).join(', ')].filter(Boolean).join(': ');
      const text = [now, own && [album, item.artist].filter(Boolean).join(', ')].filter(Boolean).join('. ');
      if (srNow.textContent !== text) srNow.textContent = text;
      srRows.forEach((r, i) => { if (i === player.track) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current'); });
    };
    s.summary = () => [tTitle.textContent, tArtist.textContent, own && album, count.textContent].filter(Boolean).join(', ');
    s.onShow = () => {
      if (!player.started) player.setPlaying(true);
      s.update(true);
    };
    const volOff = () => {
      volT = timers.cancel(volT);
      node.classList.remove('is-vol');
    };
    s.onHide = volOff;
    // the wheel sets the volume on Now Playing, like the real thing
    s.move = (d) => {
      node.classList.add('is-vol');
      timers.cancel(volT);
      volT = timers.later(volOff, 1600);
      const moved = player.nudge(d);
      if (moved) ctx.announce(`${L.volume} ${Math.round(player.volume * 100)} %`);
      return moved;
    };
    s.jump = () => false;
    s.pickTrack = (i) => {
      if (i === player.track && player.started) return player.setPlaying(!player.playing);
      player.go(i);
      player.setPlaying(true);
    };
    const baseActivate = s.activate;
    // (Enter on the playlist block: play / pause, said like the play button says it)
    s.activate = () => {
      if (s.rows.length) return baseActivate();
      player.setPlaying(!player.playing);
      ctx.announce(player.playing ? L.playing : L.paused);
    };
    s.update(true);
    return s;
  }

  return { menuScreen, buildScreen };
}
