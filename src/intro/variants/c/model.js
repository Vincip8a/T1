// Procedural silver iPod Classic (6th/7th gen) split into its real exploded-view parts.
// Model space: mm, origin at the centre of the front face, x → right, y → up,
// front face at z = 0, back at z = -IPOD.depth.
import * as THREE from 'three';
import { toCreasedNormals, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { IPOD, PARTS, COLORS } from '../../../shared/ipodSpec.js';
import * as T from './tex.js';

const PI = Math.PI;
const W = IPOD.width, H = IPOD.height;
const SX = (x) => x - W / 2;
const SY = (y) => H / 2 - y;
/** Front-plate edge bevel: the full W×H outline is reached at z = -FACE_BEVEL. */
export const FACE_BEVEL = 0.25;
const SEG = 16; // per corner arc (visible outlines); small parts use 4–6

function rrPath(p, w, h, r, cx = 0, cy = 0) {
  r = Math.max(0.05, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0); p.absarc(x1 - r, y0 + r, r, -PI / 2, 0, false);
  p.lineTo(x1, y1 - r); p.absarc(x1 - r, y1 - r, r, 0, PI / 2, false);
  p.lineTo(x0 + r, y1); p.absarc(x0 + r, y1 - r, r, PI / 2, PI, false);
  p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, PI, 1.5 * PI, false);
  return p;
}
/** Rounded rect whose bevelled (widest) outline is w×h. Holes grow by b so their wall is w×h. */
const rr = (w, h, r, b = 0, cx = 0, cy = 0) => rrPath(new THREE.Shape(), w - 2 * b, h - 2 * b, r - b, cx, cy);
const rrHole = (w, h, r, b = 0, cx = 0, cy = 0) => rrPath(new THREE.Path(), w + 2 * b, h + 2 * b, r + b, cx, cy);
/** Circle as an n-gon (no arc joints; same tessellation for hole, wheel and base). */
const circle = (r, hole = false, cx = 0, cy = 0, n = 128) => {
  const p = hole ? new THREE.Path() : new THREE.Shape();
  for (let i = 0; i < n; i++) p[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos((i * 2 * PI) / n), cy + r * Math.sin((i * 2 * PI) / n));
  return p;
};

/** Extrude with a rounded bevel; spans z ∈ [-depth, 0]. Caps get exact flat normals. */
function ext(shape, depth, b = 0, segs = 2, curveSegments = 5) {
  const bt = Math.min(b, depth / 2 - 0.02);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * Math.max(bt, 0), 0.02), bevelEnabled: b > 0,
    bevelThickness: Math.max(bt, 0), bevelSize: b, bevelSegments: segs, curveSegments,
  });
  g.translate(0, 0, -(depth - Math.max(bt, 0)));
  const out = toCreasedNormals(g, PI / 5);
  g.dispose();
  const n = out.attributes.normal, pos = out.attributes.position, uv = out.attributes.uv;
  for (let i = 0; i < pos.count; i += 3) {
    const z = pos.getZ(i);
    if (Math.abs(z - pos.getZ(i + 1)) < 1e-5 && Math.abs(z - pos.getZ(i + 2)) < 1e-5) {
      const nz = Math.sign(n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)) || 1;
      for (let k = 0; k < 3; k++) n.setXYZ(i + k, 0, 0, nz);
    } else for (let k = 0; k < 3; k++) uv.setXY(i + k, pos.getX(i + k), pos.getY(i + k));
    // ^ walls: planar uv (the default flips x/y at 45°)
  }
  return out;
}
/** Merge static sub-meshes of one material into one draw call. */
const merge = (gs) => {
  const m = mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));
  gs.forEach((g) => g.dispose());
  return m;
};
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** DOM hand-off tone: sRGB multipliers for the plate, top → bottom. */
const FACE_TONE = [0.973, 0.965, 0.951, 0.950, 0.959, 0.968, 0.975, 0.980, 0.990, 0.998, 1, 0.994, 0.993];
const FACE_COLOR = '#e1e4e7';

/** Flat ring R-0.03…R+0.7 over the wheel well; vertex colours replay the DOM wheel's box-shadows
 *  (11 % dark seam ×2, one nudged up; 60 % white lip nudged down), ~0.1 mm AA. */
function recessLip(R, [cx, cy]) {
  const n = 256, pos = [], col = [], idx = [];
  const cov = (x, y, oy) => Math.min(1, Math.max(0, (R + 0.2 - Math.hypot(x, y - oy)) / 0.1 + 0.5));
  [-0.03, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.36, 0.42, 0.5, 0.7].forEach((dr, j) => {
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * PI, x = (R + dr) * Math.cos(a), y = (R + dr) * Math.sin(a);
      const k = ((1 + 0.165 * cov(x, y, -0.22)) * (1 - 0.11 * cov(x, y, 0)) * (1 - 0.11 * cov(x, y, 0.06))) ** 2.2;
      pos.push(x + cx, y + cy, 0); col.push(k, k, k);
      const v = (j - 1) * (n + 1) + i, w = v + n + 1;
      if (j && i < n) idx.push(v, w, v + 1, v + 1, w, w + 1);
    }
  });
  const g = new THREE.BufferGeometry().setIndex(idx);
  const at = (k, a, d) => g.setAttribute(k, new THREE.Float32BufferAttribute(a, d));
  at('position', pos, 3); at('color', col, 3); at('uv', pos.filter((_, i) => i % 3 < 2), 2);
  g.computeVertexNormals();
  return g;
}

/** Chip packages as one mesh; the marked top (+z, or -z when `back`) samples atlas cell `cell`. */
function chipGeo(list, z0, back) {
  return merge(list.map((c) => {
    const g = box(c.w, c.h, c.d, c.x, c.y, back ? z0 - c.d / 2 : z0 + c.d / 2);
    const uv = g.attributes.uv, u0 = (c.cell % 4) / 4, v0 = c.cell < 4 ? 0.5 : 0, top = back ? 20 : 16;
    for (let i = 0; i < 24; i++) {
      const on = i >= top && i < top + 4;
      uv.setXY(i, u0 + (on ? uv.getX(i) / 4 : 0.01), v0 + (on ? uv.getY(i) / 2 : 0.25));
    }
    return g;
  }));
}

/** Kapton ribbon (cubic Bézier, N segments) between two parts; its ends follow both parts. */
function ribbon(mat, from, a, ta, to, b, tb, w, N = 20) {
  const pos = new Float32Array((N + 1) * 6), nrm = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), idx = [];
  for (let i = 0; i < N; i++) { const k = 2 * i; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const g = new THREE.BufferGeometry().setIndex(idx);
  const attr = (k, arr, n) => { const x = new THREE.BufferAttribute(arr, n); g.setAttribute(k, x); return x; };
  const P = attr('position', pos, 3), Nn = attr('normal', nrm, 3), U = attr('uv', uv, 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3();
  const C = new THREE.Vector3(), D = new THREE.Vector3(), n = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0), prev = new THREE.Vector3();
  function update() {
    const fg = from.group, tg = to.group;
    mesh.visible = fg.visible && tg.visible;
    if (!mesh.visible) return;
    fg.updateMatrix(); tg.updateMatrix();
    A.copy(a).applyMatrix4(fg.matrix); B.copy(b).applyMatrix4(tg.matrix);
    const k = 0.42 * A.distanceTo(B) + 2.5;
    P1.copy(ta).transformDirection(fg.matrix).multiplyScalar(k).add(A);
    P2.copy(tb).transformDirection(tg.matrix).multiplyScalar(k).add(B);
    let s = 0;
    for (let i = 0; i <= N; i++) {
      const u = i / N, v = 1 - u;
      C.copy(A).multiplyScalar(v * v * v).addScaledVector(P1, 3 * v * v * u).addScaledVector(P2, 3 * v * u * u).addScaledVector(B, u * u * u);
      D.copy(P1).sub(A).multiplyScalar(v * v).addScaledVector(n.copy(P2).sub(P1), 2 * u * v).addScaledVector(n.copy(B).sub(P2), u * u);
      n.crossVectors(D, X).normalize();
      if (i) s += C.distanceTo(prev);
      prev.copy(C);
      for (let e = 0; e < 2; e++) {
        const o = i * 6 + e * 3, h = (e - 0.5) * w;
        pos[o] = C.x + h; pos[o + 1] = C.y; pos[o + 2] = C.z;
        nrm[o] = n.x; nrm[o + 1] = n.y; nrm[o + 2] = n.z;
        uv[i * 4 + e * 2] = e * w; uv[i * 4 + e * 2 + 1] = s;
      }
    }
    P.needsUpdate = Nn.needsUpdate = U.needsUpdate = true;
  }
  return { mesh, update };
}

export function buildIpod({ maxAniso = 8 } = {}) {
  const textures = [];
  const tx = (c, o = {}) => { const t = T.tex(c, { aniso: maxAniso, ...o }); textures.push(t); return t; };
  // world-scaled brushing (uv = mm): coarse steel (40 mm tile), fine anodised face (20 mm)
  const brush = tx(T.brushed(3, 128, 16), { color: false, wrap: true });
  brush.repeat.set(1 / 40, 1 / 40);
  const fine = tx(T.brushed(4, 196, 20, 1024, [0.3, 0.3], 9000), { color: false, wrap: true });
  fine.repeat.set(1 / 20, 1 / 20);

  const model = new THREE.Group();
  const parts = {};
  const mk = (id) => {
    const spec = PARTS.find((p) => p.id === id);
    const g = new THREE.Group();
    g.name = id;
    g.position.z = -spec.z;
    model.add(g);
    return (parts[id] = { id, group: g, z0: -spec.z });
  };
  const add = (part, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    part.group.add(m);
    return m;
  };
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);

  const sw = IPOD.screenWindow, wh = IPOD.wheel;
  const swc = [SX(sw.x + sw.width / 2), SY(sw.y + sw.height / 2)];
  const whc = [SX(wh.cx), SY(wh.cy)];
  const R = wh.diameter / 2, CB = IPOD.centerButton.diameter / 2;
  const mats = {};
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // front plate: anodised, finely brushed aluminium
  {
    const p = mk('faceplate');
    const b = FACE_BEVEL;
    const s = rr(W, H, IPOD.cornerRadius, b);
    s.holes.push(rrHole(sw.width, sw.height, sw.radius, b, ...swc));
    s.holes.push(circle(R + 0.12 + b, true, ...whc));
    // satin anodising (diffuse floor); the tone map carries the DOM plate's light falloff
    const tone = T.capFit(tx(T.faceToneCanvas(FACE_TONE)), W, H);
    mats.face = phys({
      color: FACE_COLOR, map: tone, metalness: 0.62, roughness: 0.44, roughnessMap: fine,
      anisotropy: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.28,
    });
    add(p, ext(s, 0.8, b, 3, SEG), mats.face);
    // flat lip over the hole bevel, shaded like the DOM wheel recess
    mats.lip = mats.face.clone();
    mats.lip.vertexColors = true;
    add(p, recessLip(R, whc), mats.lip, 0, 0, 0.002);
  }

  // display window: tinted acrylic with printed black mask
  {
    const p = mk('screenGlass');
    const gw = sw.width - 0.1, gh = sw.height - 0.1;
    const alpha = T.capFit(tx(T.glassAlphaCanvas(gw, gh, IPOD.screen.width + 0.6, IPOD.screen.height + 0.6), { color: false }), gw, gh);
    mats.glass = phys({
      color: '#030303', metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03,
      transparent: true, alphaMap: alpha, ior: 1.49, specularIntensity: 1, envMapIntensity: 1,
    });
    add(p, ext(rr(gw, gh, sw.radius, 0.1), 0.6, 0.1, 2, 8), mats.glass, swc[0], swc[1], 0);
  }

  // click wheel + centre button (hairline gaps, no visible well)
  {
    const p = mk('clickWheel');
    const s = circle(R);
    s.holes.push(circle(CB - 0.03, true));
    const map = T.capFit(tx(T.wheelCanvas(wh.diameter, IPOD.wheelLabels.radiusFactor, CB)), wh.diameter, wh.diameter);
    mats.wheel = phys({ color: '#ffffff', map, roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0 });
    add(p, ext(s, 1.3), mats.wheel, whc[0], whc[1], 0);
    const cmap = T.capFit(tx(T.centreCanvas(2 * CB)), 2 * CB, 2 * CB);
    mats.centre = phys({ color: '#ffffff', map: cmap, emissive: '#ffffff', emissiveMap: cmap, emissiveIntensity: 0, metalness: 0.3, roughness: 0.4, roughnessMap: brush, anisotropy: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3 });
    add(p, ext(circle(CB - 0.1, false, 0, 0, 64), 1.2, 0.1, 2), mats.centre, whc[0], whc[1], -0.08);
    // sensor base: gap-shade grey, wide enough to veil the annulus while the plate seats
    const ws = circle(R + 2.5, false, 0, 0, 96); ws.holes.push(circle(CB - 2, true, 0, 0, 48));
    add(p, ext(ws, 0.2, 0, 1), std({ color: '#8a8d91', roughness: 0.8 }), whc[0], whc[1], -1.35);
  }

  // click-wheel flex: capacitive sensor ring on kapton (its tail is a live ribbon, below)
  const ro = R - 3;
  {
    const p = mk('wheelFlex');
    const ft = tx(T.flexCanvas(), { wrap: true });
    ft.repeat.set(1 / 10, 1 / 10);
    const kap = (map) => phys({ color: '#ffffff', map, metalness: 0.2, roughness: 0.34, clearcoat: 0.85, clearcoatRoughness: 0.14, side: THREE.DoubleSide });
    mats.flex = kap(ft);
    const ring = circle(ro, false, 0, 0, 96); ring.holes.push(circle(9.5, true, 0, 0, 48));
    const rmap = T.capFit(tx(T.flexRingCanvas(2 * ro, 9.5, ro)), 2 * ro, 2 * ro);
    add(p, ext(ring, 0.15, 0, 1), kap(rmap), whc[0], whc[1], 0);
    add(p, ext(rr(7, 4.5, 0.6), 0.15), mats.flex, whc[0] - 6, whc[1] - ro + 0.2, 0);
  }

  // LCD module: brushed steel frame, dark panel
  const fh = sw.height + 3;
  {
    const p = mk('lcd');
    add(p, ext(rr(sw.width + 3, fh, 1.2, 0.15), 2.4, 0.15), std({ color: COLORS.steel, metalness: 0.92, roughness: 0.3, roughnessMap: brush }), swc[0], swc[1], 0);
    add(p, ext(rr(sw.width - 0.6, sw.height - 0.6, 0.6), 0.1), std({ color: '#0d0e10', roughness: 0.55 }), swc[0], swc[1], 0.1);
    mats.panel = phys({ color: COLORS.lcdOff, metalness: 0, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.08 });
    add(p, new THREE.PlaneGeometry(IPOD.screen.width, IPOD.screen.height), mats.panel, swc[0], swc[1], 0.12);
  }

  // logic board: double-sided (SoC/RAM/NAND in front, codec/PMU/drive connector behind)
  const BW = 57.4, BH = 96, BY = 0.25, BZ = -0.4, BB = BZ - 0.8;
  const chips = [
    { ref: 'U1', x: -9, y: 20, w: 13, h: 13, d: 1.0, lines: ['DN8702', '0726 K4B', 'TAIWAN'] },
    { ref: 'U2', x: 11, y: 27, w: 12, h: 9, d: 0.9, lines: ['K4M513', 'PE-DG75'] },
    { ref: 'U3', x: 11, y: 12, w: 12, h: 10, d: 1.0, lines: ['NAND 32G', 'E3 BB2'] },
    { ref: 'U4', x: -15, y: 0, w: 7, h: 7, d: 0.8, lines: ['CS42L', 'CNZ'] },
    { ref: 'U5', x: 1, y: -1, w: 6, h: 6, d: 0.7, lines: ['PMU', '1723'] },
  ];
  const backChips = [
    { x: -9, y: 14, w: 11, h: 11, d: 0.8, lines: ['PP5022C', 'TBDG 0734'] },
    { x: 11, y: -6, w: 9, h: 7, d: 0.7, lines: ['WM8758', 'BG 07'] },
    { x: -12, y: -20, w: 7, h: 7, d: 0.6, lines: ['ATA', '1611'] },
  ];
  [...chips, ...backChips].forEach((c, i) => { c.cell = i; });
  const others = [
    { ref: 'SH1', x: 6, y: -23, w: 32, h: 19, d: 1.0, kind: 'can' },
    { ref: 'J1', x: 0, y: 40, w: 17, h: 3.4, d: 1.1, kind: 'zif' },
    { ref: 'J2', x: -15, y: -38, w: 10, h: 3, d: 1.0, kind: 'zif' },
    { ref: 'J3', x: 17, y: -38, w: 12, h: 3, d: 1.0, kind: 'zif' },
    { ref: 'Y1', x: -2, y: 8, w: 3.2, h: 2, d: 0.8, kind: 'xtal' },
  ];
  const holes = [[-25, 42], [25, 42], [-25, -42], [25, -42], [0, 3]];
  {
    const p = mk('logicBoard');
    const pcb = T.capFit(tx(T.pcbCanvas(BW, BH, [...chips, ...others], holes)), BW, BH);
    add(p, ext(rr(BW, BH, 3, 0.1), 0.8, 0.1, 1, 6), phys({ color: '#ffffff', map: pcb, roughness: 0.5, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.22 }), 0, BY, BZ);
    const atlas = tx(T.chipAtlas([...chips, ...backChips].map((c) => c.lines)));
    const chipMat = std({ map: atlas, roughness: 0.5 });
    add(p, chipGeo(chips, BZ, false), chipMat, 0, BY);
    add(p, chipGeo(backChips, BB, true), chipMat, 0, BY);
    const can = std({ color: '#cdd1d6', metalness: 1, roughness: 0.28, roughnessMap: brush });
    const shiny = std({ color: '#e0e3e7', metalness: 1, roughness: 0.18 });
    const plastic = std({ color: '#1c1d20', roughness: 0.45 });
    const sh = others[0];
    add(p, ext(rr(sh.w, sh.h, 0.8, 0.25), sh.d, 0.25, 1, 4), can, sh.x, sh.y + BY, BZ + sh.d);
    const zifs = [], dark = [], metal = [];
    for (const o of others.slice(1)) {
      (o.kind === 'zif' ? zifs : metal).push(box(o.w, o.h, o.d, o.x, o.y + BY, BZ + o.d / 2));
      if (o.kind === 'zif') dark.push(box(o.w, o.h * 0.35, 0.35, o.x, o.y + BY - o.h * 0.32, BZ + o.d + 0.1));
    }
    zifs.push(box(12, 3, 1, 8, -34 + BY, BB - 0.5)); // J4: drive connector on the back
    dark.push(box(12, 1, 0.35, 8, -34.9 + BY, BB - 1.1));
    // dock connector, headphone jack, hold switch
    const jx = SX(IPOD.headphoneJack.x), hx = SX(IPOD.holdSwitch.x + IPOD.holdSwitch.width / 2);
    metal.push(ext(rr(IPOD.dockConnector.width + 0.8, 3.4, 0.9, 0.2), 3.2, 0.2, 1, 4).translate(0, -H / 2 + 2.4, 1.8));
    metal.push(new THREE.CylinderGeometry(2.3, 2.3, 1.2, 20).translate(jx, H / 2 - 2.2, -2.1));
    metal.push(ext(rr(IPOD.holdSwitch.width + 1, 3, 0.8, 0.2), 1.8, 0.2, 1, 4).translate(hx, H / 2 - 3, BZ));
    dark.push(box(IPOD.dockConnector.width - 1, 1.6, 2.6, 0, -H / 2 + 2.4, 0.35), box(6.5, 9, 3.4, jx, H / 2 - 6.5, -2.1));
    add(p, merge(zifs), std({ color: '#e8e1cf', roughness: 0.55 }));
    add(p, merge(dark), plastic);
    add(p, merge(metal), shiny);
    // SMD passives, both sides
    const r = T.rng(9);
    const pas = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.55, 0.45), std({ roughness: 0.55 }), 150);
    const busy = [...chips, ...others, ...backChips, { x: 8, y: -34, w: 12, h: 3 }];
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let n = 0;
    for (let guard = 0; n < 150 && guard < 5000; guard++) {
      const x = (r() - 0.5) * (BW - 6), y = (r() - 0.5) * (BH - 12), bk = n >= 110;
      if (busy.some((c) => Math.abs(x - c.x) < c.w / 2 + 2 && Math.abs(y - c.y) < c.h / 2 + 2)) continue;
      pas.setMatrixAt(n, m4.makeRotationZ(r() > 0.5 ? PI / 2 : 0).setPosition(x, y + BY, bk ? BB - 0.22 : BZ + 0.22));
      pas.setColorAt(n++, col.set(r() > 0.45 ? '#a9845a' : r() > 0.5 ? '#2e2f33' : '#cfc8b8'));
    }
    pas.count = n;
    p.group.add(pas);
  }

  // battery: dark Li-ion pouch
  {
    const p = mk('battery');
    const bw = 50, bh = 21, cy = SY(88.5);
    const map = T.capFit(tx(T.batteryCanvas(bw, bh)), bw - 1.2, bh - 1.2);
    add(p, ext(rr(bw, bh, 2.4, 0.6), 2.6, 0.6, 3), std({ color: '#ffffff', map, metalness: 0.35, roughness: 0.36 }), 0, cy, 0);
    [['#b3261e', -3], ['#151515', -1]].forEach(([c, x]) => add(p, new THREE.CylinderGeometry(0.4, 0.4, 7, 8), std({ color: c, roughness: 0.4 }), x - 14, cy + bh / 2 + 3.2, -0.6));
    add(p, ext(rr(9, 5, 0.6), 0.15), mats.flex, 12, cy + bh / 2 + 1.5, -0.4);
  }

  // 1.8" hard drive + rubber bumpers
  const dw = 54, dh = 71, dcy = SY(41);
  {
    const p = mk('storage');
    add(p, ext(rr(dw, dh, 2.2, 0.3), 4.3, 0.3, 1), std({ color: '#5a5f66', metalness: 0.7, roughness: 0.5 }), 0, dcy, -0.5);
    const label = T.capFit(tx(T.driveCanvas(dw - 0.6, dh - 0.6)), dw - 0.8, dh - 0.8);
    add(p, ext(rr(dw - 0.6, dh - 0.6, 2, 0.1), 0.5, 0.1, 1), std({ color: '#ffffff', map: label, metalness: 0.75, roughness: 0.34, roughnessMap: brush }), 0, dcy, 0);
    const rubber = phys({ color: '#1b1c1f', roughness: 0.85, metalness: 0, sheen: 0.4, sheenColor: '#555', sheenRoughness: 0.6 });
    const bumps = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => ext(rr(9, 12, 2.6, 0.9), 5.2, 0.9, 2, 4).translate(sx * (dw / 2 - 2.4), dcy + sy * (dh / 2 - 3.6), 0.2));
    add(p, merge(bumps), rubber);
  }

  // internal mid-frame: thin dark stamped steel, two narrow ribs, spring clips
  {
    const p = mk('midframe');
    const frame = std({ color: '#5a5e63', metalness: 0.55, roughness: 0.6 });
    const s = rr(W - 1.8, H - 1.8, IPOD.cornerRadius - 0.8, 0.1);
    s.holes.push(rrHole(W - 5.8, H - 5.8, IPOD.cornerRadius - 2.8, 0.1));
    add(p, merge([ext(s, 2.2, 0.1, 1, 8), box(W - 5, 1.1, 0.7, 0, -6, -1.4), box(W - 5, 1.1, 0.7, 0, 26, -1.4)]), frame);
    const clips = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 5.5, 2.4), std({ color: '#b9bdc2', metalness: 1, roughness: 0.3 }), 12);
    const m4 = new THREE.Matrix4();
    let i = 0;
    [-38, -14, 10, 34].forEach((y) => [-1, 1].forEach((sx) => clips.setMatrixAt(i++, m4.makeTranslation(sx * (W / 2 - 0.9), y, -1.5))));
    [-1, 1].forEach((sy) => [-14, 14].forEach((x) => clips.setMatrixAt(i++, m4.makeRotationZ(PI / 2).setPosition(x, sy * (H / 2 - 0.9), -1.5))));
    p.group.add(clips);
  }

  // back shell: mirror-polished stainless tub with the edge openings
  let back;
  {
    const p = mk('backShell');
    const w2 = W - 0.3, h2 = H - 0.3, cr = IPOD.cornerRadius - 0.15;
    const steel = phys({ color: '#dfe1e3', metalness: 1, roughness: 0.06, clearcoat: 0.6, clearcoatRoughness: 0.04 });
    // side wall (a hair narrower) ends inside the plate's belt: one continuous radius, no lip
    const ring = rr(w2 - 0.06, h2 - 0.06, cr - 0.03, 0.25);
    ring.holes.push(rrHole(w2 - 1.2, h2 - 1.2, cr - 0.6, 0.25));
    add(p, ext(ring, 9.1, 0.25, 3, SEG), steel, 0, 0, 8.6);
    mats.steel = steel;
    const bw = w2 - 1.8, bh = h2 - 1.8;
    const [cC, rC] = T.backCanvases(bw, bh, {});
    const cT = T.capFit(tx(cC), bw, bh), rT = T.capFit(tx(rC, { color: false }), bw, bh);
    back = { cC, rC, cT, rT, bw, bh };
    mats.back = phys({ color: '#dfe1e3', map: cT, metalness: 1, roughness: 1, roughnessMap: rT, clearcoat: 0.6, clearcoatRoughness: 0.04 });
    add(p, ext(rr(w2, h2, cr, 0.9), 1.7, 0.9, 6, SEG), mats.back, 0, 0, 0.6);
    const inner = T.capFit(tx(T.shellInnerCanvas(w2 - 1.4, h2 - 1.4)), w2 - 1.4, h2 - 1.4);
    add(p, new THREE.ShapeGeometry(rr(w2 - 1.4, h2 - 1.4, cr - 0.7), 12), std({ map: inner, metalness: 0.55, roughness: 0.55 }), 0, 0, 0.62);
    // edge openings as decals on the walls (mid-depth): hold slot + slider, jack, dock slot
    const yT = (h2 - 0.06) / 2 + 0.015, zc = -IPOD.depth / 2 + PARTS.at(-1).z;
    const top = (g, x) => g.rotateX(-PI / 2).translate(x, yT, zc), bot = (g) => g.rotateX(PI / 2).translate(0, -yT, zc);
    const jx = SX(IPOD.headphoneJack.x), hs = IPOD.holdSwitch, hx = SX(hs.x + hs.width / 2), jr = IPOD.headphoneJack.diameter / 2;
    const decal = (c, r = 0.6, m = 0) => std({ color: c, roughness: r, metalness: m, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    add(p, merge([
      top(new THREE.ShapeGeometry(rr(hs.width, 2.1, 1.05), 4), hx),
      top(new THREE.CircleGeometry(jr, 32), jx),
      bot(new THREE.ShapeGeometry(rr(IPOD.dockConnector.width, IPOD.dockConnector.height, 1.1), 4)),
    ]), decal('#060607', 0.7));
    add(p, merge([
      top(new THREE.RingGeometry(jr - 0.25, jr, 32), jx),
      top(new THREE.RingGeometry(0.75, 1.15, 24), jx).translate(0, 0.005, 0),
      bot(new THREE.ShapeGeometry(rr(IPOD.dockConnector.width - 3, 0.75, 0.3), 2)).translate(0, -0.005, 0),
    ]), decal('#4a4d52', 0.35, 0.8));
    add(p, box(2.8, 0.5, 1.3, hx - hs.width / 2 + 1.75, yT - 0.12, zc), std({ color: '#ecebe8', roughness: 0.35 }));
  }

  // screws (instanced)
  const screwGeo = (() => {
    const gs = [
      new THREE.CylinderGeometry(1.55, 1.6, 0.6, 16).rotateX(PI / 2).translate(0, 0, -0.275),
      new THREE.CylinderGeometry(0.6, 0.6, 2.6, 8).rotateX(PI / 2).translate(0, 0, -1.85),
      new THREE.BoxGeometry(2.0, 0.36, 0.2), new THREE.BoxGeometry(0.36, 2.0, 0.2),
    ];
    gs.forEach((g) => g.deleteAttribute('uv'));
    return merge(gs);
  })();
  const screwBase = [
    [-25, 42 + BY, -3.4], [25, 42 + BY, -3.4], [-25, -42 + BY, -3.4], [25, -42 + BY, -3.4],
    [-27.4, 18, -0.8], [27.4, 18, -0.8], [-27.4, -30, -0.8], [27.4, -30, -0.8],
  ].map((v) => V(...v));
  const screws = new THREE.InstancedMesh(screwGeo, std({ color: '#c3c8cf', metalness: 1, roughness: 0.2 }), screwBase.length);
  screws.frustumCulled = false;
  model.add(screws);

  model.updateMatrixWorld(true);
  const list = PARTS.map((s) => parts[s.id]);
  for (const p of list) p.box = new THREE.Box3().setFromObject(p.group);

  // live kapton ribbons: wheel flex → J2, LCD → J1 (over the top edge), drive → J4 (board back)
  const up = V(0, 1, 0), dn = V(0, -1, 0);
  const ribbons = [
    ribbon(mats.flex, parts.wheelFlex, V(whc[0] - 6, whc[1] - ro - 1.8, -0.08), dn, parts.logicBoard, V(-15, -38 + BY - 1.5, BZ + 0.5), dn, 6.5),
    ribbon(mats.flex, parts.lcd, V(swc[0], swc[1] + fh / 2 - 1.5, -2.45), up, parts.logicBoard, V(0, 40 + BY + 1.7, BZ + 0.55), up, 13),
    ribbon(mats.flex, parts.storage, V(8, dcy - dh / 2 + 1.5, 0.05), dn, parts.logicBoard, V(8, -34 + BY - 1.5, BB - 0.5), dn, 10),
  ];
  ribbons.forEach((r) => model.add(r.mesh));

  function setBrand({ monogram = '', name = '', tagline = '' } = {}) {
    const [cC, rC] = T.backCanvases(back.bw, back.bh, { monogram, name, line: tagline });
    back.cC.getContext('2d').drawImage(cC, 0, 0);
    back.rC.getContext('2d').drawImage(rC, 0, 0);
    back.cT.needsUpdate = back.rT.needsUpdate = true;
  }

  return { model, parts: list, byId: parts, screws, screwBase, textures, mats, ribbons, setBrand };
}
