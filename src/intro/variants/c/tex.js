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

export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

export function text(g, s, x, y, size, { weight = 600, color = '#000', align = 'left', spacing = 0 } = {}) {
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

/** Contrast studio wrap (linear): [startDeg, endDeg, value] bands around the horizon,
 *  optionally ramping to w, darkening towards the floor. */
export function stripCanvas(bands) {
  const [c, g] = canvas(1024, 64);
  const grd = g.createLinearGradient(0, 0, 1024, 0);
  const k = (v) => `rgb(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0})`;
  for (const [a, b, v, w = v] of bands) { grd.addColorStop(a / 360 + 0.001, k(v)); grd.addColorStop(b / 360 - 0.001, k(w)); }
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 64);
  g.globalCompositeOperation = 'multiply';
  const vg = g.createLinearGradient(0, 0, 0, 64);
  // dark horizon just above eye level: a band across the pitched polished back
  [[0, '#fff'], [0.43, '#eee'], [0.445, '#161616'], [0.475, '#161616'], [0.49, '#aaa'], [0.7, '#888'], [1, '#444']]
    .forEach(([o, c]) => vg.addColorStop(o, c));
  g.fillStyle = vg; g.fillRect(0, 0, 1024, 64);
  return c;
}

/** Click-wheel face: satin plastic with MENU / ⏮ / ⏭ / ⏯ glyphs. */
export function wheelCanvas(dMm, labelFactor) {
  const S = 1024, px = S / dMm, R = S / 2, lr = R * labelFactor;
  const [c, g] = canvas(S, S);
  const grd = g.createRadialGradient(R, R * 0.7, R * 0.1, R, R, R);
  grd.addColorStop(0, '#f3f4f6');
  grd.addColorStop(1, COLORS.wheel);
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const col = COLORS.wheelLabel;
  text(g, 'MENU', R, R - lr, 2.35 * px, { weight: 700, color: col, align: 'center', spacing: 0.25 * px });
  g.fillStyle = col;
  const tri = (x, y, s, d) => {
    g.beginPath();
    g.moveTo(x - s * d * 0.5, y - s * 0.55); g.lineTo(x + s * d * 0.5, y); g.lineTo(x - s * d * 0.5, y + s * 0.55);
    g.closePath(); g.fill();
  };
  const s = 1.75 * px, bar = 0.42 * px;
  let x = R + lr;
  tri(x - s * 0.62, R, s, 1); tri(x + s * 0.18, R, s, 1); g.fillRect(x + s * 0.68, R - s * 0.55, bar, s * 1.1);
  x = R - lr;
  tri(x + s * 0.62, R, s, -1); tri(x - s * 0.18, R, s, -1); g.fillRect(x - s * 0.68 - bar, R - s * 0.55, bar, s * 1.1);
  const y = R + lr;
  tri(R - s * 0.55, y, s, 1);
  g.fillRect(R + s * 0.32, y - s * 0.55, bar, s * 1.1);
  g.fillRect(R + s * 0.32 + bar * 2, y - s * 0.55, bar, s * 1.1);
  return c;
}

/** Logic board: solder mask, orthogonal trace buses with 45° jogs, vias, pads, silkscreen. */
export function pcbCanvas(wMm, hMm, parts, holes, seed = 7) {
  const px = 14, W = wMm * px, H = hMm * px;
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  const X = (x) => (x + wMm / 2) * px, Y = (y) => (hMm / 2 - y) * px;
  g.fillStyle = COLORS.pcb;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.03})`;
    g.beginPath(); g.arc(r() * W, r() * H, 10 + r() * 50, 0, 7); g.fill();
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  // parallel buses: run, 45° jog, run
  for (let b = 0; b < 26; b++) {
    const n = 3 + Math.floor(r() * 9), pitch = 5 + r() * 3, horiz = r() > 0.5;
    let x = r() * W, y = r() * H;
    const l1 = 60 + r() * 260, jog = (r() > 0.5 ? 1 : -1) * (20 + r() * 50), l2 = 40 + r() * 220;
    g.strokeStyle = `rgba(95,180,120,${0.35 + r() * 0.25})`; g.lineWidth = 2;
    for (let k = 0; k < n; k++) {
      const o = k * pitch;
      g.beginPath();
      if (horiz) { g.moveTo(x, y + o); g.lineTo(x + l1, y + o); g.lineTo(x + l1 + Math.abs(jog), y + o + jog); g.lineTo(x + l1 + Math.abs(jog) + l2, y + o + jog); }
      else { g.moveTo(x + o, y); g.lineTo(x + o, y + l1); g.lineTo(x + o + jog, y + l1 + Math.abs(jog)); g.lineTo(x + o + jog, y + l1 + Math.abs(jog) + l2); }
      g.stroke();
    }
  }
  // vias
  for (let i = 0; i < 220; i++) {
    const x = r() * W, y = r() * H;
    g.fillStyle = '#c9a85a'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
    g.fillStyle = '#0f3322'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill();
  }
  // footprints: pad rows + silkscreen outline + designator
  parts.forEach((ch) => {
    const x = X(ch.x - ch.w / 2), y = Y(ch.y + ch.h / 2), w = ch.w * px, h = ch.h * px, pad = 0.8 * px;
    g.fillStyle = '#d4af5a';
    for (let p = 0; p < w; p += 0.65 * px) { g.fillRect(x + p, y - pad, 0.35 * px, pad * 0.8); g.fillRect(x + p, y + h + pad * 0.2, 0.35 * px, pad * 0.8); }
    g.strokeStyle = 'rgba(240,240,230,0.85)'; g.lineWidth = 2;
    g.strokeRect(x - pad * 1.4, y - pad * 1.4, w + pad * 2.8, h + pad * 2.8);
    text(g, ch.ref, x - pad * 1.4, y - pad * 2.6, 1.4 * px, { color: 'rgba(240,240,230,0.9)', weight: 500 });
  });
  holes.forEach(([mx, my]) => {
    g.fillStyle = '#e1c068'; g.beginPath(); g.arc(X(mx), Y(my), 2.2 * px, 0, 7); g.fill();
    g.fillStyle = '#26292a'; g.beginPath(); g.arc(X(mx), Y(my), 1.2 * px, 0, 7); g.fill();
  });
  text(g, '820-2263-A', X(-26), Y(-45), 1.6 * px, { color: 'rgba(240,240,230,0.85)', weight: 500 });
  text(g, 'REV 05   94V-0', X(8), Y(-45), 1.4 * px, { color: 'rgba(240,240,230,0.75)', weight: 500 });
  return c;
}

/** Laser-etched IC top. */
export function chipCanvas(lines, seed) {
  const [c, g] = canvas(192, 192);
  const r = rng(seed);
  g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 192, 192);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(r() * 192, r() * 192, 2, 2); }
  lines.forEach((l, i) => text(g, l, 96, 70 + i * 28, i ? 20 : 26, { color: '#8d9095', align: 'center', weight: 500 }));
  g.fillStyle = '#4a4c50'; g.beginPath(); g.arc(22, 22, 8, 0, 7); g.fill();
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
  text(g, 'Li-ion Polymer Battery', m, m + 1.6 * px, 1.9 * px, { weight: 700, color: ink });
  text(g, '3.7 V ⎓ 550 mAh   2.04 Wh', m, m + 4.2 * px, 1.4 * px, { weight: 500, color: ink });
  text(g, 'Do not puncture, crush or heat above 60 °C', m, m + 6.4 * px, 1.0 * px, { weight: 400, color: '#8a8e94' });
  text(g, 'LP-616-0550  ·  Lot 26K14', m, H - m - 0.6 * px, 1.0 * px, { weight: 400, color: '#8a8e94' });
  const lx = W - m - 16 * px, ly = m - 0.4 * px, lw = 16 * px, lh = H - 2 * m + 0.8 * px;
  roundRect(g, lx, ly, lw, lh, 0.6 * px); g.fillStyle = '#e8e9eb'; g.fill();
  barcode(g, lx + 1.2 * px, ly + 1.2 * px, lw - 2.4 * px, 4.4 * px, r);
  text(g, '7 26450 1 18', lx + lw / 2, ly + 7.2 * px, 1.05 * px, { color: '#222', align: 'center', weight: 500 });
  const tx = lx + 3.6 * px, ty = ly + lh - 4 * px, ts = 2.6 * px;
  g.strokeStyle = '#141518'; g.lineWidth = 0.22 * px;
  g.beginPath(); g.moveTo(tx, ty - ts * 0.55); g.lineTo(tx + ts * 0.6, ty + ts * 0.5); g.lineTo(tx - ts * 0.6, ty + ts * 0.5); g.closePath(); g.stroke();
  text(g, '!', tx, ty + ts * 0.08, 1.6 * px, { weight: 800, color: '#141518', align: 'center' });
  const bx = tx + 5 * px;
  g.strokeRect(bx - ts * 0.35, ty - ts * 0.4, ts * 0.7, ts * 0.9);
  g.beginPath(); g.moveTo(bx - ts * 0.6, ty - ts * 0.6); g.lineTo(bx + ts * 0.6, ty + ts * 0.65); g.moveTo(bx + ts * 0.6, ty - ts * 0.6); g.lineTo(bx - ts * 0.6, ty + ts * 0.65); g.stroke();
  text(g, 'CE', bx + 4.4 * px, ty, 1.7 * px, { weight: 500, color: '#141518', align: 'center' });
  return c;
}

/** 1.8" drive top cover: brushed steel, spindle emboss, screw holes, product label. */
export function driveCanvas(wMm, hMm) {
  const px = 13, W = wMm * px, H = hMm * px;
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
  g.fillStyle = rg; g.beginPath(); g.arc(sx, sy, 9 * px, 0, 7); g.fill();
  [[3, 3], [wMm - 3, 3], [3, hMm - 3], [wMm - 3, hMm - 3], [wMm / 2, hMm * 0.3]].forEach(([x, y]) => {
    g.fillStyle = '#5c6066'; g.beginPath(); g.arc(x * px, y * px, 1.3 * px, 0, 7); g.fill();
    g.strokeStyle = '#2a2c30'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x * px - 0.6 * px, y * px); g.lineTo(x * px + 0.6 * px, y * px); g.moveTo(x * px, y * px - 0.6 * px); g.lineTo(x * px, y * px + 0.6 * px); g.stroke();
  });
  const lx = 3.5 * px, ly = hMm * 0.5 * px, lw = W - 7 * px, lh = hMm * 0.44 * px;
  roundRect(g, lx, ly, lw, lh, 0.8 * px); g.fillStyle = '#eef0f2'; g.fill();
  g.fillStyle = '#20242a'; g.fillRect(lx, ly, lw, 5.2 * px);
  text(g, '1.8" HARD DISK DRIVE', lx + 1.8 * px, ly + 2.6 * px, 2.2 * px, { weight: 700, color: '#f2f3f5' });
  text(g, '160 GB', lx + lw - 1.8 * px, ly + 2.6 * px, 2.6 * px, { weight: 800, color: '#f2f3f5', align: 'right' });
  ['MODEL  HD1816-ZK', 'P/N  HDA-160-LIF', '4200 RPM   5 V ⎓ 0.33 A', 'S/N  X7Q2K91M04A', 'Firmware  ZK101B']
    .forEach((s, i) => text(g, s, lx + 1.8 * px, ly + 7.6 * px + i * 2.4 * px, 1.55 * px, { weight: 500, color: '#25282d' }));
  barcode(g, lx + 1.8 * px, ly + lh - 7.2 * px, lw * 0.55, 3.6 * px, r);
  const qx = lx + lw - 9.5 * px, qy = ly + lh - 9.8 * px, qs = 0.5 * px;
  for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) if (r() > 0.5 || i < 1 || j < 1) { g.fillStyle = '#111'; g.fillRect(qx + i * qs, qy + j * qs, qs, qs); }
  text(g, 'DO NOT PRESS  ·  ESD SENSITIVE', lx + 1.8 * px, ly + lh - 1.6 * px, 1.2 * px, { weight: 600, color: '#5b2020' });
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
    if (monogram) text(g, monogram, W / 2, H * 0.38, 15 * px, { weight: 300, color: ink, align: 'center', spacing: 0.6 * px });
    if (name) text(g, name, W / 2, H * 0.76, 2.4 * px, { weight: 500, color: ink, align: 'center', spacing: 0.1 * px });
    if (line) text(g, line, W / 2, H * 0.8, 1.35 * px, { weight: 400, color: ink, align: 'center' });
    text(g, 'Designed with care  ·  Assembled by hand  ·  160 GB', W / 2, H * 0.86, 1.2 * px, { weight: 400, color: ink, align: 'center' });
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
  roundRect(g, 6 * px, 8 * px, W - 12 * px, H * 0.62, 2 * px); g.fillStyle = '#1d1f22'; g.fill();
  g.fillStyle = '#3a3d42';
  [[10, 14], [W / px - 22, 14], [10, 50], [W / px - 22, 50]].forEach(([x, y]) => { roundRect(g, x * px, y * px, 12 * px, 7 * px, px); g.fill(); });
  roundRect(g, 8 * px, H * 0.76, 16 * px, 8 * px, 0.6 * px); g.fillStyle = '#e9e6dc'; g.fill();
  text(g, 'QC  PASS', 9 * px, H * 0.76 + 2.6 * px, 1.6 * px, { weight: 700, color: '#2a2c30' });
  barcode(g, 9 * px, H * 0.76 + 4.4 * px, 12 * px, 2.6 * px, r);
  return c;
}

/** Display-window print: opaque black mask border, nearly clear centre (alpha, linear). */
export function glassAlphaCanvas(wMm, hMm, innerW, innerH) {
  const px = 8, W = wMm * px, H = hMm * px;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgb(46,46,46)'; // clear acrylic over the active area
  roundRect(g, (W - innerW * px) / 2, (H - innerH * px) / 2, innerW * px, innerH * px, 2);
  g.fill();
  return c;
}

/** Click-wheel sensor flex: kapton ring with capacitive electrode segments. */
export function flexRingCanvas(dMm, rIn, rOut) {
  const S = 512, px = S / dMm, c0 = S / 2;
  const [c, g] = canvas(S, S);
  g.fillStyle = COLORS.flex; g.fillRect(0, 0, S, S);
  const seg = 16;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2 + 0.03, a1 = ((i + 1) / seg) * Math.PI * 2 - 0.03;
    g.beginPath(); g.arc(c0, c0, (rOut - 0.8) * px, a0, a1); g.arc(c0, c0, (rIn + 0.8) * px, a1, a0, true); g.closePath();
    g.fillStyle = i % 2 ? '#d99a45' : '#cf8f3a'; g.fill();
    g.strokeStyle = 'rgba(110,55,8,0.55)'; g.lineWidth = 1.5; g.stroke();
  }
  g.strokeStyle = 'rgba(240,190,110,0.7)'; g.lineWidth = 1.5;
  for (const rr of [rIn + 0.35, rOut - 0.35]) { g.beginPath(); g.arc(c0, c0, rr * px, 0, 7); g.stroke(); }
  return c;
}

/** Copper-on-kapton flex traces (tiles). */
export function flexCanvas() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = COLORS.flex; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(120,60,10,0.55)'; g.lineWidth = 2;
  for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(6 + i * 10.5, 0); g.lineTo(6 + i * 10.5, 128); g.stroke(); }
  return c;
}
