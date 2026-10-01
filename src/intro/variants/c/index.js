// Intro C "studio teardown": turns up from the polished back to a still 3/4 rest, the shell is pried
// off, screws spin out, the stack opens outside-in, parts seat back to front (hover, snap, click,
// glint) and the device lands frontal on getTargetRect(). Pure function of t.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { IPOD } from '../../../shared/ipodSpec.js';
import { buildIpod, FACE_BEVEL } from './model.js';
import { stripCanvas, shadowCanvas } from './tex.js';

const { PI, abs, cos, exp, max, min, sign, sin, sqrt, tan } = Math;
const DEG = PI / 180, HALF_D = IPOD.depth / 2;
const FOV_HERO = 26, FOV_END = 20, tHero = tan(13 * DEG);
const D = 6.5, STILL = D - 0.18, FADE_MS = 220; // still from STILL
const ENV_END = 0.25, GLASS_FROM = 2.75, GLASS_END = 2.27, GLASS_Z = PI / 4;
const WHEEL_GLOW = 0.24, CENTRE_GLOW = 0.3, END_EXPOSURE = 0.9, KEY_END = 0.9; // = DOM iPod tone
const KEY_HOLD = 1.1, FACE_HOLD = 0.72; // hero: plate silver, not white
const TL = { rise: 1.0, spin: 1.1, screw: 1.52, re0: 4.15, reS: 0.085, reD: 0.62, cam0: 4.6 };
// removal story [start, duration]: shell, screws, plate, frame, stack
const OUT = {
  backShell: [1.4, 1.15], faceplate: [1.62, 1], midframe: [1.72, 1], screenGlass: [1.79, 0.95], clickWheel: [1.82, 0.95],
  battery: [1.87, 0.95], lcd: [1.92, 0.95], wheelFlex: [1.95, 0.95], storage: [1.98, 0.95], logicBoard: [2.04, 0.95],
};
const LAYER = { faceplate: 0, screenGlass: 1, clickWheel: 1, lcd: 2, wheelFlex: 2, logicBoard: 3, storage: 4, battery: 5, midframe: 6, backShell: 7 };
const SHELL_IDS = ['faceplate', 'screenGlass', 'clickWheel', 'lcd', 'backShell'];

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const p3out = (u) => 1 - (1 - u) ** 3;
const io2 = (u) => (u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2);
const inOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
// seat: glide to 7 % above, hover, snap home (power2.in) into the click
const seat = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.7 ? 0.93 * io2(u / 0.7) : u < 0.86 ? 0.93 + (0.005 * (u - 0.7)) / 0.16 : 1 - 0.065 * (1 - ((u - 0.86) / 0.14) ** 2));
const smax = (a, b, w) => 0.5 * (a + b + sqrt((a - b) ** 2 + w * w));
function spline(keys) {
  const n = keys.length;
  const m = keys.map((k, i) => {
    if (!i || i === n - 1) return 0;
    const a = keys[i - 1], b = keys[i + 1];
    return (k[1] - a[1]) * (b[1] - k[1]) <= 0 ? 0 : (b[1] - a[1]) / (b[0] - a[0]);
  });
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (t > keys[i + 1][0]) i++;
    const A = keys[i], B = keys[i + 1], h = B[0] - A[0], s = (t - A[0]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * A[1] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * B[1] + (s3 - s2) * h * m[i + 1];
  };
}
// yaw/pitch: one decelerating turn from the back (seen from above) to a still 3/4 rest
const orbit = (yaw, pitch) => {
  const y = spline([[TL.spin, 38], ...yaw, [STILL, 0]]), p = spline([[TL.spin, -11], ...pitch, [STILL, 0]]);
  const u = (t) => 1 - min(1, t / TL.spin);
  return { yaw: (t) => (t < TL.spin ? 38 + 112 * u(t) ** 3 : y(t)), pitch: (t) => (t < TL.spin ? -11 - 15 * u(t) ** 1.5 : p(t)) };
};
const ORBIT = {
  land: orbit([[1.45, 38], [2.3, 27], [3.0, 40], [3.9, 64], [5.05, 33]], [[1.45, -11], [2.6, 12], [3.9, 19], [5.05, 8]]),
  port: orbit([[1.45, 38], [2.3, 20], [3.0, 18], [3.9, 26], [5.05, 12]], [[1.45, -11], [2.6, 44], [3.9, 54], [5.05, 18]]),
};

function studios(stripTex) {
  const geo = new THREE.BoxGeometry();
  const box = (s, x, y, z, sx, sy, sz, v, g = geo, map = null) => {
    const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), map, side: THREE.DoubleSide }));
    o.position.set(x, y, z); o.scale.set(sx, sy, sz);
    s.add(o);
  };
  const room = new RoomEnvironment(), con = new THREE.Scene();
  [[-5, 7, 13.8, 8, 7, 0.2, 1.6], [3, 4, 13.85, 16, 10, 0.2, 0.55], [0, -2, 13.9, 26, 3, 0.2, 0.05], [-14.85, 3, 7, 0.2, 18, 14, 0.85], [0, 4, 13.97, 30, 18, 0.2, 0.7],
    [-14.8, 4, 4, 0.2, 14, 1.4, 9], [14.6, 5, -3, 0.2, 14, 1.2, 7], [14.8, 2, 7, 0.2, 9, 8, 0.03], [-14.8, 2, -8, 0.2, 9, 9, 0.03]].forEach((a) => box(room, ...a));
  box(con, 0, 0, 0, 1, 1, 1, 1.7, new THREE.CylinderGeometry(12, 12, 26, 96, 1, true), stripTex);
  box(con, 0, 12.5, 0, 26, 0.2, 26, 1.1);
  box(con, 0, -12.5, 0, 26, 0.2, 26, 0.01);
  return { room, con, dispose: () => [room, con].forEach((s) => s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); })) };
}
const BANDS = [
  [0, 12, 0.6, 0.4], [12, 14.5, 1], [14.5, 26, 0.5], [26, 32, 0.02], [32, 46, 0.75, 0.4], [46, 49, 1], [49, 60, 0.55],
  [60, 72, 0.7, 0.35], [72, 75, 1], [75, 86, 0.55], [86, 92, 0.02], [92, 104, 0.75, 0.4], [104, 107, 1], [107, 118, 0.6],
  [118, 126, 0.015], [126, 140, 0.7, 0.45], [140, 143, 1], [143, 180, 0.5, 0.3], [180, 219, 0.006], [219, 223, 0.4],
  [223, 226, 0.006], [226, 227.5, 0.16], [227.5, 268, 0.006], [268, 300, 0.4], [300, 309, 1], [309, 330, 0.03], [330, 360, 0.5, 0.6],
];

const NOOP = { duration: 0, done: Promise.resolve(), skip() {}, seek() {}, pause() {}, play() {}, dispose() {}, measure() {}, info() {} };

export function runIntro({ getTargetRect, reducedMotion = false, config = null } = {}) {
  const duration = reducedMotion ? 1.0 : D;
  const canvas = document.createElement('canvas');
  let renderer;
  try {
    const attrs = { alpha: true, antialias: true, stencil: false, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl2', attrs);
    if (!gl) return NOOP;
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, ...attrs });
  } catch {
    return NOOP;
  }
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.intro = 'c';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:50';
  document.body.append(canvas);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene(), V3 = THREE.Vector3;
  const key = new THREE.DirectionalLight(0xfffaf2, KEY_HOLD); key.position.set(-0.6, 1.0, 0.8);
  const rim = new THREE.DirectionalLight(0xdce8ff, 2.2); rim.position.set(1.0, 0.45, -0.9);
  const camera = new THREE.PerspectiveCamera(FOV_HERO, 1, 20, 8000);
  const rig = new THREE.Group(), chassis = new THREE.Group();
  const ipod = buildIpod({ maxAniso: min(8, renderer.capabilities.getMaxAnisotropy()) });
  const { glass, panel, wheel, centre, face, lip } = ipod.mats;
  chassis.position.z = HALF_D;
  chassis.add(ipod.model);
  rig.add(chassis);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas());
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.renderOrder = -1;
  scene.add(key, rim, rig, shadow);

  const parts = ipod.parts, N = parts.length, ids = parts.map((p) => p.id), iOf = (id) => ids.indexOf(id);
  const SHELL = SHELL_IDS.map(iOf), INTERNAL = parts.map((_, i) => i).filter((i) => !SHELL.includes(i));
  const [iBoard, iFrame, iWheel, iFlex, iShell] = ['logicBoard', 'midframe', 'clickWheel', 'wheelFlex', 'backShell'].map(iOf);
  const O0 = ids.map((id) => OUT[id][0]), OD = ids.map((id) => OUT[id][1]);
  const E = new Float32Array(N), G = new Float32Array(N);
  const gM = [], gIds = [];
  parts.forEach((p, i) => p.group.traverse(({ material: m }) => {
    if (!m) return;
    let k = gM.indexOf(m);
    if (k < 0) { k = gM.push(m) - 1; gIds.push([]); }
    if (!gIds[k].includes(i)) gIds[k].push(i);
  }));
  const gB = gM.map((m) => m.envMapIntensity), gF = gM.map((m) => m === face || m === lip);
  const CON = [glass, panel, ipod.mats.steel, ipod.mats.back], ROOM = gM.filter((m) => !CON.includes(m));

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, conRT = null;
  function buildEnv() {
    envRT?.dispose(); conRT?.dispose();
    const stripTex = new THREE.CanvasTexture(stripCanvas(BANDS)), st = studios(stripTex);
    envRT = pmrem.fromScene(st.room, 0.03); conRT = pmrem.fromScene(st.con, 0.015);
    st.dispose(); stripTex.dispose();
    scene.environment = envRT.texture;
    for (const m of gM) m.envMap = CON.includes(m) ? conRT.texture : envRT.texture;
  }
  buildEnv();

  const L = { vw: 0, vh: 0, dpr: 0, dz: [], o: ORBIT.land };
  const tmpV = new V3(), tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion();

  function computeExplode(gap) {
    const groups = [], dz = new Array(N).fill(0);
    ids.forEach((id, i) => { (groups[LAYER[id]] ??= []).push(i); });
    let cursor = 0;
    for (const g of groups) {
      const d = cursor - max(...g.map((i) => parts[i].box.max.z));
      g.forEach((i) => { dz[i] = d; });
      cursor = min(...g.map((i) => parts[i].box.min.z)) + d - gap;
    }
    return dz.map((d) => d - HALF_D - (cursor + gap) / 2);
  }
  function fitDistance(points, q, mx, my, ox = 0, oy = 0, live = false) {
    const ax = tHero * mx * L.vw / L.vh, ay = tHero * my;
    let d = 0;
    for (let k = 0; k < points.length; k++) {
      tmpV.copy(points[k]); tmpV.z += HALF_D + (live ? L.dz[k >> 3] * E[k >> 3] : 0); tmpV.applyQuaternion(q);
      d = max(d, tmpV.z + abs(tmpV.x + ox) / ax, tmpV.z + abs(tmpV.y + oy) / ay);
    }
    return d;
  }
  const qOf = (t) => tmpQ.setFromEuler(tmpE.set(-L.o.pitch(t) * DEG, -L.o.yaw(t) * DEG, 0, 'XYZ'));
  const boxPoints = (box, dz, out) => {
    for (let i = 0; i < 8; i++) out.push(new V3(box[i & 1 ? 'max' : 'min'].x, box[i & 2 ? 'max' : 'min'].y, box[i & 4 ? 'max' : 'min'].z + dz));
  };

  function layout() {
    const vw = innerWidth, vh = innerHeight, dpr = min(devicePixelRatio || 1, 2), aspect = vw / vh;
    if (vw === L.vw && vh === L.vh && dpr === L.dpr) return;
    if (dpr !== L.dpr) renderer.setPixelRatio(dpr);
    Object.assign(L, { vw, vh, dpr, portrait: aspect < 0.9 });
    renderer.setSize(vw, vh, false);
    L.o = L.portrait ? ORBIT.port : ORBIT.land;
    L.spread = L.portrait ? 0.95 : max(0.7, min(1, aspect / 1.45));
    L.dz = computeExplode(17 * L.spread);
    L.screwOff = ipod.screwBase.map((b, j) => new V3(sign(b.x) * (5 + (j % 3)) * L.spread, b.y * 0.04, (7 + (j % 2) * 3) * L.spread));
    const ex = [];
    L.corners = [];
    parts.forEach((p, i) => { boxPoints(p.box, L.dz[i], ex); boxPoints(p.box, 0, L.corners); });
    ipod.screwBase.forEach((b, j) => { const v = b.clone().add(L.screwOff[j]); v.z += L.dz[j < 4 ? iBoard : iFrame]; ex.push(v); });
    L.mx = L.portrait ? 0.86 : 0.84; L.my = L.portrait ? 0.8 : 0.86;
    const e = [1e9, 1e9, -1e9, -1e9], q = qOf(3.3);
    for (const p of ex) {
      tmpV.copy(p); tmpV.z += HALF_D; tmpV.applyQuaternion(q);
      e[0] = min(e[0], tmpV.x); e[1] = min(e[1], tmpV.y); e[2] = max(e[2], tmpV.x); e[3] = max(e[3], tmpV.y);
    }
    L.cx = (e[0] + e[2]) / 2; L.cy = (e[1] + e[3]) / 2;
    L.dHero = max(...[2.6, 3.3, 3.9, 4.25].map((t) => fitDistance(ex, qOf(t), L.mx, L.my, -L.cx, -L.cy)));
    L.dAsm = fitDistance(L.corners, tmpQ.setFromEuler(tmpE.set(-8 * DEG, -30 * DEG, 0)), 0.6, 0.6);
    L.rise = 1.25 * L.dAsm * tHero + IPOD.height * 0.75;
  }

  function targetRect() {
    let r = null;
    try { r = getTargetRect?.(); } catch {}
    if (r?.height > 4) return r;
    const h = min(L.vh * 0.74, 600), w = (h * IPOD.width) / IPOD.height;
    return { left: (L.vw - w) / 2, top: (L.vh - h) / 2, width: w, height: h };
  }

  function applyCamera(b, kHero) {
    const rect = targetRect(), tanE = tan((FOV_END * DEG) / 2);
    const camZEnd = HALF_D - FACE_BEVEL + (IPOD.height * L.vh) / (2 * tanE * rect.height);
    const fov = lerp(FOV_HERO, FOV_END, b);
    camera.fov = fov;
    camera.position.set(0, 0, lerp(kHero, camZEnd * tanE, b) / tan((fov * DEG) / 2));
    camera.aspect = L.vw / L.vh;
    camera.setViewOffset(L.vw, L.vh, -(rect.left + rect.width / 2 - L.vw / 2) * b, -(rect.top + rect.height / 2 - L.vh / 2) * b, L.vw, L.vh);
    camera.updateProjectionMatrix();
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), pv = new V3(), one = new V3(1, 1, 1);
  const reStart = (i) => TL.re0 + (N - 1 - (i === iWheel ? 0 : i)) * TL.reS;

  function placeScrews(t) {
    for (let j = 0; j < ipod.screwBase.length; j++) {
      const h = j < 4 ? iBoard : iFrame, k = j % 4;
      const out = p3out(clamp01((t - (TL.screw + (j < 4 ? 0.16 : 0) + k * 0.035)) / 0.8));
      const back = inOutCubic(clamp01((t - (reStart(h) - 0.14 + k * 0.025)) / (TL.reD + 0.08)));
      const e = out * (1 - back);
      pv.copy(ipod.screwBase[j]).addScaledVector(L.screwOff[j], e);
      pv.z += L.dz[h] * E[h];
      q.setFromEuler(eul.set(0.4 * e * sin(j * 1.7), 0.4 * e * cos(j * 1.3), (out - back) * 6 * PI * (j % 2 ? 1 : -1)));
      ipod.screws.setMatrixAt(j, m4.compose(pv, q, one));
    }
    ipod.screws.instanceMatrix.needsUpdate = true;
  }

  function pose(t) {
    layout();
    if (!reducedMotion) return poseAt(t);
    const u = clamp01(t / duration);
    poseAt(D);
    camera.position.z = HALF_D + (camera.position.z - HALF_D) * (1 + 0.04 * (1 - p3out(u)));
    return smooth(0, 0.7, u);
  }
  function poseAt(t) {
    rig.rotation.set(-L.o.pitch(t) * DEG, -L.o.yaw(t) * DEG, 0, 'XYZ');
    const rise = -L.rise * (1 - p3out(clamp01(t / TL.rise)));
    const bob = 1.2 * sin((t - 1.9) * 2.1) * smooth(1.9, 2.7, t) * (1 - smooth(3.9, 4.4, t));
    const env = smooth(1.35, 2.6, t) * (1 - smooth(4.25, 5.3, t));
    const ox = -L.cx * env, oy = bob - L.cy * env;
    rig.position.set(ox, rise + oy, 0);

    let nudge = 0, wob = 0;
    for (let i = 0; i < N; i++) {
      const out = p3out(clamp01((t - O0[i]) / OD[i])), rs = reStart(i), back = seat((t - rs) / TL.reD);
      E[i] = out * (1 - back);
      parts[i].group.position.set(0, 0, parts[i].z0 + L.dz[i] * E[i]);
      const j = i === iWheel ? 0 : i;
      const sgn = j % 2 ? -1 : 1, amp = (1.8 + (j % 3) * 0.8) * DEG;
      let tilt = amp * (sin(PI * out) * (1 - back) * 0.7 + sgn * sin(PI * back) * 0.8 * (j ? 1 : 1 - smooth(0.7, 0.95, back)));
      if (i === iShell) tilt += 3.5 * DEG * sin(PI * clamp01(out * 1.6)) * (1 - back);
      const tau = t - (rs + TL.reD);
      G[i] = tau > -0.3 && tau < 0.3 ? exp(-((tau / 0.09) ** 2)) : 0;
      if (tau > 0 && tau < 0.7) {
        const k = exp(-tau / 0.055) * sin(tau * 52);
        if (i !== iWheel) {
          nudge -= sign(L.dz[i]) * (i === 0 ? 2.2 : i === N - 1 ? 1.4 : 0.5) * 0.55 * k;
          wob += (i === 0 ? 0.6 : 0.15) * k;
        }
        if (j === 0 || i === N - 1) tilt -= sgn * amp * 0.55 * exp(-tau / 0.09) * sin((PI * tau) / 0.12);
      }
      parts[i].group.rotation.set(tilt, tilt * 0.45 * sgn, 0);
    }
    const b = inOutCubic(clamp01((t - TL.cam0) / (STILL - TL.cam0))), b2 = b * b;
    const fk = lerp(FACE_HOLD - (L.portrait ? 0.1 : 0), 1, max(b2, 1 - smooth(1.3, 2.4, t)));
    for (let k = 0, g = 0; k < gM.length; k++, g = 0) {
      for (let n = 0; n < gIds[k].length; n++) g = max(g, G[gIds[k][n]]);
      gM[k].envMapIntensity = gB[k] * (1 + 0.3 * g) * (gF[k] ? fk : 1);
    }
    chassis.position.set(0, 0, HALF_D + nudge);
    chassis.rotation.set(wob * DEG, 0, 0);
    placeScrews(t);
    let closed = true, k = 0;
    for (; k < SHELL.length; k++) if (E[SHELL[k]] >= 1e-4) closed = false;
    const veiled = t > reStart(0) && E[0] < (L.portrait ? 0.42 : 0.08);
    for (k = 0; k < INTERNAL.length; k++) { const i = INTERNAL[k]; parts[i].group.visible = !closed && !(veiled && (i === iFlex || i === iBoard)); }
    ipod.screws.visible = !closed;
    for (k = 0; k < 3; k++) ipod.ribbons[k].update();

    const sweep = smooth(5.0, STILL, t);
    scene.environmentRotation.set(0, lerp(-0.7, ENV_END - 0.55, smooth(0, 5.1, t)) + 0.55 * sweep, 0);
    for (k = 0; k < ROOM.length; k++) ROOM[k].envMapRotation.copy(scene.environmentRotation);
    glass.envMapRotation.set(0, lerp(GLASS_FROM, GLASS_END, sweep), GLASS_Z);
    panel.envMapRotation.copy(glass.envMapRotation);

    const dHero = lerp(L.dAsm * (1 + 0.12 * (1 - p3out(clamp01(t / 1.25)))), L.dHero, env);
    const dReq = fitDistance(L.corners, rig.quaternion, L.mx, L.my, ox, oy, true);
    applyCamera(b, smax(dHero * tHero, dReq * tHero, 0.04 * dHero * tHero));
    wheel.emissiveIntensity = WHEEL_GLOW * b2; centre.emissiveIntensity = CENTRE_GLOW * b2;
    renderer.toneMappingExposure = lerp(1, END_EXPOSURE, b2);
    key.intensity = lerp(KEY_HOLD, KEY_END, b2);

    shadow.visible = b < 1;
    shadow.position.set(0, -IPOD.height / 2 - 9 - 7 * env + rise, -12);
    shadow.scale.set(lerp(84, 175 * L.spread, env), lerp(13, 24, env), 1);
    shadow.material.opacity = (0.55 - (L.portrait ? 0.45 : 0.17) * env) * smooth(0.4, 1.1, t) * (1 - b);
    return 1;
  }

  let t = 0, playing = false, finished = false, raf = 0, last = 0, disposed = false, handedOff = false, lost = false, fadeTimer = 0, resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  function render() {
    if (disposed) return;
    const op = pose(t);
    if (!handedOff) canvas.style.opacity = String(op);
    if (!lost) renderer.render(scene, camera);
  }
  const rectKey = () => { const r = targetRect(); return `${r.left},${r.top},${r.width},${r.height}`; };
  // aligned frame, done, then a timer (not rAF) fade re-rendering if the rect moves; canvas removed
  function finish() {
    if (finished || disposed) return;
    finished = handedOff = true; playing = false;
    cancelAnimationFrame(raf);
    t = duration;
    render();
    const t0 = performance.now();
    let r0 = rectKey();
    const tick = () => {
      if (disposed || !handedOff) return;
      const u = min(1, (performance.now() - t0) / FADE_MS), r = rectKey();
      if (r !== r0) { r0 = r; render(); }
      canvas.style.opacity = String((1 - u) ** 2);
      if (u < 1) fadeTimer = setTimeout(tick, 16);
      else canvas.remove();
    };
    tick();
    resolveDone();
  }
  function frame(now) {
    if (!playing || disposed) return;
    t = min(duration, t + (last ? min((now - last) / 1000, 0.1) : 0));
    last = now;
    if (t >= duration) return finish();
    render();
    raf = requestAnimationFrame(frame);
  }
  const onResize = () => { if (!playing) render(); };
  const onLost = (e) => { e.preventDefault(); lost = true; };
  const onRestored = () => { if (disposed) return; lost = false; buildEnv(); render(); };
  const listen = (on) => {
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('resize', onResize);
    canvas[f]('webglcontextlost', onLost);
    canvas[f]('webglcontextrestored', onRestored);
  };
  listen(true);

  const brand = (cfg) => { if (!disposed && cfg?.brand) { ipod.setBrand(cfg.brand); if (!playing) render(); } };
  if (config) brand(config);
  else { // non-blocking; force-cache reuses the page's response
    fetch(new URL(`${import.meta.env.BASE_URL}config.json`, location.href), { cache: 'force-cache' }).then((r) => r.json()).then(brand).catch(() => {});
  }

  layout();
  pose(3.4);
  INTERNAL.forEach((i) => { parts[i].group.visible = true; });
  renderer.compile(scene, camera);
  ipod.textures.forEach((x) => renderer.initTexture(x));
  render();

  const fv = new V3();
  const controller = {
    duration,
    done,
    skip: finish,
    seek(s) {
      if (disposed) return;
      t = max(0, min(duration, Number(s) || 0));
      if (handedOff) { handedOff = finished = false; cancelAnimationFrame(raf); clearTimeout(fadeTimer); if (!canvas.isConnected) document.body.append(canvas); }
      render();
    },
    pause() { if (playing) { playing = false; cancelAnimationFrame(raf); } },
    play() {
      if (playing || finished || disposed) return;
      if (t >= duration) return finish();
      playing = true; last = 0;
      raf = requestAnimationFrame(frame);
    },
    dispose() {
      if (disposed) return;
      disposed = true; playing = false;
      cancelAnimationFrame(raf); clearTimeout(fadeTimer);
      listen(false);
      const res = new Set([...ipod.textures, shadowTex, envRT, conRT]);
      scene.traverse((o) => {
        res.add(o.geometry); if (o.isInstancedMesh) o.dispose();
        for (const m of [].concat(o.material ?? [])) { res.add(m); for (const v of Object.values(m)) if (v?.isTexture) res.add(v); }
      });
      [...res, pmrem, renderer].forEach((x) => x?.dispose());
      renderer.forceContextLoss?.();
      canvas.remove();
      resolveDone();
    },
    measure() {
      if (disposed) return null;
      pose(t);
      ipod.model.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      const ext = [1e9, 1e9, -1e9, -1e9];
      for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        fv.set((x * IPOD.width) / 2, (y * IPOD.height) / 2, -FACE_BEVEL).applyMatrix4(ipod.model.matrixWorld).project(camera);
        const px = (fv.x * 0.5 + 0.5) * L.vw, py = (0.5 - fv.y * 0.5) * L.vh;
        ext[0] = min(ext[0], px); ext[1] = min(ext[1], py); ext[2] = max(ext[2], px); ext[3] = max(ext[3], py);
      }
      const r = targetRect(), target = [r.left, r.top, r.left + r.width, r.top + r.height];
      return { t, ext, target, err: max(...ext.map((e, i) => abs(e - target[i]))) };
    },
    info: () => ({ ...renderer.info.memory, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  };
  controller._measure = controller.measure;
  if (import.meta.env.DEV) controller._three = { scene, renderer, ipod, key, rim };
  controller.play();
  return controller;
}
