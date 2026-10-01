// Rotational click-wheel input: pointer events + angle accumulation (one step per `stepDeg`),
// click detection on the four ring sectors, and flick momentum with exponential decay.
export function createWheel(ring, {
  stepDeg = 20,
  onStep,            // (dir: 1 | -1) – ticks fire exactly here
  onPressStart,      // (sector) – pressed visual
  onPressEnd,        // ()
  onPress,           // (sector) – a completed click: 'menu' | 'next' | 'play' | 'prev'
  reducedMotion = () => false,
}) {
  let active = null;
  let raf = 0;
  let acc = 0;

  const angleAt = (e) => {
    const r = ring.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  const sectorOf = (a) => (a > -135 && a <= -45 ? 'menu' : a > -45 && a <= 45 ? 'next' : a > 45 && a <= 135 ? 'play' : 'prev');
  const norm = (d) => ((d + 540) % 360) - 180;

  const feed = (delta) => {
    acc += delta;
    let guard = 0;
    while (acc >= stepDeg && guard++ < 6) { acc -= stepDeg; onStep(1); }
    while (acc <= -stepDeg && guard++ < 6) { acc += stepDeg; onStep(-1); }
  };

  const stopMomentum = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  const startMomentum = (v0) => {
    let v = Math.max(-2.2, Math.min(2.2, v0)); // deg per ms
    let last = performance.now();
    const tau = 240;
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(now - last, 48);
      last = now;
      feed(v * dt);
      v *= Math.exp(-dt / tau);
      raf = Math.abs(v) > 0.05 ? requestAnimationFrame(loop) : 0;
    };
    raf = requestAnimationFrame(loop);
  };

  const down = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (active) return;
    stopMomentum();
    try { ring.setPointerCapture(e.pointerId); } catch {}
    const a = angleAt(e);
    const now = performance.now();
    active = { id: e.pointerId, last: a, moved: 0, cum: 0, t0: now, lastMove: now, samples: [[now, 0]], dragging: false, sector: sectorOf(a) };
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
    const now = performance.now();
    active.lastMove = now;
    active.samples.push([now, active.cum]);
    while (active.samples.length > 2 && now - active.samples[0][0] > 110) active.samples.shift();
    if (!active.dragging && active.moved > 9) {
      active.dragging = true;
      onPressEnd?.();
      acc = 0;
    }
    if (active.dragging) feed(d);
    e.preventDefault();
  };

  const up = (e) => {
    if (!active || e.pointerId !== active.id) return;
    const st = active;
    active = null;
    try { ring.releasePointerCapture(e.pointerId); } catch {}
    const now = performance.now();
    if (!st.dragging) {
      onPressEnd?.();
      if (e.type === 'pointerup' && now - st.t0 < 700) onPress?.(st.sector);
      return;
    }
    if (reducedMotion() || e.type !== 'pointerup' || now - st.lastMove > 70) return;
    const s0 = st.samples[0];
    const dt = now - s0[0];
    if (dt < 16) return;
    const v = (st.cum - s0[1]) / dt;
    if (Math.abs(v) > 0.3) startMomentum(v);
  };

  ring.addEventListener('pointerdown', down);
  ring.addEventListener('pointermove', move);
  ring.addEventListener('pointerup', up);
  ring.addEventListener('pointercancel', up);
  ring.addEventListener('lostpointercapture', up);

  return {
    stop: stopMomentum,
    destroy() {
      stopMomentum();
      ring.removeEventListener('pointerdown', down);
      ring.removeEventListener('pointermove', move);
      ring.removeEventListener('pointerup', up);
      ring.removeEventListener('pointercancel', up);
      ring.removeEventListener('lostpointercapture', up);
    },
  };
}
