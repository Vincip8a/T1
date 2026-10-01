// Procedural canvas textures for intro C (no image files).
import * as THREE from 'three';
import { COLORS } from '../../../shared/ipodSpec.js';

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round(h);
  return [c, c.getContext('2d')];
}

/** Canvas → texture. `color` → sRGB data, otherwise linear (roughness / alpha). */
export function tex(c, { color = true, wrap = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Fit a texture onto an extrude cap whose uv == shape mm coords (w×h rect centred at 0,0). */
export function capFit(t, w, h) {
  t.repeat.set(1 / w, 1 / h);
  t.offset.set(0.5, 0.5);
  return t;
}

const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const dot = (g, x, y, r, c) => { if (c) g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };

/** Text: weight, colour, alignment, letter spacing (px). */
function text(g, s, x, y, size, weight = 600, color = '#000', align = 'left', spacing = 0) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  g.fillText(s, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

function barcode(g, x, y, w, h, r, ink = '#111') {
  g.fillStyle = ink;
  for (let cx = x; cx < x + w;) {
    const bw = 1 + Math.floor(r() * 3.5);
    if (r() > 0.42) g.fillRect(cx, y, Math.min(bw, x + w - cx), h);
    cx += bw + 1;
  }
}

/** Tiling low-contrast brushing (linear grey around `base`); `h` = streak height range px. */
export function brushed(seed, base, spread, S = 512, h = [0.5, 0.9], n = S * 3) {
  const [c, g] = canvas(S, S);
  const r = rng(seed);
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const v = Math.round(base + (r() - 0.5) * spread * 2);
    g.globalAlpha = 0.2 + r() * 0.45;
    g.fillStyle = `rgb(${v},${v},${v})`;
    const y = r() * S, len = 60 + r() * S * 0.8, x = r() * S, hh = h[0] + r() * h[1];
    g.fillRect(x, y, len, hh);
    if (x + len > S) g.fillRect(x - S, y, len, hh);
  }
  g.globalAlpha = 1;
  return c;
}

/** Contrast studio wrap (linear): [startDeg, endDeg, value(, end)] bands around the horizon,
 *  darkening towards the floor through a soft (not hard-edged) horizon. */
export function stripCanvas(bands) {
  const [c, g] = canvas(1024, 64);
  const grd = g.createLinearGradient(0, 0, 1024, 0);
  const k = (v) => `rgb(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0})`;
  for (const [a, b, v, w = v] of bands) { grd.addColorStop(a / 360 + 0.001, k(v)); grd.addColorStop(b / 360 - 0.001, k(w)); }
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 64);
  g.globalCompositeOperation = 'multiply';
  const vg = g.createLinearGradient(0, 0, 0, 64);
  [[0, '#fff'], [0.42, '#e6e6e6'], [0.46, '#303030'], [0.5, '#9a9a9a'], [0.7, '#888'], [1, '#444']]
    .forEach(([o, c]) => vg.addColorStop(o, c));
  g.fillStyle = vg; g.fillRect(0, 0, 1024, 64);
  return c;
}

/** CSS-style inset shadow inside a circle (canvas y down = model down). */
function inset(g, cx, cy, r, dy, blur, color) {
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
  g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetY = dy;
  g.beginPath(); g.rect(cx - 3 * r, cy - 3 * r, 6 * r, 6 * r); g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, 2 * Math.PI, true);
  g.fillStyle = '#000'; g.fill();
  g.restore();
}
function band(g, cx, cy, r1, color) { dot(g, cx, cy, r1, color); }

/** Click-wheel face: the DOM wheel's satin gradient, recess shading, the centre button's seam
 *  and MENU / ⏮ / ⏭ / ⏯ glyphs (hand-off match). */
export function wheelCanvas(dMm, labelFactor, cbMm) {
  const S = 1024, px = S / dMm, R = S / 2, lr = R * labelFactor, u = px;
  const [c, g] = canvas(S, S);
  g.save(); g.translate(R, S * 0.16); g.scale(1.3, 1.1);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, S);
  grd.addColorStop(0, '#f0f1f2'); grd.addColorStop(0.52, COLORS.wheel); grd.addColorStop(1, '#d9dbde');
  g.fillStyle = grd; g.fillRect(-S, -S, 3 * S, 3 * S);
  g.restore();
  inset(g, R, R, R, 0.22 * u, 0.45 * u, 'rgba(0,0,0,.12)');
  inset(g, R, R, R, -0.2 * u, 0.3 * u, 'rgba(255,255,255,.9)');
  // centre-button seam: white lower lip, dark hairline (DOM box-shadows, top layer last)
  const cb = cbMm * px;
  band(g, R, R + 0.19 * u, cb + 0.13 * u, 'rgba(255,255,255,.65)');
  band(g, R, R, cb + 0.15 * u, 'rgba(100,104,110,.5)');
  const col = COLORS.wheelLabel;
  // = DOM label (0.05em tracking), doubled ±0.04 mm to keep its weight through mip filtering
  for (const d of [-0.04, 0.04]) text(g, 'MENU', R + (0.0525 + d) * px, R - lr, 2.1 * px, 700, col, 'center', 0.105 * px);
  // ⏭ ⏮ ⏯ as the DOM's 20×9 glyphs, 2.1 mm tall, centred on the label radius
  const k = (2.1 / 9) * px;
  [['M0 0l7.2 4.5L0 9zM7.2 0l7.2 4.5L7.2 9zM15.4 0h2.4v9h-2.4z', R + lr, R], ['M20 0l-7.2 4.5L20 9zM12.8 0L5.6 4.5l7.2 4.5zM4.6 0H2.2v9h2.4z', R - lr, R],
    ['M1 0l7.4 4.5L1 9zM11.4 0h2.6v9h-2.6zM16.2 0h2.6v9h-2.6z', R, R + lr]].forEach(([d, x, y]) => {
    g.setTransform(k, 0, 0, k, x - 10 * k, y - 4.5 * k);
    g.fill(new Path2D(d));
  });
  g.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

/** Centre button: matte aluminium tone, slightly concave (shadowed top, lit bottom). */
export function centreCanvas(dMm) {
  const S = 512, u = S / dMm, R = S / 2;
  const [c, g] = canvas(S, S);
  g.fillStyle = COLORS.centerButton; g.fillRect(0, 0, S, S);
  const grd = g.createLinearGradient(0, 0, 0, S);
  [[0, 'rgba(0,0,0,.1)'], [0.4, 'rgba(0,0,0,.024)'], [0.7, 'rgba(255,255,255,.08)'], [1, 'rgba(255,255,255,.24)']].forEach(([o, k]) => grd.addColorStop(o, k));
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  inset(g, R, R, R, 0.35 * u, 0.7 * u, 'rgba(0,0,0,.14)');
  inset(g, R, R, R, -0.25 * u, 0.45 * u, 'rgba(255,255,255,.5)');
  return c;
}

/** Front-plate tone (sRGB multiplier rows, top → bottom: the DOM plate's light falloff) with the
 *  DOM's faint horizontal brushing hairlines (±5 %, balanced light/dark). */
export function faceToneCanvas(stops) {
  const [c, g] = canvas(256, 1024);
  const grd = g.createLinearGradient(0, 0, 0, 1024), r = rng(12);
  stops.forEach((v, i) => { const k = Math.round(255 * v); grd.addColorStop(i / (stops.length - 1), `rgb(${k},${k},${k})`); });
  g.fillStyle = grd; g.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = r() > 0.45 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.03)';
    g.fillRect(r() * 300 - 40, r() * 1024, 24 + r() * 160, 1);
  }
  return c;
}

/** Logic board: solder mask, orthogonal trace buses with 45° jogs, vias, pads, silkscreen. */
export function pcbCanvas(wMm, hMm, parts, holes, seed = 7) {
  const px = 12, W = wMm * px, H = hMm * px;
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  const X = (x) => (x + wMm / 2) * px, Y = (y) => (hMm / 2 - y) * px;
  g.fillStyle = COLORS.pcb;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.03})`;
    dot(g, r() * W, r() * H, 10 + r() * 50);
  }
  g.lineCap = g.lineJoin = 'round';
  // parallel buses: run, 45° jog, run
  for (let b = 0; b < 26; b++) {
    const n = 3 + Math.floor(r() * 9), pitch = 4.5 + r() * 2.5, horiz = r() > 0.5;
    const x = r() * W, y = r() * H;
    const l1 = 50 + r() * 220, jog = (r() > 0.5 ? 1 : -1) * (18 + r() * 42), l2 = 34 + r() * 190, aj = Math.abs(jog);
    g.strokeStyle = `rgba(95,180,120,${0.35 + r() * 0.25})`; g.lineWidth = 2;
    for (let k = 0; k < n; k++) {
      const o = k * pitch, P = horiz ? (a, b) => g.lineTo(x + a, y + o + b) : (a, b) => g.lineTo(x + o + b, y + a);
      g.beginPath(); P(0, 0); P(l1, 0); P(l1 + aj, jog); P(l1 + aj + l2, jog); g.stroke();
    }
  }
  for (let i = 0; i < 220; i++) { // vias
    const x = r() * W, y = r() * H;
    dot(g, x, y, 2.8, '#c9a85a');
    dot(g, x, y, 1.2, '#0f3322');
  }
  // footprints: pad rows + silkscreen outline + designator
  parts.forEach((ch) => {
    const x = X(ch.x - ch.w / 2), y = Y(ch.y + ch.h / 2), w = ch.w * px, h = ch.h * px, pad = 0.8 * px;
    g.fillStyle = '#d4af5a';
    for (let p = 0; p < w; p += 0.65 * px) { g.fillRect(x + p, y - pad, 0.35 * px, pad * 0.8); g.fillRect(x + p, y + h + pad * 0.2, 0.35 * px, pad * 0.8); }
    g.strokeStyle = 'rgba(240,240,230,0.85)'; g.lineWidth = 2;
    g.strokeRect(x - pad * 1.4, y - pad * 1.4, w + pad * 2.8, h + pad * 2.8);
    text(g, ch.ref, x - pad * 1.4, y - pad * 2.6, 1.4 * px, 500, 'rgba(240,240,230,0.9)');
  });
  holes.forEach(([mx, my]) => {
    dot(g, X(mx), Y(my), 2.2 * px, '#e1c068');
    dot(g, X(mx), Y(my), 1.2 * px, '#26292a');
  });
  text(g, '820-2263-A', X(-26), Y(-45), 1.6 * px, 500, 'rgba(240,240,230,0.85)');
  text(g, 'REV 05   94V-0', X(8), Y(-45), 1.4 * px, 500, 'rgba(240,240,230,0.75)');
  return c;
}

/** Laser-etched IC tops, one 160 px cell each (4 × 2 atlas). */
export function chipAtlas(list) {
  const S = 160, [c, g] = canvas(4 * S, 2 * S);
  const r = rng(3);
  g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 4 * S, 2 * S);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(r() * 4 * S, r() * 2 * S, 2, 2); }
  list.forEach((lines, i) => {
    const x = (i % 4) * S, y = ((i / 4) | 0) * S;
    lines.forEach((l, k) => text(g, l, x + S / 2, y + 58 + k * 24, k ? 17 : 22, 500, '#8d9095', 'center'));
    dot(g, x + 20, y + 20, 7, '#4a4c50');
  });
  return c;
}

/** Li-ion pouch: dark foil wrap with silver print and a small white spec label. */
export function batteryCanvas(wMm, hMm) {
  const px = 16, W = wMm * px, H = hMm * px;
  const [c, g] = canvas(W, H);
  const r = rng(11);
  g.fillStyle = COLORS.battery; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.03})`; g.fillRect(0, r() * H, W, 1 + r() * 3); }
  const ink = '#b8bcc2', m = 2 * px;
  text(g, 'Li-ion Polymer Battery', m, m + 1.6 * px, 1.9 * px, 700, ink);
  text(g, '3.7 V ⎓ 550 mAh   2.04 Wh', m, m + 4.2 * px, 1.4 * px, 500, ink);
  text(g, 'Do not puncture, crush or heat above 60 °C', m, m + 6.4 * px, 1.0 * px, 400, '#8a8e94');
  text(g, 'LP-616-0550  ·  Lot 26K14', m, H - m - 0.6 * px, 1.0 * px, 400, '#8a8e94');
  const lx = W - m - 16 * px, ly = m - 0.4 * px, lw = 16 * px, lh = H - 2 * m + 0.8 * px;
  rrect(g, lx, ly, lw, lh, 0.6 * px); g.fillStyle = '#e8e9eb'; g.fill();
  barcode(g, lx + 1.2 * px, ly + 1.2 * px, lw - 2.4 * px, 4.4 * px, r);
  text(g, '7 26450 1 18', lx + lw / 2, ly + 7.2 * px, 1.05 * px, 500, '#222', 'center');
  text(g, '⚠  ♻  CE', lx + lw / 2, ly + lh - 3.4 * px, 2.2 * px, 600, '#141518', 'center');
  return c;
}

/** 1.8" drive top cover: brushed steel, spindle emboss, screw holes, breather hole, label. */
export function driveCanvas(wMm, hMm) {
  const px = 12, W = wMm * px, H = hMm * px;
  const [c, g] = canvas(W, H);
  const r = rng(5);
  g.fillStyle = COLORS.drive; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1300; i++) {
    const v = 160 + Math.floor(r() * 70);
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.15 + r() * 0.25})`;
    g.fillRect(r() * W, r() * H, 40 + r() * 300, 1);
  }
  const sx = W * 0.5, sy = H * 0.3;
  const rg = g.createRadialGradient(sx, sy, 6 * px, sx, sy, 9 * px);
  rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); rg.addColorStop(0.75, 'rgba(0,0,0,0.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  dot(g, sx, sy, 9 * px, rg);
  [[3, 3], [wMm - 3, 3], [3, hMm - 3], [wMm - 3, hMm - 3], [wMm / 2, hMm * 0.3]].forEach(([x, y]) => {
    dot(g, x * px, y * px, 1.3 * px, '#5c6066');
    g.strokeStyle = '#2a2c30'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x * px - 0.6 * px, y * px); g.lineTo(x * px + 0.6 * px, y * px); g.moveTo(x * px, y * px - 0.6 * px); g.lineTo(x * px, y * px + 0.6 * px); g.stroke();
  });
  // breather hole: the tell-tale of a 1.8" drive
  text(g, '⚠ DO NOT COVER THIS HOLE', W - 3.5 * px, H * 0.405, 1.25 * px, 600, '#3a3d42', 'right');
  dot(g, W - 7 * px, H * 0.445, 0.75 * px, '#2a2c30'); dot(g, W - 7 * px, H * 0.445, 0.35 * px, '#08090a');
  const lx = 3.5 * px, ly = hMm * 0.5 * px, lw = W - 7 * px, lh = hMm * 0.44 * px;
  rrect(g, lx, ly, lw, lh, 0.8 * px); g.fillStyle = '#eef0f2'; g.fill();
  g.fillStyle = '#20242a'; g.fillRect(lx, ly, lw, 5.2 * px);
  text(g, '1.8" HARD DISK DRIVE', lx + 1.8 * px, ly + 2.6 * px, 2.2 * px, 700, '#f2f3f5');
  text(g, '160 GB', lx + lw - 1.8 * px, ly + 2.6 * px, 2.6 * px, 800, '#f2f3f5', 'right');
  ['MODEL  HD1816-ZK', 'P/N  HDA-160-LIF', '4200 RPM   5 V ⎓ 0.33 A', 'S/N  X7Q2K91M04A', 'Firmware  ZK101B']
    .forEach((s, i) => text(g, s, lx + 1.8 * px, ly + 7.6 * px + i * 2.4 * px, 1.55 * px, 500, '#25282d'));
  barcode(g, lx + 1.8 * px, ly + lh - 7.2 * px, lw * 0.55, 3.6 * px, r);
  const qx = lx + lw - 9.5 * px, qy = ly + lh - 9.8 * px, qs = 0.5 * px;
  g.fillStyle = '#111';
  for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) if (r() > 0.5 || i < 1 || j < 1) g.fillRect(qx + i * qs, qy + j * qs, qs, qs);
  text(g, 'DO NOT PRESS  ·  ESD SENSITIVE', lx + 1.8 * px, ly + lh - 1.6 * px, 1.2 * px, 600, '#5b2020');
  return c;
}

/** Back exterior: engraved monogram + small print, mirrored (viewed from behind).
 *  Returns [colourCanvas, roughnessCanvas]. */
export function backCanvases(wMm, hMm, { monogram = '', name = '', line = '' } = {}) {
  const px = 10, W = wMm * px, H = hMm * px;
  return [false, true].map((rough) => {
    const [c, g] = canvas(W, H);
    g.fillStyle = rough ? 'rgb(16,16,16)' : '#ffffff';
    g.fillRect(0, 0, W, H);
    g.save(); g.translate(Math.round(W), 0); g.scale(-1, 1);
    const ink = rough ? 'rgb(74,74,74)' : '#dcdcdc'; // frosted laser etch: rougher, ~13% darker, neutral
    if (monogram) text(g, monogram, W / 2, H * 0.38, 15 * px, 300, ink, 'center', 0.6 * px);
    if (name) text(g, name, W / 2, H * 0.76, 2.4 * px, 500, ink, 'center', 0.1 * px);
    if (line) text(g, line, W / 2, H * 0.8, 1.35 * px, 400, ink, 'center');
    text(g, 'Designed with care  ·  Assembled by hand  ·  160 GB', W / 2, H * 0.86, 1.2 * px, 400, ink, 'center');
    g.restore();
    return c;
  });
}

/** Inside of the back shell: matte steel, black insulating foil, foam pads, QC sticker. */
export function shellInnerCanvas(wMm, hMm) {
  const px = 6, W = wMm * px, H = hMm * px;
  const [c, g] = canvas(W, H);
  const r = rng(21);
  g.fillStyle = '#8d9298'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) { const v = 120 + Math.floor(r() * 60); g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(r() * W, r() * H, 20 + r() * 100, 1); }
  rrect(g, 6 * px, 8 * px, W - 12 * px, H * 0.62, 2 * px); g.fillStyle = '#1d1f22'; g.fill();
  g.fillStyle = '#3a3d42';
  [[10, 14], [W / px - 22, 14], [10, 50], [W / px - 22, 50]].forEach(([x, y]) => { rrect(g, x * px, y * px, 12 * px, 7 * px, px); g.fill(); });
  rrect(g, 8 * px, H * 0.76, 16 * px, 8 * px, 0.6 * px); g.fillStyle = '#e9e6dc'; g.fill();
  text(g, 'QC  PASS', 9 * px, H * 0.76 + 2.6 * px, 1.6 * px, 700, '#2a2c30');
  barcode(g, 9 * px, H * 0.76 + 4.4 * px, 12 * px, 2.6 * px, r);
  return c;
}

/** Display-window print: opaque black mask border, nearly clear centre (alpha, linear). */
export function glassAlphaCanvas(wMm, hMm, innerW, innerH) {
  const px = 8, W = wMm * px, H = hMm * px;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgb(46,46,46)'; // clear acrylic over the active area
  rrect(g, (W - innerW * px) / 2, (H - innerH * px) / 2, innerW * px, innerH * px, 2);
  g.fill();
  return c;
}

/** Click-wheel sensor flex: kapton ring with capacitive electrode segments. */
export function flexRingCanvas(dMm, rIn, rOut) {
  const S = 512, px = S / dMm, c0 = S / 2;
  const [c, g] = canvas(S, S);
  g.fillStyle = COLORS.flex; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2 + 0.03, a1 = ((i + 1) / 16) * Math.PI * 2 - 0.03;
    g.beginPath(); g.arc(c0, c0, (rOut - 0.8) * px, a0, a1); g.arc(c0, c0, (rIn + 0.8) * px, a1, a0, true); g.closePath();
    g.fillStyle = i % 2 ? '#d99a45' : '#cf8f3a'; g.fill();
    g.strokeStyle = 'rgba(110,55,8,0.55)'; g.lineWidth = 1.5; g.stroke();
  }
  g.strokeStyle = 'rgba(240,190,110,0.7)';
  for (const rr of [rIn + 0.35, rOut - 0.35]) { g.beginPath(); g.arc(c0, c0, rr * px, 0, 7); g.stroke(); }
  return c;
}

/** Copper-on-kapton flex traces (tiles; traces run along v). */
export function flexCanvas() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = COLORS.flex; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(120,60,10,0.5)';
  for (let i = 0; i < 12; i++) g.fillRect(5 + i * 10.5, 0, 2.5, 128);
  return c;
}

/** Soft contact shadow: a blurred rounded rect (device footprint), drawn via an offset shadow. */
export function shadowCanvas() {
  const [c, g] = canvas(256, 96);
  g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 22; g.shadowOffsetX = 1000;
  rrect(g, 38 - 1000, 30, 180, 36, 18); g.fill();
  return c;
}
