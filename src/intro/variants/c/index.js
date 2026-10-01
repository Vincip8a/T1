// Intro variant C: "studio teardown". A silver iPod Classic rises into frame showing its
// mirror-polished back, swings to a 3/4 front view and bursts apart along its own depth axis
// during the last part of the turn (front-to-back cascade), holds while the camera orbits to its
// widest pose, then seats back together back-to-front with a physical click (each landing nudges
// the chassis, glints and settles), and turns to face the viewer, landing pixel-aligned on
// getTargetRect(). Pure function of t: same t → same frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { IPOD } from '../../../shared/ipodSpec.js';
import { loadConfig } from '../../../shared/config.js';
import { buildIpod, FACE_BEVEL } from './model.js';
import { stripCanvas } from './tex.js';

const DEG = Math.PI / 180;
const HALF_D = IPOD.depth / 2;
const FOV_HERO = 26, FOV_END = 20;
const D = 6.5;
const ENV_END = 0.25; // final room rotation (fixes the hand-off look)
const GLASS_FROM = 2.75, GLASS_END = 2.27, GLASS_Z = Math.PI / 4; // diagonal glint on the display glass
const FACE_GLOW = 0.05, WHEEL_GLOW = 0.1; // hand-off fill (matches the DOM iPod's tone)
const END_EXPOSURE = 0.94;
const TL = {
  rise: 1.0,
  ex0: 1.2, exS: 0.07, exD: 1.25,
  re0: 4.3, reS: 0.085, reD: 0.62,
  cam0: 4.6,
};
// exploded-stack slot per part (front → back); battery gets its own slot behind the drive
const LAYER = { faceplate: 0, screenGlass: 1, clickWheel: 1, lcd: 2, wheelFlex: 2, logicBoard: 3, storage: 4, battery: 5, midframe: 6, backShell: 7 };
const SHELL_IDS = ['faceplate', 'screenGlass', 'clickWheel', 'lcd', 'backShell'];

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const p3out = (u) => 1 - (1 - u) ** 3;
const inOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
/** Lift off gently, arrive with intent (end slope 4/3, then the click). Closed form, no solver. */
const arrive = (u) => u * u * (5 / 3 - (2 / 3) * u);
/** Smooth max: ≥ max(a, b), no kink when the framing guard takes over. */
const smax = (a, b, w) => 0.5 * (a + b + Math.sqrt((a - b) ** 2 + w * w));
/** Monotone-ish Hermite spline through [t, v] keys; flat tangents at the ends and at extrema. */
function spline(keys) {
  const n = keys.length;
  const m = keys.map((k, i) => {
    if (i === 0 || i === n - 1) return 0;
    const a = keys[i - 1], b = keys[i + 1];
    if ((k[1] - a[1]) * (b[1] - k[1]) <= 0) return 0;
    return (b[1] - a[1]) / (b[0] - a[0]);
  });
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (t > keys[i + 1][0]) i++;
    const t0 = keys[i][0], v0 = keys[i][1], t1 = keys[i + 1][0], v1 = keys[i + 1][1];
    const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * h * m[i + 1];
  };
}
// Orbit: yaw (camera towards the device's right) and elevation. The opening turn passes the
// edge-on profile early (t≈0.75, still rising); the widest pose (apex) is held at 3.9 s before
// reassembly starts at 4.3 s. Landscape spreads the stack sideways, portrait looks down on it.
const YAW_IN = [[0, 166], [0.5, 124], [0.8, 76], [1.35, 38]];
const ORBIT = {
  land: {
    yaw: spline([...YAW_IN, [2.2, 27], [3.0, 40], [3.9, 64], [5.05, 33], [D, 0]]),
    pitch: spline([[0, 12], [1.35, 7], [2.6, 12], [3.9, 19], [5.05, 8], [D, 0]]),
  },
  port: {
    yaw: spline([...YAW_IN, [2.2, 20], [3.0, 18], [3.9, 26], [5.05, 12], [D, 0]]),
    pitch: spline([[0, 12], [1.35, 18], [2.6, 44], [3.9, 54], [5.05, 18], [D, 0]]),
  },
};

/** Two studios, one PMREM pass each.
 *  room: RoomEnvironment + a hot front soft box, a broad dim wrap on the camera side (keeps
 *  the anodised face lit at oblique yaw) and strips/flags for the internals.
 *  contrast: dark cyclorama with soft boxes, hot strips and black flags around the horizon for
 *  the mirror steel; its dark sector (with one thin strip) serves the display glass and LCD
 *  through per-material envMapRotation. */
function studios(stripTex) {
  const geo = new THREE.BoxGeometry(), mats = [];
  const box = (s, x, y, z, sx, sy, sz, v, map = null) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), map, side: THREE.DoubleSide });
    mats.push(m);
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz);
    s.add(o);
    return o;
  };
  const room = new RoomEnvironment();
  box(room, -5, 7, 13.8, 8, 7, 0.2, 1.6);        // front soft box, high left (hot)
  box(room, 3, 4, 13.85, 16, 10, 0.2, 0.55);      // broad dimmer front fill (face falloff)
  box(room, 0, -2, 13.9, 26, 3, 0.2, 0.05);       // dark band below it (face gradient)
  box(room, -14.85, 3, 7, 0.2, 18, 14, 0.62);     // camera-side wrap (left wall, front half)
  box(room, 0, 4, 13.97, 30, 18, 0.2, 0.5);       // camera-side wrap (front wall)
  box(room, -14.8, 4, 4, 0.2, 14, 1.4, 9);        // left strip
  box(room, 14.6, 5, -3, 0.2, 14, 1.2, 7);        // right rim strip
  box(room, 14.8, 2, 7, 0.2, 9, 8, 0.03);         // right flag
  box(room, -14.8, 2, -8, 0.2, 9, 9, 0.03);       // left-back flag
  const con = new THREE.Scene();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 26, 96, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.7, 1.7), map: stripTex, side: THREE.DoubleSide }));
  mats.push(cyl.material);
  con.add(cyl);
  box(con, 0, 12.5, 0, 26, 0.2, 26, 1.1);  // ceiling soft box
  box(con, 0, -12.5, 0, 26, 0.2, 26, 0.01); // black floor
  return {
    room, con,
    dispose() { geo.dispose(); cyl.geometry.dispose(); mats.forEach((m) => m.dispose()); room.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); },
  };
}
// horizon bands for the contrast studio (deg from +Z towards +X, value): the polished back
// sweeps 60°→180° while it faces the camera, crossing two hot strips and a black flag.
const BANDS = [
  [0, 12, 0.6, 0.4], [12, 14.5, 1], [14.5, 26, 0.5], [26, 32, 0.02], [32, 46, 0.75, 0.4], [46, 49, 1], [49, 60, 0.55],
  [60, 72, 0.7, 0.35], [72, 75, 1], [75, 86, 0.55], [86, 92, 0.02], [92, 104, 0.75, 0.4], [104, 107, 1], [107, 118, 0.6],
  [118, 126, 0.015], [126, 140, 0.7, 0.45], [140, 143, 1], [143, 180, 0.5, 0.3], [180, 219, 0.006], [219, 223, 0.4],
  [223, 226, 0.006], [226, 227.5, 0.16], [227.5, 268, 0.006], [268, 300, 0.4], [300, 309, 1], [309, 330, 0.03], [330, 360, 0.5, 0.6],
];

const NOOP = { duration: 0, done: Promise.resolve(), skip() {}, seek() {}, pause() {}, play() {}, dispose() {} };

export function runIntro({ getTargetRect, reducedMotion = false, config = null } = {}) {
  const duration = reducedMotion ? 1.0 : D;

  // Renderer first: without WebGL return a finished no-op controller (the DOM iPod takes over)
  // and leave nothing behind in the DOM.
  const canvas = document.createElement('canvas');
  let renderer;
  try {
    const attrs = { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl2', attrs);
    if (!gl) return NOOP;
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, ...attrs });
  } catch {
    return NOOP;
  }
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.intro = 'c';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:50;background:transparent;opacity:1';
  document.body.append(canvas);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const stripTex = new THREE.CanvasTexture(stripCanvas(BANDS));
  const st = studios(stripTex);
  const envRT = pmrem.fromScene(st.room, 0.03), conRT = pmrem.fromScene(st.con, 0.015);
  st.dispose(); stripTex.dispose();
  scene.environment = envRT.texture;

  const key = new THREE.DirectionalLight(0xfffaf2, 1.6); key.position.set(-0.6, 1.0, 0.8);
  const rim = new THREE.DirectionalLight(0xdce8ff, 2.2); rim.position.set(1.0, 0.45, -0.9);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(FOV_HERO, 1, 20, 8000);
  const rig = new THREE.Group();
  scene.add(rig);
  const ipod = buildIpod({ maxAniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  const { glass, panel, face, wheel, centre } = ipod.mats;
  for (const m of [glass, panel, ipod.mats.steel, ipod.mats.back]) m.envMap = conRT.texture;
  const chassis = new THREE.Group(); // receives the landing nudges
  chassis.position.z = HALF_D;        // rotate about the device centre
  chassis.add(ipod.model);
  rig.add(chassis);

  // soft contact shadow
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.5)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.2)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.renderOrder = -1;
  scene.add(shadow);

  const parts = ipod.parts, N = parts.length;
  const iOf = (id) => parts.findIndex((p) => p.id === id);
  const SHELL = SHELL_IDS.map(iOf);
  const INTERNAL = parts.map((_, i) => i).filter((i) => !SHELL.includes(i));
  const iBoard = iOf('logicBoard'), iFrame = iOf('midframe'), iWheel = iOf('clickWheel'), iFlex = iOf('wheelFlex');
  const E = new Float32Array(N), G = new Float32Array(N);
  // per-material contact glint bookkeeping: [material, base envMapIntensity, part indices]
  const glint = new Map();
  parts.forEach((p, i) => p.group.traverse((o) => {
    if (!o.material) return;
    const g = glint.get(o.material) ?? [o.material, o.material.envMapIntensity ?? 1, []];
    if (!g[2].includes(i)) g[2].push(i);
    glint.set(o.material, g);
  }));

  // ---- layout (viewport dependent, recomputed on resize / DPR change) ----
  const L = { vw: 0, vh: 0, dpr: 0, spread: 1, dz: [], screwOff: [], corners: [], dHero: 600, dAsm: 600, o: ORBIT.land, portrait: false };
  const tmpV = new THREE.Vector3(), tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion();

  function computeExplode(gap) {
    const groups = [];
    parts.forEach((p, i) => { (groups[LAYER[p.id]] ??= []).push(i); });
    const dz = new Array(N).fill(0);
    let cursor = 0;
    for (const g of groups) {
      const zmax = Math.max(...g.map((i) => parts[i].box.max.z));
      const zmin = Math.min(...g.map((i) => parts[i].box.min.z));
      const d = cursor - zmax;
      g.forEach((i) => { dz[i] = d; });
      cursor = zmin + d - gap;
    }
    const centre = (cursor + gap) / 2;
    return dz.map((d) => d + (-HALF_D - centre));
  }
  /** Camera distance from the rig origin so all points (+ rig offset ox/oy) fit inside ±mx/±my NDC. */
  function fitDistance(points, q, fov, aspect, mx, my, ox = 0, oy = 0, dzOf = null) {
    const t = Math.tan((fov * DEG) / 2);
    let d = 0;
    points.forEach((p, k) => {
      tmpV.copy(p); tmpV.z += HALF_D + (dzOf ? dzOf(k) : 0); tmpV.applyQuaternion(q);
      d = Math.max(d, tmpV.z + Math.abs(tmpV.x + ox) / (t * aspect * mx), tmpV.z + Math.abs(tmpV.y + oy) / (t * my));
    });
    return d;
  }
  const qOf = (yaw, pitch) => tmpQ.setFromEuler(tmpE.set(-pitch * DEG, -yaw * DEG, 0, 'XYZ'));
  /** Centre of the rotated point cloud (camera-aligned x/y), to keep the stack centred. */
  function centreOf(points, q) {
    const e = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of points) {
      tmpV.copy(p); tmpV.z += HALF_D; tmpV.applyQuaternion(q);
      e[0] = Math.min(e[0], tmpV.x); e[1] = Math.min(e[1], tmpV.y); e[2] = Math.max(e[2], tmpV.x); e[3] = Math.max(e[3], tmpV.y);
    }
    return [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2];
  }
  const boxPoints = (box, dz, out) => {
    for (let i = 0; i < 8; i++) out.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, (i & 4 ? box.max.z : box.min.z) + dz));
  };

  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (vw === L.vw && vh === L.vh && dpr === L.dpr) return;
    if (dpr !== L.dpr) renderer.setPixelRatio(dpr);
    L.vw = vw; L.vh = vh; L.dpr = dpr;
    renderer.setSize(vw, vh, false);
    const aspect = vw / vh;
    L.portrait = aspect < 0.9;
    L.o = L.portrait ? ORBIT.port : ORBIT.land;
    L.spread = L.portrait ? 0.95 : Math.max(0.7, Math.min(1, aspect / 1.45));
    L.dz = computeExplode(17 * L.spread);
    L.screwOff = ipod.screwBase.map((b, j) => new THREE.Vector3(Math.sign(b.x) * (5 + (j % 3)) * L.spread, b.y * 0.04, (7 + (j % 2) * 3) * L.spread));
    const exploded = [], assembled = [];
    L.corners = [];
    parts.forEach((p, i) => { boxPoints(p.box, L.dz[i], exploded); boxPoints(p.box, 0, assembled); boxPoints(p.box, 0, L.corners); });
    ipod.screwBase.forEach((b, j) => { const v = b.clone().add(L.screwOff[j]); v.z += L.dz[j < 4 ? iBoard : iFrame]; exploded.push(v); });
    L.mx = L.portrait ? 0.86 : 0.84; L.my = L.portrait ? 0.78 : 0.86;
    [L.cx, L.cy] = centreOf(exploded, qOf(L.o.yaw(3.3), L.o.pitch(3.3)));
    L.dHero = Math.max(...[2.6, 3.3, 3.9, 4.25].map((t) => fitDistance(exploded, qOf(L.o.yaw(t), L.o.pitch(t)), FOV_HERO, aspect, L.mx, L.my, -L.cx, -L.cy)));
    L.dAsm = fitDistance(assembled, qOf(30, 8), FOV_HERO, aspect, 0.6, 0.6);
    // start fully below the frame, even for the camera's pulled-back opening distance
    L.rise = 1.25 * L.dAsm * Math.tan((FOV_HERO * DEG) / 2) + IPOD.height * 0.75;
  }

  function targetRect() {
    let r;
    try { r = getTargetRect?.(); } catch { r = null; }
    if (!r || !(r.height > 4)) {
      const h = Math.min(L.vh * 0.74, 600), w = (h * IPOD.width) / IPOD.height;
      return { left: (L.vw - w) / 2, top: (L.vh - h) / 2, width: w, height: h };
    }
    return r;
  }

  /** Blend b ∈ [0,1] from the centred hero framing (half-height k at the rig origin) to the
   *  final framing where the front face silhouette exactly covers the target rect. */
  function applyCamera(b, kHero) {
    const rect = targetRect();
    const tanE = Math.tan((FOV_END * DEG) / 2);
    const dSil = (IPOD.height * L.vh) / (2 * tanE * rect.height);
    const camZEnd = HALF_D - FACE_BEVEL + dSil;
    const fov = lerp(FOV_HERO, FOV_END, b);
    const k = lerp(kHero, camZEnd * tanE, b);
    camera.fov = fov;
    camera.position.set(0, 0, k / Math.tan((fov * DEG) / 2));
    camera.aspect = L.vw / L.vh;
    const ox = (rect.left + rect.width / 2 - L.vw / 2) * b, oy = (rect.top + rect.height / 2 - L.vh / 2) * b;
    camera.setViewOffset(L.vw, L.vh, -ox, -oy, L.vw, L.vh);
    camera.updateProjectionMatrix();
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), pv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const tHero = Math.tan((FOV_HERO * DEG) / 2);
  const dzLive = (k) => L.dz[k >> 3] * E[k >> 3]; // corner k belongs to part k/8
  const reStart = (i) => TL.re0 + (N - 1 - (i === iWheel ? 0 : i)) * TL.reS; // wheel seats with the front plate

  /** Screws ride with their host part and back out / drive in (spinning) around it. */
  function placeScrews(t) {
    for (let j = 0; j < ipod.screwBase.length; j++) {
      const h = j < 4 ? iBoard : iFrame, k = j % 4;
      const out = p3out(clamp01((t - (TL.ex0 + h * TL.exS + 0.06 + k * 0.03)) / 0.85));
      const back = inOutCubic(clamp01((t - (reStart(h) - 0.14 + k * 0.025)) / (TL.reD + 0.08)));
      const e = out * (1 - back);
      pv.copy(ipod.screwBase[j]).addScaledVector(L.screwOff[j], e);
      pv.z += L.dz[h] * E[h];
      q.setFromEuler(eul.set(0.4 * e * Math.sin(j * 1.7), 0.4 * e * Math.cos(j * 1.3), (out - back) * 6 * Math.PI * (j % 2 ? 1 : -1)));
      ipod.screws.setMatrixAt(j, m4.compose(pv, q, one));
    }
    ipod.screws.instanceMatrix.needsUpdate = true;
  }

  function pose(t) {
    layout();
    if (reducedMotion) {
      const u = clamp01(t / duration);
      rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0); chassis.position.set(0, 0, HALF_D); chassis.rotation.set(0, 0, 0);
      parts.forEach((p) => { p.group.position.set(0, 0, p.z0); p.group.rotation.set(0, 0, 0); });
      INTERNAL.forEach((i) => { parts[i].group.visible = false; });
      ipod.screws.visible = false;
      shadow.visible = false;
      scene.environmentRotation.set(0, ENV_END, 0);
      glass.envMapRotation.set(0, GLASS_END, GLASS_Z); panel.envMapRotation.copy(glass.envMapRotation);
      face.emissiveIntensity = FACE_GLOW; wheel.emissiveIntensity = centre.emissiveIntensity = WHEEL_GLOW;
      renderer.toneMappingExposure = END_EXPOSURE;
      applyCamera(1, 0);
      camera.position.z = HALF_D + (camera.position.z - HALF_D) * (1 + 0.04 * (1 - p3out(u)));
      camera.updateProjectionMatrix();
      return smooth(0, 0.7, u);
    }
    const yaw = L.o.yaw(t), pitch = L.o.pitch(t);
    rig.rotation.set(-pitch * DEG, -yaw * DEG, 0, 'XYZ');
    const rise = -L.rise * (1 - p3out(clamp01(t / TL.rise)));
    const bob = 1.2 * Math.sin((t - 1.9) * 2.1) * smooth(1.9, 2.7, t) * (1 - smooth(3.9, 4.4, t));
    const env = smooth(1.15, 2.4, t) * (1 - smooth(4.25, 5.3, t));
    const ox = -L.cx * env, oy = bob - L.cy * env;
    rig.position.set(ox, rise + oy, 0);

    // parts: front-to-back cascade out, back-to-front back in; landing nudges on the chassis,
    // a per-part settle (front plate + wheel, back shell) and a small specular contact glint
    let nudge = 0, wob = 0;
    for (let i = 0; i < N; i++) {
      const p = parts[i];
      const out = p3out(clamp01((t - (TL.ex0 + i * TL.exS)) / TL.exD));
      const rs = reStart(i);
      const back = arrive(clamp01((t - rs) / TL.reD));
      const e = out * (1 - back);
      E[i] = e;
      p.group.position.set(0, 0, p.z0 + L.dz[i] * e);
      const j = i === iWheel ? 0 : i; // the wheel rides home with the front plate: same tilt
      const sgn = j % 2 ? -1 : 1, amp = (1.8 + (j % 3) * 0.8) * DEG;
      // the plate levels out over its last quarter, so it never seats skewed over the wheel
      let tilt = amp * (Math.sin(Math.PI * out) * (1 - back) * 0.7 + sgn * Math.sin(Math.PI * back) * 0.8 * (j ? 1 : 1 - smooth(0.7, 0.95, back)));
      const tau = t - (rs + TL.reD);
      G[i] = tau > -0.3 && tau < 0.3 ? Math.exp(-((tau / 0.09) ** 2)) : 0;
      if (tau > 0 && tau < 0.7) {
        const k = Math.exp(-tau / 0.055) * Math.sin(tau * 52);
        if (i !== iWheel) {
          const w = i === 0 ? 2.2 : i === N - 1 ? 1.4 : 0.5; // heavier parts, bigger click
          nudge += -Math.sign(L.dz[i]) * w * 0.55 * k;
          wob += (i === 0 ? 0.6 : 0.15) * k;
        }
        if (j === 0 || i === N - 1) tilt -= sgn * amp * 0.55 * Math.exp(-tau / 0.09) * Math.sin((Math.PI * tau) / 0.12);
      }
      p.group.rotation.set(tilt, tilt * 0.45 * sgn, 0);
    }
    for (const [m, base, ids] of glint.values()) {
      let g = 0;
      for (const i of ids) g = Math.max(g, G[i]);
      m.envMapIntensity = base * (1 + 0.3 * g);
    }
    chassis.position.set(0, 0, HALF_D + nudge);
    chassis.rotation.set(wob * DEG, 0, 0);
    placeScrews(t);
    let closed = true;
    for (const i of SHELL) if (E[i] >= 1e-4) closed = false;
    // once the plate is nearly home the wheel annulus is the only window onto the flex/board
    const veiled = t > reStart(0) && E[0] < 0.08;
    for (const i of INTERNAL) parts[i].group.visible = !closed && !(veiled && (i === iFlex || i === iBoard));
    ipod.screws.visible = !closed;

    // reflections: slow drift + a soft-box sweep across the face as it turns home
    const sweep = smooth(5.2, D, t);
    scene.environmentRotation.set(0, lerp(-0.7, ENV_END - 0.55, smooth(0, 5.1, t)) + 0.55 * sweep, 0);
    glass.envMapRotation.set(0, lerp(GLASS_FROM, GLASS_END, sweep), GLASS_Z);
    panel.envMapRotation.copy(glass.envMapRotation);

    const b = inOutCubic(clamp01((t - TL.cam0) / (D - TL.cam0)));
    const dHero = lerp(L.dAsm * (1 + 0.12 * (1 - p3out(clamp01(t / 1.6)))), L.dHero, env);
    // framing guard: the live pose (partly exploded, close camera) must stay inside the margins
    const dReq = fitDistance(L.corners, rig.quaternion, FOV_HERO, L.vw / L.vh, L.mx, L.my, ox, oy, dzLive);
    applyCamera(b, smax(dHero * tHero, dReq * tHero, 0.04 * dHero * tHero));
    face.emissiveIntensity = FACE_GLOW * b * b;
    wheel.emissiveIntensity = centre.emissiveIntensity = WHEEL_GLOW * b * b;
    renderer.toneMappingExposure = lerp(1, END_EXPOSURE, b * b);

    shadow.visible = b < 1;
    shadow.position.set(0, -IPOD.height / 2 - 9 - 7 * env + rise, -12);
    shadow.scale.set(lerp(78, 175 * L.spread, env), lerp(11, 22, env), 1);
    shadow.material.opacity = 0.5 * smooth(0.4, 1.1, t) * (1 - b);
    return 1;
  }

  let t = 0, playing = false, finished = false, raf = 0, last = 0, disposed = false, handedOff = false;
  function render() {
    if (disposed) return;
    const op = pose(t);
    if (!handedOff) canvas.style.opacity = String(op);
    renderer.render(scene, camera);
  }

  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  /** Draw the final aligned frame synchronously, then resolve `done` and cross-fade (220 ms)
   *  into the DOM iPod. Programs and textures are warmed in the constructor, so this is cheap. */
  function finish() {
    if (finished || disposed) return;
    finished = true; playing = false;
    cancelAnimationFrame(raf); raf = 0;
    t = duration; handedOff = true;
    render();
    canvas.style.transition = 'none'; canvas.style.opacity = '1';
    void canvas.offsetWidth;
    canvas.style.transition = 'opacity 220ms ease-out';
    canvas.style.opacity = '0';
    resolveDone();
  }
  function frame(now) {
    if (!playing || disposed) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    t = Math.min(duration, t + dt);
    if (t >= duration) { finish(); return; }
    render();
    raf = requestAnimationFrame(frame);
  }
  const onResize = () => { if (!playing) render(); };
  window.addEventListener('resize', onResize);
  // DPR changes (window dragged to another display) without a resize event
  let mq = null;
  const onDpr = () => { watchDpr(); onResize(); };
  const watchDpr = () => {
    mq?.removeEventListener?.('change', onDpr);
    mq = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
    mq?.addEventListener?.('change', onDpr);
  };
  watchDpr();
  const onLost = () => finish(); // GPU reset / context loss: go straight to the DOM iPod
  canvas.addEventListener('webglcontextlost', onLost);

  const brand = (cfg) => { if (!disposed && cfg?.brand) { ipod.setBrand(cfg.brand); if (!playing) render(); } };
  if (config) brand(config);
  else loadConfig(new URL(`${import.meta.env.BASE_URL}config.json`, location.href).href).then(brand).catch(() => {});

  layout();
  pose(3.4); // everything visible once → compile all programs up front
  INTERNAL.forEach((i) => { parts[i].group.visible = true; });
  renderer.compile(scene, camera);
  ipod.textures.forEach((x) => renderer.initTexture(x)); // upload now, not mid-explosion
  render();

  const controller = {
    duration,
    done,
    skip() { finish(); },
    seek(s) {
      if (disposed) return;
      t = Math.max(0, Math.min(duration, Number(s) || 0));
      if (handedOff) { handedOff = false; finished = false; cancelAnimationFrame(raf); canvas.style.transition = 'none'; }
      render();
    },
    pause() { if (!playing) return; playing = false; cancelAnimationFrame(raf); },
    play() {
      if (playing || finished || disposed) return;
      if (t >= duration) { finish(); return; } // already at the end: hand off
      playing = true; last = 0;
      raf = requestAnimationFrame(frame);
    },
    dispose() {
      if (disposed) return;
      disposed = true; playing = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      mq?.removeEventListener?.('change', onDpr);
      canvas.removeEventListener('webglcontextlost', onLost);
      const mats = new Set(), geos = new Set();
      scene.traverse((o) => {
        if (o.geometry) geos.add(o.geometry);
        if (o.material) [].concat(o.material).forEach((m) => mats.add(m));
        if (o.isInstancedMesh) o.dispose();
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => {
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose();
      });
      ipod.textures.forEach((x) => x.dispose());
      shadowTex.dispose();
      envRT.dispose(); conRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
      resolveDone();
    },
  };

  // Dev-only verification hook (stripped from production builds): projected front-face bbox
  // vs the target rect at the current t, in viewport px. Lets harnesses assert alignment numerically.
  if (import.meta.env.DEV) {
    controller._measure = () => {
      pose(t);
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      const ext = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        tmpV.set((x * IPOD.width) / 2, (y * IPOD.height) / 2, -FACE_BEVEL).applyMatrix4(ipod.model.matrixWorld).project(camera);
        const px = (tmpV.x * 0.5 + 0.5) * L.vw, py = (0.5 - tmpV.y * 0.5) * L.vh;
        ext[0] = Math.min(ext[0], px); ext[1] = Math.min(ext[1], py); ext[2] = Math.max(ext[2], px); ext[3] = Math.max(ext[3], py);
      }
      const r = targetRect();
      const err = Math.max(Math.abs(ext[0] - r.left), Math.abs(ext[1] - r.top), Math.abs(ext[2] - (r.left + r.width)), Math.abs(ext[3] - (r.top + r.height)));
      return { left: ext[0], top: ext[1], right: ext[2], bottom: ext[3], target: { left: r.left, top: r.top, width: r.width, height: r.height }, err };
    };
    controller._three = { scene, renderer, ipod, key, rim };
    controller._render = () => renderer.render(scene, camera); // draw without re-posing (probes)
  }
  controller.play();
  return controller;
}
