// Intro variant A: cinematic product reveal. A silver iPod Classic floats in at a 3/4 angle,
// explodes front-to-back along its depth axis, holds while the camera orbits the stack,
// reassembles back-to-front with a settle + glint and lands pixel-aligned on getTargetRect().
// Every frame is a pure function of t (seek-deterministic).
import * as THREE from 'three';
import { IPOD, PARTS } from '../../../shared/ipodSpec.js';
import { loadConfig } from '../../../shared/config.js';
import { buildIpod, FACE_BEVEL } from './model.js';

const DEG = Math.PI / 180;
const HALF_D = IPOD.depth / 2;
const FOV_HERO = 26, FOV_END = 20;

// ---- timeline (seconds) ----
const TL = {
  duration: 7.0,
  fadeIn: 0.45,
  explode: 1.0, stagger: 0.075, explodeDur: 1.15,
  reassemble: 4.05, reStagger: 0.085, reDur: 1.05,
  camStart: 5.1, camEnd: 6.6,
};
const LAYER = { faceplate: 0, screenGlass: 1, clickWheel: 1, wheelFlex: 2, lcd: 2, logicBoard: 3, battery: 4, storage: 4, midframe: 5, backShell: 6 };

// ---- easing helpers ----
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
    for (let i = 0; i < 24; i++) { s = (lo + hi) / 2; if (f(x1, x2, s) < x) lo = s; else hi = s; }
    return f(y1, y2, s);
  };
}
const arrive = bezier(0.42, 0, 0.12, 1); // gentle pull-off, long deceleration into place
/** Hermite spline through [t, v] keys; flat tangents at the ends and at local extrema. */
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
// camera orbit around the stack: yaw φ (camera to the device's right) and elevation ψ
const YAW = spline([[0, 26], [1.2, 33], [2.8, 38], [4.05, 62], [5.4, 30], [6.6, 0]]);
const PITCH = spline([[0, 6], [1.2, 9], [2.8, 11], [4.05, 19], [5.4, 9], [6.6, 0]]);

/** Product-photography studio for reflections: dark cyclorama, big soft key above, two strip
 *  lights for crisp edge highlights on the polished steel and a soft front panel for the face. */
function studioScene() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  const pos = room.geometry.attributes.position, cols = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 20, v = 0.05 + 0.22 * Math.max(0, y) + 0.03 * (1 + Math.min(0, y));
    cols.push(v, v, v * 1.06);
  }
  room.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  s.add(room);
  const box = (w, h, x, y, z, k, c = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  box(16, 10, 0, 13, 2, 3.2);            // overhead key
  box(14, 7, -3, 8.5, 11, 1.7);          // soft front-top panel (face brightness, kept off the mirror axis)
  box(2.2, 16, -12, 2, 5, 7.0, 0xf6f8ff); // left strip
  box(1.6, 16, 13, 1, -2, 5.0, 0xe6efff); // right strip (rim)
  box(10, 1.2, 0, -3, -14, 2.5);         // low back kicker
  return s;
}

export function runIntro({ getTargetRect, reducedMotion = false } = {}) {
  const duration = reducedMotion ? 1.0 : TL.duration;

  // ---- renderer / canvas ----
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.intro = 'a';
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%', display: 'block',
    pointerEvents: 'none', zIndex: '50', opacity: '0', background: 'transparent',
  });
  document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = studioScene();
  const envRT = pmrem.fromScene(studio, 0.02);
  studio.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.0;

  const key = new THREE.DirectionalLight(0xfffbf6, 2.2); key.position.set(-0.7, 1.0, 0.9);
  const rim = new THREE.DirectionalLight(0xdbe7ff, 2.6); rim.position.set(1.0, 0.5, -0.9);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(0.6, -0.7, 1.0);
  scene.add(key, rim, fill);

  const camera = new THREE.PerspectiveCamera(FOV_HERO, 1, 30, 6000);
  const rig = new THREE.Group();
  scene.add(rig);
  const ipod = buildIpod({ maxAniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  ipod.model.position.z = HALF_D; // rotate about the device centre
  rig.add(ipod.model);
  const sweep = new THREE.PointLight(0xffffff, 0, 0, 2);
  rig.add(sweep);
  ipod.parts.forEach((p) => p.mats.forEach((m) => { m.userData.env = m.envMapIntensity ?? 1; }));

  // soft contact shadow (camera-facing blurred ellipse below the device)
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.renderOrder = -1;
  scene.add(shadow);

  // ---- layout (depends on viewport; recomputed on resize) ----
  const L = { vw: 0, vh: 0, spread: 1, dz: [], screwOff: [], dHero: 600, dAsm: 600, yawK: 1, pitchK: 1 };
  const tmpV = new THREE.Vector3(), tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion();

  function computeExplode(gap) {
    const groups = [];
    ipod.parts.forEach((p, i) => { (groups[LAYER[p.id]] ??= []).push(i); });
    const dz = new Array(ipod.parts.length).fill(0);
    let cursor = 0;
    for (const g of groups) {
      const zmax = Math.max(...g.map((i) => ipod.parts[i].box.max.z));
      const zmin = Math.min(...g.map((i) => ipod.parts[i].box.min.z));
      const d = cursor - zmax;
      g.forEach((i) => { dz[i] = d; });
      cursor = zmin + d - gap;
    }
    const centre = (cursor + gap) / 2; // stack spans [cursor+gap, 0]
    return dz.map((d) => d + (-HALF_D - centre));
  }

  /** Camera distance (from rig origin) so every sample point fits inside ±mx/±my NDC. */
  function fitDistance(points, yaw, pitch, fov, aspect, mx, my) {
    const t = Math.tan((fov * DEG) / 2);
    tmpQ.setFromEuler(tmpE.set(-pitch * DEG, -yaw * DEG, 0, 'XYZ'));
    let d = 0;
    for (const p of points) {
      tmpV.copy(p); tmpV.z += HALF_D; tmpV.applyQuaternion(tmpQ);
      d = Math.max(d, tmpV.z + Math.abs(tmpV.x) / (t * aspect * mx), tmpV.z + Math.abs(tmpV.y) / (t * my));
    }
    return d;
  }

  function boxPoints(box, dz, out) {
    for (let i = 0; i < 8; i++) {
      out.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, (i & 4 ? box.max.z : box.min.z) + dz));
    }
  }

  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw === L.vw && vh === L.vh) return;
    L.vw = vw; L.vh = vh;
    renderer.setSize(vw, vh, false);
    const aspect = vw / vh;
    const portrait = aspect < 0.9;
    L.spread = Math.max(0.6, Math.min(1, aspect / 1.45));
    L.yawK = portrait ? 0.75 : 1;
    L.pitchK = portrait ? 1.9 : 1;
    L.dz = computeExplode(19 * L.spread);
    const iBoard = ipod.parts.findIndex((p) => p.id === 'logicBoard');
    const iFrame = ipod.parts.findIndex((p) => p.id === 'midframe');
    L.screwOff = ipod.screwBase.map((b, j) => {
      const host = j < 4 ? L.dz[iBoard] : L.dz[iFrame];
      return new THREE.Vector3(Math.sign(b.x) * (7 + (j % 3)) * L.spread, b.y * 0.06, host + 9 + (j % 2) * 3);
    });
    const exploded = [], assembled = [];
    ipod.parts.forEach((p, i) => { boxPoints(p.box, L.dz[i], exploded); boxPoints(p.box, 0, assembled); });
    ipod.screwBase.forEach((b, j) => exploded.push(b.clone().add(L.screwOff[j])));
    const mx = portrait ? 0.92 : 0.86, my = portrait ? 0.8 : 0.9;
    L.dHero = Math.max(...[2.8, 3.4, 4.05].map((t) => fitDistance(exploded, YAW(t) * L.yawK, PITCH(t) * L.pitchK, FOV_HERO, aspect, mx, my)));
    L.dAsm = fitDistance(assembled, YAW(0.6) * L.yawK, PITCH(0.6) * L.pitchK, FOV_HERO, aspect, 0.62, 0.62);
  }

  function targetRect() {
    let r;
    try { r = getTargetRect?.(); } catch { r = null; }
    if (!r || !(r.height > 4)) {
      const h = Math.min(L.vh * 0.74, 600);
      return { left: (L.vw - (h * IPOD.width) / IPOD.height) / 2, top: (L.vh - h) / 2, width: (h * IPOD.width) / IPOD.height, height: h };
    }
    return r;
  }

  // ---- per-frame state ----
  const screwM = new THREE.Matrix4(), screwQ = new THREE.Quaternion(), screwE = new THREE.Euler(), screwP = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const N = ipod.parts.length;

  function applyFinalCamera(b, kHero, fovHero) {
    const rect = targetRect();
    const tanE = Math.tan((FOV_END * DEG) / 2);
    // distance from camera to the faceplate's silhouette plane so the 103.5 mm body spans rect.height px
    const dSil = (IPOD.height * L.vh) / (2 * tanE * rect.height);
    const camZEnd = HALF_D - FACE_BEVEL + dSil;
    const fov = lerp(fovHero, FOV_END, b);
    const k = lerp(kHero, camZEnd * tanE, b);
    camera.fov = fov;
    camera.position.set(0, 0, k / Math.tan((fov * DEG) / 2));
    const ox = (rect.left + rect.width / 2 - L.vw / 2) * b, oy = (rect.top + rect.height / 2 - L.vh / 2) * b;
    camera.aspect = L.vw / L.vh;
    camera.setViewOffset(L.vw, L.vh, -ox, -oy, L.vw, L.vh);
    camera.updateProjectionMatrix();
  }

  function pose(t) {
    layout();
    if (reducedMotion) {
      const u = clamp01(t / duration);
      rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0);
      ipod.parts.forEach((p) => { p.group.position.set(0, 0, p.z0); p.group.rotation.set(0, 0, 0); });
      ipod.screwBase.forEach((b, j) => { ipod.screws.setMatrixAt(j, screwM.makeTranslation(b.x, b.y, b.z)); });
      ipod.screws.instanceMatrix.needsUpdate = true;
      shadow.visible = false;
      const settle = 1 + 0.035 * (1 - p3out(u));
      applyFinalCamera(1, 0, FOV_END);
      camera.position.z = HALF_D + (camera.position.z - HALF_D) * settle;
      camera.updateProjectionMatrix();
      return smooth(0, 0.7, u);
    }
    const yaw = YAW(t) * L.yawK, pitch = PITCH(t) * L.pitchK;
    const b = inOutCubic(clamp01((t - TL.camStart) / (TL.camEnd - TL.camStart)));
    rig.rotation.set(-pitch * DEG, -yaw * DEG, 0, 'XYZ');
    // float in from below, gentle bob while exploded
    const rise = -18 * (1 - p3out(clamp01(t / 1.5)));
    const bob = 1.4 * Math.sin(t * 1.9) * smooth(1.2, 2.4, t) * (1 - smooth(4.0, 5.2, t));
    rig.position.set(0, rise + bob, 0);

    // parts
    for (let i = 0; i < N; i++) {
      const p = ipod.parts[i];
      const uo = clamp01((t - (TL.explode + i * TL.stagger)) / TL.explodeDur);
      const rs = TL.reassemble + (N - 1 - i) * TL.reStagger;
      const ur = clamp01((t - rs) / TL.reDur);
      const out = p3out(uo), back = arrive(ur);
      const e = out * (1 - back);
      p.group.position.set(0, 0, p.z0 + L.dz[i] * e);
      // in-flight tilt, then a small damped settle after contact
      const sgn = i % 2 ? -1 : 1, amp = (2.2 + (i % 3)) * DEG;
      let tilt = amp * Math.sin(Math.PI * out) * (1 - back) * 0.6 + sgn * amp * Math.sin(Math.PI * back);
      const tau = t - (rs + TL.reDur);
      if (tau > 0 && tau < 0.7) tilt -= sgn * amp * 0.55 * Math.exp(-tau / 0.09) * Math.sin((Math.PI * tau) / 0.12);
      p.group.rotation.set(tilt, tilt * 0.4 * sgn, 0);
      // specular glint at contact
      const ta = rs + TL.reDur * 0.82;
      const g = Math.exp(-(((t - ta) / 0.09) ** 2));
      for (const m of p.mats) {
        m.envMapIntensity = m.userData.env * (1 + 0.9 * g);
        if (m.emissive) m.emissive.setScalar(0.1 * g);
      }
    }
    // screws: pop out + spin, return (screwing in) right after their host part
    const iBoard = ipod.parts.findIndex((p) => p.id === 'logicBoard');
    for (let j = 0; j < ipod.screwBase.length; j++) {
      const uo = clamp01((t - (TL.explode + 0.05 + j * 0.035)) / 0.95);
      const rs = TL.reassemble + (N - 1 - iBoard) * TL.reStagger + 0.25 + j * 0.03;
      const ur = clamp01((t - rs) / 0.9);
      const out = p3out(uo), back = arrive(ur), e = out * (1 - back);
      screwP.copy(ipod.screwBase[j]).addScaledVector(L.screwOff[j], e);
      const spin = (out * 3.2 - back * 3.2) * Math.PI * 2 * (j % 2 ? 1 : -1);
      screwQ.setFromEuler(screwE.set(0.5 * e * Math.sin(j * 1.7), 0.5 * e * Math.cos(j * 1.3), spin));
      ipod.screws.setMatrixAt(j, screwM.compose(screwP, screwQ, one));
    }
    ipod.screws.instanceMatrix.needsUpdate = true;
    // hero glint: a soft highlight sweeps diagonally across the front plate as it seats
    const tf = TL.reassemble + (N - 1) * TL.reStagger + TL.reDur * 0.8;
    const sw = clamp01((t - tf + 0.25) / 0.7);
    sweep.position.set(lerp(-60, 65, sw), lerp(75, -65, sw), 45);
    sweep.intensity = 4200 * Math.sin(Math.PI * sw) ** 2;

    // reflections sweep slowly across the metal; a fixed angle at the end
    scene.environmentRotation.set(0, lerp(-0.5, 0.35, smooth(0, TL.camEnd, t)), 0);

    // camera: hero framing (centred) → final framing (pixel-aligned with the target rect)
    const env = smooth(0.95, 2.3, t) * (1 - smooth(4.1, 5.5, t));
    const dHero = lerp(L.dAsm * (1 + 0.14 * (1 - p3out(clamp01(t / 1.8)))), L.dHero, env);
    applyFinalCamera(b, dHero * Math.tan((FOV_HERO * DEG) / 2), FOV_HERO);

    // contact shadow
    const fadeIn = smooth(0, TL.fadeIn, t);
    shadow.visible = b < 1;
    shadow.position.set(0, -IPOD.height / 2 - 10 - 6 * env, -10);
    shadow.scale.set(lerp(80, 170 * L.spread, env), lerp(12, 22, env), 1);
    shadow.material.opacity = 0.55 * fadeIn * (1 - b);
    return fadeIn;
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
    // hand-off: cross-fade the canvas into the DOM iPod underneath (≤ 250 ms)
    setTimeout(() => {
      if (disposed) return;
      handedOff = true;
      canvas.style.transition = 'opacity 220ms ease-out';
      canvas.style.opacity = '0';
    }, 60);
  }

  function frame(now) {
    if (!playing || disposed) return;
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
    last = now;
    t = Math.min(duration, t + dt);
    render();
    if (t >= duration) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  const onResize = () => { if (!playing) render(); };
  window.addEventListener('resize', onResize);

  // brand monogram engraved on the back (content from config.json)
  loadConfig(new URL(location.pathname.includes('/dev/') ? '../config.json' : 'config.json', document.baseURI).href)
    .then((cfg) => { if (!disposed && cfg?.brand) { ipod.setBrand(cfg.brand); if (!playing) render(); } })
    .catch(() => {});

  layout();
  pose(0);
  renderer.compile(scene, camera);
  render();

  const controller = {
    duration,
    done,
    skip() { if (!disposed) finish(); },
    seek(s) { t = Math.max(0, Math.min(duration, Number(s) || 0)); render(); },
    pause() { playing = false; cancelAnimationFrame(raf); },
    play() {
      if (playing || finished || disposed) return;
      playing = true; last = 0;
      raf = requestAnimationFrame(frame);
    },
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
        Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
        m.dispose();
      });
      ipod.textures.forEach((x) => x.dispose());
      shadowTex.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
      resolveDone();
    },
  };
  controller._dbg = { ipod, scene, render };
  controller.play();
  return controller;
}
