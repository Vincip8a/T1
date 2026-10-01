// Procedural iPod Classic (6th/7th gen, silver) built as separate, physically plausible parts.
// Device-local coords: millimetres, origin at the centre of the body volume, x → right, y → up,
// +z → out of the front face. Every size is derived from IPOD / PARTS / COLORS.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { IPOD, COLORS, PARTS } from '../../../shared/ipodSpec.js';
import * as TX from './textures.js';

const W = IPOD.width, H = IPOD.height, D = IPOD.depth;
export const ZF = D / 2; // front face z
const L = Object.fromEntries(PARTS.map((p) => [p.id, p]));
const X = (x) => x - W / 2;
const Y = (y) => H / 2 - y;
const Z = (d) => ZF - d; // depth from the front → z
const zc = (id) => Z(L[id].z + L[id].thickness / 2);

/** Rounded rect (absarc corners) centred on (cx, cy), appended to a Shape or Path. */
function rr(path, cx, cy, w, h, r) {
  const x0 = cx - w / 2, y0 = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  path.moveTo(x0 + r, y0);
  path.lineTo(x0 + w - r, y0); path.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x0 + w, y0 + h - r); path.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(x0 + r, y0 + h); path.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + r); path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}
const rrShape = (cx, cy, w, h, r) => rr(new THREE.Shape(), cx, cy, w, h, r);
const rrHole = (cx, cy, w, h, r) => rr(new THREE.Path(), cx, cy, w, h, r);
const circ = (P, cx, cy, r) => { const p = new P(); p.absarc(cx, cy, r, 0, Math.PI * 2, false); return p; };

/** Extrude `shape` between depths dFront..dBack (mm from the front). Walls sit exactly on the outline. */
function slab(shape, dFront, dBack, bevel = 0, segs = 3) {
  const t = dBack - dFront;
  const bt = Math.min(bevel, t / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(t - 2 * Math.max(bt, 0), 0.01), curveSegments: 28,
    bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: segs,
  });
  g.translate(0, 0, Z(dBack) + Math.max(bt, 0));
  return g;
}

/** Planar UVs from x/y (optionally mirrored for faces seen from the back). */
function planarUV(g, x0, y0, w, h, mirror = false) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) - x0) / w;
    uv.setXY(i, mirror ? 1 - u : u, (p.getY(i) - y0) / h);
  }
  uv.needsUpdate = true;
  return g;
}

/** Quarter-arc points (degrees) for lathe profiles. */
const arc = (cx, cy, r, a0, a1, n = 7) => Array.from({ length: n + 1 }, (_, i) => {
  const a = THREE.MathUtils.degToRad(a0 + (a1 - a0) * i / n);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
/** Revolve a (radius, z) profile around the device z axis at centre c. Smooth, artefact-free rims. */
function lathe(prof, c) {
  const g = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 128);
  g.rotateX(Math.PI / 2);
  g.translate(c.x, c.y, 0);
  return g;
}

function decal(w, h, map, x, y, z, back = true) {
  const g = new THREE.PlaneGeometry(w, h);
  if (back) g.rotateY(Math.PI);
  g.translate(x, y, z);
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return [g, m];
}

export function buildIpod() {
  const tex = {
    brushA: TX.brushedTex(3, 0.42, 0.06),
    brushD: TX.brushedTex(9, 0.36, 0.2),
    wheel: TX.wheelTex(),
    back: TX.backTex('', ''),
    chip: TX.chipTex(),
    chip2: TX.chipTex(['DN-PMU', '2026 B', '343S0538']),
    battery: TX.batteryTex(),
    drive: TX.driveTex(),
    flex: TX.flexTex(),
    screw: TX.screwTex(),
  };
  tex.brushD.rotation = Math.PI / 2;

  const M = {
    alu: new THREE.MeshPhysicalMaterial({ color: COLORS.aluminium, metalness: 0.85, roughness: 0.9, roughnessMap: tex.brushA, anisotropy: 0.5, envMapIntensity: 0.62 }),
    steel: new THREE.MeshPhysicalMaterial({ color: COLORS.steel, metalness: 1, roughness: 1, roughnessMap: tex.back.rough, map: tex.back.map, clearcoat: 0.6, clearcoatRoughness: 0.05 }),
    wheel: new THREE.MeshPhysicalMaterial({ map: tex.wheel, roughness: 0.5, metalness: 0, sheen: 0.3, sheenRoughness: 0.6, envMapIntensity: 0.8 }),
    center: new THREE.MeshPhysicalMaterial({ color: COLORS.centerButton, metalness: 0.8, roughness: 0.42, envMapIntensity: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#020304', roughness: 0.08, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.04, specularIntensity: 0.35, envMapIntensity: 0.55 }),
    lcd: new THREE.MeshPhysicalMaterial({ color: COLORS.lcdOff, roughness: 0.25, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }),
    shield: new THREE.MeshStandardMaterial({ color: COLORS.steel, metalness: 1, roughness: 0.9, roughnessMap: tex.brushD }),
    pcb: null,
    pcbPlain: new THREE.MeshStandardMaterial({ color: '#1a4a31', roughness: 0.5, metalness: 0.1 }),
    chip: new THREE.MeshStandardMaterial({ map: tex.chip, roughness: 0.55, metalness: 0.1 }),
    chip2: new THREE.MeshStandardMaterial({ map: tex.chip2, roughness: 0.55, metalness: 0.1 }),
    battery: new THREE.MeshPhysicalMaterial({ color: COLORS.battery, roughness: 0.4, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
    drive: new THREE.MeshPhysicalMaterial({ color: COLORS.drive, metalness: 0.9, roughness: 0.85, roughnessMap: tex.brushD, anisotropy: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.82, metalness: 0 }),
    flex: new THREE.MeshPhysicalMaterial({ map: tex.flex, roughness: 0.35, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
    frame: new THREE.MeshStandardMaterial({ color: '#7d828a', metalness: 0.85, roughness: 0.42 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d7b25a', metalness: 1, roughness: 0.28 }),
    black: new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.55 }),
    white: new THREE.MeshStandardMaterial({ color: '#e9e6dc', roughness: 0.6 }),
    cap: new THREE.MeshStandardMaterial({ color: '#b49a72', roughness: 0.5, metalness: 0.2 }),
    screwTop: new THREE.MeshStandardMaterial({ map: tex.screw, metalness: 0.9, roughness: 0.3 }),
    screw: new THREE.MeshStandardMaterial({ color: '#c4c8cd', metalness: 1, roughness: 0.3 }),
  };

  const disposables = { geos: [], mats: [], tex: Object.values(tex).flatMap((t) => (t.isTexture ? [t] : [t.map, t.rough])) };
  const device = new THREE.Group();
  const parts = {};

  function part(id, cx, cy, cz) {
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    const inner = new THREE.Group();
    inner.position.set(-cx, -cy, -cz);
    g.add(inner);
    g.userData = { id, inner, home: new THREE.Vector3(cx, cy, cz) };
    parts[id] = g;
    device.add(g);
    return g;
  }
  function mesh(p, geo, mat, x = 0, y = 0, z = 0) {
    disposables.geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    p.userData.inner.add(m);
    return m;
  }
  function inst(p, geo, mat, list) { // list of [x,y,z,(sx,sy,sz)]
    disposables.geos.push(geo);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const o = new THREE.Object3D();
    list.forEach(([x, y, z, sx = 1, sy = 1, sz = 1], i) => { o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    p.userData.inner.add(im);
    return im;
  }
  const rbox = (w, h, d, r = 0.3, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2 - 0.001));

  const sw = IPOD.screenWindow, wheelC = new THREE.Vector2(X(IPOD.wheel.cx), Y(IPOD.wheel.cy));
  const winC = new THREE.Vector2(X(sw.x + sw.width / 2), Y(sw.y + sw.height / 2));
  const wheelR = IPOD.wheel.diameter / 2, cbR = IPOD.centerButton.diameter / 2;

  // ── Front plate: anodised aluminium with window + wheel cut-outs ──
  {
    const p = part('faceplate', 0, 0, zc('faceplate'));
    const s = rrShape(0, 0, W, H, IPOD.cornerRadius);
    s.holes.push(rrHole(winC.x, winC.y, sw.width, sw.height, sw.radius), circ(THREE.Path, wheelC.x, wheelC.y, wheelR + 0.12));
    mesh(p, planarUV(slab(s, 0, L.faceplate.thickness, 0.3), -W / 2, -H / 2, W, H), M.alu);
  }
  // ── Display window (dark acrylic) with a flange behind the plate ──
  {
    const p = part('screenGlass', winC.x, winC.y, zc('screenGlass'));
    mesh(p, slab(rrShape(winC.x, winC.y, sw.width - 0.08, sw.height - 0.08, sw.radius), 0.1, 0.8, 0.06), M.glass);
    mesh(p, slab(rrShape(winC.x, winC.y, sw.width + 2.6, sw.height + 2.6, 2), 0.8, 1.0), M.glass);
  }
  // ── Click wheel ring with printed glyphs + sensor PCB behind ──
  {
    const p = part('clickWheel', wheelC.x, wheelC.y, zc('clickWheel'));
    const zf = Z(0.15), zb = Z(1.3), ri = cbR + 0.18, f = 0.4;
    const prof = [[wheelR, zb], ...arc(wheelR - f, zf - f, f, 0, 90), ...arc(ri + f, zf - f, f, 90, 180), [ri, zb]];
    mesh(p, planarUV(lathe(prof, wheelC), wheelC.x - wheelR, wheelC.y - wheelR, wheelR * 2, wheelR * 2), M.wheel);
    const b = circ(THREE.Shape, wheelC.x, wheelC.y, wheelR - 0.6);
    b.holes.push(circ(THREE.Path, wheelC.x, wheelC.y, cbR - 0.5));
    mesh(p, slab(b, 1.36, 1.62), M.pcbPlain);
  }
  // ── Centre button (domed aluminium) ──
  {
    const p = part('centerButton', wheelC.x, wheelC.y, zc('clickWheel'));
    const zf = Z(0.25), f = 0.6;
    mesh(p, lathe([[cbR, Z(1.6)], ...arc(cbR - f, zf - f, f, 0, 90), [cbR * 0.6, zf + 0.02], [0, zf + 0.03]], wheelC), M.center);
  }
  // ── Click wheel flex: copper/kapton ring + tail up to the logic board ──
  {
    const z0 = L.wheelFlex.z, z1 = z0 + L.wheelFlex.thickness;
    const R = wheelR - 1.2, hw = 4.2, d = Math.asin(hw / R), top = Y(36);
    const s = new THREE.Shape();
    s.moveTo(hw, wheelC.y + R * Math.cos(d)); s.lineTo(hw, top); s.lineTo(-hw, top); s.lineTo(-hw, wheelC.y + R * Math.cos(d));
    s.absarc(wheelC.x, wheelC.y, R, Math.PI / 2 + d, Math.PI / 2 - d + Math.PI * 2, false);
    s.holes.push(circ(THREE.Path, wheelC.x, wheelC.y, cbR - 1));
    const p = part('wheelFlex', 0, (wheelC.y + top) / 2 - 6, Z((z0 + z1) / 2));
    mesh(p, planarUV(slab(s, z0, z1), -R, wheelC.y - R, 2 * R, 2 * R), M.flex);
    mesh(p, rbox(10, 3.2, 1.2, 0.2), M.black, 0, top - 1, Z(z1 + 0.6));
    mesh(p, new THREE.BoxGeometry(8.4, 1.4, 0.12), M.gold, 0, top + 1.2, Z(z1 - 0.1));
  }
  // ── LCD module: brushed metal frame, dark panel, flex tail ──
  {
    const z0 = L.lcd.z, z1 = z0 + L.lcd.thickness;
    const p = part('lcd', winC.x, winC.y, Z((z0 + z1) / 2));
    mesh(p, planarUV(slab(rrShape(winC.x, winC.y, sw.width + 3, sw.height + 3.4, 1.4), z0, z1, 0.2), winC.x - 30, winC.y - 30, 60, 60), M.shield);
    mesh(p, slab(rrShape(winC.x, winC.y, IPOD.screen.width + 0.8, IPOD.screen.height + 0.8, 0.6), z0 - 0.05, z0 + 0.3), M.lcd);
    mesh(p, new THREE.BoxGeometry(14, 16, 0.2), M.flex, winC.x + 12, winC.y - sw.height / 2 - 4, Z(z1 + 0.05));
    mesh(p, rbox(11, 3, 1, 0.2), M.black, winC.x + 12, winC.y - sw.height / 2 - 11.5, Z(z1 + 0.4));
    mesh(p, new THREE.BoxGeometry(30, 20, 0.08), M.white, winC.x - 8, winC.y + 4, Z(z1 + 0.02));
  }
  // ── Logic board: PCB + chips, shield can, connectors, passives ──
  const screwPos = [[-24, 44], [24, 44], [-24, -9], [24, -9], [-10, -45], [10, -45]];
  {
    const z0 = L.logicBoard.z + 0.4, z1 = L.logicBoard.z + L.logicBoard.thickness; // 0.8 mm board, parts on the back
    const bx = 27.5, top = Y(4), mid = Y(64), bot = Y(100.5), tab = 13;
    const s = new THREE.Shape();
    s.moveTo(-bx + 2, top); s.lineTo(bx - 2, top); s.lineTo(bx, top - 2); s.lineTo(bx, mid); s.lineTo(tab, mid - 3);
    s.lineTo(tab, bot + 1.5); s.lineTo(tab - 1.5, bot); s.lineTo(-tab + 1.5, bot); s.lineTo(-tab, bot + 1.5); s.lineTo(-tab, mid - 3);
    s.lineTo(-bx, mid); s.lineTo(-bx, top - 2); s.closePath();
    for (const [x, y] of screwPos) s.holes.push(circ(THREE.Path, x, y, 0.9));
    const bw = 2 * bx, bh = top - bot;
    tex.pcb = TX.pcbTex(bw, bh, screwPos.map(([x, y]) => [1 - (x + bx) / bw, (y - bot) / bh]));
    disposables.tex.push(tex.pcb);
    M.pcb = new THREE.MeshStandardMaterial({ map: tex.pcb, roughness: 0.42, metalness: 0.12 });
    const p = part('logicBoard', 0, (top + bot) / 2, Z((z0 + z1 + 1) / 2));
    mesh(p, planarUV(slab(s, z0, z1), -bx, bot, bw, bh, true), M.pcb);
    const zb = Z(z1); // back surface of the board (components grow toward -z)
    const comp = (w, h, d, mat, x, y, r = 0.25) => mesh(p, rbox(w, h, d, r), mat, x, y, zb - d / 2);
    comp(13, 13, 1.1, M.chip, -9, 26);
    comp(9, 7, 0.9, M.chip2, 11, 33);
    comp(7, 7, 0.8, M.chip2, -16, 10);
    comp(21, 15, 1.5, M.shield, 9, 12, 0.4);
    comp(6, 6, 0.8, M.chip, 13, -3);
    comp(10, 2.4, 1.1, M.black, -4, 1);
    comp(6, 3, 1.3, M.white, -9, -19);
    comp(21, 4.2, 2.6, M.shield, 0, bot + 2.2, 0.5); // 30-pin dock connector
    comp(18, 1, 0.6, M.black, 0, bot + 0.1);
    mesh(p, new THREE.CylinderGeometry(2.4, 2.4, 7.5, 24), M.black, X(IPOD.headphoneJack.x), top - 1.5, zb - 2.4);
    mesh(p, new THREE.CylinderGeometry(2.7, 2.7, 1.2, 24), M.shield, X(IPOD.headphoneJack.x), top + 1.6, zb - 2.4);
    comp(IPOD.holdSwitch.width, 3.5, 1.6, M.black, X(IPOD.holdSwitch.x + IPOD.holdSwitch.width / 2), top - 1.2);
    const r = TX.rng(31), caps = [];
    for (let i = 0; i < 46; i++) {
      const x = (r() - 0.5) * 48, y = mid + 2 + r() * (top - mid - 6);
      caps.push([x, y, zb - 0.3, r() < 0.5 ? 1 : 0.6, r() < 0.5 ? 0.6 : 1, 1]);
    }
    for (let i = 0; i < 14; i++) caps.push([(r() - 0.5) * 20, bot + 6 + r() * (mid - bot - 10), zb - 0.3, 1, 0.6, 1]);
    inst(p, new THREE.BoxGeometry(1.6, 1, 0.6), M.cap, caps);
  }
  // ── Screws (instanced heads + threaded shafts) ──
  {
    const zb = Z(L.logicBoard.z + L.logicBoard.thickness);
    const p = part('screws', 0, 0, zb - 0.35);
    const head = new THREE.CylinderGeometry(1.15, 1.15, 0.6, 20); head.rotateX(-Math.PI / 2);
    inst(p, head, [M.screw, M.screwTop, M.screw], screwPos.map(([x, y]) => [x, y, zb - 0.3]));
    const shaft = new THREE.CylinderGeometry(0.6, 0.6, 2.4, 12); shaft.rotateX(-Math.PI / 2);
    inst(p, shaft, M.screw, screwPos.map(([x, y]) => [x, y, zb + 1.2]));
  }
  // ── Internal mid-frame with clips ──
  {
    const z0 = L.midframe.z, z1 = z0 + L.midframe.thickness;
    const p = part('midframe', 0, 0, Z((z0 + z1) / 2));
    const s = rrShape(0, 0, W - 1.4, H - 1.4, IPOD.cornerRadius - 0.7);
    s.holes.push(rrHole(0, 0, W - 3.4, H - 3.4, IPOD.cornerRadius - 1.7));
    mesh(p, slab(s, z0, z1, 0.15), M.frame);
    const clips = [];
    for (const y of [-34, -10, 14, 38]) for (const sx of [-1, 1]) clips.push([sx * (W / 2 - 0.9), y, Z((z0 + z1) / 2), 1, 1, 1]);
    inst(p, rbox(0.9, 4, 2.4, 0.3), M.frame, clips);
    const tabs = [];
    for (const x of [-18, 18]) for (const sy of [-1, 1]) tabs.push([x, sy * (H / 2 - 2.6), Z(z1 - 0.6), 1, 1, 1]);
    inst(p, rbox(6, 2.2, 1.2, 0.3), M.shield, tabs);
  }
  // ── 1.8" hard drive with rubber bumpers + ribbon ──
  {
    const z0 = L.storage.z, z1 = z0 + L.storage.thickness, cy = Y(34), dh = 56, dw = 50;
    const p = part('storage', 0, cy, Z((z0 + z1) / 2));
    const body = mesh(p, rbox(dw, dh, z1 - z0 - 0.4, 0.8, 3), M.drive, 0, cy, Z((z0 + z1) / 2));
    planarUV(body.geometry, -dw / 2, cy - dh / 2, dw, dh);
    mesh(p, slab(rrShape(0, cy, dw - 1.5, dh - 1.5, 1), z0, z0 + 0.25), M.pcbPlain);
    const [dg, dm] = decal(40, 34.7, tex.drive, 0, cy + 3, Z(z1 - 0.2) - 0.04);
    mesh(p, dg, dm); disposables.mats.push(dm);
    const bumpers = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) bumpers.push([sx * (dw / 2), cy + sy * (dh / 2 - 6), Z((z0 + z1) / 2), 1, 1, 1]);
    inst(p, rbox(5, 9, z1 - z0, 1.4, 3), M.rubber, bumpers);
    mesh(p, new THREE.BoxGeometry(20, 9, 0.15), M.flex, 0, cy - dh / 2 - 3.5, Z(z0 + 0.4));
  }
  // ── Li-ion pouch battery with printed label + lead ──
  {
    const z0 = L.battery.z, z1 = z0 + L.battery.thickness, cy = Y(82.5), bw = 50, bh = 30;
    const p = part('battery', 0, cy, Z((z0 + z1) / 2));
    mesh(p, rbox(bw, bh, z1 - z0, 1, 3), M.battery, 0, cy, Z((z0 + z1) / 2));
    const [dg, dm] = decal(44, 27.5, tex.battery, 0, cy, Z(z1) - 0.05);
    mesh(p, dg, dm); disposables.mats.push(dm);
    mesh(p, new THREE.BoxGeometry(7, 7, 0.18), M.flex, -14, cy + bh / 2 + 3, Z(z0 + 0.5));
    mesh(p, rbox(6, 2.6, 1.2, 0.2), M.white, -14, cy + bh / 2 + 6.5, Z(z0 + 0.9));
  }
  // ── Back shell: mirror-polished stainless, curved edge, engraved back ──
  {
    const z0 = L.faceplate.thickness, z1 = D;
    const p = part('backShell', 0, 0, Z((z0 + z1) / 2));
    mesh(p, planarUV(slab(rrShape(0, 0, W, H, IPOD.cornerRadius), z0, z1, 1.5, 8), -W / 2, -H / 2, W, H, true), M.steel);
  }

  // Part-local bounding boxes (for camera fitting + label anchors).
  device.updateMatrixWorld(true);
  for (const g of Object.values(parts)) {
    const b = new THREE.Box3().setFromObject(g);
    b.min.sub(g.userData.home); b.max.sub(g.userData.home);
    g.userData.box = b;
  }

  return {
    device, parts, materials: M,
    setBrand(monogram, name) { tex.back.redraw(monogram, name); },
    dispose() {
      disposables.geos.forEach((g) => g.dispose());
      new Set([...Object.values(M), ...disposables.mats].filter(Boolean)).forEach((m) => m.dispose());
      disposables.tex.forEach((t) => t.dispose());
    },
  };
}
