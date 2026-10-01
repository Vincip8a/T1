// Click-wheel sounds, like the piezo in the real thing: a very short, quiet square-wave "tk" per
// scroll step and a lower, slightly longer "tck" for button presses, each with a fast exponential
// decay. The AudioContext is created lazily on the first user gesture.
const KINDS = { tick: [3400, 0.012, 0.05], press: [1500, 0.03, 0.07] }; // Hz, decay s, peak gain

export function createSound(enabled) {
  let ctx = null;
  let lastAt = 0;
  return {
    ensure() {
      if (!enabled) return;
      try {
        ctx ??= new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
      } catch { /* audio unavailable */ }
    },
    play(kind = 'tick') {
      if (ctx?.state !== 'running') return;
      const now = performance.now();
      if (kind === 'tick' && now - lastAt < 12) return; // never buzz on very fast spins
      lastAt = now;
      try {
        const [frequency, decay, gain] = KINDS[kind];
        const t = ctx.currentTime;
        const o = new OscillatorNode(ctx, { type: 'square', frequency });
        const g = new GainNode(ctx);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(1e-4, t + decay);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + decay);
      } catch { /* ignore */ }
    },
    close() { try { ctx?.close(); } catch { /* ignore */ } ctx = null; },
  };
}
