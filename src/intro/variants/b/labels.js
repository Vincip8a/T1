// Blueprint-style callouts (SVG overlay): thin leader lines + small two-line labels.
// Layout is a pure function of the projected part boxes, so it is deterministic per frame.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};

export function createLabels(defs) {
  const svg = el('svg', { 'aria-hidden': 'true' });
  svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:51;overflow:visible;display:none;'
    + 'font-family:"Lucida Grande","Helvetica Neue",Helvetica,Arial,sans-serif;filter:drop-shadow(0 1px 1.5px rgba(0,20,50,.45))';
  document.body.append(svg);

  const items = defs.map((d, i) => {
    const g = el('g', {}, svg);
    const line = el('polyline', { fill: 'none', stroke: 'rgba(236,246,255,.92)', 'stroke-width': 1, 'stroke-linejoin': 'round' }, g);
    const ring = el('circle', { r: 5, fill: 'none', stroke: 'rgba(236,246,255,.85)', 'stroke-width': 1 }, g);
    const dot = el('circle', { r: 2, fill: '#fff' }, g);
    const box = el('g', {}, g);
    const bg = el('rect', { rx: 4, fill: 'rgba(10,32,64,.62)', stroke: 'rgba(170,210,255,.55)', 'stroke-width': 0.75 }, box);
    const num = el('text', { 'font-size': 9, 'font-weight': 700, fill: 'rgba(150,200,255,.95)', 'letter-spacing': '.04em' }, box);
    num.textContent = String(i + 1).padStart(2, '0');
    const t1 = el('text', { 'font-size': 10.5, 'font-weight': 700, fill: '#fff', 'letter-spacing': '.07em' }, box);
    t1.textContent = d.title.toUpperCase();
    const t2 = el('text', { 'font-size': 9.5, fill: 'rgba(214,232,255,.88)' }, box);
    t2.textContent = d.sub;
    return { ...d, g, line, ring, dot, box, bg, num, t1, t2, w: 0, h: d.sub ? 32 : 20 };
  });

  let measured = false;
  function measure() {
    for (const it of items) {
      const w1 = it.t1.getComputedTextLength(), w2 = it.t2.getComputedTextLength(), wn = it.num.getComputedTextLength();
      it.wn = wn + 6;
      it.w = Math.ceil(Math.max(w1, w2) + it.wn + 14);
      it.num.setAttribute('x', 7); it.num.setAttribute('y', 13.5);
      it.t1.setAttribute('x', 7 + it.wn); it.t1.setAttribute('y', 13.5);
      it.t2.setAttribute('x', 7 + it.wn); it.t2.setAttribute('y', 26);
      it.bg.setAttribute('width', it.w); it.bg.setAttribute('height', it.h);
    }
    measured = items.every((it) => it.w > 20);
  }

  /**
   * entries: { [id]: { cx, cy, minX, maxX, minY, maxY } } in viewport px.
   * progress(i) → { line: 0..1, box: 0..1 } per label; global alpha 0 hides everything.
   */
  function update(entries, vw, vh, portrait, progress, alpha) {
    if (alpha <= 0.001) { svg.style.display = 'none'; return; }
    svg.style.display = 'block';
    svg.style.opacity = alpha;
    if (!measured) measure();
    const list = items.map((it, i) => ({ it, i, e: entries[it.id] })).filter((o) => o.e);
    const pad = 10;
    if (!portrait) {
      const top = Math.min(...list.map((o) => o.e.minY)), bot = Math.max(...list.map((o) => o.e.maxY));
      list.sort((a, b) => a.e.cx - b.e.cx);
      const sides = { top: [], bottom: [] };
      const midY = (top + bot) / 2;
      list.forEach((o) => sides[o.e.cy < midY ? 'top' : 'bottom'].push(o));
      const RH = 40;
      for (const [side, arr] of Object.entries(sides)) {
        const placed = [];
        for (const o of arr) { // greedy rows: no box overlaps, and no leader line crosses another box
          const ax = o.e.cx, w = o.it.w;
          const cands = [ax - w / 2, ax - 16, ax - w + 16].map((x) => Math.min(vw - pad - w, Math.max(pad, x)));
          let best = null;
          for (const strict of [true, false]) { // 2nd pass tolerates a line crossing a box
            for (let row = 0; row < 4 && !best; row++) {
              for (const x of cands) {
                const ok = placed.every((p) => {
                  if (p.row === row) return x + w + 10 <= p.x || x >= p.x + p.it.w + 10;
                  if (!strict) return true;
                  if (p.row < row) return !(ax > p.x - 6 && ax < p.x + p.it.w + 6);
                  return !(p.e.cx > x - 6 && p.e.cx < x + w + 6);
                });
                if (ok) { best = { row, x }; break; }
              }
            }
            if (best) break;
          }
          Object.assign(o, best ?? { row: 0, x: cands[0] }, { side });
          placed.push(o);
        }
        for (const o of arr) {
          o.y = side === 'top'
            ? Math.max(pad + o.row * RH, top - 26 - o.it.h - o.row * RH)
            : Math.min(vh - pad - o.it.h - o.row * RH, bot + 26 + o.row * RH);
          const ax = o.e.cx, ay = o.e.cy;
          const ly = side === 'top' ? o.y + o.it.h : o.y;
          const bx = Math.min(Math.max(ax, o.x + 14), o.x + o.it.w - 14);
          o.pts = Math.abs(bx - ax) < 0.5 ? [[ax, ay], [ax, ly]] : [[ax, ay], [ax, ly + (side === 'top' ? 14 : -14)], [bx, ly]];
        }
      }
    } else {
      list.sort((a, b) => a.e.cy - b.e.cy);
      const sides = { left: [], right: [] };
      list.forEach((o, k) => sides[k % 2 ? 'right' : 'left'].push(o));
      for (const [side, arr] of Object.entries(sides)) {
        arr.forEach((o) => {
          o.x = side === 'left' ? pad : vw - pad - o.it.w;
          o.y = Math.min(vh - pad - o.it.h, Math.max(pad, o.e.cy - o.it.h / 2));
        });
        for (let k = 1; k < arr.length; k++) arr[k].y = Math.max(arr[k].y, arr[k - 1].y + arr[k - 1].it.h + 6);
        for (let k = arr.length - 1; k >= 0; k--) {
          const lim = k === arr.length - 1 ? vh - pad - arr[k].it.h : arr[k + 1].y - arr[k].it.h - 6;
          arr[k].y = Math.min(arr[k].y, lim);
        }
        for (const o of arr) {
          const ax = o.e.cx, ay = o.e.cy;
          const lx = side === 'left' ? o.x + o.it.w : o.x;
          const ly = o.y + o.it.h / 2;
          o.pts = [[ax, ay], [lx + (side === 'left' ? 12 : -12), ly], [lx, ly]];
        }
      }
    }
    for (const o of list) {
      const { line, box } = progress(o.i);
      const it = o.it;
      it.g.style.display = line > 0 ? '' : 'none';
      let len = 0;
      for (let k = 1; k < o.pts.length; k++) len += Math.hypot(o.pts[k][0] - o.pts[k - 1][0], o.pts[k][1] - o.pts[k - 1][1]);
      it.line.setAttribute('points', o.pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '));
      it.line.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${len.toFixed(1)}`);
      it.line.setAttribute('stroke-dashoffset', (len * (1 - line)).toFixed(1));
      const [ax, ay] = o.pts[0];
      it.dot.setAttribute('cx', ax); it.dot.setAttribute('cy', ay);
      it.ring.setAttribute('cx', ax); it.ring.setAttribute('cy', ay);
      it.ring.setAttribute('r', (2 + 4 * line).toFixed(2));
      it.ring.style.opacity = line;
      it.box.setAttribute('transform', `translate(${o.x.toFixed(1)},${(o.y + (1 - box) * (o.side === 'bottom' ? -4 : 4)).toFixed(1)})`);
      it.box.style.opacity = box;
    }
  }

  return { update, dispose: () => svg.remove(), hide: () => { svg.style.display = 'none'; } };
}
