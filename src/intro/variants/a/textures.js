// Procedural canvas textures for the exploded-view iPod (no image files).
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

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** Wrap a canvas into a texture. `color` → sRGB colour data, otherwise linear (roughness/alpha/bump). */
export function tex(c, { color = true, wrap = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Map a texture onto an ExtrudeGeometry cap whose uv == shape mm coords (rect w×h centred at cx,cy). */
export function capFit(t, w, h, cx = 0, cy = 0) {
  t.repeat.set(1 / w, 1 / h);
  t.offset.set(0.5 - cx / w, 0.5 - cy / h);
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function text(g, s, x, y, size, { weight = 600, color = '#000', align = 'left', spacing = 0 } = {}) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  g.fillText(s, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

function barcode(g, x, y, w, h, r) {
  g.fillStyle = '#111';
  let cx = x;
  while (cx < x + w) {
    const bw = 1 + Math.floor(r() * 3.5);
    if (r() > 0.42) g.fillRect(cx, y, bw, h);
    cx += bw + 1;
  }
}

/** Fine horizontal brushing streaks (grey, linear). Used as roughness + bump map. */
export function brushed(seed = 3, base = 200, spread = 55) {
  const [c, g] = canvas(1024, 1024);
  const r = rng(seed);
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i++) {
    const v = Math.round(base + (r() - 0.5) * spread * 2);
    g.globalAlpha = 0.25 + r() * 0.5;
    g.fillStyle = `rgb(${v},${v},${v})`;
    const y = r() * 1024, len = 80 + r() * 700, x = r() * 1024;
    g.fillRect(x, y, len, 0.6 + r() * 1.4);
    if (x + len > 1024) g.fillRect(x - 1024, y, len, 1);
  }
  g.globalAlpha = 1;
  return c;
}

/** Click-wheel face: satin plastic with MENU / ⏮ / ⏭ / ⏯ glyphs. Covers the wheel diameter. */
export function wheelCanvas(diameterMm, labelFactor) {
  const S = 1024, px = S / diameterMm, R = S / 2, lr = R * labelFactor;
  const [c, g] = canvas(S, S);
  const grd = g.createRadialGradient(R, R * 0.8, R * 0.1, R, R, R);
  grd.addColorStop(0, '#f2f3f5');
  grd.addColorStop(1, COLORS.wheel);
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const col = COLORS.wheelLabel;
  text(g, 'MENU', R, R - lr, 2.35 * px, { weight: 700, color: col, align: 'center', spacing: 0.25 * px });
  g.fillStyle = col;
  const tri = (x, y, s, dir) => {
    g.beginPath();
    g.moveTo(x - s * dir * 0.5, y - s * 0.55);
    g.lineTo(x + s * dir * 0.5, y);
    g.lineTo(x - s * dir * 0.5, y + s * 0.55);
    g.closePath();
    g.fill();
  };
  const s = 1.75 * px, bar = 0.42 * px;
  // next ▶▶|
  let x = R + lr;
  tri(x - s * 0.62, R, s, 1); tri(x + s * 0.18, R, s, 1); g.fillRect(x + s * 0.68, R - s * 0.55, bar, s * 1.1);
  // prev |◀◀
  x = R - lr;
  tri(x + s * 0.62, R, s, -1); tri(x - s * 0.18, R, s, -1); g.fillRect(x - s * 0.68 - bar, R - s * 0.55, bar, s * 1.1);
  // play/pause ▶ ||
  x = R; const y = R + lr;
  tri(x - s * 0.55, y, s, 1);
  g.fillRect(x + s * 0.32, y - s * 0.55, bar, s * 1.1);
  g.fillRect(x + s * 0.32 + bar * 2, y - s * 0.55, bar, s * 1.1);
  return c;
}

/** Green logic board with copper traces, gold pads, vias and silkscreen. Board is wMm×hMm, centred. */
export function pcbCanvas(wMm, hMm, chips, seed = 7) {
  const px = 16, W = Math.round(wMm * px), H = Math.round(hMm * px);
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  const X = (x) => (x + wMm / 2) * px, Y = (y) => (hMm / 2 - y) * px;
  g.fillStyle = COLORS.pcb;
  g.fillRect(0, 0, W, H);
  // solder-mask mottling
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.03})`;
    g.beginPath(); g.arc(r() * W, r() * H, 10 + r() * 60, 0, 7); g.fill();
  }
  // traces: Manhattan polylines with 45° corners
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(90,170,110,${0.35 + r() * 0.3})`;
    g.lineWidth = r() > 0.85 ? 6 : 2 + r() * 1.5;
    let x = r() * W, y = r() * H;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      const len = 40 + r() * 260, dir = Math.floor(r() * 4);
      const d = 20 + r() * 30;
      if (dir === 0) { x += len; } else if (dir === 1) { y += len; } else if (dir === 2) { x += d; y += d; } else { y -= len; }
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#d6b25a';
    g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill();
    g.fillStyle = '#123d27';
    g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill();
  }
  // trace bundles
  for (let b = 0; b < 7; b++) {
    const x0 = r() * W * 0.8, y0 = r() * H, horiz = r() > 0.5, n = 6 + Math.floor(r() * 8), len = 150 + r() * 400;
    g.strokeStyle = 'rgba(100,185,120,0.55)'; g.lineWidth = 2;
    for (let k = 0; k < n; k++) {
      g.beginPath();
      if (horiz) { g.moveTo(x0, y0 + k * 7); g.lineTo(x0 + len, y0 + k * 7); g.lineTo(x0 + len + 40, y0 + k * 7 + 40); }
      else { g.moveTo(x0 + k * 7, y0); g.lineTo(x0 + k * 7, y0 + len); }
      g.stroke();
    }
  }
  // chip footprints: gold pad rows + silkscreen outline + reference designator
  chips.forEach((ch, i) => {
    const x = X(ch.x - ch.w / 2), y = Y(ch.y + ch.h / 2), w = ch.w * px, h = ch.h * px;
    g.fillStyle = '#d4af5a';
    const pad = 0.9 * px;
    for (let p = 0; p < w; p += 0.65 * px) { g.fillRect(x + p, y - pad, 0.35 * px, pad * 0.8); g.fillRect(x + p, y + h + pad * 0.2, 0.35 * px, pad * 0.8); }
    g.strokeStyle = 'rgba(240,240,230,0.85)'; g.lineWidth = 2;
    g.strokeRect(x - pad * 1.4, y - pad * 1.4, w + pad * 2.8, h + pad * 2.8);
    text(g, ch.ref ?? `U${i + 1}`, x - pad * 1.4, y - pad * 2.6, 1.5 * px, { color: 'rgba(240,240,230,0.9)', weight: 500 });
  });
  // mounting holes
  [[-25, 42], [25, 42], [-25, -42], [25, -42], [0, 3]].forEach(([mx, my]) => {
    g.fillStyle = '#e1c068'; g.beginPath(); g.arc(X(mx), Y(my), 2.2 * px, 0, 7); g.fill();
    g.fillStyle = '#2b2f2c'; g.beginPath(); g.arc(X(mx), Y(my), 1.2 * px, 0, 7); g.fill();
  });
  text(g, '820-2263-A', X(-26), Y(-45), 1.6 * px, { color: 'rgba(240,240,230,0.85)', weight: 500 });
  text(g, 'REV 05  ⓔ  94V-0', X(8), Y(-45), 1.4 * px, { color: 'rgba(240,240,230,0.75)', weight: 500 });
  return c;
}

/** Laser-etched IC top. */
export function chipCanvas(lines, seed = 2) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(r() * 256, r() * 256, 2, 2); }
  lines.forEach((l, i) => text(g, l, 128, 92 + i * 38, i ? 26 : 34, { color: '#8d9095', align: 'center', weight: 500 }));
  g.fillStyle = '#4a4c50'; g.beginPath(); g.arc(30, 30, 10, 0, 7); g.fill();
  return c;
}

/** Li-ion pouch with printed label. */
export function batteryCanvas(wMm, hMm) {
  const px = 20, W = wMm * px, H = hMm * px;
  const [c, g] = canvas(W, H);
  const r = rng(11);
  g.fillStyle = COLORS.battery; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.035})`; g.fillRect(0, r() * H, W, 1 + r() * 3); }
  const m = 2.2 * px;
  roundRect(g, m, m, W - 2 * m, H - 2 * m, 0.8 * px);
  g.fillStyle = '#c9ccd0'; g.fill();
  text(g, 'Li-ion Polymer Battery', m + 1.4 * px, m + 2.4 * px, 1.9 * px, { weight: 700, color: '#141518' });
  text(g, '3.7 V ⎓ 550 mAh  2.04 Wh', m + 1.4 * px, m + 5.0 * px, 1.5 * px, { weight: 500, color: '#2a2c30' });
  text(g, 'Rechargeable · Do not puncture, crush or heat above 60 °C', m + 1.4 * px, m + 7.2 * px, 1.05 * px, { weight: 400, color: '#3a3c40' });
  text(g, 'LP-616-0550  ·  Lot 26K14', m + 1.4 * px, m + 9.2 * px, 1.05 * px, { weight: 400, color: '#3a3c40' });
  barcode(g, W - m - 15 * px, m + 1.4 * px, 13 * px, 5 * px, r);
  text(g, '7 26450 1 18', W - m - 8.5 * px, m + 7.4 * px, 1.1 * px, { color: '#222', align: 'center', weight: 500 });
  // warning triangle + crossed bin
  const tx = W - m - 13.5 * px, ty = m + 12.5 * px, ts = 2.6 * px;
  g.strokeStyle = '#141518'; g.lineWidth = 0.22 * px;
  g.beginPath(); g.moveTo(tx, ty - ts * 0.55); g.lineTo(tx + ts * 0.6, ty + ts * 0.5); g.lineTo(tx - ts * 0.6, ty + ts * 0.5); g.closePath(); g.stroke();
  text(g, '!', tx, ty + ts * 0.08, 1.7 * px, { weight: 800, color: '#141518', align: 'center' });
  const bx = tx + 4 * px;
  g.strokeRect(bx - ts * 0.35, ty - ts * 0.4, ts * 0.7, ts * 0.9);
  g.beginPath(); g.moveTo(bx - ts * 0.6, ty - ts * 0.6); g.lineTo(bx + ts * 0.6, ty + ts * 0.65); g.moveTo(bx + ts * 0.6, ty - ts * 0.6); g.lineTo(bx - ts * 0.6, ty + ts * 0.65); g.stroke();
  return c;
}

/** 1.8" drive top cover: brushed steel, spindle emboss, screw holes, product label. */
export function driveCanvas(wMm, hMm) {
  const px = 14, W = Math.round(wMm * px), H = Math.round(hMm * px);
  const [c, g] = canvas(W, H);
  const r = rng(5);
  g.fillStyle = COLORS.drive; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1600; i++) {
    const v = 150 + Math.floor(r() * 90);
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.18 + r() * 0.3})`;
    g.fillRect(r() * W, r() * H, 40 + r() * 300, 1);
  }
  // spindle emboss + screw holes
  const sxp = W * 0.5, syp = H * 0.34;
  const rg = g.createRadialGradient(sxp, syp, 6 * px, sxp, syp, 9 * px);
  rg.addColorStop(0, 'rgba(255,255,255,0.0)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); rg.addColorStop(0.75, 'rgba(0,0,0,0.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(sxp, syp, 9 * px, 0, 7); g.fill();
  [[3, 3], [wMm - 3, 3], [3, hMm - 3], [wMm - 3, hMm - 3], [wMm / 2, hMm * 0.34]].forEach(([x, y]) => {
    g.fillStyle = '#5c6066'; g.beginPath(); g.arc(x * px, y * px, 1.3 * px, 0, 7); g.fill();
    g.strokeStyle = '#2a2c30'; g.lineWidth = 2; g.beginPath(); g.moveTo(x * px - 0.6 * px, y * px); g.lineTo(x * px + 0.6 * px, y * px); g.moveTo(x * px, y * px - 0.6 * px); g.lineTo(x * px, y * px + 0.6 * px); g.stroke();
  });
  // label
  const lx = 3.5 * px, ly = hMm * 0.52 * px, lw = W - 7 * px, lh = hMm * 0.42 * px;
  roundRect(g, lx, ly, lw, lh, 0.8 * px);
  g.fillStyle = '#eef0f2'; g.fill();
  g.fillStyle = '#20242a'; g.fillRect(lx, ly, lw, 5.2 * px);
  text(g, '1.8" HARD DISK DRIVE', lx + 1.8 * px, ly + 2.6 * px, 2.2 * px, { weight: 700, color: '#f2f3f5' });
  text(g, '160 GB', lx + lw - 1.8 * px, ly + 2.6 * px, 2.6 * px, { weight: 800, color: '#f2f3f5', align: 'right' });
  const rows = ['MODEL  HD1816-ZK', 'P/N  HDA-160-LIF', '4200 RPM   5 V ⎓ 0.33 A', 'S/N  X7Q2K91M04A', 'Firmware  ZK101B'];
  rows.forEach((s, i) => text(g, s, lx + 1.8 * px, ly + 7.6 * px + i * 2.4 * px, 1.55 * px, { weight: 500, color: '#25282d' }));
  barcode(g, lx + 1.8 * px, ly + lh - 7.2 * px, lw * 0.55, 3.6 * px, r);
  // 2D code
  const qx = lx + lw - 9.5 * px, qy = ly + lh - 9.8 * px, qs = 0.5 * px;
  for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) if (r() > 0.5 || i < 1 || j < 1) { g.fillStyle = '#111'; g.fillRect(qx + i * qs, qy + j * qs, qs, qs); }
  text(g, 'DO NOT PRESS  ·  ESD SENSITIVE', lx + 1.8 * px, ly + lh - 1.6 * px, 1.2 * px, { weight: 600, color: '#5b2020' });
  return c;
}

/** Back shell exterior: engraved monogram + small text. Mirrored (the back is viewed from behind).
 *  Returns [colourCanvas, roughnessCanvas]. */
export function backCanvases(wMm, hMm, { monogram = '', name = '', line = '' } = {}) {
  const px = 12, W = Math.round(wMm * px), H = Math.round(hMm * px);
  const out = [];
  for (const rough of [false, true]) {
    const [c, g] = canvas(W, H);
    g.fillStyle = rough ? 'rgb(28,28,28)' : '#ffffff';
    g.fillRect(0, 0, W, H);
    g.save(); g.translate(W, 0); g.scale(-1, 1);
    const ink = rough ? 'rgb(255,255,255)' : '#aeb2b8';
    if (monogram) {
      text(g, monogram, W / 2, H * 0.4, 16 * px, { weight: 300, color: ink, align: 'center', spacing: 0.6 * px });
    }
    if (name) text(g, name, W / 2, H * 0.78, 2.4 * px, { weight: 500, color: ink, align: 'center', spacing: 0.1 * px });
    if (line) text(g, line, W / 2, H * 0.82, 1.35 * px, { weight: 400, color: ink, align: 'center' });
    text(g, '160 GB', W / 2, H * 0.86, 1.35 * px, { weight: 400, color: ink, align: 'center' });
    g.restore();
    out.push(c);
  }
  return out;
}

/** Inside of the back shell: matte steel with black foil and a QC sticker. */
export function shellInnerCanvas(wMm, hMm) {
  const px = 8, W = Math.round(wMm * px), H = Math.round(hMm * px);
  const [c, g] = canvas(W, H);
  const r = rng(21);
  g.fillStyle = '#8d9298'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) { const v = 120 + Math.floor(r() * 60); g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(r() * W, r() * H, 20 + r() * 120, 1); }
  roundRect(g, 6 * px, 8 * px, W - 12 * px, H * 0.62, 2 * px);
  g.fillStyle = '#1d1f22'; g.fill();
  roundRect(g, 8 * px, H * 0.76, 16 * px, 8 * px, 0.6 * px);
  g.fillStyle = '#e9e6dc'; g.fill();
  text(g, 'QC  PASS', 9 * px, H * 0.76 + 2.6 * px, 1.6 * px, { weight: 700, color: '#2a2c30' });
  barcode(g, 9 * px, H * 0.76 + 4.4 * px, 12 * px, 2.6 * px, r);
  return c;
}

/** Display window print: opaque black border, tinted clear centre (alpha map, linear). */
export function glassAlphaCanvas(wMm, hMm, innerW, innerH) {
  const px = 10, W = Math.round(wMm * px), H = Math.round(hMm * px);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgb(70,70,70)';
  g.fillRect((W - innerW * px) / 2, (H - innerH * px) / 2, innerW * px, innerH * px);
  return c;
}

/** Copper-on-kapton flex traces (colour). */
export function flexCanvas() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = COLORS.flex; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,60,10,0.55)'; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(20 + i * 18, 0); g.lineTo(20 + i * 18, 256); g.stroke(); }
  return c;
}
