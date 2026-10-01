// Procedural canvas textures for the intro-f iPod model. Everything is generated at runtime:
// no external images or fonts. Text uses the system sans-serif stack.
import * as THREE from 'three';
import { COLORS, IPOD } from '../../../shared/ipodSpec.js';

const FONT = 'ui-sans-serif, system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif';

/** Deterministic PRNG (mulberry32) so every page load renders the same textures. */
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(w, h, draw, { data = false, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Fine grain + directional streaks. `amp` is the brightness swing in 0..255. */
function grain(ctx, w, h, r, amp, streaks, vertical) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amp;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < streaks; i++) {
    const p = r() * (vertical ? w : h);
    const a = 0.08 + r() * 0.18;
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    if (vertical) ctx.fillRect(p, 0, 1 + r() * 1.5, h);
    else ctx.fillRect(0, p, w, 1 + r() * 1.5);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function text(ctx, str, x, y, size, color, weight = 500, align = 'center') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/* ---------- individual textures ---------- */

// Anodised aluminium: bead-blasted matte grain. Returns { map, rough }.
function aluminium(aniso) {
  const r = rng(11);
  const map = make(512, 512, (ctx, w, h) => {
    ctx.fillStyle = COLORS.aluminium;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, r, 10, 24, true);
  }, { aniso });
  const r2 = rng(12);
  const rough = make(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c4c4c4';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, r2, 50, 70, true);
  }, { data: true, aniso });
  return { map, rough };
}

// Mirror-polished stainless back shell with the engraved monogram and small text.
// Drawn mirrored in x: ExtrudeGeometry cap UVs are shape coordinates, and this cap faces -Z.
function steel(brand, aniso) {
  const r = rng(21);
  return make(640, 1072, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#e3e7ec'); g.addColorStop(0.5, '#cfd4da'); g.addColorStop(1, '#dde1e6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, r, 5, 40, false);
    ctx.save();
    ctx.translate(w, 0); ctx.scale(-1, 1);
    const ink = 'rgba(70,76,84,0.55)';
    const mono = brand?.monogram ?? '';
    text(ctx, mono, w / 2, h * 0.42, 150, 'rgba(60,66,74,0.5)', 700);
    text(ctx, mono, w / 2 + 1, h * 0.42 - 1, 150, 'rgba(255,255,255,0.35)', 700);
    const lines = [brand?.name ?? '', brand?.tagline ?? '', '160 GB  ·  Model F-1', 'Designed with care. Assembled with patience.'];
    lines.forEach((s, i) => text(ctx, s, w / 2, h * 0.80 + i * 24, i < 2 ? 18 : 15, ink, i < 2 ? 600 : 400));
    ctx.restore();
  }, { aniso });
}

// Click-wheel ring: MENU / prev / next / play-pause glyphs at wheelLabels.radiusFactor.
function wheel(aniso) {
  return make(512, 512, (ctx, w, h) => {
    const c = w / 2, R = w / 2;
    const g = ctx.createRadialGradient(c, c * 0.9, R * 0.3, c, c, R);
    g.addColorStop(0, '#eceef0'); g.addColorStop(0.75, COLORS.wheel); g.addColorStop(1, '#d6d8db');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rr = rng(31);
    grain(ctx, w, h, rr, 4, 0, true);
    const col = COLORS.wheelLabel;
    const d = R * IPOD.wheelLabels.radiusFactor;
    text(ctx, IPOD.wheelLabels.menu, c, c - d, 30, col, 700);
    ctx.fillStyle = col;
    const tri = (x, y, s, dir) => { // dir +1 → points right
      ctx.beginPath(); ctx.moveTo(x - dir * s * 0.55, y - s * 0.6); ctx.lineTo(x + dir * s * 0.55, y); ctx.lineTo(x - dir * s * 0.55, y + s * 0.6); ctx.closePath(); ctx.fill();
    };
    const bar = (x, y, s, bw) => ctx.fillRect(x - bw / 2, y - s * 0.6, bw, s * 1.2);
    const s = 17;
    // prev (left): bar + two triangles pointing left
    bar(c - d - s * 1.6, c, s, 5); tri(c - d - s * 0.5, c, s, -1); tri(c - d + s * 0.6, c, s, -1);
    // next (right): two triangles pointing right + bar
    tri(c + d - s * 0.6, c, s, 1); tri(c + d + s * 0.5, c, s, 1); bar(c + d + s * 1.6, c, s, 5);
    // play/pause (bottom)
    tri(c - s * 0.7, c + d, s, 1); bar(c + s * 0.55, c + d, s, 5); bar(c + s * 1.15, c + d, s, 5);
  }, { aniso });
}

// Green logic board: solder-mask base, lighter traces, gold pads, white silkscreen.
function pcb(aniso) {
  const r = rng(41);
  return make(512, 864, (ctx, w, h) => {
    ctx.fillStyle = COLORS.pcb;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, r, 6, 0, false);
    // traces
    ctx.lineCap = 'round';
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(120,200,150,${0.18 + r() * 0.25})`;
      ctx.lineWidth = 1.2 + r() * 1.6;
      let x = r() * w, y = r() * h;
      ctx.beginPath(); ctx.moveTo(x, y);
      const n = 2 + (r() * 4) | 0;
      for (let k = 0; k < n; k++) {
        const horiz = r() > 0.5, len = 20 + r() * 110, diag = r() > 0.6;
        if (diag) { x += len * 0.7 * (r() > 0.5 ? 1 : -1); y += len * 0.7 * (r() > 0.5 ? 1 : -1); }
        else if (horiz) x += len * (r() > 0.5 ? 1 : -1); else y += len * (r() > 0.5 ? 1 : -1);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // via / pad grids
    for (let i = 0; i < 420; i++) {
      const x = r() * w, y = r() * h, s = 2 + r() * 2.5;
      ctx.fillStyle = r() > 0.3 ? '#c9a24a' : '#e8e0c0';
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2e3a34';
      ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    // SMD pad rows
    for (let i = 0; i < 26; i++) {
      const x = 20 + r() * (w - 60), y = 20 + r() * (h - 60), n = 4 + (r() * 10) | 0, horiz = r() > 0.5;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = '#d7b35a';
        if (horiz) ctx.fillRect(x + k * 7, y, 4, 9); else ctx.fillRect(x, y + k * 7, 9, 4);
      }
    }
    // silkscreen
    ctx.strokeStyle = 'rgba(245,245,240,0.85)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 34; i++) {
      const x = 16 + r() * (w - 70), y = 16 + r() * (h - 70), bw = 14 + r() * 40, bh = 10 + r() * 30;
      ctx.strokeRect(x, y, bw, bh);
      if (r() > 0.5) text(ctx, ['C', 'R', 'U', 'J', 'L'][(r() * 5) | 0] + ((r() * 90) | 0), x + bw / 2, y - 7, 10, 'rgba(245,245,240,0.9)', 500);
    }
    ctx.strokeRect(10, 10, w - 20, h - 20);
    text(ctx, 'MLB  REV 2.1', 50, h - 24, 12, 'rgba(245,245,240,0.9)', 600, 'left');
  }, { aniso });
}

// 1.8" hard-drive top: brushed steel with a white label and a barcode.
function hdd(aniso) {
  const r = rng(51);
  return make(512, 672, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#c4c7cb'); g.addColorStop(0.5, COLORS.drive); g.addColorStop(1, '#aeb1b5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, r, 10, 220, false);
    // screw heads at corners
    for (const [x, y] of [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26], [w / 2, 26], [w / 2, h - 26]]) {
      ctx.fillStyle = '#8f9397'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a5e63'; ctx.fillRect(x - 6, y - 1.2, 12, 2.4); ctx.fillRect(x - 1.2, y - 6, 2.4, 12);
    }
    // label
    ctx.fillStyle = '#f6f6f3';
    roundRect(ctx, 60, 90, w - 120, h - 270, 8); ctx.fill();
    text(ctx, '1.8"  HARD DISK DRIVE', w / 2, 125, 24, '#2b2d30', 700);
    text(ctx, '160 GB   ·   ZIF   ·   4200 rpm', w / 2, 158, 17, '#3c3f43', 500);
    text(ctx, 'MODEL  HDD-F1618G   ·   5 V  ⎓  0.5 A', w / 2, 184, 14, '#55585c', 400);
    ctx.fillStyle = '#1f2124';
    let x = 90;
    while (x < w - 90) { const bw = 1 + r() * 4; ctx.fillRect(x, 215, bw, 70); x += bw + 1 + r() * 4; }
    text(ctx, 'S/N  F1 6K2 0Y3 8TQ', w / 2, 305, 13, '#55585c', 400);
    text(ctx, 'FABRICATED IN THE CLOUD', w / 2, 330, 12, '#777a7e', 400);
    text(ctx, '⚠  DO NOT COVER THIS HOLE', w / 2, h - 150, 12, '#55585c', 500);
    ctx.fillStyle = '#4a4d51'; ctx.beginPath(); ctx.arc(w / 2, h - 120, 5, 0, Math.PI * 2); ctx.fill();
  }, { aniso });
}

// Li-ion pouch: dark laminate with a printed label.
function battery(aniso) {
  const r = rng(61);
  return make(512, 256, (ctx, w, h) => {
    ctx.fillStyle = COLORS.battery;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, r, 8, 60, false);
    ctx.fillStyle = '#3d4046';
    roundRect(ctx, 36, 36, w - 72, h - 72, 10); ctx.fill();
    text(ctx, 'Li-ion Polymer Battery', w / 2, 70, 24, '#e8e9ea', 700);
    text(ctx, '3.7 V  ·  550 mAh  ·  2.0 Wh', w / 2, 104, 18, '#cfd1d4', 500);
    text(ctx, 'APN F1-BAT-0160   Do not puncture, heat or disassemble', w / 2, 134, 12, '#a9acb0', 400);
    ctx.strokeStyle = '#a9acb0'; ctx.lineWidth = 2;
    ctx.strokeRect(60, 158, 50, 30); ctx.fillStyle = '#a9acb0'; ctx.fillRect(110, 166, 5, 14);
    ctx.fillRect(64, 162, 42 * 0.8, 22);
    text(ctx, '♻  ⚠  CE', w - 100, 173, 20, '#cfd1d4', 600);
  }, { aniso });
}

// Chip package top (black epoxy, laser-marked).
function chip(aniso) {
  return make(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1f2124';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rng(71), 10, 0, false);
    text(ctx, 'F1', w / 2, h * 0.36, 70, '#9ea2a7', 700);
    text(ctx, 'FABLE-5100', w / 2, h * 0.62, 24, '#8a8e93', 500);
    text(ctx, '2626  KR', w / 2, h * 0.76, 20, '#6f7378', 400);
    ctx.fillStyle = '#aeb2b7'; ctx.beginPath(); ctx.arc(32, 32, 9, 0, Math.PI * 2); ctx.fill();
  }, { aniso });
}

// Kapton flex with copper traces running along its length (v axis).
function flex(aniso) {
  return make(128, 512, (ctx, w, h) => {
    ctx.fillStyle = COLORS.flex;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#dca84c' : '#b7762a';
      ctx.fillRect(14 + i * 15, 0, 5, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, w, 24); ctx.fillRect(0, h - 24, w, 24);
  }, { aniso });
}

// Soft radial contact shadow.
function shadow() {
  return make(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeTextures(aniso = 8) {
  const alu = aluminium(aniso);
  return {
    alu: alu.map, aluRough: alu.rough,
    steel: steel(null, aniso),
    wheel: wheel(aniso),
    pcb: pcb(aniso),
    hdd: hdd(aniso),
    battery: battery(aniso),
    chip: chip(aniso),
    flex: flex(aniso),
    shadow: shadow(),
  };
}

/** Re-draw the back-shell engraving once config.json has loaded (replaces the texture image). */
export function engrave(tex, brand, aniso = 8) {
  const fresh = steel(brand, aniso);
  tex.image = fresh.image;
  tex.needsUpdate = true;
  fresh.dispose();
}
