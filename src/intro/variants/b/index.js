// Intro variant B – "engineering teardown": the iPod is taken apart from the back like a real
// repair (shell → battery → drive → frame → screws → board → flex → LCD → wheel → window),
// held as a labelled exploded view, then snapped back together and handed off frontal,
// pixel-aligned to getTargetRect(). Pure function of t → frame (seek/pause/play deterministic).
import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { IPOD, PARTS } from '../../../shared/ipodSpec.js';
import { loadConfig } from '../../../shared/config.js';
import { buildIpod, ZF } from './model.js';
import { createLabels } from './labels.js';

const EZ = Object.fromEntries(['power2.inOut', 'power3.inOut', 'power2.out', 'power3.out', 'power2.in', 'sine.inOut', 'expo.out']
  .map((n) => [n, gsap.parseEase(n)]));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;

// ── Timeline (seconds) ──
const DURATION = 7.3;
const OUT_ORDER = ['backShell', 'battery', 'storage', 'midframe', 'screws', 'logicBoard', 'wheelFlex', 'lcd', 'clickWheel', 'centerButton', 'screenGlass'];
const OUT0 = 1.3, OUT_STAG = 0.18, OUT_DUR = 0.64;
const HOLD0 = 3.7, HOLD1 = 4.95;
const IN0 = 4.95, IN_STAG = 0.085, IN_DUR = 0.4;
const CAM_IN = [0.15, 1.35], CAM_OUT = [5.85, 7.1];
const RIG_IN = [0.08, 1.3], RIG_OUT = [5.75, 7.05];

// Exploded slots: offset from home in device-local mm (−z = out of the back) + rotation.
const SLOTS = {
  screenGlass: { p: [0, 20, -30], r: [0, -0.3, 0] },
  centerButton: { p: [0, -40, -34], r: [0, Math.PI - 0.7, 0] },
  clickWheel: { p: [0, -18, -62], r: [0, Math.PI - 0.6, 0.2] },
  lcd: { p: [0, 14, -86], r: [0, -0.35, 0] },
  wheelFlex: { p: [0, -14, -108], r: [0, -0.3, 0] },
  logicBoard: { p: [0, 0, -134], r: [0, -0.35, 0] },
  screws: { p: [0, 0, -150], r: [0, -0.35, 0] },
  midframe: { p: [0, 0, -174], r: [0, -0.2, 0] },
  storage: { p: [0, 20, -200], r: [-0.06, -0.45, 0] },
  battery: { p: [0, -36, -218], r: [0.08, -0.5, 0] },
  backShell: { p: [0, 8, -270], r: [0, -0.8, 0.03] },
};
const LABEL_IDS = PARTS.map((p) => p.id);
// Label anchor points on each part, in device mm (front-view spec coords: x right, y down, depth from front).
const ANCHORS = {
  faceplate: [8, 92, 0.8], screenGlass: [20, 20, 0.6], clickWheel: [44, 73.6, 0.2], wheelFlex: [30.9, 52, 1.9],
  lcd: [42, 30, 3.4], logicBoard: [40, 40, 5], screws: [6.9, 7.75, 5.2], midframe: [60.4, 50, 3],
  storage: [24, 30, 9.4], battery: [30.9, 82, 7.2], backShell: [30.9, 40, 10.5],
};

export function runIntro({ getTargetRect, reducedMotion = false }) {
  const duration = reducedMotion ? 1.1 : DURATION;

  // ── Renderer / scene ──
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;background:transparent;opacity:0';
  document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // Studio environment: RoomEnvironment + dark horizon flags and two softbox strips for chrome contrast.
  const room = new RoomEnvironment();
  const extra = [];
  const flag = (x, y, z, sx, sy, sz, c) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(c, c, c) }));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); room.add(m); extra.push(m);
  };
  flag(0, 2.2, 13.6, 30, 5.5, 0.2, 0.02); flag(0, 2.2, -13.6, 30, 5.5, 0.2, 0.02);
  flag(15.2, 2.2, 0, 0.2, 5.5, 26, 0.03); flag(-15.2, 2.2, 0, 0.2, 5.5, 26, 0.03);
  flag(9, 9, 13.4, 1.4, 12, 0.1, 12); flag(-12, 7, -13.4, 1.2, 10, 0.1, 14);
  const envRT = pmrem.fromScene(room, 0.035);
  extra.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
  room.dispose?.();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.0;
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(-140, 220, 260);
  const rim = new THREE.DirectionalLight(0xdce8ff, 1.3); rim.position.set(220, 80, -240);
  const fill = new THREE.HemisphereLight(0xeaf2ff, 0x404650, 0.35);
  scene.add(key, rim, fill);

  // Soft contact shadow on an implied floor under the device / exploded stack.
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.35, '#8a8a8a'); grd.addColorStop(0.7, '#262626'); grd.addColorStop(1, '#000');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x06142c, alphaMap: shadowTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = -1;
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(20, 1, 10, 6000);
  const model = buildIpod();
  const rig = new THREE.Group();
  rig.add(model.device);
  const anchorLocal = Object.fromEntries(Object.entries(ANCHORS).map(([id, [x, y, d]]) =>
    [id, new THREE.Vector3(x - IPOD.width / 2, IPOD.height / 2 - y, ZF - d).sub(model.parts[id].userData.home)]));
  scene.add(rig);

  loadConfig().catch(() => loadConfig(new URL('../config.json', document.baseURI).href)).then((cfg) => { if (!disposed) { model.setBrand(cfg?.brand?.monogram ?? '', cfg?.brand?.name ?? ''); renderNow(); } }).catch(() => {});

  const labelDefs = LABEL_IDS.map((id) => {
    const lab = PARTS.find((p) => p.id === id).label;
    const m = lab.match(/^(.*?)\s*\((.*)\)\s*$/);
    return { id, title: m ? m[1] : lab, sub: m ? m[2] : '' };
  });
  const labels = reducedMotion ? null : createLabels(labelDefs);

  // ── Static per-part data ──
  const slotQ = {}, slotP = {};
  for (const [id, s] of Object.entries(SLOTS)) {
    slotQ[id] = new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.r));
    slotP[id] = new THREE.Vector3(...s.p);
  }
  const ID_Q = new THREE.Quaternion();
  const Q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, -0.34, 0, 'YXZ'));

  // ── Viewport-dependent state (recomputed on resize) ──
  let vw = 1, vh = 1, portrait = false, spread = 1, QT = new THREE.Quaternion(), camT = null;

  function layoutFor() {
    vw = Math.max(1, window.innerWidth); vh = Math.max(1, window.innerHeight);
    renderer.setSize(vw, vh, false);
    portrait = vw / vh < 0.85;
    spread = portrait ? 0.72 : vw / vh < 1.3 ? 0.85 : 1;
    QT.setFromEuler(portrait ? new THREE.Euler(2.42, -0.42, Math.PI, 'YXZ') : new THREE.Euler(0.2, -2.12, 0, 'YXZ'));
    camT = fitTeardown();
  }

  // Fit the exploded arrangement into the viewport (camera direction fixed, distance + centre solved).
  function fitTeardown() {
    const az = portrait ? 0 : 0.05, el = portrait ? 0.12 : 0.2, fov = portrait ? 32 : 28;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const xA = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const yA = new THREE.Vector3().crossVectors(dir, xA);
    const pts = [];
    const v = new THREE.Vector3();
    for (const [id, g] of Object.entries(model.parts)) {
      const b = g.userData.box, home = g.userData.home;
      const pos = home.clone(), q = ID_Q.clone();
      if (slotP[id]) { pos.addScaledVector(slotP[id], spread); q.copy(slotQ[id]); }
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyQuaternion(q).add(pos).applyQuaternion(QT);
        pts.push([v.dot(xA), v.dot(yA), v.dot(dir)]);
      }
    }
    const ext = (k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))];
    const [x0, x1] = ext(0), [y0, y1] = ext(1), [z0, z1] = ext(2);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const tv = Math.tan(THREE.MathUtils.degToRad(fov / 2)), th = tv * (vw / vh);
    const mx = portrait ? 0.9 : 0.86, my = portrait ? 0.78 : 0.64;
    let dist = 0;
    for (const [px, py, pz] of pts) {
      dist = Math.max(dist, pz - cz + Math.abs(px - cx) / (th * mx), pz - cz + Math.abs(py - cy) / (tv * my));
    }
    const target = new THREE.Vector3().addScaledVector(xA, cx).addScaledVector(yA, cy).addScaledVector(dir, cz);
    if (!portrait) target.y += dist * tv * 0.04; // nudge the stack slightly below centre: room for top labels
    return { target, az, el, dist, fov, ox: 0, oy: 0 };
  }

  // Final frontal camera: silhouette plane (front plate walls) fills the target rect exactly.
  const Z_SIL = ZF - 0.3;
  function camAligned(rect) {
    const fov = 20, tv = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const h = rect && rect.height > 2 ? rect.height : vh * 0.6;
    const d = (IPOD.height * vh) / (2 * tv * h);
    const cx = rect ? rect.left + rect.width / 2 : vw / 2, cy = rect ? rect.top + rect.height / 2 : vh / 2;
    return { target: new THREE.Vector3(0, 0, 0), az: 0, el: 0, dist: Z_SIL + d, fov, ox: vw / 2 - cx, oy: vh / 2 - cy };
  }

  function applyCamera(A, T, k, azDrift = 0) {
    const tgt = A.target.clone().lerp(T.target, k);
    const az = lerp(A.az, T.az + azDrift, k), el = lerp(A.el, T.el, k);
    const dist = Math.exp(lerp(Math.log(A.dist), Math.log(T.dist), k));
    camera.fov = lerp(A.fov, T.fov, k);
    camera.aspect = vw / vh;
    camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(tgt);
    camera.up.set(0, 1, 0);
    camera.lookAt(tgt);
    camera.near = Math.max(1, dist * 0.2);
    camera.far = dist * 4 + 800;
    const ox = lerp(A.ox, T.ox, k), oy = lerp(A.oy, T.oy, k);
    if (Math.abs(ox) > 0.01 || Math.abs(oy) > 0.01) camera.setViewOffset(vw, vh, ox, oy, vw, vh);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // ── Part choreography ──
  const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
  function bezier(out, p0, p1, p2, e) {
    const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
    return out.set(p0.x * a + p1.x * b + p2.x * c, p0.y * a + p1.y * b + p2.y * c, p0.z * a + p1.z * b + p2.z * c);
  }
  function posePart(id, t) {
    const g = model.parts[id], home = g.userData.home;
    const i = OUT_ORDER.indexOf(id);
    if (i < 0 || reducedMotion) { g.position.copy(home); g.quaternion.identity(); return; }
    const s0 = OUT0 + i * OUT_STAG - (i === 0 ? 0.08 : 0), d0 = i === 0 ? 0.86 : OUT_DUR;
    const j = OUT_ORDER.length - 1 - i, s1 = IN0 + j * IN_STAG;
    const slot = tmpV.copy(slotP[id]).multiplyScalar(spread).add(home);
    // lift straight out of the back first, then arc over to the slot
    const lift = home.clone(); lift.z += slotP[id].z * spread * 0.55;
    if (id === 'backShell') lift.set(home.x, home.y + 3, home.z + slotP[id].z * spread * 0.7);
    let e, r;
    if (t < s1) { // disassembly / hold
      const u = seg(t, s0, s0 + d0);
      e = EZ['power2.inOut'](u);
      r = EZ['sine.inOut'](seg(u, 0.2, 1));
      bezier(g.position, home, lift, slot, e);
      if (t > s0 + d0) g.position.y += Math.sin((t - s0 - d0) * 2.2 + i) * 0.35 * Math.min(1, (t - s0 - d0) * 2); // gentle float
      g.quaternion.slerpQuaternions(ID_Q, slotQ[id], r);
    } else { // reassembly: accelerate into place, then a short damped settle
      const v = seg(t, s1, s1 + IN_DUR);
      e = 1 - EZ['power2.in'](v);
      r = 1 - EZ['power3.inOut'](seg(v, 0, 0.85));
      bezier(g.position, home, lift, slot, e);
      if (v < 1) g.position.y += Math.sin(((s1 - s0 - d0)) * 2.2 + i) * 0.35 * e;
      g.quaternion.slerpQuaternions(ID_Q, slotQ[id], r);
      const tau = t - (s1 + IN_DUR);
      if (tau > 0 && tau < 0.5) {
        const k = Math.exp(-tau * 11) * Math.sin(tau * 42) * (1 - seg(tau, 0.35, 0.5));
        g.position.z -= 1.1 * k;
        g.quaternion.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0.4, 0).normalize(), 0.012 * k));
      }
    }
  }

  // ── Frame evaluation ──
  let t = 0, playing = true, last = null, raf = 0, finished = false, handedOff = false, disposed = false;
  const proj = new THREE.Vector3();

  function frame(tt) {
    const rect = safeRect();
    const A = camAligned(rect);
    let opacity = 1;
    if (reducedMotion) {
      const u = seg(tt, 0, duration);
      opacity = EZ['power2.out'](seg(u, 0, 0.6));
      rig.quaternion.setFromEuler(new THREE.Euler(0, -0.12 * (1 - EZ['power3.out'](u)), 0));
      rig.scale.setScalar(1 - 0.03 * (1 - EZ['power3.out'](u)));
      for (const id of Object.keys(model.parts)) posePart(id, tt);
      applyCamera(A, A, 0);
    } else {
      opacity = EZ['power2.out'](seg(tt, 0, 0.35));
      rig.scale.setScalar(0.93 + 0.07 * EZ['power3.out'](seg(tt, 0, 0.9)));
      const kin = EZ['power3.inOut'](seg(tt, RIG_IN[0], RIG_IN[1])), kout = EZ['power3.inOut'](seg(tt, RIG_OUT[0], RIG_OUT[1]));
      if (tt < RIG_OUT[0]) rig.quaternion.slerpQuaternions(Q0, QT, kin);
      else rig.quaternion.slerpQuaternions(QT, ID_Q, kout);
      if (tt < RIG_IN[0]) rig.quaternion.copy(Q0);
      for (const id of Object.keys(model.parts)) posePart(id, tt);
      const kc = tt < 3 ? EZ['power3.inOut'](seg(tt, CAM_IN[0], CAM_IN[1])) : 1 - EZ['power3.inOut'](seg(tt, CAM_OUT[0], CAM_OUT[1]));
      const drift = 0.14 * (EZ['sine.inOut'](seg(tt, 1.2, 5.6)) - 0.5);
      applyCamera(A, camT, kc, drift);
    }
    rig.updateMatrixWorld(true);
    placeShadow(tt);
    renderer.render(scene, camera);
    if (!handedOff) canvas.style.opacity = opacity.toFixed(3);
    if (labels) updateLabels(tt);
  }

  const sv = new THREE.Vector3();
  function placeShadow(tt) {
    const a = reducedMotion ? 0 : 0.3 * EZ['power2.out'](seg(tt, 0.1, 0.8)) * (1 - EZ['power2.inOut'](seg(tt, 6.1, 6.8)));
    shadow.visible = a > 0.002;
    if (!shadow.visible) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
    for (const g of Object.values(model.parts)) {
      g.getWorldPosition(sv);
      x0 = Math.min(x0, sv.x); x1 = Math.max(x1, sv.x); y0 = Math.min(y0, sv.y); z0 = Math.min(z0, sv.z); z1 = Math.max(z1, sv.z);
    }
    shadow.position.set((x0 + x1) / 2, y0 - IPOD.height / 2 - 8, (z0 + z1) / 2);
    shadow.scale.set((x1 - x0) * 1.1 + IPOD.width * 1.6, (z1 - z0) * 0.8 + 34, 1);
    shadow.material.opacity = a;
  }

  function updateLabels(tt) {
    const alpha = tt > HOLD0 - 0.05 && tt < HOLD1 ? 1 : 0;
    if (!alpha || handedOff) { labels.update({}, vw, vh, portrait, () => ({}), 0); return; }
    const entries = {};
    const corner = new THREE.Vector3();
    for (const id of LABEL_IDS) {
      const g = model.parts[id], b = g.userData.box;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
        g.localToWorld(corner).project(camera);
        const sx = (corner.x + 1) / 2 * vw, sy = (1 - corner.y) / 2 * vh;
        minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
      }
      g.localToWorld(proj.copy(anchorLocal[id])).project(camera);
      entries[id] = { cx: (proj.x + 1) / 2 * vw, cy: (1 - proj.y) / 2 * vh, minX, maxX, minY, maxY };
    }
    const out = EZ['power2.inOut'](seg(tt, HOLD1 - 0.28, HOLD1 - 0.04));
    labels.update(entries, vw, vh, portrait, (i) => ({
      line: EZ['power3.out'](seg(tt, HOLD0 + i * 0.035, HOLD0 + i * 0.035 + 0.3)) * (1 - out),
      box: EZ['power2.out'](seg(tt, HOLD0 + 0.15 + i * 0.035, HOLD0 + 0.4 + i * 0.035)) * (1 - out),
    }), 1);
  }

  function safeRect() {
    try { return getTargetRect?.() ?? null; } catch { return null; }
  }

  // ── Clock ──
  let resolveDone;
  const done = new Promise((res) => { resolveDone = res; });
  function finish() {
    if (finished) return;
    finished = true; playing = false; t = duration;
    frame(t);
    resolveDone();
    // hand-off: cross-fade the canvas out (240 ms) while the DOM iPod fades in underneath
    handedOff = true;
    labels?.hide();
    canvas.style.transition = 'opacity 240ms ease-out';
    void canvas.offsetWidth; // commit opacity 1 before transitioning
    canvas.style.opacity = '0';
  }
  function tick(now) {
    raf = 0;
    if (disposed) return;
    if (playing) {
      if (last == null) last = now;
      t = Math.min(duration, t + Math.min(0.2, (now - last) / 1000));
      last = now;
    }
    frame(t);
    if (playing && t >= duration) { finish(); return; }
    if (playing) raf = requestAnimationFrame(tick);
  }
  function renderNow() { if (!disposed && !raf) frame(t); }

  const onResize = () => { if (disposed) return; layoutFor(); frame(t); };
  window.addEventListener('resize', onResize);
  layoutFor();
  frame(0);
  raf = requestAnimationFrame(tick);

  return {
    duration,
    done,
    skip() { if (disposed) return; cancelAnimationFrame(raf); raf = 0; finish(); },
    seek(s) {
      if (disposed) return;
      t = Math.max(0, Math.min(duration, Number(s) || 0));
      last = null;
      if (handedOff) { handedOff = false; canvas.style.transition = 'none'; }
      if (t < duration) finished = false;
      frame(t);
    },
    pause() { playing = false; last = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    play() {
      if (disposed || finished) return;
      playing = true; last = null;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      model.dispose();
      shadow.geometry.dispose(); shadow.material.dispose(); shadowTex.dispose();
      envRT.dispose(); pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
      labels?.dispose();
      resolveDone();
    },
    /** Test hook: projected bbox (viewport px) of the front-plate silhouette vs. the target rect. */
    _measure() {
      const r = safeRect();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = new THREE.Vector3(sx * IPOD.width / 2, sy * IPOD.height / 2, Z_SIL);
        model.device.localToWorld(p).project(camera);
        const x = (p.x + 1) / 2 * vw, y = (1 - p.y) / 2 * vh;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      const box = { left: minX, top: minY, right: maxX, bottom: maxY };
      const err = r ? Math.max(Math.abs(minX - r.left), Math.abs(maxX - r.right), Math.abs(minY - r.top), Math.abs(maxY - r.bottom)) : null;
      return { box, target: r && { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, err };
    },
  };
}
