// Fake playback state for the Now Playing screen: elapsed time advances while "playing",
// tracks wrap, listeners get 'state' | 'track' | 'time' | 'volume' events. Survives screen changes.
// Timer-driven (not rAF) so progress advances even when the page isn't painting.
export function createPlayer(tracks = []) {
  const parse = (s) => {
    const [m, sec] = String(s ?? '').split(':').map(Number);
    const v = (m || 0) * 60 + (sec || 0);
    return v > 0 ? v : 180;
  };
  const listeners = new Set();
  let raf = 0;
  let last = 0;

  const p = {
    tracks,
    idx: 0,
    playing: false,
    started: false,
    elapsed: 0,
    volume: 0.62,
    get track() { return tracks[p.idx]; },
    get duration() { return parse(tracks[p.idx]?.duration); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(type) { for (const fn of listeners) fn(type, p); },
    play() {
      if (!tracks.length || p.playing) return;
      p.playing = true;
      p.started = true;
      last = performance.now();
      raf = setInterval(loop, 250);
      p.emit('state');
    },
    pause() {
      if (!p.playing) return;
      p.playing = false;
      clearInterval(raf);
      raf = 0;
      p.emit('state');
    },
    toggle() { p.playing ? p.pause() : p.play(); },
    next() {
      if (!tracks.length) return;
      p.idx = (p.idx + 1) % tracks.length;
      p.elapsed = 0;
      p.emit('track');
    },
    prev() {
      if (!tracks.length) return;
      if (p.elapsed > 3) p.elapsed = 0;
      else p.idx = (p.idx - 1 + tracks.length) % tracks.length;
      p.emit('track');
    },
    nudgeVolume(d) {
      p.volume = Math.max(0, Math.min(1, p.volume + d));
      p.emit('volume');
    },
    destroy() { clearInterval(raf); listeners.clear(); },
  };

  function loop() {
    if (!p.playing) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 2);
    last = now;
    p.elapsed += dt;
    if (p.elapsed >= p.duration) { p.next(); p.elapsed = 0; }
    p.emit('time');
  }

  return p;
}
