// Click-wheel sounds: a short, quiet piezo-like tick per scroll step and a slightly lower,
// longer click for button presses. The AudioContext is created lazily inside a user gesture.
export function createClicker({ enabled = true } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  const prime = () => {
    if (!enabled) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC({ latencyHint: 'interactive' });
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        const n = Math.floor(ctx.sampleRate * 0.03);
        noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      ctx = null;
    }
  };

  const blip = ({ freq, len, gain, noiseFreq, noiseGain, noiseLen }) => {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.002;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.0012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + len + 0.01);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = noiseFreq;
    bp.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(noiseGain, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + noiseLen);
    src.connect(bp).connect(ng).connect(master);
    src.start(t);
    src.stop(t + noiseLen + 0.01);
  };

  return {
    prime,
    /** one scroll detent */
    tick: () => blip({ freq: 2900, len: 0.016, gain: 0.09, noiseFreq: 4200, noiseGain: 0.08, noiseLen: 0.011 }),
    /** button press (a touch lower and longer) */
    press: () => blip({ freq: 1500, len: 0.03, gain: 0.12, noiseFreq: 2200, noiseGain: 0.1, noiseLen: 0.02 }),
    destroy: () => { try { ctx?.close(); } catch {} ctx = null; },
  };
}
