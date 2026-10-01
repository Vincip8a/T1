// Procedural iPod Classic (6th/7th gen, silver) built as separable exploded-view parts.
// Model space: millimetres, origin at the centre of the front face, x → right, y → up,
// front face at z = 0, back at z = -IPOD.depth.
import * as THREE from 'three';
import { toCreasedNormals, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { IPOD, PARTS, COLORS } from '../../../shared/ipodSpec.js';
import * as T from './textures.js';

const PI = Math.PI;
const W = IPOD.width, H = IPOD.height;
export const SX = (x) => x - W / 2;
export const SY = (y) => H / 2 - y;
/** Front-face bevel of the faceplate: its full outline is reached at z = -FACE_BEVEL. */
export const FACE_BEVEL = 0.3;

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
/** Rounded rect whose *bevelled* outline is w×h (shape inset by bevel b). Holes are grown by b instead. */
const rr = (w, h, r, cx, cy, b = 0) => rrPath(new THREE.Shape(), w - 2 * b, h - 2 * b, r - b, cx, cy);
const rrHole = (w, h, r, cx, cy, b = 0) => rrPath(new THREE.Path(), w + 2 * b, h + 2 * b, r + b, cx, cy);
const circle = (r, cx = 0, cy = 0, hole = false) => {
  const p = hole ? new THREE.Path() : new THREE.Shape();
  p.absarc(cx, cy, r, 0, 2 * PI, false);
  return p;
};

/** Extrude with a rounded bevel; the result spans z ∈ [-depth, 0] (front cap at z = 0). */
function ext(shape, depth, b = 0, segs = 3, curveSegments = 40) {
  const bt = Math.min(b, depth / 2 - 0.02);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * Math.max(bt, 0), 0.02), bevelEnabled: b > 0,
    bevelThickness: Math.max(bt, 0), bevelSize: b, bevelSegments: segs, curveSegments,
  });
  g.translate(0, 0, -(depth - Math.max(bt, 0)));
  const out = toCreasedNormals(g, PI / 5);
  g.dispose();
  // keep the flat caps truly flat (the cap triangulation only has contour vertices, so
  // smoothed edge normals would otherwise bleed across the whole face as streaks)
  const n = out.attributes.normal, pos = out.attributes.position;
  const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b2.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    if (Math.abs(a.z - b2.z) < 1e-5 && Math.abs(a.z - c.z) < 1e-5) {
      const nz = b2.sub(a).cross(c.sub(a)).z > 0 ? 1 : -1;
      for (let k = 0; k < 3; k++) n.setXYZ(i + k, 0, 0, nz);
    }
  }
  return out;
}

export function buildIpod({ maxAniso = 8 } = {}) {
  const textures = [];
  const tx = (c, o = {}) => { const t = T.tex(c, { aniso: maxAniso, ...o }); textures.push(t); return t; };
  const brushedC = T.brushed(3, 210, 45);
  const brushedT = (w, h) => T.capFit(tx(brushedC, { color: false, wrap: true }), w + 6, h + 6);

  const model = new THREE.Group();
  model.name = 'ipod';
  const parts = {};
  const mk = (id) => {
    const spec = PARTS.find((p) => p.id === id);
    const g = new THREE.Group();
    g.name = id;
    g.position.z = -spec.z;
    model.add(g);
    parts[id] = { id, group: g, mats: [], z0: -spec.z, index: PARTS.indexOf(spec) };
    return parts[id];
  };
  const add = (part, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    part.group.add(m);
    if (!part.mats.includes(mat)) part.mats.push(mat);
    return m;
  };
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);

  // ---------- front plate (anodised aluminium) ----------
  const sw = IPOD.screenWindow, wh = IPOD.wheel;
  const swc = [SX(sw.x + sw.width / 2), SY(sw.y + sw.height / 2)];
  const whc = [SX(wh.cx), SY(wh.cy)];
  const R = wh.diameter / 2;
  {
    const p = mk('faceplate');
    const b = FACE_BEVEL;
    const s = rr(W, H, IPOD.cornerRadius, 0, 0, b);
    s.holes.push(rrHole(sw.width, sw.height, sw.radius, swc[0], swc[1], 0.15));
    s.holes.push(circle(R + 0.15 + 0.2, whc[0], whc[1], true));
    const rough = T.capFit(tx(T.brushed(4, 230, 14), { color: false, wrap: true }), W + 6, H + 6);
    const mat = phys({
      color: COLORS.aluminium, metalness: 0.6, roughness: 0.44, roughnessMap: rough,
      anisotropy: 0.3, clearcoat: 0.12, clearcoatRoughness: 0.45,
    });
    add(p, ext(s, 0.8, b, 4), mat);
  }

  // ---------- display window (acrylic with black print) ----------
  {
    const p = mk('screenGlass');
    const gw = sw.width - 0.1, gh = sw.height - 0.1;
    const alpha = T.capFit(tx(T.glassAlphaCanvas(gw, gh, IPOD.screen.width + 0.6, IPOD.screen.height + 0.6), { color: false }), gw, gh);
    const mat = phys({
      color: '#07080a', metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02,
      transparent: true, alphaMap: alpha, ior: 1.49, specularIntensity: 1, envMapIntensity: 0.55,
    });
    add(p, ext(rr(gw, gh, sw.radius, 0, 0, 0.12), 0.6, 0.12), mat, swc[0], swc[1], 0);
  }

  // ---------- click wheel + centre button ----------
  {
    const p = mk('clickWheel');
    const cb = IPOD.centerButton.diameter / 2;
    const s = circle(R - 0.1);
    s.holes.push(circle(cb + 0.25 + 0.3, 0, 0, true));
    const map = T.capFit(tx(T.wheelCanvas(wh.diameter, IPOD.wheelLabels.radiusFactor)), wh.diameter, wh.diameter);
    const mat = phys({ color: '#ffffff', map, roughness: 0.48, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.2, sheenColor: '#ffffff' });
    add(p, ext(s, 1.4, 0.3, 4, 96), mat, whc[0], whc[1], 0);
    const cmat = phys({ color: COLORS.centerButton, metalness: 0.45, roughness: 0.36, roughnessMap: brushedT(16, 16), clearcoat: 0.3 });
    add(p, ext(circle(cb - 0.4), 1.25, 0.4, 4, 72), cmat, whc[0], whc[1], -0.12);
    const well = new THREE.MeshStandardMaterial({ color: '#0c0d0f', roughness: 0.7 });
    const ws = circle(R + 0.6); ws.holes.push(circle(cb - 2, 0, 0, true));
    add(p, ext(ws, 0.2, 0, 1, 96), well, whc[0], whc[1], -1.45);
    p.mats.push(well);
  }

  // ---------- click-wheel flex (copper on kapton) ----------
  {
    const p = mk('wheelFlex');
    const ft = tx(T.flexCanvas(), { wrap: true });
    ft.repeat.set(1 / 14, 1 / 14);
    const mat = phys({ color: '#ffffff', map: ft, metalness: 0.25, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    const ring = circle(R - 3); ring.holes.push(circle(9.5, 0, 0, true));
    add(p, ext(ring, 0.15, 0, 1, 96), mat, whc[0], whc[1], 0);
    add(p, ext(rr(9, 30, 1.2), 0.15), mat, whc[0] + 6, whc[1] + R + 12, 0);
    const stiff = new THREE.MeshStandardMaterial({ color: '#ece9e1', roughness: 0.6 });
    add(p, ext(rr(10, 4, 0.6), 0.35), stiff, whc[0] + 6, whc[1] + R + 26, 0.2);
    p.mats.push(stiff);
  }

  // ---------- LCD module + metal frame ----------
  {
    const p = mk('lcd');
    const fw = sw.width + 3, fh = sw.height + 3;
    const frame = phys({ color: COLORS.steel, metalness: 0.92, roughness: 0.3, roughnessMap: brushedT(fw, fh), anisotropy: 0.5 });
    add(p, ext(rr(fw, fh, 1.2, 0, 0, 0.15), 2.4, 0.15), frame, swc[0], swc[1], 0);
    const bezel = new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.55 });
    add(p, ext(rr(sw.width - 0.4, sw.height - 0.4, 0.6), 0.12), bezel, swc[0], swc[1], 0.12);
    const panel = phys({ color: '#0b0d0f', metalness: 0, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 0.3 });
    const pg = new THREE.PlaneGeometry(IPOD.screen.width, IPOD.screen.height);
    add(p, pg, panel, swc[0], swc[1], 0.14);
    const flex = phys({ color: COLORS.flex, metalness: 0.25, roughness: 0.3, clearcoat: 0.8 });
    add(p, ext(rr(18, 12, 1), 0.15), flex, swc[0] - 8, swc[1] - fh / 2 - 5.5, -1.6);
    p.mats.push(bezel);
  }

  // ---------- logic board ----------
  const BW = 57.4, BH = 96, BY = 0.25;
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
  {
    const p = mk('logicBoard');
    const pcb = T.capFit(tx(T.pcbCanvas(BW, BH, [...chips, ...others])), BW, BH);
    const mat = phys({ color: '#ffffff', map: pcb, roughness: 0.4, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.22 });
    const board = rr(BW, BH, 3, 0, 0, 0.1);
    add(p, ext(board, 0.8, 0.1), mat, 0, BY, -0.4);
    chips.forEach((c, i) => {
      const m = new THREE.MeshPhysicalMaterial({ map: tx(T.chipCanvas(c.lines, i + 3)), roughness: 0.5, clearcoat: 0.2 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), m);
      box.position.set(c.x, c.y + BY, -0.4 + c.d / 2);
      p.group.add(box); p.mats.push(m);
    });
    const can = phys({ color: '#cdd1d6', metalness: 1, roughness: 0.28, roughnessMap: brushedT(30, 30) });
    const zif = new THREE.MeshStandardMaterial({ color: '#e8e1cf', roughness: 0.55 });
    const latch = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.5 });
    const xtal = phys({ color: '#d9dce0', metalness: 1, roughness: 0.2 });
    p.mats.push(can, zif, latch, xtal);
    for (const o of others) {
      const mat2 = o.kind === 'can' ? can : o.kind === 'zif' ? zif : xtal;
      const geo = o.kind === 'can' ? ext(rr(o.w, o.h, 0.8, 0, 0, 0.25), o.d, 0.25) : new THREE.BoxGeometry(o.w, o.h, o.d);
      const m = new THREE.Mesh(geo, mat2);
      m.position.set(o.x, o.y + BY, o.kind === 'can' ? -0.4 + o.d : -0.4 + o.d / 2);
      p.group.add(m);
      if (o.kind === 'zif') {
        const l = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h * 0.35, 0.35), latch);
        l.position.set(o.x, o.y + BY - o.h * 0.32, -0.4 + o.d + 0.1);
        p.group.add(l);
      }
    }
    // dock connector, headphone jack, hold switch
    const plastic = new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.45 });
    const shroud = phys({ color: '#e0e3e7', metalness: 1, roughness: 0.18 });
    p.mats.push(plastic, shroud);
    const dock = new THREE.Mesh(ext(rr(IPOD.dockConnector.width + 0.8, 3.4, 0.9, 0, 0, 0.2), 3.2, 0.2), shroud);
    dock.position.set(0, -H / 2 + 2.4, 1.8);
    p.group.add(dock);
    const dockIn = new THREE.Mesh(new THREE.BoxGeometry(IPOD.dockConnector.width - 1, 1.6, 2.6), plastic);
    dockIn.position.set(0, -H / 2 + 2.4, 0.35);
    p.group.add(dockIn);
    const jack = new THREE.Mesh(new THREE.BoxGeometry(6.5, 9, 3.4), plastic);
    jack.position.set(SX(IPOD.headphoneJack.x), H / 2 - 6.5, -2.1);
    p.group.add(jack);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 1.2, 40), shroud);
    ring.position.set(SX(IPOD.headphoneJack.x), H / 2 - 2.2, -2.1);
    p.group.add(ring);
    const hold = new THREE.Mesh(ext(rr(IPOD.holdSwitch.width + 1, 3, 0.8, 0, 0, 0.2), 1.8, 0.2), shroud);
    hold.position.set(SX(IPOD.holdSwitch.x + IPOD.holdSwitch.width / 2), H / 2 - 3, -0.4);
    p.group.add(hold);
    // SMD passives
    const r = T.rng(9);
    const pas = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.55, 0.45), new THREE.MeshStandardMaterial({ roughness: 0.55 }), 110);
    const busy = [...chips, ...others];
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let n = 0, guard = 0;
    while (n < 110 && guard++ < 4000) {
      const x = (r() - 0.5) * (BW - 6), y = (r() - 0.5) * (BH - 12);
      if (busy.some((c) => Math.abs(x - c.x) < c.w / 2 + 2 && Math.abs(y - c.y) < c.h / 2 + 2)) continue;
      m4.makeRotationZ(r() > 0.5 ? PI / 2 : 0).setPosition(x, y + BY, -0.4 + 0.22);
      pas.setMatrixAt(n, m4);
      pas.setColorAt(n, col.set(r() > 0.45 ? '#a9845a' : r() > 0.5 ? '#2e2f33' : '#cfc8b8'));
      n++;
    }
    pas.count = n;
    p.group.add(pas); p.mats.push(pas.material);
    p.mats.unshift(mat);
  }

  // ---------- battery ----------
  {
    const p = mk('battery');
    const bw = 50, bh = 21;
    const map = T.capFit(tx(T.batteryCanvas(bw, bh)), bw - 1.2, bh - 1.2);
    const mat = phys({ color: '#ffffff', map, metalness: 0.2, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    add(p, ext(rr(bw, bh, 2.4, 0, 0, 0.6), 2.6, 0.6, 4), mat, 0, SY(88.5), 0);
    const red = new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.4 });
    const blk = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.4 });
    [[red, -3], [blk, -1]].forEach(([m, x]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 7, 10), m);
      w.position.set(x - 14, SY(88.5) + bh / 2 + 3.2, -0.6);
      p.group.add(w); p.mats.push(m);
    });
  }

  // ---------- 1.8" hard drive + rubber bumpers ----------
  {
    const p = mk('storage');
    const dw = 54, dh = 71, cy = SY(41);
    const body = phys({ color: '#5a5f66', metalness: 0.7, roughness: 0.5 });
    add(p, ext(rr(dw, dh, 2.2, 0, 0, 0.3), 4.3, 0.3), body, 0, cy, -0.5);
    const label = T.capFit(tx(T.driveCanvas(dw - 0.6, dh - 0.6)), dw - 0.6 - 0.2, dh - 0.6 - 0.2);
    const top = phys({ color: '#ffffff', map: label, metalness: 0.75, roughness: 0.34, roughnessMap: brushedT(dw, dh), anisotropy: 0.4 });
    add(p, ext(rr(dw - 0.6, dh - 0.6, 2, 0, 0, 0.1), 0.5, 0.1), top, 0, cy, 0);
    const rubber = phys({ color: '#1b1c1f', roughness: 0.85, metalness: 0, sheen: 0.4, sheenColor: '#555' });
    const bump = ext(rr(9, 12, 2.6, 0, 0, 0.9), 5.2, 0.9, 4);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => add(p, bump, rubber, sx * (dw / 2 - 2.4), cy + sy * (dh / 2 - 3.6), 0.2));
    const flex = phys({ color: COLORS.flex, metalness: 0.25, roughness: 0.3, clearcoat: 0.8 });
    add(p, ext(rr(34, 7, 0.8), 0.15), flex, -4, cy - dh / 2 - 2.5, -0.3);
  }

  // ---------- mid-frame + clips ----------
  {
    const p = mk('midframe');
    const zinc = phys({ color: '#868b92', metalness: 0.8, roughness: 0.42, roughnessMap: brushedT(40, 40) });
    const s = rr(W - 1.8, H - 1.8, IPOD.cornerRadius - 0.8, 0, 0, 0.15);
    s.holes.push(rrHole(W - 4.6, H - 4.6, IPOD.cornerRadius - 2, 0, 0, 0.15));
    add(p, ext(s, 3, 0.15), zinc, 0, 0, 0);
    // two cross ribs
    [-6, 26].forEach((y) => add(p, ext(rr(W - 4, 2.2, 0.6, 0, 0, 0.1), 1.2, 0.1), zinc, 0, y, -1.6));
    const clipMat = phys({ color: '#d6dade', metalness: 1, roughness: 0.22 });
    const clips = new THREE.InstancedMesh(ext(rr(1.4, 5.5, 0.5, 0, 0, 0.15), 2.4, 0.15), clipMat, 12);
    const m4 = new THREE.Matrix4();
    let i = 0;
    [-38, -14, 10, 34].forEach((y) => [-1, 1].forEach((sx) => { clips.setMatrixAt(i++, m4.makeTranslation(sx * (W / 2 - 0.9), y, -0.3)); }));
    [-1, 1].forEach((sy) => [-14, 14].forEach((x) => { clips.setMatrixAt(i++, m4.makeRotationZ(PI / 2).setPosition(x, sy * (H / 2 - 0.9), -0.3)); }));
    p.group.add(clips);
    p.mats.push(zinc, clipMat);
  }

  // ---------- back shell (mirror-polished stainless tub) ----------
  let backTex;
  {
    const p = mk('backShell');
    const sw2 = W - 0.4, sh2 = H - 0.4, cr = IPOD.cornerRadius - 0.2;
    const wallMat = phys({ color: COLORS.steel, metalness: 1, roughness: 0.07, envMapIntensity: 1.1 });
    const ring = rr(sw2, sh2, cr, 0, 0, 0.2);
    ring.holes.push(rrHole(sw2 - 1.2, sh2 - 1.2, cr - 0.6, 0, 0, 0.2));
    add(p, ext(ring, 8.6, 0.2), wallMat, 0, 0, 8.6);
    const [cC, rC] = T.backCanvases(sw2 - 1.8, sh2 - 1.8, {});
    const cT = T.capFit(tx(cC), sw2 - 1.8, sh2 - 1.8), rT = T.capFit(tx(rC, { color: false }), sw2 - 1.8, sh2 - 1.8);
    backTex = { cC, rC, cT, rT, w: sw2 - 1.8, h: sh2 - 1.8 };
    const backMat = phys({ color: COLORS.steel, map: cT, metalness: 1, roughness: 0.55, roughnessMap: rT, envMapIntensity: 1.1 });
    add(p, ext(rr(sw2, sh2, cr, 0, 0, 0.9), 1.7, 0.9, 6), backMat, 0, 0, 0.6);
    const inner = T.capFit(tx(T.shellInnerCanvas(sw2 - 1.4, sh2 - 1.4)), sw2 - 1.4, sh2 - 1.4);
    const innerMat = new THREE.MeshStandardMaterial({ map: inner, metalness: 0.55, roughness: 0.55 });
    add(p, new THREE.ShapeGeometry(rr(sw2 - 1.4, sh2 - 1.4, cr - 0.7), 24), innerMat, 0, 0, 0.62);
  }

  // ---------- screws (instanced) ----------
  const screwGeo = (() => {
    const head = new THREE.CylinderGeometry(1.55, 1.6, 0.6, 28).rotateX(PI / 2).translate(0, 0, -0.275);
    const shaft = new THREE.CylinderGeometry(0.6, 0.6, 2.6, 16).rotateX(PI / 2).translate(0, 0, -1.85);
    const slotA = new THREE.BoxGeometry(2.0, 0.36, 0.2).translate(0, 0, 0.0);
    const slotB = new THREE.BoxGeometry(0.36, 2.0, 0.2).translate(0, 0, 0.0);
    [head, shaft, slotA, slotB].forEach((g) => { g.deleteAttribute('uv'); });
    const g = mergeGeometries([head, shaft, slotA, slotB]);
    [head, shaft, slotA, slotB].forEach((x) => x.dispose());
    return g;
  })();
  const screwMat = phys({ color: '#c3c8cf', metalness: 1, roughness: 0.2 });
  const screwBase = [
    [-25, 42 + BY, -3.4], [25, 42 + BY, -3.4], [-25, -42 + BY, -3.4], [25, -42 + BY, -3.4],
    [-27.4, 18, -0.8], [27.4, 18, -0.8], [-27.4, -30, -0.8], [27.4, -30, -0.8],
  ].map((v) => new THREE.Vector3(...v));
  const screws = new THREE.InstancedMesh(screwGeo, screwMat, screwBase.length);
  screws.frustumCulled = false;
  model.add(screws);

  // ---------- bounding boxes (model space, assembled) ----------
  model.updateMatrixWorld(true);
  const list = PARTS.map((s) => parts[s.id]);
  for (const p of list) p.box = new THREE.Box3().setFromObject(p.group);

  function setBrand({ monogram = '', name = '', tagline = '' } = {}) {
    const [cC, rC] = T.backCanvases(backTex.w, backTex.h, { monogram, name, line: tagline });
    backTex.cC.getContext('2d').drawImage(cC, 0, 0);
    backTex.rC.getContext('2d').drawImage(rC, 0, 0);
    backTex.cT.needsUpdate = true; backTex.rT.needsUpdate = true;
  }

  return { model, parts: list, byId: parts, screws, screwBase, screwMat, textures, setBrand };
}
