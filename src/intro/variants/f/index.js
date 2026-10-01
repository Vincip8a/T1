// Intro variant F – "Independent challenger": a silver iPod Classic is pried open, every part
// drifts out into an exploded view with inertia and secondary motion, the camera sweeps around
// the floating hardware, and everything seats back together (each landing nudges the chassis)
// before the device settles frontal, pixel-aligned with the DOM iPod, and cross-fades away.
// Time-driven and deterministic: same t → same frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { IPOD } from '../../../shared/ipodSpec.js';
import { loadConfig } from '../../../shared/config.js';
import { makeTextures, engrave } from './tex.js';
import { buildModel } from './model.js';

const FOV_END = 24;             // narrow final FOV keeps the side walls invisible
const DUR = 6.8, DUR_REDUCED = 1.0, FADE_MS = 220;
const { PI, sin, cos, exp } = Math;
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

export function runIntro({ getTargetRect, reducedMotion = false, config = null, configUrl = null } = {}) {
  const duration = reducedMotion ? DUR_REDUCED : DUR;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  /* ---------- canvas & renderer ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-f-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
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
  const pixelRatio = () => Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio());
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  /* ---------- scene ---------- */
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;

  const key = new THREE.DirectionalLight(0xfff3e4, 1.35);
  key.position.set(60, 90, 210);
  const rim = new THREE.DirectionalLight(0xd4e6ff, 1.3);
  rim.position.set(-120, 60, -90);
  const edge = new THREE.DirectionalLight(0xffffff, 0.9); // low-left edge light so the rim reads on silver
  edge.position.set(-80, -120, 60);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-60, -40, 120);
  scene.add(key, rim, edge, fill);

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = makeTextures(aniso);
  const model = buildModel(tex);
  scene.add(model.root);

  const camera = new THREE.PerspectiveCamera(FOV_END, 1, 10, 2000);
  const look = new THREE.Vector3();

  let disposed = false, playing = false, finished = false, lost = false;
  const applyBrand = (cfg) => { if (!disposed && cfg?.brand) { engrave(tex.steel, cfg.brand, aniso); if (!playing) render(t); } };
  if (config) applyBrand(config);
  else loadConfig(configUrl ?? new URL('config.json', new URL(import.meta.env.BASE_URL, location.href)).href).then(applyBrand).catch(() => {});

  /* ---------- choreography ---------- */
  const tr = {};
  const landings = []; // { t, amp }: each part seating nudges the chassis (damped impulse)
  if (reducedMotion) {
    tr.opacity = seq(0).to(0, 0.5, 1, 'power2.out');
    for (const n of ['az', 'el', 'lookZ', 'lookY', 'screws', 'clips']) tr[n] = seq(0);
    tr.dist = seq(1); tr.fov = seq(FOV_END); tr.shadow = seq(1); tr.spread = seq(0);
    for (const p of model.parts) tr[p.id] = seq(0);
  } else {
    const OUT = 'back.out(1.7)';
    // Removal order (start, duration): pry the shell, screws spin out, clips pop, the heavy
    // parts leave backwards, then the front stack lifts away.
    const out = {
      backShell: [0.70, 1.05], screws: [0.95, 0.90], clips: [1.00, 0.70], storage: [1.15, 0.95],
      battery: [1.28, 0.90], midframe: [1.36, 0.80], logicBoard: [1.42, 0.90], faceplate: [1.55, 1.00],
      screenGlass: [1.70, 0.85], clickWheel: [1.82, 0.85], centerButton: [1.92, 0.80], wheelFlex: [2.02, 0.80], lcd: [2.12, 0.80],
    };
    const amp = { lcd: 0.25, wheelFlex: 0.15, centerButton: 0.15, clickWheel: 0.3, screenGlass: 0.25, faceplate: 0.6, midframe: 0.3, logicBoard: 0.4, battery: 0.35, storage: 0.55, clips: 0.2, screws: 0.2, backShell: 1.6 };
    // Reassembly in reverse order: each part glides in, hovers a moment above its seat, then
    // snaps home (the chassis takes the impulse). The shell closes last at ~5.98 s.
    const order = ['lcd', 'wheelFlex', 'centerButton', 'clickWheel', 'screenGlass', 'faceplate', 'midframe', 'logicBoard', 'battery', 'storage', 'clips', 'screws', 'backShell'];
    order.forEach((id, i) => {
      const [t0, d] = out[id];
      const a0 = 4.1 + i * 0.105, a1 = a0 + 0.62, aSeat = a1 - 0.14;
      tr[id] = seq(0).to(t0, t0 + d, 1, OUT).to(a0, aSeat, 0.07, 'power2.inOut').to(aSeat, a1, 0, 'power2.in');
      landings.push({ t: a1, amp: amp[id] });
    });
    tr.opacity = seq(0).to(0, 0.45, 1, 'power2.out');
    // Camera: 3/4 pose, sweep around the cluster during the hold, come back to a near-frontal
    // view while the parts seat (size already final), then glide the last few degrees to frontal.
    tr.az = seq(-10).to(0, 1.2, -34, 'sine.inOut').to(1.2, 2.9, -50, 'sine.inOut').to(2.9, 5.2, -16, 'sine.inOut').to(5.2, 5.75, -6, 'sine.inOut').to(6.0, 6.55, 0, 'sine.inOut');
    tr.el = seq(5).to(0, 1.2, 12, 'sine.inOut').to(1.2, 2.9, 19, 'sine.inOut').to(2.9, 5.2, 5, 'sine.inOut').to(5.2, 5.75, 2.5, 'sine.inOut').to(6.0, 6.55, 0, 'sine.inOut');
    tr.dist = seq(1.12).to(0, 0.7, 1.06, 'power2.out').to(0.7, 2.2, 1.34, 'power2.inOut').to(4.5, 5.75, 1, 'power2.inOut');
    tr.fov = seq(30).to(4.5, 5.75, FOV_END, 'power2.inOut');
    tr.lookZ = seq(0).to(0.7, 2.4, -14, 'power2.inOut').to(4.5, 5.75, 0, 'power2.inOut');
    tr.lookY = seq(0).to(0.7, 2.4, 2, 'sine.inOut').to(4.5, 5.75, 0, 'sine.inOut');
    tr.shadow = seq(1).to(0.55, 0.85, 0, 'sine.inOut').to(5.98, 6.4, 1, 'sine.inOut');
    tr.spread = seq(0).to(0.65, 1.5, 1, 'power2.out').to(5.0, 5.95, 0, 'power2.inOut'); // phones: extra dolly-out while the cluster is apart
  }
  /** Sum of damped impulses from the landings: 0 before each seat, zero again ≤ 0.7 s later. */
  function nudge(time) {
    let n = 0;
    for (const l of landings) {
      const d = time - l.t;
      if (d > 0 && d < 0.7) n += l.amp * sin(d * 34) * exp(-d * 7.5) * (1 - d / 0.7);
    }
    return n;
  }

  /* ---------- rendering ---------- */
  let t = 0, raf = 0, last = 0, fadeTimer = 0;

  function render(time) {
    if (disposed) return;
    const rect = getTargetRect();
    const vw = innerWidth, vh = innerHeight;
    const rw = Math.max(1, rect.width), rh = Math.max(1, rect.height);
    // Narrow viewports (the target nearly fills the width): shrink the depth spread and the
    // orbit, fan the stack vertically instead, and back the camera off further during the hold.
    const m = clamp((rw / vw - 0.35) / 0.4, 0, 1);
    const k = 1 - 0.38 * m, yk = 0.55 * m, aS = 1 - 0.5 * m;

    for (const p of model.parts) p.e = tr[p.id].at(time);
    model.apply(k, yk, tr.screws.at(time), tr.clips.at(time), time);
    const n = nudge(time);
    model.root.position.z = -1.4 * n;
    model.root.rotation.x = 0.006 * n;
    model.root.scale.setScalar(1 - 0.012 * n);
    model.shadow.material.opacity = 0.5 * tr.shadow.at(time);

    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const fullW = 2 * Math.max(cx, vw - cx), fullH = 2 * Math.max(cy, vh - cy);
    const dEnd = IPOD.height * fullH / (2 * rh * Math.tan(FOV_END * PI / 360));
    camera.fov = tr.fov.at(time);
    camera.aspect = fullW / fullH;
    camera.near = Math.max(1, dEnd * 0.08);
    camera.far = dEnd * 5 + 600;
    camera.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, vw, vh);
    camera.updateProjectionMatrix();
    const D = dEnd * (tr.dist.at(time) + 0.8 * m * tr.spread.at(time));
    const az = tr.az.at(time) * aS * PI / 180, el = tr.el.at(time) * aS * PI / 180;
    look.set(0, tr.lookY.at(time) * k + 7 * m * tr.spread.at(time), tr.lookZ.at(time) * k);
    camera.position.set(look.x + D * sin(az) * cos(el), look.y + D * sin(el), look.z + D * cos(az) * cos(el));
    camera.lookAt(look);
    camera.updateMatrixWorld();

    if (!finished) canvas.style.opacity = tr.opacity.at(time).toFixed(3);
    const pr = pixelRatio();
    if (pr !== renderer.getPixelRatio()) { renderer.setPixelRatio(pr); renderer.setSize(vw, vh, false); }
    if (!lost) renderer.render(scene, camera);
  }

  function finish() {
    if (finished) return;
    playing = false;
    cancelAnimationFrame(raf);
    t = duration;
    render(t);
    finished = true;
    // Cross-fade into the DOM iPod (driven from JS so it never depends on a CSS transition
    // getting its first compositor frame, nor on rAF); re-render the aligned frame only if the target
    // moves during the fade, so a layout shift during the boot cannot leave a misaligned ghost.
    const t0 = performance.now();
    let r0 = getTargetRect();
    const tick = () => {
      if (disposed) return;
      const u = Math.min(1, (performance.now() - t0) / FADE_MS);
      canvas.style.opacity = ((1 - u) * (1 - u)).toFixed(3);
      const r = getTargetRect();
      if (r.left !== r0.left || r.top !== r0.top || r.width !== r0.width || r.height !== r0.height) { r0 = r; render(duration); }
      if (u < 1) fadeTimer = setTimeout(tick, 16); // timers, not rAF: rAF can stall behind a GPU backlog
    };
    tick();
    resolveDone();
  }
  function frame(now) {
    if (!playing) return;
    // Wall-clock stepping, clamped: rAF timestamps can precede performance.now() taken in play()
    // (never go backwards), and a stalled frame must not turn into slow motion.
    const dt = last ? clamp((now - last) / 1000, 0, 0.1) : 0;
    last = now;
    t = Math.min(duration, t + dt);
    render(t);
    if (t >= duration) finish();
    else raf = requestAnimationFrame(frame);
  }
  function resize() {
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(innerWidth, innerHeight, false);
    if (!playing) render(t);
  }
  const onLost = (e) => { e.preventDefault(); lost = true; };
  const onRestored = () => { lost = false; render(t); };
  window.addEventListener('resize', resize);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  renderer.setSize(innerWidth, innerHeight, false);

  // Warm up shaders on the first (invisible) frame so playback does not stutter.
  render(0);

  const ctl = {
    duration,
    done,
    skip() { if (!disposed) finish(); },
    seek(s) { t = clamp(Number(s) || 0, 0, duration); if (!finished) render(t); if (!playing && t >= duration) finish(); },
    pause() { playing = false; cancelAnimationFrame(raf); },
    play() {
      if (disposed || playing || finished) return;
      playing = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      playing = false;
      cancelAnimationFrame(raf);
      clearTimeout(fadeTimer);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      model.dispose();
      for (const x of Object.values(tex)) x.dispose();
      envRT.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
    /** Test hook: GPU resource counters (should be 0 after dispose). */
    info() { return { ...renderer.info.memory }; },
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
