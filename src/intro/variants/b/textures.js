// Procedural canvas textures for the teardown iPod (no external image files).
import * as THREE from 'three';
import { COLORS } from '../../../shared/ipodSpec.js';

const FONT = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';

/** Deterministic PRNG (mulberry32), so every texture is identical on every load. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gray = (v) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function text(g, str, x, y, size, { weight = 400, color = '#000', align = 'center', spacing = 0 } = {}) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  g.fillText(str, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

function barcode(g, x, y, w, h, seed) {
  const r = rng(seed);
  let cx = x;
  g.fillStyle = '#111';
  while (cx < x + w) {
    const bw = 1 + Math.floor(r() * 3.2);
    if (r() > 0.42) g.fillRect(cx, y, bw, h);
    cx += bw + 1;
  }
}

/** Brushed-metal roughness/bump map: fine horizontal streaks (linear data). */
export function brushedTex(seed = 1, base = 0.42, amp = 0.16) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = gray(base); g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3200; i++) {
    g.globalAlpha = 0.12 + r() * 0.4;
    g.fillStyle = gray(base + (r() - 0.5) * amp * 2);
    g.fillRect(r() * 700 - 200, r() * 512, 80 + r() * 520, r() < 0.85 ? 1 : 2);
  }
  g.globalAlpha = 1;
  const t = toTex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Click-wheel face: MENU / ⏮ / ⏭ / ⏯ printed in grey, canvas covers the wheel's bounding square. */
export function wheelTex() {
  const S = 1024, m = S / 2, rr = 0.72 * m;
  const [c, g] = canvas(S, S);
  const grd = g.createRadialGradient(m, m * 0.85, m * 0.1, m, m, m);
  grd.addColorStop(0, '#eeeff1'); grd.addColorStop(1, COLORS.wheel);
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const col = '#8c9095'; // COLORS.wheelLabel, a touch darker to survive tone mapping
  text(g, 'MENU', m, m - rr, 66, { weight: 700, color: col, spacing: 3 });
  g.fillStyle = col;
  const tri = (x, y, s, dir) => { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + dir * s * 1.25, y); g.lineTo(x, y + s); g.closePath(); g.fill(); };
  const s = 22;
  // next ▶▶|
  tri(m + rr - 44, m, s, 1); tri(m + rr - 16, m, s, 1); g.fillRect(m + rr + 12, m - s, 8, s * 2);
  // prev |◀◀
  tri(m - rr + 44, m, s, -1); tri(m - rr + 16, m, s, -1); g.fillRect(m - rr - 20, m - s, 8, s * 2);
  // play/pause ▶❚❚
  tri(m - 34, m + rr, s, 1); g.fillRect(m + 8, m + rr - s, 9, s * 2); g.fillRect(m + 24, m + rr - s, 9, s * 2);
  return toTex(c);
}

/** Polished back: engraved monogram + small print. Returns colour + roughness maps (10 px / mm). */
export function backTex(monogram = '', name = '') {
  const draw = (g, bg, ink) => {
    g.fillStyle = bg; g.fillRect(0, 0, 618, 1035);
    if (monogram) text(g, monogram, 309, 330, 150, { weight: 600, color: ink, spacing: 4 });
    text(g, 'classic', 309, 450, 34, { weight: 300, color: ink, spacing: 6 });
    text(g, name ? `Designed by ${name}` : 'Designed with care', 309, 812, 21, { color: ink });
    text(g, 'Model No. DN-160 · 160 GB · Assembled by hand', 309, 842, 17, { color: ink });
    text(g, 'Serial No. 2026-1001-0417', 309, 868, 15, { color: ink });
  };
  const [c1, g1] = canvas(618, 1035);
  draw(g1, '#ffffff', '#c9ced4');
  const [c2, g2] = canvas(618, 1035);
  draw(g2, gray(0.09), gray(0.55));
  return { map: toTex(c1), rough: toTex(c2, false), redraw(mono, nm) { monogram = mono; name = nm; draw(g1, '#ffffff', '#c9ced4'); draw(g2, gray(0.09), gray(0.55)); this.map.needsUpdate = true; this.rough.needsUpdate = true; } };
}

/** Logic board: green solder mask, copper traces, gold pads, vias, silkscreen (10 px / mm). */
export function pcbTex(w, h, holes = []) {
  const k = 10, W = Math.round(w * k), H = Math.round(h * k);
  const [c, g] = canvas(W, H);
  const r = rng(7);
  g.fillStyle = COLORS.pcb; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * W, r() * H, 6 + r() * 30, 6 + r() * 30); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 170; i++) {
    let x = Math.round(r() * W / 8) * 8, y = Math.round(r() * H / 8) * 8;
    g.strokeStyle = r() < 0.75 ? 'rgba(63,140,92,.85)' : 'rgba(84,160,110,.9)';
    g.lineWidth = r() < 0.8 ? 2 : 4;
    g.beginPath(); g.moveTo(x, y);
    let dir = Math.floor(r() * 8);
    for (let j = 0; j < 3 + r() * 4; j++) {
      const len = 20 + r() * 130, a = dir * Math.PI / 4;
      x += Math.cos(a) * len; y += Math.sin(a) * len;
      g.lineTo(x, y);
      dir = (dir + (r() < 0.5 ? 1 : 7)) % 8;
    }
    g.stroke();
    g.fillStyle = '#d6b052'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
  }
  for (let i = 0; i < 260; i++) { // vias
    const x = r() * W, y = r() * H;
    g.fillStyle = '#c9a548'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
    g.fillStyle = '#0e2a1c'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill();
  }
  // pad rows (passives / fine-pitch footprints)
  g.fillStyle = '#d9b456';
  for (let i = 0; i < 70; i++) {
    const x = r() * (W - 60), y = r() * (H - 60), n = 4 + Math.floor(r() * 10), horiz = r() < 0.5;
    for (let j = 0; j < n; j++) horiz ? g.fillRect(x + j * 7, y, 4, 10) : g.fillRect(x, y + j * 7, 10, 4);
  }
  // silkscreen
  g.strokeStyle = 'rgba(235,240,232,.75)'; g.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) g.strokeRect(r() * (W - 80), r() * (H - 60), 20 + r() * 70, 14 + r() * 50);
  const labels = ['C214', 'R12', 'U3', 'L7', 'Q2', 'J1', 'TP9', 'U18', 'C77', 'FB4'];
  for (let i = 0; i < 22; i++) text(g, labels[i % labels.length], r() * W, r() * H, 13, { color: 'rgba(235,240,232,.8)' });
  text(g, 'DN-LB 820-2026-A', W * 0.3, H * 0.93, 22, { weight: 700, color: 'rgba(240,244,236,.9)' });
  // screw pads (gold rings)
  for (const [u, v] of holes) {
    g.fillStyle = '#d8b55a'; g.beginPath(); g.arc(u * W, (1 - v) * H, 26, 0, 7); g.fill();
    g.fillStyle = '#1a3a28'; g.beginPath(); g.arc(u * W, (1 - v) * H, 12, 0, 7); g.fill();
  }
  return toTex(c);
}

export function chipTex(lines = ['DN8720', 'A1 2026', '338S0420']) {
  const [c, g] = canvas(256, 256);
  const grd = g.createLinearGradient(0, 0, 256, 256);
  grd.addColorStop(0, '#26282c'); grd.addColorStop(1, '#141517');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  lines.forEach((l, i) => text(g, l, 128, 92 + i * 40, 30, { weight: 500, color: '#8e9298', spacing: 1 }));
  g.fillStyle = '#5a5d62'; g.beginPath(); g.arc(34, 34, 10, 0, 7); g.fill();
  return toTex(c);
}

function warnTri(g, x, y, s) {
  g.strokeStyle = '#e8e9eb'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.8); g.lineTo(x - s, y + s * 0.8); g.closePath(); g.stroke();
  g.fillStyle = '#e8e9eb'; g.fillRect(x - 2, y - s * 0.4, 4, s * 0.7); g.fillRect(x - 2, y + s * 0.42, 4, 4);
}

export function batteryTex() {
  const [c, g] = canvas(640, 400);
  g.fillStyle = '#2b2d31'; g.fillRect(0, 0, 640, 400);
  g.fillStyle = '#34373c'; g.fillRect(0, 0, 640, 70);
  text(g, 'Li-ion Polymer Battery', 32, 36, 32, { weight: 700, color: '#eef0f2', align: 'left' });
  text(g, '3.7 V  ⎓  550 mAh  ·  2.0 Wh', 32, 110, 26, { color: '#d9dbde', align: 'left' });
  text(g, 'Model DN-616-0337  ·  Rechargeable', 32, 148, 20, { color: '#b5b8bc', align: 'left' });
  ['Do not puncture, crush, disassemble or heat above 60 °C.', 'Risk of fire and burns. Dispose of properly.', 'Use only with the specified device.']
    .forEach((l, i) => text(g, l, 32, 210 + i * 26, 17, { color: '#9da1a6', align: 'left' }));
  warnTri(g, 560, 128, 30);
  // crossed-out bin
  g.strokeStyle = '#e8e9eb'; g.lineWidth = 3;
  g.strokeRect(520, 230, 40, 50); g.beginPath(); g.moveTo(512, 224); g.lineTo(568, 224); g.moveTo(506, 214); g.lineTo(574, 296); g.moveTo(574, 214); g.lineTo(506, 296); g.stroke();
  g.fillStyle = '#e9eaec'; g.fillRect(32, 300, 300, 72);
  barcode(g, 44, 308, 276, 44, 11);
  text(g, '+', 600, 360, 34, { weight: 700, color: '#e04040' });
  return toTex(c);
}

export function driveTex() {
  const [c, g] = canvas(600, 520);
  g.fillStyle = '#e6e7e9'; g.fillRect(0, 0, 600, 520);
  g.fillStyle = '#2a2e35'; g.fillRect(0, 0, 600, 88);
  text(g, '1.8" HARD DISK DRIVE', 300, 46, 34, { weight: 700, color: '#f2f3f5', spacing: 2 });
  text(g, '160 GB', 40, 160, 72, { weight: 700, color: '#1d2026', align: 'left' });
  text(g, '4200 RPM · ZIF · 8 MB', 44, 222, 24, { color: '#3b3f46', align: 'left' });
  ['MODEL  DN-HDD18-160', 'DC +3.3 V  0.5 A', 'S/N  2026-00-0417', 'Handle with care – shock sensitive']
    .forEach((l, i) => text(g, l, 44, 280 + i * 30, 20, { color: '#4b5058', align: 'left' }));
  barcode(g, 44, 410, 330, 70, 23);
  g.strokeStyle = '#3b3f46'; g.lineWidth = 4; g.beginPath(); g.arc(490, 440, 46, 0, 7); g.stroke();
  text(g, 'DN', 490, 442, 34, { weight: 700, color: '#3b3f46' });
  g.fillStyle = '#c33b33'; g.fillRect(420, 140, 140, 10);
  return toTex(c);
}

export function flexTex() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#b8731f'; g.fillRect(0, 0, 256, 256);
  const r = rng(5);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,40,0' : '240,190,110'},${r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 10 + r() * 30, 10 + r() * 30); }
  g.strokeStyle = 'rgba(236,182,98,.55)'; g.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(98 + i * 3.4, 0); g.lineTo(98 + i * 3.4, 72); g.stroke(); }
  for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(128, 128, 54 + i * 6, 0, Math.PI * 2); g.stroke(); }
  return toTex(c);
}

export function screwTex() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(28, 26, 4, 32, 32, 34);
  grd.addColorStop(0, '#f2f4f6'); grd.addColorStop(1, '#9ca1a7');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2f3236'; g.fillRect(29, 12, 6, 40); g.fillRect(12, 29, 40, 6);
  return toTex(c);
}
