// Procedural silver iPod Classic (6th/7th gen) split into its real exploded-view parts.
// Model space: mm, origin at the front-face centre, y up, front at z = 0.
import * as THREE from 'three';
import { toCreasedNormals, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { IPOD, PARTS, COLORS } from '../shared/ipodSpec.js';
import * as T from './tex.js';

const { PI, abs, cos, hypot, max, min, sign, sin } = Math, V3 = THREE.Vector3;
const W = IPOD.width, H = IPOD.height;
const SX = (x) => x - W / 2, SY = (y) => H / 2 - y;
export const FACE_BEVEL = 0.25;
const SEG = 16;

function rrPath(p, w, h, r, cx = 0, cy = 0) {
  r = max(0.05, min(r, w / 2 - 0.01, h / 2 - 0.01));
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0); p.absarc(x1 - r, y0 + r, r, -PI / 2, 0);
  p.lineTo(x1, y1 - r); p.absarc(x1 - r, y1 - r, r, 0, PI / 2);
  p.lineTo(x0 + r, y1); p.absarc(x0 + r, y1 - r, r, PI / 2, PI);
  p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, PI, 1.5 * PI);
  return p;
}
const rr = (w, h, r, b = 0, cx = 0, cy = 0) => rrPath(new THREE.Shape(), w - 2 * b, h - 2 * b, r - b, cx, cy);
const rrHole = (w, h, r, b = 0, cx = 0, cy = 0) => rrPath(new THREE.Path(), w + 2 * b, h + 2 * b, r + b, cx, cy);
const circle = (r, hole = false, n = 128, cx = 0, cy = 0) => {
  const p = hole ? new THREE.Path() : new THREE.Shape();
  for (let i = 0; i < n; i++) p[i ? 'lineTo' : 'moveTo'](cx + r * cos((i * 2 * PI) / n), cy + r * sin((i * 2 * PI) / n));
  return p;
};
const holed = (s, ...h) => { s.holes.push(...h); return s; };

function ext(shape, depth, b = 0, segs = 2, curveSegments = 5) {
  const bt = max(0, min(b, depth / 2 - 0.02));
  const g = toCreasedNormals(new THREE.ExtrudeGeometry(shape, {
    depth: max(depth - 2 * bt, 0.02), bevelEnabled: b > 0, bevelThickness: bt, bevelSize: b, bevelSegments: segs, curveSegments,
  }).translate(0, 0, bt - depth), PI / 5);
  const n = g.attributes.normal, pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i += 3) {
    const z = pos.getZ(i);
    if (abs(z - pos.getZ(i + 1)) < 1e-5 && abs(z - pos.getZ(i + 2)) < 1e-5) {
      const nz = sign(n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)) || 1;
      for (let k = 0; k < 3; k++) n.setXYZ(i + k, 0, 0, nz);
    } else for (let k = 0; k < 3; k++) uv.setXY(i + k, pos.getX(i + k), pos.getY(i + k));
  }
  return g;
}
const merge = (gs) => {
  const m = mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));
  gs.forEach((g) => g.dispose());
  return m;
};
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

const FACE_TONE = [0.973, 0.965, 0.951, 0.950, 0.959, 0.968, 0.975, 0.980, 0.990, 0.998, 1, 0.994, 0.993];

function recessLip(R, [cx, cy]) {
  const n = 256, pos = [], col = [], idx = [];
  const cov = (x, y, oy) => min(1, max(0, (R + 0.2 - hypot(x, y - oy)) / 0.1 + 0.5));
  [-0.03, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.36, 0.42, 0.5, 0.7].forEach((dr, j) => {
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * PI, x = (R + dr) * cos(a), y = (R + dr) * sin(a);
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

const chipGeo = (list, z0, back, c0) => merge(list.map(([x, y, w, h, d], i) => {
  const g = box(w, h, d, x, y, back ? z0 - d / 2 : z0 + d / 2), uv = g.attributes.uv, c = c0 + i, top = back ? 20 : 16;
  for (let k = 0; k < 24; k++) {
    const on = k >= top && k < top + 4;
    uv.setXY(k, (c % 4) / 4 + (on ? uv.getX(k) / 4 : 0.01), (c < 4 ? 0.5 : 0) + (on ? uv.getY(k) / 2 : 0.25));
  }
  return g;
}));

function ribbon(mat, from, a, ta, to, b, tb, w, N = 28) {
  const pos = new Float32Array((N + 1) * 6), nrm = pos.slice(), uv = new Float32Array((N + 1) * 4), idx = [];
  for (let k = 0; k < 2 * N; k += 2) idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  const g = new THREE.BufferGeometry().setIndex(idx);
  const at = [['position', pos, 3], ['normal', nrm, 3], ['uv', uv, 2]].map(([k, arr, n]) => g.setAttribute(k, new THREE.BufferAttribute(arr, n)).getAttribute(k));
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  const [A, B, P1, P2, C, D, n, prev] = Array.from({ length: 8 }, () => new V3()), X = new V3(1, 0, 0);
  function update() {
    const fg = from.group, tg = to.group;
    if (!(mesh.visible = fg.visible && tg.visible)) return;
    fg.updateMatrix(); tg.updateMatrix();
    A.copy(a).applyMatrix4(fg.matrix); B.copy(b).applyMatrix4(tg.matrix);
    const k = 0.42 * A.distanceTo(B) + 2.5;
    P1.copy(ta).transformDirection(fg.matrix).multiplyScalar(k).add(A);
    P2.copy(tb).transformDirection(tg.matrix).multiplyScalar(k).add(B);
    for (let i = 0, s = 0; i <= N; i++) {
      const u = i / N, v = 1 - u;
      C.copy(A).multiplyScalar(v * v * v).addScaledVector(P1, 3 * v * v * u).addScaledVector(P2, 3 * v * u * u).addScaledVector(B, u * u * u);
      D.copy(P1).sub(A).multiplyScalar(v * v).addScaledVector(n.copy(P2).sub(P1), 2 * u * v).addScaledVector(n.copy(B).sub(P2), u * u);
      n.crossVectors(D, X).normalize();
      if (i) s += C.distanceTo(prev);
      prev.copy(C);
      for (let e = 0; e < 2; e++) {
        const o = i * 6 + e * 3;
        pos[o] = C.x + (e - 0.5) * w; pos[o + 1] = C.y; pos[o + 2] = C.z;
        nrm[o] = n.x; nrm[o + 1] = n.y; nrm[o + 2] = n.z;
        uv[i * 4 + e * 2] = e * w; uv[i * 4 + e * 2 + 1] = s;
      }
    }
    at[0].needsUpdate = at[1].needsUpdate = at[2].needsUpdate = true;
  }
  return { mesh, update };
}

export function buildIpod({ maxAniso = 8 } = {}) {
  // canvas textures are drawn later, one per setup task (runIntro's step chain, before the first upload),
  // so building the model stays one short task: `paint` is a function that returns the drawn canvas
  const textures = [], paints = [];
  const tx = (paint, o = {}) => {
    const t = T.tex(T.blank(), { aniso: maxAniso, ...o });
    paints.push(() => { t.image = paint(); t.needsUpdate = true; return t; });
    textures.push(t);
    return t;
  };
  const fit = (c, w, h = w, o) => T.capFit(tx(c, o), w, h);
  const brush = tx(() => T.brushed(3, 128, 16), { color: false, wrap: true });
  brush.repeat.set(1 / 40, 1 / 40);
  const fine = tx(() => T.brushed(4, 190, 36, 1024, [0.3, 0.3], 9000, 0.5), { color: false, wrap: true });
  fine.repeat.set(1 / 20, 1 / 20);

  const model = new THREE.Group(), parts = {}, mats = {};
  const mk = (id) => {
    const g = new THREE.Group(), z0 = -PARTS.find((p) => p.id === id).z;
    g.name = id; g.position.z = z0;
    model.add(g);
    return (parts[id] = { id, group: g, z0 });
  };
  const add = (part, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    part.group.add(m);
    return m;
  };
  const phys = (o) => new THREE.MeshPhysicalMaterial(o), std = (o) => new THREE.MeshStandardMaterial(o);

  const sw = IPOD.screenWindow, wh = IPOD.wheel, sc = IPOD.screen;
  const swc = [SX(sw.x + sw.width / 2), SY(sw.y + sw.height / 2)], whc = [SX(wh.cx), SY(wh.cy)];
  const R = wh.diameter / 2, CB = IPOD.centerButton.diameter / 2, ro = R - 3;

  { // front plate: brushed anodised aluminium, tone = DOM plate
    const p = mk('faceplate'), b = FACE_BEVEL;
    mats.face = phys({ color: '#e1e4e7', map: fit(() => T.faceToneCanvas(FACE_TONE), W, H), metalness: 0.62, roughness: 0.44, roughnessMap: fine, anisotropy: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.28 });
    add(p, ext(holed(rr(W, H, IPOD.cornerRadius, b), rrHole(sw.width, sw.height, sw.radius, b, ...swc), circle(R + 0.12 + b, true, 128, ...whc)), 0.8, b, 3, SEG), mats.face);
    mats.lip = mats.face.clone();
    mats.lip.vertexColors = true;
    add(p, recessLip(R, whc), mats.lip, 0, 0, 0.002);
  }
  {
    const p = mk('screenGlass'), gw = sw.width - 0.1, gh = sw.height - 0.1;
    mats.glass = phys({ color: '#030303', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, alphaMap: fit(() => T.glassAlphaCanvas(gw, gh, sc.width + 0.6, sc.height + 0.6), gw, gh, { color: false }), ior: 1.49 });
    add(p, ext(rr(gw, gh, sw.radius, 0.1), 0.6, 0.1, 2, 8), mats.glass, ...swc);
  }
  {
    const p = mk('clickWheel'), map = fit(() => T.wheelCanvas(wh.diameter, IPOD.wheelLabels.radiusFactor, CB), wh.diameter), cmap = fit(() => T.centreCanvas(2 * CB), 2 * CB);
    const glow = { color: '#fff', emissive: '#fff', emissiveIntensity: 0, clearcoat: 0.3, clearcoatRoughness: 0.3 };
    mats.wheel = phys({ ...glow, map, emissiveMap: map, roughness: 0.42 });
    mats.centre = phys({ ...glow, map: cmap, emissiveMap: cmap, metalness: 0.3, roughness: 0.4, roughnessMap: brush, anisotropy: 0.4 });
    add(p, ext(holed(circle(R), circle(CB - 0.03, true)), 1.3), mats.wheel, ...whc);
    add(p, ext(circle(CB - 0.1, false, 64), 1.2, 0.1), mats.centre, ...whc, -0.08);
    add(p, ext(holed(circle(R + 2.5, false, 96), circle(CB - 2, true, 48)), 0.2), std({ color: '#8a8d91', roughness: 0.8 }), ...whc, -1.35);
  }
  {
    const p = mk('wheelFlex'), ft = tx(() => T.flexCanvas(), { wrap: true });
    ft.repeat.set(1 / 10, 1 / 10);
    const kap = (map, o) => phys({ color: '#fff', map, metalness: 0.2, roughness: 0.34, clearcoat: 0.85, clearcoatRoughness: 0.14, side: THREE.DoubleSide, ...o });
    mats.flex = kap(ft);
    mats.ribbon = kap(ft, { metalness: 0.1, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.25 });
    add(p, ext(holed(circle(ro, false, 96), circle(9.5, true, 48)), 0.15), kap(fit(() => T.flexRingCanvas(2 * ro, 9.5, ro), 2 * ro)), ...whc);
    add(p, ext(rr(7, 4.5, 0.6), 0.15), mats.flex, whc[0] - 6, whc[1] - ro + 0.2);
  }
  const fh = sw.height + 3;
  {
    const p = mk('lcd');
    add(p, ext(rr(sw.width + 3, fh, 1.2, 0.15), 2.4, 0.15), std({ color: COLORS.steel, metalness: 0.92, roughness: 0.3, roughnessMap: brush }), ...swc);
    add(p, ext(rr(sw.width - 0.6, sw.height - 0.6, 0.6), 0.1), std({ color: '#0d0e10', roughness: 0.55 }), ...swc, 0.1);
    mats.panel = phys({ color: COLORS.lcdOff, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.08 });
    add(p, new THREE.PlaneGeometry(sc.width, sc.height), mats.panel, ...swc, 0.12);
  }

  const BW = 57.4, BH = 96, BY = 0.25, BZ = -0.4, BB = BZ - 0.8;
  const chips = [[-9, 20, 13, 13, 1], [11, 27, 12, 9, 0.9], [11, 12, 12, 10, 1], [-15, 0, 7, 7, 0.8], [1, -1, 6, 6, 0.7]];
  const backChips = [[-9, 14, 11, 11, 0.8], [11, -6, 9, 7, 0.7], [-12, -20, 7, 7, 0.6]];
  const others = [['SH1', 6, -23, 32, 19, 1, 'can'], ['J1', 0, 40, 17, 3.4, 1.1, 'zif'], ['J2', -15, -38, 10, 3, 1, 'zif'], ['J3', 17, -38, 12, 3, 1, 'zif'], ['Y1', -2, 8, 3.2, 2, 0.8, 'x']];
  const prints = [...chips.map(([x, y, w, h], i) => ({ ref: 'U' + (i + 1), x, y, w, h })), ...others.map(([ref, x, y, w, h]) => ({ ref, x, y, w, h }))];
  {
    const p = mk('logicBoard');
    add(p, ext(rr(BW, BH, 3, 0.1), 0.8, 0.1, 1, 6), phys({ color: '#fff', map: fit(() => T.pcbCanvas(BW, BH, prints, [[-25, 42], [25, 42], [-25, -42], [25, -42], [0, 3]]), BW, BH), roughness: 0.5, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.22 }), 0, BY, BZ);
    const chipMat = std({ map: tx(() => T.chipAtlas([['DN8702', '0726 K4B', 'TAIWAN'], ['K4M513', 'PE-DG75'], ['NAND 32G', 'E3 BB2'], ['CS42L', 'CNZ'], ['PMU', '1723'], ['PP5022C', 'TBDG 0734'], ['WM8758', 'BG 07'], ['ATA', '1611']])), roughness: 0.5 });
    add(p, chipGeo(chips, BZ, false, 0), chipMat, 0, BY);
    add(p, chipGeo(backChips, BB, true, 5), chipMat, 0, BY);
    const [, sx, sy, sw2, sh2, sd] = others[0];
    add(p, ext(rr(sw2, sh2, 0.8, 0.25), sd, 0.25, 1, 4), std({ color: '#cdd1d6', metalness: 1, roughness: 0.28, roughnessMap: brush }), sx, sy + BY, BZ + sd);
    const zifs = [box(12, 3, 1, 8, -34 + BY, BB - 0.5)], dark = [box(12, 1, 0.35, 8, -34.9 + BY, BB - 1.1)], metal = [];
    for (const [, x, y, w, h, d, kind] of others.slice(1)) {
      (kind === 'zif' ? zifs : metal).push(box(w, h, d, x, y + BY, BZ + d / 2));
      if (kind === 'zif') dark.push(box(w, h * 0.35, 0.35, x, y + BY - h * 0.32, BZ + d + 0.1));
    }
    const jx = SX(IPOD.headphoneJack.x), hx = SX(IPOD.holdSwitch.x + IPOD.holdSwitch.width / 2);
    metal.push(ext(rr(IPOD.dockConnector.width + 0.8, 3.4, 0.9, 0.2), 3.2, 0.2, 1, 4).translate(0, 2.4 - H / 2, 1.8),
      new THREE.CylinderGeometry(2.3, 2.3, 1.2, 20).translate(jx, H / 2 - 2.2, -2.1),
      ext(rr(IPOD.holdSwitch.width + 1, 3, 0.8, 0.2), 1.8, 0.2, 1, 4).translate(hx, H / 2 - 3, BZ));
    dark.push(box(IPOD.dockConnector.width - 1, 1.6, 2.6, 0, 2.4 - H / 2, 0.35), box(6.5, 9, 3.4, jx, H / 2 - 6.5, -2.1));
    add(p, merge(zifs), std({ color: '#e8e1cf', roughness: 0.55 }));
    add(p, merge(dark), std({ color: '#1c1d20', roughness: 0.45 }));
    add(p, merge(metal), std({ color: '#e0e3e7', metalness: 1, roughness: 0.18 }));
    const r = T.rng(9), m4 = new THREE.Matrix4(), col = new THREE.Color();
    const pas = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.55, 0.45), std({ roughness: 0.55 }), 150);
    const busy = [...prints, ...backChips.map(([x, y, w, h]) => ({ x, y, w, h })), { x: 8, y: -34, w: 12, h: 3 }];
    let n = 0;
    for (let guard = 0; n < 150 && guard < 5000; guard++) {
      const x = (r() - 0.5) * (BW - 6), y = (r() - 0.5) * (BH - 12);
      if (busy.some((c) => abs(x - c.x) < c.w / 2 + 2 && abs(y - c.y) < c.h / 2 + 2)) continue;
      pas.setMatrixAt(n, m4.makeRotationZ(r() > 0.5 ? PI / 2 : 0).setPosition(x, y + BY, n >= 110 ? BB - 0.22 : BZ + 0.22));
      pas.setColorAt(n++, col.set(r() > 0.45 ? '#a9845a' : r() > 0.5 ? '#2e2f33' : '#cfc8b8'));
    }
    pas.count = n;
    p.group.add(pas);
  }
  {
    const p = mk('battery'), bw = 50, bh = 21, cy = SY(88.5);
    add(p, ext(rr(bw, bh, 2.4, 0.6), 2.6, 0.6, 3), std({ color: '#fff', map: fit(() => T.batteryCanvas(bw, bh), bw - 1.2, bh - 1.2), metalness: 0.35, roughness: 0.36 }), 0, cy);
    [['#b3261e', -17], ['#151515', -15]].forEach(([c, x]) => add(p, new THREE.CylinderGeometry(0.4, 0.4, 7, 8), std({ color: c, roughness: 0.4 }), x, cy + bh / 2 + 3.2, -0.6));
    add(p, ext(rr(9, 5, 0.6), 0.15), mats.flex, 12, cy + bh / 2 + 1.5, -0.4);
  }
  const dw = 54, dh = 71, dcy = SY(41);
  { // 1.8" hard drive + rubber bumpers
    const p = mk('storage');
    add(p, ext(rr(dw, dh, 2.2, 0.3), 4.3, 0.3, 1), std({ color: '#5a5f66', metalness: 0.7, roughness: 0.5 }), 0, dcy, -0.5);
    add(p, ext(rr(dw - 0.6, dh - 0.6, 2, 0.1), 0.5, 0.1, 1), std({ color: '#fff', map: fit(() => T.driveCanvas(dw - 0.6, dh - 0.6), dw - 0.8, dh - 0.8), metalness: 0.75, roughness: 0.34, roughnessMap: brush }), 0, dcy);
    const bumps = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => ext(rr(9, 12, 2.6, 0.9), 5.2, 0.9, 2, 4).translate(sx * (dw / 2 - 2.4), dcy + sy * (dh / 2 - 3.6), 0.2)));
    add(p, merge(bumps), phys({ color: '#1b1c1f', roughness: 0.85, sheen: 0.4, sheenColor: '#555', sheenRoughness: 0.6 }));
  }
  {
    const p = mk('midframe'), cr = IPOD.cornerRadius;
    const ring = ext(holed(rr(W - 1.8, H - 1.8, cr - 0.8, 0.1), rrHole(W - 5.8, H - 5.8, cr - 2.8, 0.1)), 2.2, 0.1, 1, 8);
    add(p, merge([ring, box(W - 5, 1.1, 0.7, 0, -6, -1.4), box(W - 5, 1.1, 0.7, 0, 26, -1.4)]), std({ color: '#5a5e63', metalness: 0.55, roughness: 0.6 }));
    const clips = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 5.5, 2.4), std({ color: '#b9bdc2', metalness: 1, roughness: 0.3 }), 12), m4 = new THREE.Matrix4();
    let i = 0;
    for (const y of [-38, -14, 10, 34]) for (const s of [-1, 1]) clips.setMatrixAt(i++, m4.makeTranslation(s * (W / 2 - 0.9), y, -1.5));
    for (const s of [-1, 1]) for (const x of [-14, 14]) clips.setMatrixAt(i++, m4.makeRotationZ(PI / 2).setPosition(x, s * (H / 2 - 0.9), -1.5));
    p.group.add(clips);
  }
  let back;
  {
    const p = mk('backShell'), w2 = W - 0.3, h2 = H - 0.3, cr = IPOD.cornerRadius - 0.15, bw = w2 - 1.8, bh = h2 - 1.8;
    const polish = { color: '#dfe1e3', metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.04 };
    // the ring sits just behind the front plate; its side wall is seen nearly edge-on in the last, almost
    // frontal frames, where its depth lost against the plate's face as a thin dark line near the edge:
    // a small depth offset keeps it behind the plate
    mats.steel = phys({ ...polish, roughness: 0.06, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    add(p, ext(holed(rr(w2 - 0.06, h2 - 0.06, cr - 0.03, 0.25), rrHole(w2 - 1.2, h2 - 1.2, cr - 0.6, 0.25)), 9.1, 0.25, 3, SEG), mats.steel, 0, 0, 8.6);
    // both back canvases are drawn in one go, with the brand known by then (setBrand)
    const pair = () => (back.pair ??= T.backCanvases(bw, bh, back.brand));
    const cT = fit(() => pair()[0], bw, bh), rT = fit(() => pair()[1], bw, bh, { color: false });
    back = { pair: null, brand: {}, cT, rT, bw, bh };
    mats.back = phys({ ...polish, map: cT, roughness: 1, roughnessMap: rT });
    add(p, ext(rr(w2, h2, cr, 0.9), 1.7, 0.9, 6, SEG), mats.back, 0, 0, 0.6);
    add(p, new THREE.ShapeGeometry(rr(w2 - 1.4, h2 - 1.4, cr - 0.7), 12), std({ map: fit(() => T.shellInnerCanvas(w2 - 1.4, h2 - 1.4), w2 - 1.4, h2 - 1.4), metalness: 0.55, roughness: 0.55 }), 0, 0, 0.62);
    const yT = (h2 - 0.06) / 2 + 0.015, zc = PARTS.at(-1).z - IPOD.depth / 2, hs = IPOD.holdSwitch, dc = IPOD.dockConnector;
    const jx = SX(IPOD.headphoneJack.x), hx = SX(hs.x + hs.width / 2), jr = IPOD.headphoneJack.diameter / 2;
    const top = (g, x, o = 0) => g.rotateX(-PI / 2).translate(x, yT + o, zc), bot = (g) => g.rotateX(PI / 2).translate(0, -yT, zc);
    const decal = (color, roughness, metalness = 0) => std({ color, roughness, metalness, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const S = (s, n = 4) => new THREE.ShapeGeometry(s, n);
    add(p, merge([top(S(rr(hs.width, 2.1, 1.05)), hx), top(new THREE.CircleGeometry(jr, 32), jx), bot(S(rr(dc.width, dc.height, 1.1)))]), decal('#060607', 0.7));
    add(p, merge([
      top(new THREE.RingGeometry(jr - 0.25, jr, 32), jx), top(new THREE.RingGeometry(0.75, 1.15, 24), jx, 0.005),
      top(S(holed(rr(hs.width + 0.5, 2.6, 1.3), rrHole(hs.width, 2.1, 1.05))), hx), bot(S(rr(dc.width - 3, 0.75, 0.3), 2)).translate(0, -0.005, 0),
    ]), decal('#4a4d52', 0.35, 0.8));
    add(p, box(3, 0.7, 1.5, hx - hs.width / 2 + 1.85, yT - 0.1, zc), std({ color: '#f4f4f2', roughness: 0.3, emissive: '#fff', emissiveIntensity: 0.12 }));
  }

  const gs = [
    new THREE.CylinderGeometry(1.55, 1.6, 0.6, 16).rotateX(PI / 2).translate(0, 0, -0.275),
    new THREE.CylinderGeometry(0.6, 0.6, 2.6, 8).rotateX(PI / 2).translate(0, 0, -1.85),
    new THREE.BoxGeometry(2.0, 0.36, 0.2), new THREE.BoxGeometry(0.36, 2.0, 0.2),
  ];
  gs.forEach((g) => g.deleteAttribute('uv'));
  const screwBase = [[-25, 42 + BY, -3.4], [25, 42 + BY, -3.4], [-25, BY - 42, -3.4], [25, BY - 42, -3.4], [-27.4, 18, -0.8], [27.4, 18, -0.8], [-27.4, -30, -0.8], [27.4, -30, -0.8]].map((v) => new V3(...v));
  const screws = new THREE.InstancedMesh(merge(gs), std({ color: '#c3c8cf', metalness: 1, roughness: 0.2 }), screwBase.length);
  screws.frustumCulled = false;
  model.add(screws);

  model.updateMatrixWorld(true);
  const list = PARTS.map((s) => parts[s.id]);
  for (const p of list) p.box = new THREE.Box3().setFromObject(p.group);

  const up = new V3(0, 1, 0), dn = new V3(0, -1, 0), L = parts.logicBoard;
  // live kapton ribbons: wheel flex → J2, LCD → J1, drive → J4 (board back)
  const ribbons = [
    ribbon(mats.ribbon, parts.wheelFlex, new V3(whc[0] - 6, whc[1] - ro - 1.8, -0.08), dn, L, new V3(-15, BY - 39.5, BZ + 0.5), dn, 6.5),
    ribbon(mats.ribbon, parts.lcd, new V3(swc[0], swc[1] + fh / 2 - 1.5, -2.45), up, L, new V3(0, 41.7 + BY, BZ + 0.55), up, 13),
    ribbon(mats.ribbon, parts.storage, new V3(8, dcy - dh / 2 + 1.5, 0.05), dn, L, new V3(8, BY - 35.5, BB - 0.5), dn, 10),
  ];
  ribbons.forEach((r) => model.add(r.mesh));

  function setBrand({ monogram = '', name = '', tagline = '' } = {}) {
    back.brand = { monogram, name, line: tagline };
    if (!back.pair) return; // not drawn yet: its paint uses the brand
    T.backCanvases(back.bw, back.bh, back.brand).forEach((c, i) => {
      const g = back.pair[i].getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); // the canvas keeps its mirror/scale transform: copy 1:1
      g.drawImage(c, 0, 0);
    });
    back.cT.needsUpdate = back.rT.needsUpdate = true;
  }

  return { model, parts: list, screws, screwBase, textures, paints, mats, ribbons, setBrand };
}
