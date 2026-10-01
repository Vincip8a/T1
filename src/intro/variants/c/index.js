// Intro variant C: "studio teardown". A silver iPod Classic rises into frame showing its
// mirror-polished back, turns to a 3/4 front view, bursts apart along its own depth axis
// (front-to-back cascade), holds while the camera orbits the stack, then seats back together
// back-to-front with a physical click (each landing nudges the chassis), and turns to face the
// viewer, landing pixel-aligned on getTargetRect() under a soft-box glint. Pure function of t.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { IPOD } from '../../../shared/ipodSpec.js';
import { loadConfig } from '../../../shared/config.js';
import { buildIpod, FACE_BEVEL } from './model.js';

const DEG = Math.PI / 180;
const HALF_D = IPOD.depth / 2;
const FOV_HERO = 26, FOV_END = 20;
const D = 7.0;
const ENV_END = 0.25, GLASS_FROM = 0.5, GLASS_END = 0.0; // final environment rotations (fix the hand-off look)
const FACE_GLOW = 0.12, ENV_K = 1; // hand-off fill on the front plate (matches the DOM iPod's tone)
const TL = {
  rise: 1.3,
  ex0: 1.5, exS: 0.07, exD: 1.25,
  re0: 4.35, reS: 0.085, reD: 0.62,
  cam0: 4.95,
};
// exploded-stack slot per part (front → back); battery gets its own slot behind the drive
const LAYER = { faceplate: 0, screenGlass: 1, clickWheel: 1, lcd: 2, wheelFlex: 2, logicBoard: 3, storage: 4, battery: 5, midframe: 6, backShell: 7 };
const SHELL_IDS = ['faceplate', 'screenGlass', 'clickWheel', 'lcd', 'backShell'];

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const p3out = (u) => 1 - (1 - u) ** 3;
const inOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
function bezier(x1, y1, x2, y2) {
  const f = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, s = x;
    for (let i = 0; i < 22; i++) { s = (lo + hi) / 2; if (f(x1, x2, s) < x) lo = s; else hi = s; }
    return f(y1, y2, s);
  };
}
const arrive = bezier(0.5, 0, 0.82, 0.76); // lift off gently, arrive with intent (then the click)
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
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1], h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * h * m[i + 1];
  };
}
// Orbit: yaw (camera towards the device's right) and elevation. Landscape spreads the stack
// sideways, portrait looks down on it so the layers spread vertically.
const ORBIT = {
  land: {
    yaw: spline([[0, 198], [0.95, 112], [1.95, 30], [3.0, 40], [4.45, 64], [5.6, 33], [D, 0]]),
    pitch: spline([[0, 12], [1.95, 7], [3.0, 12], [4.45, 19], [5.6, 8], [D, 0]]),
  },
  port: {
    yaw: spline([[0, 198], [0.95, 112], [1.95, 20], [3.0, 18], [4.45, 26], [5.6, 12], [D, 0]]),
    pitch: spline([[0, 12], [1.95, 18], [3.0, 44], [4.45, 54], [5.6, 18], [D, 0]]),
  },
};

/** Studio environment: RoomEnvironment plus a large front soft box (face brightness), two
 *  crisp strip lights and dark flags so the polished steel shows real contrast. */
function studio() {
  const room = new RoomEnvironment();
  const geo = new THREE.BoxGeometry();
  const mats = [];
  const box = (x, y, z, sx, sy, sz, v) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v) });
    mats.push(m);
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz);
    room.add(o);
  };
  box(-5, 7, 13.8, 8, 7, 0.2, 1.6);       // front soft box, high left (hot)
  box(3, 4, 13.85, 16, 10, 0.2, 0.55);     // broad dimmer front fill (gives the face a falloff)
  box(0, -2, 13.9, 26, 3, 0.2, 0.05);      // dark band below it (gives the face a gradient)
  box(-14.8, 4, 4, 0.2, 14, 1.4, 9);       // left strip
  box(14.6, 5, -3, 0.2, 14, 1.2, 7);       // right rim strip
  box(14.8, 2, 7, 0.2, 9, 8, 0.03);        // right flag
  box(-14.8, 2, -8, 0.2, 9, 9, 0.03);      // left-back flag
  box(0, -2, -13.9, 24, 6, 0.2, 0.04);     // back flag (for the polished back)
  return { room, dispose() { geo.dispose(); mats.forEach((m) => m.dispose()); room.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); } };
}

/** Dark studio for the display glass + LCD: black with one soft diagonal strip, so the
 *  screen stays deep black with a single glossy reflection. */
function glassStudio() {
  const s = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mk = (v, x, y, z, sx, sy, rz) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); m.rotateZ(rz); m.scale.set(sx, sy, 1);
    s.add(m);
  };
  mk(1.2, -0.35, 0.75, 10, 0.32, 30, 0.785);  // main diagonal strip (upper-left of the screen)
  mk(0.4, -0.12, 0.52, 10, 0.07, 30, 0.785);  // thin companion line
  mk(0.04, 0, -9, 6, 30, 8, 0);             // faint floor bounce
  return { s, dispose() { geo.dispose(); s.traverse((o) => o.material?.dispose()); } };
}

/** Chrome studio for the mirror-polished steel: large soft boxes and strips against a dark
 *  room, so the back reads as bright polished metal with crisp reflections, not gunmetal. */
function chromeStudio() {
  const s = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mk = (v, x, y, z, sx, sy) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v * 1.03), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); m.scale.set(sx, sy, 1);
    s.add(m);
  };
  mk(0.85, 0, 0, -14, 40, 40); mk(0.85, -14, 0, 0, 40, 40); mk(0.85, 14, 0, 0, 40, 40); mk(0.95, 0, 0, 14, 40, 40);
  mk(1.1, 0, 14, 0, 40, 40); mk(0.06, 0, -14, 0, 40, 40);
  // dark flags + hot strips around the horizon: bands sweep across the polished steel as it turns
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2, c = Math.cos(a), sn = Math.sin(a);
    mk(i % 3 === 1 ? 4 : 0.03, 12.5 * sn, 1, 12.5 * c, i % 3 === 1 ? 1.3 : 2.6 + (i % 2), 26);
  }
  mk(0.05, 0, -3.5, 13.4, 40, 5); // dark floor line (gives the steel a horizon)
  return { s, dispose() { geo.dispose(); s.traverse((o) => o.material?.dispose()); } };
}

export function runIntro({ getTargetRect, reducedMotion = false, config = null } = {}) {
  const duration = reducedMotion ? 1.0 : D;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.intro = 'c';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:50;background:transparent;opacity:1';
  document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const st = studio();
  const envRT = pmrem.fromScene(st.room, 0.03);
  st.dispose();
  scene.environment = envRT.texture;
  const gs = glassStudio(), cs = chromeStudio();
  const glassRT = pmrem.fromScene(gs.s, 0.02), chromeRT = pmrem.fromScene(cs.s, 0.02);
  gs.dispose(); cs.dispose();

  const key = new THREE.DirectionalLight(0xfffaf2, 1.6); key.position.set(-0.6, 1.0, 0.8);
  const rim = new THREE.DirectionalLight(0xdce8ff, 2.2); rim.position.set(1.0, 0.45, -0.9);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(FOV_HERO, 1, 20, 8000);
  const rig = new THREE.Group();
  scene.add(rig);
  const ipod = buildIpod({ maxAniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  const { glass, panel, face } = ipod.mats;
  glass.envMap = panel.envMap = glassRT.texture;
  ipod.mats.steel.envMap = ipod.mats.back.envMap = chromeRT.texture;
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
  const iBoard = iOf('logicBoard'), iFrame = iOf('midframe');
  const E = new Float32Array(N);

  // ---- layout (viewport dependent, recomputed on resize) ----
  const L = { vw: 0, vh: 0, spread: 1, dz: [], screwOff: [], dHero: 600, dAsm: 600, o: ORBIT.land, portrait: false };
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
  /** Camera distance from the rig origin so all points fit inside ±mx/±my NDC. */
  function fitDistance(points, yaw, pitch, fov, aspect, mx, my, cx = 0, cy = 0) {
    const t = Math.tan((fov * DEG) / 2);
    tmpQ.setFromEuler(tmpE.set(-pitch * DEG, -yaw * DEG, 0, 'XYZ'));
    let d = 0;
    for (const p of points) {
      tmpV.copy(p); tmpV.z += HALF_D; tmpV.applyQuaternion(tmpQ);
      d = Math.max(d, tmpV.z + Math.abs(tmpV.x - cx) / (t * aspect * mx), tmpV.z + Math.abs(tmpV.y - cy) / (t * my));
    }
    return d;
  }
  /** Centre of the rotated point cloud (camera-aligned x/y), to keep the stack centred. */
  function centreOf(points, yaw, pitch) {
    tmpQ.setFromEuler(tmpE.set(-pitch * DEG, -yaw * DEG, 0, 'XYZ'));
    const e = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of points) {
      tmpV.copy(p); tmpV.z += HALF_D; tmpV.applyQuaternion(tmpQ);
      e[0] = Math.min(e[0], tmpV.x); e[1] = Math.min(e[1], tmpV.y); e[2] = Math.max(e[2], tmpV.x); e[3] = Math.max(e[3], tmpV.y);
    }
    return [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2];
  }
  const boxPoints = (box, dz, out) => {
    for (let i = 0; i < 8; i++) out.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, (i & 4 ? box.max.z : box.min.z) + dz));
  };

  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw === L.vw && vh === L.vh) return;
    L.vw = vw; L.vh = vh;
    renderer.setSize(vw, vh, false);
    const aspect = vw / vh;
    L.portrait = aspect < 0.9;
    L.o = L.portrait ? ORBIT.port : ORBIT.land;
    L.spread = L.portrait ? 0.95 : Math.max(0.7, Math.min(1, aspect / 1.45));
    L.dz = computeExplode(17 * L.spread);
    L.screwOff = ipod.screwBase.map((b, j) => new THREE.Vector3(Math.sign(b.x) * (5 + (j % 3)) * L.spread, b.y * 0.04, (7 + (j % 2) * 3) * L.spread));
    const exploded = [], assembled = [];
    parts.forEach((p, i) => { boxPoints(p.box, L.dz[i], exploded); boxPoints(p.box, 0, assembled); });
    ipod.screwBase.forEach((b, j) => { const v = b.clone().add(L.screwOff[j]); v.z += L.dz[j < 4 ? iBoard : iFrame]; exploded.push(v); });
    const mx = L.portrait ? 0.9 : 0.84, my = L.portrait ? 0.78 : 0.86;
    [L.cx, L.cy] = centreOf(exploded, L.o.yaw(3.6), L.o.pitch(3.6));
    L.dHero = Math.max(...[2.9, 3.6, 4.45].map((t) => fitDistance(exploded, L.o.yaw(t), L.o.pitch(t), FOV_HERO, aspect, mx, my, L.cx, L.cy)));
    L.dAsm = fitDistance(assembled, 30, 8, FOV_HERO, aspect, 0.6, 0.6);
    L.rise = L.dAsm * Math.tan((FOV_HERO * DEG) / 2) + IPOD.height * 0.62;
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

  /** Screws ride with their host part and back out / drive in (spinning) around it. */
  function placeScrews(t) {
    for (let j = 0; j < ipod.screwBase.length; j++) {
      const h = j < 4 ? iBoard : iFrame, k = j % 4;
      const out = p3out(clamp01((t - (TL.ex0 + h * TL.exS + 0.06 + k * 0.03)) / 0.85));
      const back = inOutCubic(clamp01((t - (TL.re0 + (N - 1 - h) * TL.reS - 0.14 + k * 0.025)) / (TL.reD + 0.08)));
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
      rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0); chassis.position.set(0, 0, HALF_D);
      parts.forEach((p) => { p.group.position.set(0, 0, p.z0); p.group.rotation.set(0, 0, 0); });
      INTERNAL.forEach((i) => { parts[i].group.visible = false; });
      ipod.screws.visible = false;
      shadow.visible = false;
      scene.environmentRotation.set(0, ENV_END, 0);
      glass.envMapRotation.set(0, GLASS_END, 0); panel.envMapRotation.copy(glass.envMapRotation);
      face.emissiveIntensity = FACE_GLOW;
      scene.environmentIntensity = ENV_K;
      applyCamera(1, 0);
      camera.position.z = HALF_D + (camera.position.z - HALF_D) * (1 + 0.04 * (1 - p3out(u)));
      camera.updateProjectionMatrix();
      return smooth(0, 0.7, u);
    }
    const yaw = L.o.yaw(t), pitch = L.o.pitch(t);
    rig.rotation.set(-pitch * DEG, -yaw * DEG, 0, 'XYZ');
    const rise = -L.rise * (1 - p3out(clamp01(t / TL.rise)));
    const bob = 1.2 * Math.sin((t - 2.2) * 2.1) * smooth(2.2, 3.0, t) * (1 - smooth(4.0, 4.6, t));
    const env = smooth(1.45, 2.7, t) * (1 - smooth(4.3, 5.5, t));
    rig.position.set(-L.cx * env, rise + bob - L.cy * env, 0);

    // parts: front-to-back cascade out, back-to-front back in; landing nudges on the chassis
    let nudge = 0, wob = 0;
    for (let i = 0; i < N; i++) {
      const p = parts[i];
      const out = p3out(clamp01((t - (TL.ex0 + i * TL.exS)) / TL.exD));
      const rs = TL.re0 + (N - 1 - i) * TL.reS;
      const back = arrive(clamp01((t - rs) / TL.reD));
      const e = out * (1 - back);
      E[i] = e;
      p.group.position.set(0, 0, p.z0 + L.dz[i] * e);
      const sgn = i % 2 ? -1 : 1, amp = (1.8 + (i % 3) * 0.8) * DEG;
      const tilt = amp * (Math.sin(Math.PI * out) * (1 - back) * 0.7 + sgn * Math.sin(Math.PI * back) * 0.8);
      p.group.rotation.set(tilt, tilt * 0.45 * sgn, 0);
      const tau = t - (rs + TL.reD);
      if (tau > 0 && tau < 0.6) {
        const k = Math.exp(-tau / 0.055) * Math.sin(tau * 52);
        const w = i === 0 ? 1.4 : i === N - 1 ? 1.1 : 0.45; // heavier parts, bigger click
        nudge += -Math.sign(L.dz[i]) * w * 0.55 * k;
        wob += (i === 0 ? 0.6 : 0.15) * k;
      }
    }
    chassis.position.set(0, 0, HALF_D + nudge);
    chassis.rotation.set(wob * DEG, 0, 0);
    placeScrews(t);
    const closed = SHELL.every((i) => E[i] < 1e-4);
    INTERNAL.forEach((i) => { parts[i].group.visible = !closed; });
    ipod.screws.visible = !closed;

    // reflections: slow drift + a soft-box sweep across the face as it turns home
    const sweep = smooth(5.55, D, t);
    scene.environmentRotation.set(0, lerp(-0.7, ENV_END - 0.55, smooth(0, 5.4, t)) + 0.55 * sweep, 0);
    glass.envMapRotation.set(0, lerp(GLASS_FROM, GLASS_END, sweep), 0);
    panel.envMapRotation.copy(glass.envMapRotation);

    const b = inOutCubic(clamp01((t - TL.cam0) / (D - TL.cam0)));
    const dHero = lerp(L.dAsm * (1 + 0.12 * (1 - p3out(clamp01(t / 1.9)))), L.dHero, env);
    applyCamera(b, dHero * tHero);
    face.emissiveIntensity = FACE_GLOW * b * b;
    scene.environmentIntensity = lerp(1, ENV_K, b * b);

    shadow.visible = b < 1;
    shadow.position.set(0, -IPOD.height / 2 - 9 - 7 * env + rise, -12);
    shadow.scale.set(lerp(78, 175 * L.spread, env), lerp(11, 22, env), 1);
    shadow.material.opacity = 0.5 * smooth(0.5, 1.3, t) * (1 - b);
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
  function finish() {
    if (finished) return;
    finished = true; playing = false;
    cancelAnimationFrame(raf);
    t = duration; render();
    resolveDone();
    // hand-off: 220 ms cross-fade into the DOM iPod, starting immediately
    handedOff = true;
    canvas.style.transition = 'none'; canvas.style.opacity = '1';
    void canvas.offsetWidth;
    canvas.style.transition = 'opacity 220ms ease-out';
    canvas.style.opacity = '0';
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

  const brand = (cfg) => { if (!disposed && cfg?.brand) { ipod.setBrand(cfg.brand); if (!playing) render(); } };
  if (config) brand(config);
  else loadConfig(new URL(`${import.meta.env.BASE_URL}config.json`, location.href).href).then(brand).catch(() => {});

  layout();
  pose(2.9); // everything visible once → compile all programs up front
  INTERNAL.forEach((i) => { parts[i].group.visible = true; });
  renderer.compile(scene, camera);
  render();

  /** Test hook: projected front-face bbox vs the target rect at the current t (viewport px). */
  function measure() {
    pose(t);
    scene.updateMatrixWorld(true);
    const ext = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      tmpV.set((x * IPOD.width) / 2, (y * IPOD.height) / 2, -FACE_BEVEL).applyMatrix4(ipod.model.matrixWorld).project(camera);
      const px = (tmpV.x * 0.5 + 0.5) * L.vw, py = (0.5 - tmpV.y * 0.5) * L.vh;
      ext[0] = Math.min(ext[0], px); ext[1] = Math.min(ext[1], py); ext[2] = Math.max(ext[2], px); ext[3] = Math.max(ext[3], py);
    }
    const r = targetRect();
    const err = Math.max(Math.abs(ext[0] - r.left), Math.abs(ext[1] - r.top), Math.abs(ext[2] - (r.left + r.width)), Math.abs(ext[3] - (r.top + r.height)));
    return { left: ext[0], top: ext[1], right: ext[2], bottom: ext[3], target: { left: r.left, top: r.top, width: r.width, height: r.height }, err };
  }

  const controller = {
    duration,
    done,
    skip() { if (!disposed) finish(); },
    seek(s) {
      if (disposed) return;
      t = Math.max(0, Math.min(duration, Number(s) || 0));
      if (handedOff) { handedOff = false; finished = false; canvas.style.transition = 'none'; }
      render();
    },
    pause() { playing = false; cancelAnimationFrame(raf); },
    play() {
      if (playing || finished || disposed) return;
      if (t >= duration) t = 0;
      playing = true; last = 0;
      raf = requestAnimationFrame(frame);
    },
    _measure: measure,
    _three: { scene, renderer, ipod, key, rim },
    dispose() {
      if (disposed) return;
      disposed = true; playing = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
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
      envRT.dispose(); glassRT.dispose(); chromeRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
      resolveDone();
    },
  };
  controller.play();
  return controller;
}
