// Click-wheel sounds: a short, dry piezo "tk" per scroll step and a slightly lower, longer
// "tck" for button presses. The AudioContext is created lazily on the first user gesture.
export function createSound(enabled) {
  let ctx = null;
  const buffers = {};
  let lastAt = 0;

  function build(kind) {
    const sr = ctx.sampleRate;
    const press = kind === 'press';
    const dur = press ? 0.022 : 0.009;
    const n = Math.ceil(sr * dur);
    const b = ctx.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    let seed = press ? 7 : 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const f1 = press ? 1900 : 3600;
    const f2 = press ? 820 : 5200;
    const decay = press ? 0.0034 : 0.0011;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.exp(-t / decay) * Math.min(1, i / 6);
      d[i] = env * (0.5 * Math.sin(2 * Math.PI * f1 * t) + 0.2 * Math.sin(2 * Math.PI * f2 * t) + 0.42 * rnd());
    }
    return b;
  }

  return {
    ensure() {
      if (!enabled) return;
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume();
      } catch { /* audio unavailable */ }
    },
    play(kind = 'tick') {
      if (!enabled || !ctx || ctx.state !== 'running') return;
      const now = performance.now();
      if (kind === 'tick' && now - lastAt < 12) return; // never buzz on very fast spins
      lastAt = now;
      try {
        buffers[kind] ??= build(kind);
        const src = ctx.createBufferSource();
        src.buffer = buffers[kind];
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = kind === 'tick' ? 1400 : 420;
        const g = ctx.createGain();
        g.gain.value = kind === 'tick' ? 0.14 : 0.2;
        src.connect(hp).connect(g).connect(ctx.destination);
        src.start();
      } catch { /* ignore */ }
    },
    close() { try { ctx?.close(); } catch { /* ignore */ } ctx = null; },
  };
}
