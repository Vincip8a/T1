// Intro variant F – "Independent challenger": a silver iPod Classic is pried open, every part
// drifts out into an exploded view with inertia and secondary motion, the camera sweeps around
// the floating hardware, and everything snaps back together before the device settles frontal,
// pixel-aligned with the DOM iPod. Time-driven and deterministic: same t → same frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { IPOD } from '../../../shared/ipodSpec.js';
import { loadConfig } from '../../../shared/config.js';
import { makeTextures, engrave } from './tex.js';
import { buildModel } from './model.js';

const FOV_END = 24;             // narrow final FOV keeps the side walls invisible
const DUR = 6.8, DUR_REDUCED = 1.0;
const { PI, sin, cos } = Math;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Keyframe track: ordered, non-overlapping segments; `at(t)` is a pure function of t. */
function seq(v0) {
  const segs = [];
  const api = {
    to(t0, t1, v1, ease = 'none') {
      const prev = segs.length ? segs[segs.length - 1].v1 : v0;
      segs.push({ t0, t1, v0: prev, v1, f: gsap.parseEase(ease) });
      return api;
    },
    at(t) {
      let v = v0;
      for (const s of segs) {
        if (t <= s.t0) break;
        v = t >= s.t1 ? s.v1 : s.v0 + (s.v1 - s.v0) * s.f((t - s.t0) / (s.t1 - s.t0));
      }
      return v;
    },
  };
  return api;
}

export function runIntro({ getTargetRect, reducedMotion = false }) {
  const duration = reducedMotion ? DUR_REDUCED : DUR;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  /* ---------- canvas & renderer ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-f-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;opacity:0;display:block';
  document.body.append(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    canvas.remove();
    resolveDone();
    return { duration: 0, done, skip() {}, seek() {}, pause() {}, play() {}, dispose() {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  /* ---------- scene ---------- */
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xfff3e4, 1.7);
  key.position.set(60, 90, 210);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 9;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.3;
  Object.assign(key.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 20, far: 700 });
  const rim = new THREE.DirectionalLight(0xd4e6ff, 1.4);
  rim.position.set(-120, 60, -90);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-60, -40, 120);
  scene.add(key, rim, fill);

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = makeTextures(aniso);
  const model = buildModel(tex);
  scene.add(model.root);

  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.ShadowMaterial({ color: 0x0a1428, opacity: 0, transparent: true, depthWrite: false }));
  shadowPlane.position.z = -95;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const camera = new THREE.PerspectiveCamera(FOV_END, 1, 10, 2000);
  const look = new THREE.Vector3();

  let disposed = false;
  const cfgUrl = /\/dev\//.test(location.pathname) ? new URL('../config.json', document.baseURI).href : undefined;
  loadConfig(cfgUrl)
    .then((cfg) => { if (!disposed) { engrave(tex.steel, cfg.brand, aniso); if (!playing) render(t); } })
    .catch(() => {});

  /* ---------- choreography ---------- */
  const tr = {};
  if (reducedMotion) {
    tr.opacity = seq(0).to(0, 0.5, 1, 'power2.out');
    tr.dist = seq(1.05).to(0, DUR_REDUCED, 1, 'power2.out');
    for (const n of ['az', 'el', 'lookZ', 'lookY', 'shadow', 'jolt', 'screws', 'clips']) tr[n] = seq(0);
    tr.fov = seq(FOV_END);
    for (const p of model.parts) tr[p.id] = seq(0);
  } else {
    const OUT = 'back.out(1.7)', IN = 'power3.inOut';
    // Removal order (start, duration): pry the shell, screws spin out, the heavy parts leave
    // backwards, then the front stack lifts away.
    const out = {
      backShell: [0.70, 1.05], screws: [0.95, 0.90], clips: [1.00, 0.70], storage: [1.15, 0.95],
      battery: [1.28, 0.90], logicBoard: [1.42, 0.90], faceplate: [1.55, 1.00], screenGlass: [1.70, 0.85],
      clickWheel: [1.82, 0.85], centerButton: [1.92, 0.80], wheelFlex: [2.02, 0.80], lcd: [2.12, 0.80],
    };
    // Reassembly in reverse order; the shell closes last with an audible-looking click.
    const order = ['lcd', 'wheelFlex', 'centerButton', 'clickWheel', 'screenGlass', 'faceplate', 'logicBoard', 'battery', 'storage', 'clips', 'screws', 'backShell'];
    order.forEach((id, i) => {
      const [t0, d] = out[id];
      const a0 = 4.15 + i * 0.12, ad = i >= 10 ? 0.65 : 0.6;
      tr[id] = seq(0).to(t0, t0 + d, 1, OUT).to(a0, a0 + ad, 0, IN);
    });
    tr.midframe = seq(0);
    tr.opacity = seq(0).to(0, 0.45, 1, 'power2.out');
    tr.az = seq(-14).to(0, 1.2, -34, 'sine.inOut').to(1.2, 2.8, -52, 'sine.inOut').to(2.8, 5.3, -20, 'sine.inOut').to(5.3, 6.05, -11, 'sine.inOut').to(6.05, 6.8, 0, 'power3.inOut');
    tr.el = seq(6).to(0, 1.2, 12, 'sine.inOut').to(1.2, 2.8, 20, 'sine.inOut').to(2.8, 5.3, 4, 'sine.inOut').to(5.3, 6.05, 3, 'sine.inOut').to(6.05, 6.8, 0, 'power3.inOut');
    tr.dist = seq(1.16).to(0, 1.0, 1.07, 'power2.out').to(1.0, 2.9, 1.42, 'power2.inOut').to(4.2, 6.05, 1.12, 'power2.inOut').to(6.05, 6.8, 1, 'power3.inOut');
    tr.fov = seq(30).to(6.05, 6.8, FOV_END, 'power3.inOut');
    tr.lookZ = seq(0).to(1.0, 2.9, -12, 'power2.inOut').to(4.2, 6.05, -2, 'power2.inOut').to(6.05, 6.8, 0, 'power3.inOut');
    tr.lookY = seq(0).to(1.0, 2.9, 1.5, 'sine.inOut').to(4.2, 6.8, 0, 'sine.inOut');
    tr.shadow = seq(0).to(1.0, 2.0, 1, 'sine.inOut').to(4.6, 5.4, 0, 'sine.inOut');
    tr.jolt = seq(0).to(6.15, 6.16, 1).to(6.16, 6.6, 0, 'elastic.out(1,0.4)');
  }

  /* ---------- rendering ---------- */
  let t = 0, playing = false, raf = 0, last = 0;

  function render(time) {
    if (disposed) return;
    const rect = getTargetRect();
    const vw = innerWidth, vh = innerHeight;
    const rw = Math.max(1, rect.width), rh = Math.max(1, rect.height);
    // spread + orbit scale: smaller when the target nearly fills the viewport (phones)
    const fitv = Math.min(vw / rw, vh / rh);
    const k = clamp((fitv - 0.95) / 0.55, 0.42, 1);
    const aS = 0.55 + 0.45 * k;

    for (const p of model.parts) p.e = tr[p.id].at(time);
    model.apply(k, tr.screws.at(time), tr.clips.at(time), time);
    const jolt = tr.jolt.at(time);
    model.root.position.z = -0.7 * jolt;
    model.root.rotation.x = 0.012 * jolt;

    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const fullW = 2 * Math.max(cx, vw - cx), fullH = 2 * Math.max(cy, vh - cy);
    const dEnd = IPOD.height * fullH / (2 * rh * Math.tan(FOV_END * PI / 360));
    camera.fov = tr.fov.at(time);
    camera.aspect = fullW / fullH;
    camera.near = Math.max(1, dEnd * 0.08);
    camera.far = dEnd * 4 + 600;
    camera.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, vw, vh);
    camera.updateProjectionMatrix();
    const D = dEnd * tr.dist.at(time);
    const az = tr.az.at(time) * aS * PI / 180, el = tr.el.at(time) * aS * PI / 180;
    look.set(0, tr.lookY.at(time) * k, tr.lookZ.at(time) * k);
    camera.position.set(look.x + D * sin(az) * cos(el), look.y + D * sin(el), look.z + D * cos(az) * cos(el));
    camera.lookAt(look);
    camera.updateMatrixWorld();

    shadowPlane.material.opacity = 0.18 * tr.shadow.at(time);
    canvas.style.opacity = tr.opacity.at(time).toFixed(3);
    renderer.render(scene, camera);
  }

  function finish() {
    playing = false;
    cancelAnimationFrame(raf);
    t = duration;
    render(t);
    resolveDone();
  }
  function frame(now) {
    if (!playing) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t = Math.min(duration, t + dt);
    render(t);
    if (t >= duration) finish();
    else raf = requestAnimationFrame(frame);
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    if (!playing) render(t);
  }
  window.addEventListener('resize', resize);
  renderer.setSize(innerWidth, innerHeight);

  // Warm up shaders on the first (invisible) frame so playback does not stutter.
  render(0);

  const ctl = {
    duration,
    done,
    skip() { if (!disposed) finish(); },
    seek(s) { t = clamp(Number(s) || 0, 0, duration); render(t); if (!playing && t >= duration) finish(); },
    pause() { playing = false; cancelAnimationFrame(raf); },
    play() {
      if (disposed || playing) return;
      playing = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      playing = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      model.dispose();
      shadowPlane.geometry.dispose();
      shadowPlane.material.dispose();
      for (const x of Object.values(tex)) x.dispose();
      envRT.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
    /** Test hook: projected front-face rect (viewport px) vs. the target rect at the current t. */
    measure() {
      const rect = getTargetRect();
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
        const v = new THREE.Vector3(sx * IPOD.width / 2, sy * IPOD.height / 2, 0).applyMatrix4(model.root.matrixWorld).project(camera);
        return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
      });
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const left = Math.min(...xs), top = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
      return {
        t, front: { left, top, width: right - left, height: bottom - top },
        target: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        error: { left: left - rect.left, top: top - rect.top, right: right - rect.right, bottom: bottom - rect.bottom },
      };
    },
  };
  ctl.play();
  return ctl;
}
