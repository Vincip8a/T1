// Rotational click-wheel input: pointer events + angle accumulation (one step per `stepDeg`)
// and click detection on the four ring sectors. Like the real capacitive wheel there is no
// inertia: the highlight moves exactly as far as the finger travelled.
export function createWheel(ring, {
  stepDeg = 20,
  slopDeg = 9,       // movement below this still counts as a click on a sector
  onStep,            // (dir: 1 | -1) – ticks fire exactly here
  onPressStart,      // (sector) – pressed visual
  onPressEnd,        // ()
  onPress,           // (sector) – a completed click: 'menu' | 'next' | 'play' | 'prev'
}) {
  let active = null;
  let acc = 0;

  const angleAt = (e) => {
    const r = ring.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  const sectorOf = (a) => (a > -135 && a <= -45 ? 'menu' : a > -45 && a <= 45 ? 'next' : a > 45 && a <= 135 ? 'play' : 'prev');
  const norm = (d) => ((d + 540) % 360) - 180;

  const feed = (delta) => {
    // a clear reversal responds immediately instead of first unwinding the old remainder
    if (Math.abs(delta) > 2.5 && acc * delta < 0) acc = 0;
    acc += delta;
    let guard = 0;
    const thr = stepDeg - 1e-3; // tolerate float error when a drag lands exactly on a detent
    while (acc >= thr && guard++ < 8) { acc -= stepDeg; onStep(1); }
    while (acc <= -thr && guard++ < 8) { acc += stepDeg; onStep(-1); }
  };

  const down = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (active) return;
    try { ring.setPointerCapture(e.pointerId); } catch {}
    const a = angleAt(e);
    active = { id: e.pointerId, last: a, moved: 0, cum: 0, t0: performance.now(), dragging: false, sector: sectorOf(a) };
    acc = 0;
    onPressStart?.(active.sector);
    e.preventDefault();
  };

  const move = (e) => {
    if (!active || e.pointerId !== active.id) return;
    const a = angleAt(e);
    const d = norm(a - active.last);
    active.last = a;
    active.moved += Math.abs(d);
    active.cum += d;
    if (!active.dragging) {
      if (active.moved <= slopDeg) return;
      // the arc travelled while deciding "drag, not click" counts towards the first detent
      active.dragging = true;
      onPressEnd?.();
      feed(active.cum);
      return;
    }
    feed(d);
    e.preventDefault();
  };

  const up = (e) => {
    if (!active || e.pointerId !== active.id) return;
    const st = active;
    active = null;
    try { ring.releasePointerCapture(e.pointerId); } catch {}
    if (!st.dragging) {
      onPressEnd?.();
      if (e.type === 'pointerup' && performance.now() - st.t0 < 700) onPress?.(st.sector);
    }
    acc = 0;
  };

  ring.addEventListener('pointerdown', down);
  ring.addEventListener('pointermove', move);
  ring.addEventListener('pointerup', up);
  ring.addEventListener('pointercancel', up);
  ring.addEventListener('lostpointercapture', up);

  return {
    /** cancel a drag in progress (e.g. when the centre button takes over) */
    stop() { if (active && !active.dragging) onPressEnd?.(); active = null; acc = 0; },
    destroy() {
      active = null;
      ring.removeEventListener('pointerdown', down);
      ring.removeEventListener('pointermove', move);
      ring.removeEventListener('pointerup', up);
      ring.removeEventListener('pointercancel', up);
      ring.removeEventListener('lostpointercapture', up);
    },
  };
}
