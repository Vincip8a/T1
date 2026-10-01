// Click-wheel input: rotational drag on the ring (pointer capture + angle accumulation) and
// presses on the four printed zones. Like the capacitive wheel there is no inertia: the list stops
// the moment the finger lifts. Faster spins need less arc per step (the authentic acceleration).
const BASE_STEP = 20; // degrees per step at normal speed
const SLOP = 7;       // arc below this still counts as a press
const toDeg = (rad) => (rad * 180) / Math.PI;
const norm = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const zoneOf = (a) => (a > -45 && a <= 45 ? 'next' : a > 45 && a <= 135 ? 'play' : a > -135 && a <= -45 ? 'menu' : 'prev');

/**
 * @param wheel element covering the whole wheel (the centre button inside it is ignored)
 * @param on(target, type, fn) adds a listener that the caller removes on destroy
 * @param cb.onStep(dir, pointerType) → boolean (false at a list end stops the run)
 * @param cb.onPress(zone)  a completed press on 'menu' | 'next' | 'prev' | 'play'
 * @param cb.onDown()       first touch (focus, audio unlock)
 */
export function createWheel(wheel, on, { onStep, onPress, onDown }) {
  let g = null;
  const setPress = (z) => { if (z) wheel.dataset.press = z; else delete wheel.dataset.press; };

  const down = (e) => {
    if (e.button || g || e.target.closest('.ipodc-center')) return;
    const r = wheel.getBoundingClientRect();
    const R = r.width / 2;
    const cx = r.left + R;
    const cy = r.top + R;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) > R + 2) return;
    e.preventDefault();
    onDown();
    const a = toDeg(Math.atan2(e.clientY - cy, e.clientX - cx));
    g = { id: e.pointerId, type: e.pointerType, cx, cy, R, zone: zoneOf(a), last: a, acc: 0, total: 0, cum: 0, drag: false, s: [{ t: e.timeStamp, a: 0 }] };
    try { wheel.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    setPress(g.zone);
  };

  const move = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.cx;
    const dy = e.clientY - g.cy;
    if (Math.hypot(dx, dy) < g.R * 0.22) { g.last = null; return; } // no usable angle near the middle
    const a = toDeg(Math.atan2(dy, dx));
    if (g.last == null) { g.last = a; return; }
    const d = norm(a - g.last);
    g.last = a;
    // a clear reversal answers on the very next detent instead of first unwinding the remainder
    if (Math.abs(d) > 2.5 && g.acc * d < 0) g.acc = 0;
    g.acc += d; // counted from the first degree, so a slow arc never loses a step
    g.total += Math.abs(d);
    g.cum += d;
    const t = e.timeStamp;
    g.s.push({ t, a: g.cum });
    while (g.s.length > 2 && t - g.s[0].t > 100) g.s.shift();
    if (!g.drag) {
      if (g.total < SLOP) return;
      g.drag = true; // a spin, not a press
      setPress();
      wheel.classList.add('is-spinning');
    }
    const s0 = g.s[0];
    const dt = (t - s0.t) / 1000;
    const v = dt > 0.008 ? Math.abs((g.cum - s0.a) / dt) : 0;
    const step = v < 360 ? BASE_STEP : v < 800 ? 15 : 11;
    while (g.acc >= step) { g.acc -= step; if (!onStep(1, g.type)) { g.acc = 0; break; } }
    while (g.acc <= -step) { g.acc += step; if (!onStep(-1, g.type)) { g.acc = 0; break; } }
  };

  const up = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const was = g;
    stop();
    if (e.type === 'pointerup' && !was.drag) onPress(was.zone);
  };

  /** cancel a gesture in progress, including its pressed-zone visual */
  function stop() {
    g = null;
    setPress();
    wheel.classList.remove('is-spinning');
  }

  for (const [k, fn] of Object.entries({ pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: up })) on(wheel, k, fn);
  return stop;
}
