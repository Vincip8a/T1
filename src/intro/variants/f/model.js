// Procedural iPod Classic model for intro-f. World units are millimetres; the front face is
// centred on the origin and faces +Z. Every size comes from ipodSpec.js.
import * as THREE from 'three';
import { IPOD, PARTS, COLORS } from '../../../shared/ipodSpec.js';

const W = IPOD.width, H = IPOD.height;
const fx = (mx) => mx - W / 2;        // front-view mm → world x
const fy = (my) => H / 2 - my;        // front-view mm → world y
const PZ = Object.fromEntries(PARTS.map((p) => [p.id, p]));
const { PI } = Math;

/* ---------- shapes & geometry ---------- */

export function rr(w, h, r, cx = 0, cy = 0, Cls = THREE.Shape) {
  const s = new Cls();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, PI / 2, PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, PI, PI * 1.5, false);
  return s;
}
export function circ(r, cx = 0, cy = 0, Cls = THREE.Path) {
  const p = new Cls();
  p.absarc(cx, cy, r, 0, PI * 2, false);
  return p;
}
/** Extrude a shape so the result spans z ∈ [-depth, 0] with the front cap at z = 0 (facing +Z). */
export function extrude(shape, depth, bevel = 0, seg = 2, curveSegments = 14) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelOffset: -bevel, bevelSegments: seg, curveSegments,
  });
  g.translate(0, 0, -(depth - bevel));
  return g;
}
/** Map a cap texture (shape-space UVs) onto a w×h shape centred at (cx, cy). */
function fit(tex, w, h, cx = 0, cy = 0) {
  tex.repeat.set(1 / w, 1 / h);
  tex.offset.set(0.5 - cx / w, 0.5 - cy / h);
  return tex;
}
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

/* ---------- model ---------- */

export function buildModel(tex) {
  const root = new THREE.Group();
  const parts = [];
  const M = {}; // materials, for disposal

  M.alu = phys({ color: 0x9a9ea2, map: fit(tex.alu, W, H), roughnessMap: tex.aluRough, metalness: 0.55, roughness: 0.6, anisotropy: 0.3, anisotropyRotation: PI / 2, envMapIntensity: 0.45 });
  M.aluSide = phys({ color: 0x6e7278, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.35 });
  M.steel = phys({ color: COLORS.steel, map: fit(tex.steel, W - 1.2, H - 1.2), metalness: 0.2, roughness: 0.7, transparent: true, depthWrite: false });
  M.steelSide = phys({ color: 0xaeb2b7, metalness: 1, roughness: 0.32, envMapIntensity: 0.3 });
  M.wheel = phys({ color: 0xd8d8d8, map: fit(tex.wheel, IPOD.wheel.diameter, IPOD.wheel.diameter), metalness: 0, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.3 });
  M.wheelSide = phys({ color: COLORS.wheel, metalness: 0, roughness: 0.55 });
  M.button = phys({ color: 0xc6c6c6, map: fit(tex.button, IPOD.centerButton.diameter, IPOD.centerButton.diameter), metalness: 0, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.35 });
  M.glass = phys({ color: COLORS.screenWindow, metalness: 0, roughness: 0.22, envMapIntensity: 0.05, specularIntensity: 0.35 });
  M.lcdFrame = phys({ color: 0xaeb2b7, metalness: 0.9, roughness: 0.55 });
  M.lcd = phys({ color: COLORS.lcdOff, metalness: 0.1, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.15 });
  M.pcb = phys({ color: 0xffffff, map: fit(tex.pcb, 55, 93), metalness: 0.15, roughness: 0.55 });
  M.pcbSide = phys({ color: 0x2b6b47, metalness: 0, roughness: 0.6 });
  M.chip = phys({ color: 0xffffff, map: tex.chip, metalness: 0.1, roughness: 0.55 });
  M.chipSide = phys({ color: 0x24262a, roughness: 0.6 });
  M.conn = phys({ color: 0xe9e4d2, roughness: 0.7 });
  M.battery = phys({ color: 0xffffff, map: fit(tex.battery, 50, 24), metalness: 0.2, roughness: 0.6 });
  M.batterySide = phys({ color: COLORS.battery, metalness: 0.2, roughness: 0.6 });
  M.hdd = phys({ color: 0xffffff, map: fit(tex.hdd, 54, 71), metalness: 0.85, roughness: 0.45, anisotropy: 0.5 });
  M.hddSide = phys({ color: COLORS.drive, metalness: 0.85, roughness: 0.5 });
  M.rubber = phys({ color: 0x1e1f22, roughness: 0.95 });
  M.frame = phys({ color: 0x25272b, roughness: 0.7 });
  M.flex = phys({ color: 0xffffff, map: tex.flex, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide });
  M.kapton = phys({ color: COLORS.flex, metalness: 0.3, roughness: 0.4 });
  M.membrane = phys({ color: 0x2b2a2c, roughness: 0.75 });
  M.screw = phys({ color: 0xcfd3d8, metalness: 0.95, roughness: 0.35 });
  M.dark = phys({ color: 0x0a0b0d, roughness: 0.8 });
  M.white = phys({ color: 0xf4f4f2, roughness: 0.5 });
  M.shadow = new THREE.MeshBasicMaterial({ map: tex.shadow, color: 0x06080c, transparent: true, opacity: 0, depthWrite: false });

  const add = (id, obj, ex, rest) => {
    obj.name = id;
    const p = { id, obj, ex, rest: new THREE.Vector3(rest.x, rest.y, rest.z), e: 0 };
    obj.position.copy(p.rest);
    root.add(obj);
    parts.push(p);
    return p;
  };
  const sw = IPOD.screenWindow, wh = IPOD.wheel;
  const winC = { x: fx(sw.x + sw.width / 2), y: fy(sw.y + sw.height / 2) };
  const whC = { x: fx(wh.cx), y: fy(wh.cy) };
  const R = wh.diameter / 2, BR = IPOD.centerButton.diameter / 2;

  // Explosion offsets (mm at full spread). Seen from the front-left-above camera, +z parts
  // step to the right, −z parts to the left, so lateral/vertical offsets keep every layer visible.
  // 1. Front plate (aluminium) with screen-window and wheel cut-outs.
  {
    const s = rr(W, H, IPOD.cornerRadius);
    s.holes.push(rr(sw.width, sw.height, sw.radius, winC.x, winC.y, THREE.Path));
    s.holes.push(circ(R, whC.x, whC.y));
    const m = new THREE.Mesh(extrude(s, PZ.faceplate.thickness, 0.3, 3, 18), [M.alu, M.aluSide]);
    add('faceplate', m, { z: 72, rx: -0.08 }, { x: 0, y: 0, z: -PZ.faceplate.z });
  }
  // 2. Display window (dark glass).
  {
    const m = new THREE.Mesh(extrude(rr(sw.width - 0.05, sw.height - 0.05, sw.radius), PZ.screenGlass.thickness, 0.08, 2), M.glass);
    add('screenGlass', m, { z: 54, y: 7, ry: 0.06 }, { x: winC.x, y: winC.y, z: -PZ.screenGlass.z });
  }
  // 3. Click wheel ring (exactly the plate's hole radius: no seam) + centre button.
  {
    const s = circ(R, 0, 0, THREE.Shape);
    s.holes.push(circ(BR + 0.2));
    const ring = new THREE.Mesh(extrude(s, PZ.clickWheel.thickness, 0.3, 3, 56), [M.wheel, M.wheelSide]);
    add('clickWheel', ring, { z: 40, y: -5, rx: 0.14 }, { x: whC.x, y: whC.y, z: -PZ.clickWheel.z });
    const btn = new THREE.Mesh(extrude(circ(BR, 0, 0, THREE.Shape), 1.8, 0.3, 4, 44), [M.button, M.wheelSide]);
    add('centerButton', btn, { z: 56, y: -5, rx: 0.1 }, { x: whC.x, y: whC.y, z: -PZ.clickWheel.z });
  }
  // 4. Click-wheel flex PCB (kapton disc with dome switches). Slightly larger than the wheel
  // hole so it also backs the seam with a dark surface. The ribbon tail is dynamic (below).
  {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(extrude(circ(R + 0.6, 0, 0, THREE.Shape), PZ.wheelFlex.thickness, 0, 1, 48), [M.membrane, M.kapton]);
    g.add(disc);
    for (let i = 0; i < 5; i++) { // five dome switches (centre + 4 around) in silver
      const d = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.25, 20), M.screw);
      d.rotation.x = PI / 2;
      const a = i * PI / 2;
      d.position.set(i ? Math.cos(a) * R * 0.72 : 0, i ? Math.sin(a) * R * 0.72 : 0, 0.12);
      g.add(d);
    }
    add('wheelFlex', g, { z: 24, y: -7, rz: 0.05 }, { x: whC.x, y: whC.y, z: -PZ.wheelFlex.z });
  }
  // 5. LCD module: metal frame + dark panel.
  {
    const g = new THREE.Group();
    const fw = sw.width + 1.6, fh = sw.height + 1.8;
    const s = rr(fw, fh, 1.6);
    s.holes.push(rr(IPOD.screen.width, IPOD.screen.height, 0.6, 0, 0, THREE.Path));
    const frame = new THREE.Mesh(extrude(s, PZ.lcd.thickness, 0.15, 2), M.lcdFrame);
    const panel = new THREE.Mesh(extrude(rr(IPOD.screen.width + 1.2, IPOD.screen.height + 1.2, 0.5), PZ.lcd.thickness - 0.5, 0.05, 1), M.lcd);
    panel.position.z = -0.35;
    const tail = box(14, 6, 0.3, M.kapton); // LCD flex stub at the bottom
    tail.position.set(8, -fh / 2 - 2.5, -PZ.lcd.thickness + 0.6);
    g.add(frame, panel, tail);
    add('lcd', g, { z: 12, y: 9, ry: 0.07 }, { x: winC.x, y: winC.y, z: -PZ.lcd.z });
  }
  // 6. Logic board with components on its back side.
  {
    const g = new THREE.Group();
    const bw = 55, bh = 93, t = PZ.logicBoard.thickness;
    const board = new THREE.Mesh(extrude(rr(bw, bh, 2.2), t, 0.06, 1), [M.pcb, M.pcbSide]);
    g.add(board);
    const chipMat = [M.chipSide, M.chipSide, M.chipSide, M.chipSide, M.chipSide, M.chip];
    const chips = [[-8, 14, 11, 11, 1.0], [10, 16, 8, 12, 0.9], [-16, -4, 7, 7, 0.8], [16, -2, 9, 6, 0.8], [0, -20, 12, 8, 0.9], [-14, -24, 5, 5, 0.6]];
    for (const [x, y, w, h, d] of chips) {
      const c = box(w, h, d, chipMat);
      c.position.set(x, y, -t - d / 2);
      g.add(c);
    }
    for (let i = 0; i < 12; i++) { // small passives
      const c = box(1.6, 0.8, 0.5, i % 3 ? M.conn : M.rubber);
      c.position.set(-20 + (i % 6) * 8, (i < 6 ? 30 : -34) + (i % 2) * 2, -t - 0.25);
      g.add(c);
    }
    const jack = new THREE.Mesh(new THREE.CylinderGeometry(IPOD.headphoneJack.diameter / 2, IPOD.headphoneJack.diameter / 2, 7, 18), M.rubber);
    jack.position.set(fx(IPOD.headphoneJack.x), bh / 2 - 3.5, -t - 2.2);
    const hold = box(IPOD.holdSwitch.width + 2, 5, 2.2, M.rubber);
    hold.position.set(fx(IPOD.holdSwitch.x + IPOD.holdSwitch.width / 2), bh / 2 - 2.5, -t - 1.1);
    const dock = box(IPOD.dockConnector.width + 2, 5, 4.4, M.lcdFrame);
    dock.position.set(0, -bh / 2 + 2.5, -t - 2.2);
    const conn1 = box(12, 3, 1.2, M.conn), conn2 = box(8, 2.4, 1.0, M.conn);
    conn1.position.set(8, -40, 0.6); conn2.position.set(-6, 10, 0.5);
    g.add(jack, hold, dock, conn1, conn2);
    add('logicBoard', g, { z: -26, ry: -0.04 }, { x: 0, y: fy(51), z: -PZ.logicBoard.z });
  }
  // 7. Battery (pouch cell) – lower section, slides out down-left.
  {
    const m = new THREE.Mesh(extrude(rr(50, 24, 1.8), PZ.battery.thickness, 0.5, 3), [M.battery, M.batterySide]);
    const g = new THREE.Group();
    g.add(m);
    const tab = box(6, 4, 0.2, M.kapton);
    tab.position.set(18, 13.5, -0.4);
    g.add(tab);
    add('battery', g, { z: -46, x: -16, y: -20, rz: 0.06 }, { x: 0, y: fy(86), z: -PZ.battery.z });
  }
  // 8. 1.8" hard drive with rubber bumpers – upper section, lifts up and back.
  {
    const g = new THREE.Group();
    const dw = 54, dh = 71, dt = PZ.storage.thickness;
    const drive = new THREE.Mesh(extrude(rr(dw, dh, 2.5), dt, 0.45, 3), [M.hdd, M.hddSide]);
    g.add(drive);
    for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const b = new THREE.Mesh(extrude(rr(7, 7, 2.2), dt + 0.8, 0.8, 2), M.rubber);
      b.position.set(sx * (dw / 2 - 2.6), sy * (dh / 2 - 2.6), 0.4);
      g.add(b);
    }
    const zif = box(22, 2.2, 1.6, M.kapton);
    zif.position.set(2, -dh / 2 - 1.2, -dt + 1.2);
    g.add(zif);
    add('storage', g, { z: -56, x: 6, y: 24, rx: 0.08 }, { x: 0, y: fy(40), z: -PZ.storage.z });
  }
  // 9. Mid-frame (black polycarbonate ring + cross-bar): a small displacement of its own.
  {
    const g = new THREE.Group();
    const s = rr(W - 1.4, H - 1.4, IPOD.cornerRadius - 0.7);
    s.holes.push(rr(W - 5.2, H - 5.2, IPOD.cornerRadius - 2.6, 0, 0, THREE.Path));
    const ring = new THREE.Mesh(extrude(s, PZ.midframe.thickness, 0.2, 1), M.frame);
    const bar = box(W - 5.2, 1.6, 2.4, M.frame);
    bar.position.set(0, fy(51.3), -1.4);
    g.add(ring, bar);
    add('midframe', g, { z: -8, y: -3 }, { x: 0, y: 0, z: -PZ.midframe.z });
  }
  // 10. Back shell: polished stainless tray (plate + side walls) with the edge openings.
  {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(extrude(rr(W, H, IPOD.cornerRadius), PZ.backShell.thickness + 0.4, 0.55, 4, 18), M.steelSide);
    plate.position.z = -PZ.backShell.z + 0.4;
    const engraving = new THREE.Mesh(new THREE.ShapeGeometry(rr(W - 1.2, H - 1.2, IPOD.cornerRadius - 0.6), 18), M.steel);
    engraving.rotation.y = PI; // faces -Z; the rotation mirrors x so the text reads correctly from behind
    engraving.position.z = -IPOD.depth - 0.03;
    g.add(engraving);
    const ws = rr(W, H, IPOD.cornerRadius);
    ws.holes.push(rr(W - 1.2, H - 1.2, IPOD.cornerRadius - 0.6, 0, 0, THREE.Path));
    const walls = new THREE.Mesh(extrude(ws, PZ.backShell.z - PZ.midframe.z + 0.2, 0.1, 1, 18), M.steelSide);
    walls.position.z = -PZ.midframe.z;
    g.add(plate, walls);
    // openings as thin dark decals on the walls
    const zc = -IPOD.depth / 2;
    const jackHole = new THREE.Mesh(new THREE.CircleGeometry(IPOD.headphoneJack.diameter / 2, 24), M.dark);
    jackHole.rotation.x = -PI / 2; jackHole.position.set(fx(IPOD.headphoneJack.x), H / 2 + 0.02, zc);
    const holdSlot = new THREE.Mesh(new THREE.ShapeGeometry(rr(IPOD.holdSwitch.width, 1.8, 0.9)), M.dark);
    holdSlot.rotation.x = -PI / 2; holdSlot.position.set(fx(IPOD.holdSwitch.x + IPOD.holdSwitch.width / 2), H / 2 + 0.02, zc);
    const slider = box(3, 0.6, 1.2, M.white);
    slider.position.set(fx(IPOD.holdSwitch.x + 1.8), H / 2 + 0.25, zc);
    const dockSlot = new THREE.Mesh(new THREE.ShapeGeometry(rr(IPOD.dockConnector.width, IPOD.dockConnector.height, 0.8)), M.dark);
    dockSlot.rotation.x = PI / 2; dockSlot.position.set(0, -H / 2 - 0.02, zc);
    g.add(jackHole, holdSlot, slider, dockSlot);
    add('backShell', g, { z: -96, x: -36, y: 14, rx: 0.1, flip: PI }, { x: 0, y: 0, z: 0 });
  }
  // 11. Screws (instanced): heads on the back of the mid-frame ring; they spin out backwards
  // and drift outward so they stay visible beside the frame.
  const screws = (() => {
    const head = new THREE.CylinderGeometry(0.95, 0.95, 0.4, 16);
    const shaft = new THREE.CylinderGeometry(0.45, 0.4, 2.2, 10);
    shaft.translate(0, 1.3, 0);
    const slot = new THREE.BoxGeometry(1.2, 0.25, 0.3);
    slot.translate(0, -0.1, 0);
    const geo = mergeGeo([head, shaft, slot]);
    geo.rotateX(PI / 2); // head at z≈0 with its slot facing -Z, shaft pointing +Z into the frame
    const pos = [[1.5, 12], [60.3, 12], [1.5, 51.8], [60.3, 51.8], [1.5, 92], [60.3, 92]].map(([x, y]) => new THREE.Vector3(fx(x), fy(y), -(PZ.midframe.z + PZ.midframe.thickness)));
    const im = new THREE.InstancedMesh(geo, M.screw, pos.length);
    root.add(im);
    return { im, pos, ex: { z: -34, x: 9, spin: 6 * PI } };
  })();
  // 12. Clips (instanced): spring tabs on the mid-frame's long sides.
  const clips = (() => {
    const geo = new THREE.BoxGeometry(0.5, 3.2, 1.6);
    const pos = [];
    for (const sx of [-1, 1]) for (const y of [-36, -14, 14, 36]) pos.push(new THREE.Vector3(sx * (W / 2 - 1.0), y, -5.2));
    const im = new THREE.InstancedMesh(geo, M.screw, pos.length);
    root.add(im);
    return { im, pos, ex: { x: 18, rz: 0.5 } };
  })();

  // Soft contact shadow just behind the assembled device (faded out while it is apart).
  const shadow = (() => {
    const img = tex.shadow.image, rh = img.height - 112, rw = rh * W / H;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W * img.width / rw, H * img.height / rh), M.shadow);
    m.position.set(0, -4, -IPOD.depth - 0.8);
    m.renderOrder = -1;
    root.add(m);
    return m;
  })();

  // Dynamic ribbon flex (wheel flex tail → logic-board connector).
  const RIB_N = 28;
  const ribGeo = new THREE.BufferGeometry();
  const ribPos = new Float32Array((RIB_N + 1) * 2 * 3);
  const ribUv = new Float32Array((RIB_N + 1) * 2 * 2);
  const ribIdx = [];
  for (let i = 0; i <= RIB_N; i++) {
    ribUv.set([0, i / RIB_N, 1, i / RIB_N], i * 4);
    if (i < RIB_N) ribIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  ribGeo.setAttribute('position', new THREE.BufferAttribute(ribPos, 3));
  ribGeo.setAttribute('uv', new THREE.BufferAttribute(ribUv, 2));
  ribGeo.setIndex(ribIdx);
  const ribbon = new THREE.Mesh(ribGeo, M.flex);
  ribbon.frustumCulled = false;
  root.add(ribbon);

  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1, 1, 1), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3(), C = new THREE.Vector3(), T = new THREE.Vector3();

  /**
   * Apply the explosion state. `k` scales the spread (smaller on phones), `yk` fans the depth
   * stack vertically (portrait: front parts down, back parts up), `e` per part is the explosion
   * amount (may overshoot > 1 for inertia). `screwE`/`clipE` drive the instanced parts.
   */
  function apply(k, yk, screwE, clipE, time = 0) {
    parts.forEach((p, i) => {
      const e = p.e, ec = Math.min(1, Math.max(0, e)), s = Math.sin(PI * ec);
      const x = p.ex, drift = ec * ec * Math.sin(time * 1.9 + i * 1.3) * 0.7;
      p.obj.position.set(
        p.rest.x + e * (x.x || 0) * k,
        p.rest.y + e * ((x.y || 0) - Math.max(-60, Math.min(60, x.z || 0)) * yk) * k + drift,
        p.rest.z + e * (x.z || 0) * k);
      p.obj.rotation.set(s * (x.rx || 0), s * (x.ry || 0) + e * (x.flip || 0), s * (x.rz || 0));
    });
    screws.pos.forEach((v, i) => {
      const e = screwE, ec = Math.min(1, Math.max(0, e));
      tmpE.set(Math.sin(PI * ec) * 0.25 * (i % 2 ? 1 : -1), 0, e * screws.ex.spin);
      tmpQ.setFromEuler(tmpE);
      tmpV.set(v.x + e * screws.ex.x * k * Math.sign(v.x), v.y - e * screws.ex.z * yk * k, v.z + e * screws.ex.z * k);
      screws.im.setMatrixAt(i, tmpM.compose(tmpV, tmpQ, tmpS));
    });
    screws.im.instanceMatrix.needsUpdate = true;
    clips.pos.forEach((v, i) => {
      const e = clipE, s = Math.sin(PI * Math.min(1, Math.max(0, e)));
      tmpE.set(0, 0, s * clips.ex.rz * Math.sign(v.x));
      tmpQ.setFromEuler(tmpE);
      tmpV.set(v.x + e * clips.ex.x * k * Math.sign(v.x), v.y, v.z);
      clips.im.setMatrixAt(i, tmpM.compose(tmpV, tmpQ, tmpS));
    });
    clips.im.instanceMatrix.needsUpdate = true;

    // Ribbon: cubic Bézier from the flex disc's lower edge to the board connector, both
    // tangents pointing down (-y) so the ribbon lies flat at both ends and bends in between.
    const fl = byId.wheelFlex.obj, lb = byId.logicBoard.obj;
    A.set(-(R - 1.6), -3, -0.15).applyEuler(fl.rotation).add(fl.position);
    B.set(-25.5, -26, 1.0).applyEuler(lb.rotation).add(lb.position);
    const L = A.distanceTo(B);
    P1.copy(A).add(T.set(-0.42 * L, 0, 0).applyEuler(fl.rotation));
    P2.copy(B).add(T.set(-0.42 * L, 0, 0).applyEuler(lb.rotation));
    const half = 3.2;
    for (let i = 0; i <= RIB_N; i++) {
      const u = i / RIB_N, u1 = 1 - u;
      C.set(0, 0, 0).addScaledVector(A, u1 * u1 * u1).addScaledVector(P1, 3 * u1 * u1 * u).addScaledVector(P2, 3 * u1 * u * u).addScaledVector(B, u * u * u);
      ribPos.set([C.x, C.y - half, C.z, C.x, C.y + half, C.z], i * 6);
    }
    ribGeo.attributes.position.needsUpdate = true;
    ribGeo.computeVertexNormals();
    ribGeo.computeBoundingSphere();
  }

  function dispose() {
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(M)) m.dispose();
  }

  return { root, parts, byId, shadow, apply, dispose };
}

/** Minimal non-indexed merge (position/normal/uv) to avoid importing BufferGeometryUtils. */
function mergeGeo(list) {
  const geos = list.map((g) => g.toNonIndexed());
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = geos[0].attributes[name].itemSize;
    const arrs = geos.map((g) => g.attributes[name].array);
    const total = arrs.reduce((n, a) => n + a.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const a of arrs) { merged.set(a, off); off += a.length; }
    out.setAttribute(name, new THREE.BufferAttribute(merged, size));
  }
  geos.forEach((g) => g.dispose());
  list.forEach((g) => g.dispose());
  return out;
}
