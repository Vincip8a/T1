// Click-wheel input: rotational drag on the ring (pointer capture + angle accumulation) and
// presses on the four printed zones. Like the capacitive wheel there is no inertia: the list stops
// the moment the finger lifts. Faster spins need less arc per step (the authentic acceleration).
const SLOP = 7; // arc (degrees) below this still counts as a press
const PRESS_SLIDE = 0.15; // a press slid further than this (x wheel radius) from where it began is cancelled
const CENTRE = 0.4; // centre button radius / wheel radius (ipodSpec: 15.4 / 38.6): lifting there presses nothing
const ZONES = ['next', 'play', 'prev', 'menu']; // clockwise from 3 o'clock

/**
 * @param wheel element covering the whole wheel (the centre button inside it is ignored)
 * @param on(target, type, fn) adds a listener that the caller removes on destroy
 * @param cb.onStep(dir) → boolean (false at a list end drops the remainder)
 * @param cb.onPress(zone)  a completed press on 'menu' | 'next' | 'prev' | 'play'
 * @param cb.onDown()       first touch (focus, audio unlock)
 * @returns stop(): cancels a gesture in progress, including its pressed-zone visual
 */
export function createWheel(wheel, on, { onStep, onPress, onDown }) {
  let g = null;
  const setPress = (z) => { if (z) wheel.dataset.press = z; else delete wheel.dataset.press; };
  /** angle in degrees around the centre, or null too close to the middle to be usable */
  const angle = (e) => {
    const dx = e.clientX - g.cx;
    const dy = e.clientY - g.cy;
    return Math.hypot(dx, dy) < g.R * 0.22 ? null : (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const stop = () => {
    g = null;
    setPress();
    wheel.classList.remove('is-spinning');
  };

  on(wheel, 'pointerdown', (e) => {
    if (e.button || g || e.target.closest('.ipodc-center')) return;
    const r = wheel.getBoundingClientRect();
    const R = r.width / 2;
    g = { id: e.pointerId, cx: r.left + R, cy: r.top + R, R, sx: e.clientX, sy: e.clientY, acc: 0, rev: 0, total: 0, v: 0, t: e.timeStamp, drag: false };
    const a = angle(e);
    if (Math.hypot(e.clientX - g.cx, e.clientY - g.cy) > R + 2) return void (g = null);
    e.preventDefault();
    onDown();
    g.last = a;
    g.zone = ZONES[(Math.round((a ?? 90) / 90) + 4) % 4];
    try { wheel.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    setPress(g.zone);
  });

  on(wheel, 'pointermove', (e) => {
    if (e.pointerId !== g?.id) return;
    // a finger that slides off its zone (inwards onto the centre button, or anywhere far enough) presses
    // nothing on lift, like the real wheel; turning it is still possible
    if (g.zone && (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > g.R * PRESS_SLIDE
      || Math.hypot(e.clientX - g.cx, e.clientY - g.cy) < g.R * CENTRE)) {
      g.zone = null;
      if (!g.drag) setPress();
    }
    const a = angle(e);
    const d = g.last == null || a == null ? 0 : ((a - g.last + 540) % 360) - 180;
    g.last = a;
    if (!d) return;
    // a reversal answers after one full detent instead of first unwinding the old direction's
    // remainder: once the finger has turned back 2 degrees (less is jitter), that remainder is
    // dropped and the reverse arc counts on its own, however slowly it is drawn
    if (g.acc * d < 0) {
      g.rev += d;
      if (Math.abs(g.rev) >= 2) { g.acc = g.rev; g.rev = 0; } else g.acc += d;
    } else {
      g.rev = 0;
      g.acc += d; // counted from the first degree, so a slow arc never loses a step
    }
    g.total += Math.abs(d);
    const dt = Math.max(1, e.timeStamp - g.t);
    g.t = e.timeStamp;
    g.v = g.v * 0.7 + ((Math.abs(d) * 1000) / dt) * 0.3; // smoothed speed, degrees per second
    if (!g.drag) {
      if (g.total < SLOP) return;
      g.drag = true; // a spin, not a press
      setPress();
      wheel.classList.add('is-spinning');
    }
    const step = g.v < 360 ? 20 : g.v < 800 ? 15 : 11;
    while (Math.abs(g.acc) >= step) {
      const dir = Math.sign(g.acc);
      g.acc -= dir * step;
      if (!onStep(dir)) g.acc = 0;
    }
  });

  const up = (e) => {
    if (e.pointerId !== g?.id) return;
    const { drag, zone } = g;
    stop();
    if (e.type === 'pointerup' && !drag && zone) onPress(zone);
  };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) on(wheel, t, up);
  return stop;
}
