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
/** Circle as 8 arcs, so curveSegments (per arc) stays low for corners but circles stay round. */
const circle = (r, hole = false, cx = 0, cy = 0) => {
  const p = hole ? new THREE.Path() : new THREE.Shape();
  for (let i = 0; i < 8; i++) p.absarc(cx, cy, r, (i * PI) / 4, ((i + 1) * PI) / 4, false);
  return p;
};

/** Extrude with a rounded bevel; spans z ∈ [-depth, 0]. Caps get exact flat normals. */
function ext(shape, depth, b = 0, segs = 3, curveSegments = 14) {
  const bt = Math.min(b, depth / 2 - 0.02);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * Math.max(bt, 0), 0.02), bevelEnabled: b > 0,
    bevelThickness: Math.max(bt, 0), bevelSize: b, bevelSegments: segs, curveSegments,
  });
  g.translate(0, 0, -(depth - Math.max(bt, 0)));
  const out = toCreasedNormals(g, PI / 5);
  g.dispose();
  const n = out.attributes.normal, pos = out.attributes.position;
  for (let i = 0; i < pos.count; i += 3) {
    const z = pos.getZ(i);
    if (Math.abs(z - pos.getZ(i + 1)) < 1e-5 && Math.abs(z - pos.getZ(i + 2)) < 1e-5) {
      const nz = Math.sign(n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)) || 1;
      for (let k = 0; k < 3; k++) n.setXYZ(i + k, 0, 0, nz);
    }
  }
  return out;
}

export function buildIpod({ maxAniso = 8 } = {}) {
  const textures = [];
  const tx = (c, o = {}) => { const t = T.tex(c, { aniso: maxAniso, ...o }); textures.push(t); return t; };
  // One shared, world-scaled brushing texture (cap uv = mm): tiles every 40 mm.
  const brush = tx(T.brushed(3, 128, 16), { color: false, wrap: true });
  brush.repeat.set(1 / 40, 1 / 40);

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

  // ---------- front plate: anodised, finely brushed aluminium ----------
  {
    const p = mk('faceplate');
    const b = FACE_BEVEL;
    const s = rr(W, H, IPOD.cornerRadius, b);
    s.holes.push(rrHole(sw.width, sw.height, sw.radius, b, ...swc));
    s.holes.push(circle(R + 0.12 + b, true, ...whc));
    mats.face = phys({
      color: COLORS.aluminium, metalness: 0.82, roughness: 0.42, roughnessMap: brush,
      anisotropy: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.28,
      emissive: '#ffffff', emissiveIntensity: 0,
      emissiveMap: T.capFit(tx(T.faceGlowCanvas(), { color: false }), W, H),
    });
    const g = ext(s, 0.8, b, 3, 20);
    add(p, g, mats.face);
  }

  // ---------- display window: tinted acrylic with printed black mask ----------
  {
    const p = mk('screenGlass');
    const gw = sw.width - 0.1, gh = sw.height - 0.1;
    const alpha = T.capFit(tx(T.glassAlphaCanvas(gw, gh, IPOD.screen.width + 0.6, IPOD.screen.height + 0.6), { color: false }), gw, gh);
    mats.glass = phys({
      color: '#020304', metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03,
      transparent: true, alphaMap: alpha, ior: 1.49, specularIntensity: 1, envMapIntensity: 1,
    });
    add(p, ext(rr(gw, gh, sw.radius, 0.1), 0.6, 0.1, 2, 8), mats.glass, swc[0], swc[1], 0);
  }

  // ---------- click wheel + centre button (hairline gaps, no visible well) ----------
  {
    const p = mk('clickWheel');
    const bw = 0.22;
    const s = circle(R - bw);
    s.holes.push(circle(CB + 0.1 + bw, true));
    const map = T.capFit(tx(T.wheelCanvas(wh.diameter, IPOD.wheelLabels.radiusFactor)), wh.diameter, wh.diameter);
    mats.wheel = phys({ color: '#e4e4e4', map, roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, sheen: 0.25, sheenColor: '#ffffff' });
    add(p, ext(s, 1.3, bw, 3, 24), mats.wheel, whc[0], whc[1], 0);
    mats.centre = phys({ color: COLORS.centerButton, metalness: 0.45, roughness: 0.4, roughnessMap: brush, anisotropy: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3 });
    add(p, ext(circle(CB - 0.2), 1.2, 0.2, 3, 14), mats.centre, whc[0], whc[1], -0.08);
    const ws = circle(R + 0.5); ws.holes.push(circle(CB - 2, true));
    add(p, ext(ws, 0.2, 0, 1, 12), std({ color: '#3a3c40', roughness: 0.8 }), whc[0], whc[1], -1.35);
  }

  // ---------- click-wheel flex: capacitive sensor ring on kapton ----------
  {
    const p = mk('wheelFlex');
    const ft = tx(T.flexCanvas(), { wrap: true });
    ft.repeat.set(1 / 10, 1 / 10);
    const fmat = phys({ color: '#ffffff', map: ft, metalness: 0.25, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    const ro = R - 3, ring = circle(ro); ring.holes.push(circle(9.5, true));
    const rmap = T.capFit(tx(T.flexRingCanvas(2 * ro, 9.5, ro)), 2 * ro, 2 * ro);
    add(p, ext(ring, 0.15, 0, 1, 12), phys({ color: '#ffffff', map: rmap, metalness: 0.2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }), whc[0], whc[1], 0);
    add(p, ext(rr(9, 30, 1.2), 0.15), fmat, whc[0] + 6, whc[1] + R + 12, 0);
    add(p, ext(rr(10, 4, 0.6), 0.35), std({ color: '#ece9e1', roughness: 0.6 }), whc[0] + 6, whc[1] + R + 26, 0.2);
    mats.flex = fmat;
  }

  // ---------- LCD module: brushed steel frame, dark panel, flex tail ----------
  {
    const p = mk('lcd');
    const fw = sw.width + 3, fh = sw.height + 3;
    add(p, ext(rr(fw, fh, 1.2, 0.15), 2.4, 0.15), phys({ color: COLORS.steel, metalness: 0.92, roughness: 0.3, roughnessMap: brush, anisotropy: 0.5 }), swc[0], swc[1], 0);
    add(p, ext(rr(sw.width - 0.6, sw.height - 0.6, 0.6), 0.1), std({ color: '#0d0e10', roughness: 0.55 }), swc[0], swc[1], 0.1);
    mats.panel = phys({ color: COLORS.lcdOff, metalness: 0, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.08 });
    add(p, new THREE.PlaneGeometry(IPOD.screen.width, IPOD.screen.height), mats.panel, swc[0], swc[1], 0.12);
    add(p, ext(rr(18, 12, 1), 0.15), mats.flex, swc[0] - 8, swc[1] - fh / 2 - 5.5, -1.6);
  }

  // ---------- logic board ----------
  const BW = 57.4, BH = 96, BY = 0.25, BZ = -0.4;
  const chips = [
    { ref: 'U1', x: -9, y: 20, w: 13, h: 13, d: 1.0, lines: ['DN8702', '0726 K4B', 'TAIWAN'] },
    { ref: 'U2', x: 11, y: 27, w: 12, h: 9, d: 0.9, lines: ['K4M513', 'PE-DG75'] },
    { ref: 'U3', x: 11, y: 12, w: 12, h: 10, d: 1.0, lines: ['NAND 32G', 'E3 BB2'] },
    { ref: 'U4', x: -15, y: 0, w: 7, h: 7, d: 0.8, lines: ['CS42L', 'CNZ'] },
    { ref: 'U5', x: 1, y: -1, w: 6, h: 6, d: 0.7, lines: ['PMU', '1723'] },
  ];
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
    add(p, ext(rr(BW, BH, 3, 0.1), 0.8, 0.1), phys({ color: '#ffffff', map: pcb, roughness: 0.42, metalness: 0.05, clearcoat: 0.45, clearcoatRoughness: 0.25 }), 0, BY, BZ);
    const chipGeo = new THREE.BoxGeometry(1, 1, 1);
    chips.forEach((c, i) => {
      const m = add(p, chipGeo, phys({ map: tx(T.chipCanvas(c.lines, i + 3)), roughness: 0.5, clearcoat: 0.2 }), c.x, c.y + BY, BZ + c.d / 2);
      m.scale.set(c.w, c.h, c.d);
    });
    const can = phys({ color: '#cdd1d6', metalness: 1, roughness: 0.28, roughnessMap: brush });
    const zif = std({ color: '#e8e1cf', roughness: 0.55 });
    const latch = std({ color: '#1a1a1c', roughness: 0.5 });
    const shiny = phys({ color: '#e0e3e7', metalness: 1, roughness: 0.18 });
    for (const o of others) {
      if (o.kind === 'can') { add(p, ext(rr(o.w, o.h, 0.8, 0.25), o.d, 0.25), can, o.x, o.y + BY, BZ + o.d); continue; }
      add(p, chipGeo, o.kind === 'zif' ? zif : shiny, o.x, o.y + BY, BZ + o.d / 2).scale.set(o.w, o.h, o.d);
      if (o.kind === 'zif') add(p, chipGeo, latch, o.x, o.y + BY - o.h * 0.32, BZ + o.d + 0.1).scale.set(o.w, o.h * 0.35, 0.35);
    }
    // dock connector, headphone jack, hold switch
    const plastic = std({ color: '#1c1d20', roughness: 0.45 });
    add(p, ext(rr(IPOD.dockConnector.width + 0.8, 3.4, 0.9, 0.2), 3.2, 0.2), shiny, 0, -H / 2 + 2.4, 1.8);
    add(p, chipGeo, plastic, 0, -H / 2 + 2.4, 0.35).scale.set(IPOD.dockConnector.width - 1, 1.6, 2.6);
    add(p, chipGeo, plastic, SX(IPOD.headphoneJack.x), H / 2 - 6.5, -2.1).scale.set(6.5, 9, 3.4);
    add(p, new THREE.CylinderGeometry(2.3, 2.3, 1.2, 32), shiny, SX(IPOD.headphoneJack.x), H / 2 - 2.2, -2.1);
    add(p, ext(rr(IPOD.holdSwitch.width + 1, 3, 0.8, 0.2), 1.8, 0.2), shiny, SX(IPOD.holdSwitch.x + IPOD.holdSwitch.width / 2), H / 2 - 3, BZ);
    // SMD passives
    const r = T.rng(9);
    const pas = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.55, 0.45), std({ roughness: 0.55 }), 120);
    const busy = [...chips, ...others];
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let n = 0;
    for (let guard = 0; n < 120 && guard < 4000; guard++) {
      const x = (r() - 0.5) * (BW - 6), y = (r() - 0.5) * (BH - 12);
      if (busy.some((c) => Math.abs(x - c.x) < c.w / 2 + 2 && Math.abs(y - c.y) < c.h / 2 + 2)) continue;
      pas.setMatrixAt(n, m4.makeRotationZ(r() > 0.5 ? PI / 2 : 0).setPosition(x, y + BY, BZ + 0.22));
      pas.setColorAt(n++, col.set(r() > 0.45 ? '#a9845a' : r() > 0.5 ? '#2e2f33' : '#cfc8b8'));
    }
    pas.count = n;
    p.group.add(pas);
  }

  // ---------- battery: dark Li-ion pouch ----------
  {
    const p = mk('battery');
    const bw = 50, bh = 21, cy = SY(88.5);
    const map = T.capFit(tx(T.batteryCanvas(bw, bh)), bw - 1.2, bh - 1.2);
    add(p, ext(rr(bw, bh, 2.4, 0.6), 2.6, 0.6, 4), phys({ color: '#ffffff', map, metalness: 0.35, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.25 }), 0, cy, 0);
    [['#b3261e', -3], ['#151515', -1]].forEach(([c, x]) => add(p, new THREE.CylinderGeometry(0.4, 0.4, 7, 10), std({ color: c, roughness: 0.4 }), x - 14, cy + bh / 2 + 3.2, -0.6));
    add(p, ext(rr(9, 5, 0.6), 0.15), mats.flex, 12, cy + bh / 2 + 1.5, -0.4);
  }

  // ---------- 1.8" hard drive + rubber bumpers ----------
  {
    const p = mk('storage');
    const dw = 54, dh = 71, cy = SY(41);
    add(p, ext(rr(dw, dh, 2.2, 0.3), 4.3, 0.3), phys({ color: '#5a5f66', metalness: 0.7, roughness: 0.5 }), 0, cy, -0.5);
    const label = T.capFit(tx(T.driveCanvas(dw - 0.6, dh - 0.6)), dw - 0.8, dh - 0.8);
    add(p, ext(rr(dw - 0.6, dh - 0.6, 2, 0.1), 0.5, 0.1), phys({ color: '#ffffff', map: label, metalness: 0.75, roughness: 0.34, roughnessMap: brush, anisotropy: 0.4 }), 0, cy, 0);
    const rubber = phys({ color: '#1b1c1f', roughness: 0.85, metalness: 0, sheen: 0.4, sheenColor: '#555' });
    const bump = ext(rr(9, 12, 2.6, 0.9), 5.2, 0.9, 3);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => add(p, bump, rubber, sx * (dw / 2 - 2.4), cy + sy * (dh / 2 - 3.6), 0.2));
    add(p, ext(rr(34, 7, 0.8), 0.15), mats.flex, -4, cy - dh / 2 - 2.5, -0.3);
  }

  // ---------- internal mid-frame + clips ----------
  {
    const p = mk('midframe');
    const zinc = phys({ color: '#868b92', metalness: 0.8, roughness: 0.42, roughnessMap: brush });
    const s = rr(W - 1.8, H - 1.8, IPOD.cornerRadius - 0.8, 0.15);
    s.holes.push(rrHole(W - 4.6, H - 4.6, IPOD.cornerRadius - 2, 0.15));
    add(p, ext(s, 3, 0.15), zinc);
    [-6, 26].forEach((y) => add(p, ext(rr(W - 4, 2.2, 0.6, 0.1), 1.2, 0.1), zinc, 0, y, -1.6));
    const clips = new THREE.InstancedMesh(ext(rr(1.4, 5.5, 0.5, 0.15), 2.4, 0.15), phys({ color: '#d6dade', metalness: 1, roughness: 0.22 }), 12);
    const m4 = new THREE.Matrix4();
    let i = 0;
    [-38, -14, 10, 34].forEach((y) => [-1, 1].forEach((sx) => clips.setMatrixAt(i++, m4.makeTranslation(sx * (W / 2 - 0.9), y, -0.3))));
    [-1, 1].forEach((sy) => [-14, 14].forEach((x) => clips.setMatrixAt(i++, m4.makeRotationZ(PI / 2).setPosition(x, sy * (H / 2 - 0.9), -0.3))));
    p.group.add(clips);
  }

  // ---------- back shell: mirror-polished stainless tub ----------
  let back;
  {
    const p = mk('backShell');
    const w2 = W - 0.3, h2 = H - 0.3, cr = IPOD.cornerRadius - 0.15;
    const steel = phys({ color: COLORS.steel, metalness: 1, roughness: 0.06, clearcoat: 0.6, clearcoatRoughness: 0.04 });
    const ring = rr(w2, h2, cr, 0.25);
    ring.holes.push(rrHole(w2 - 1.2, h2 - 1.2, cr - 0.6, 0.25));
    add(p, ext(ring, 8.6, 0.25, 3, 18), steel, 0, 0, 8.6);
    mats.steel = steel;
    const bw = w2 - 1.8, bh = h2 - 1.8;
    const [cC, rC] = T.backCanvases(bw, bh, {});
    const cT = T.capFit(tx(cC), bw, bh), rT = T.capFit(tx(rC, { color: false }), bw, bh);
    back = { cC, rC, cT, rT, bw, bh };
    const backMat = phys({ color: COLORS.steel, map: cT, metalness: 1, roughness: 1, roughnessMap: rT, clearcoat: 0.6, clearcoatRoughness: 0.04 });
    add(p, ext(rr(w2, h2, cr, 0.9), 1.7, 0.9, 6, 18), backMat, 0, 0, 0.6);
    mats.back = backMat;
    const inner = T.capFit(tx(T.shellInnerCanvas(w2 - 1.4, h2 - 1.4)), w2 - 1.4, h2 - 1.4);
    add(p, new THREE.ShapeGeometry(rr(w2 - 1.4, h2 - 1.4, cr - 0.7), 12), std({ map: inner, metalness: 0.55, roughness: 0.55 }), 0, 0, 0.62);
  }

  // ---------- screws (instanced) ----------
  const screwGeo = (() => {
    const gs = [
      new THREE.CylinderGeometry(1.55, 1.6, 0.6, 24).rotateX(PI / 2).translate(0, 0, -0.275),
      new THREE.CylinderGeometry(0.6, 0.6, 2.6, 12).rotateX(PI / 2).translate(0, 0, -1.85),
      new THREE.BoxGeometry(2.0, 0.36, 0.2), new THREE.BoxGeometry(0.36, 2.0, 0.2),
    ];
    gs.forEach((g) => g.deleteAttribute('uv'));
    const g = mergeGeometries(gs);
    gs.forEach((x) => x.dispose());
    return g;
  })();
  const screwBase = [
    [-25, 42 + BY, -3.4], [25, 42 + BY, -3.4], [-25, -42 + BY, -3.4], [25, -42 + BY, -3.4],
    [-27.4, 18, -0.8], [27.4, 18, -0.8], [-27.4, -30, -0.8], [27.4, -30, -0.8],
  ].map((v) => new THREE.Vector3(...v));
  const screws = new THREE.InstancedMesh(screwGeo, phys({ color: '#c3c8cf', metalness: 1, roughness: 0.2 }), screwBase.length);
  screws.frustumCulled = false;
  model.add(screws);

  model.updateMatrixWorld(true);
  const list = PARTS.map((s) => parts[s.id]);
  for (const p of list) p.box = new THREE.Box3().setFromObject(p.group);

  function setBrand({ monogram = '', name = '', tagline = '' } = {}) {
    const [cC, rC] = T.backCanvases(back.bw, back.bh, { monogram, name, line: tagline });
    back.cC.getContext('2d').drawImage(cC, 0, 0);
    back.rC.getContext('2d').drawImage(rC, 0, 0);
    back.cT.needsUpdate = true; back.rT.needsUpdate = true;
  }

  return { model, parts: list, byId: parts, screws, screwBase, textures, mats, setBrand };
}
