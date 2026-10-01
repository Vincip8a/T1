// Fake playback state for the Now Playing screen: elapsed time advances while "playing",
// tracks wrap, listeners get 'state' | 'track' | 'time' | 'volume' events. Survives screen changes.
// Interval-driven (not rAF) so progress advances even when the page isn't painting.
export function createPlayer(tracks = []) {
  const parse = (s) => {
    const [m, sec] = String(s ?? '').split(':').map(Number);
    const v = (m || 0) * 60 + (sec || 0);
    return v > 0 ? v : 180;
  };
  const listeners = new Set();
  let interval = 0;
  let last = 0;

  const p = {
    tracks,
    idx: 0,
    playing: false,
    started: false,
    elapsed: 0,
    volume: 0.625,
    get track() { return tracks[p.idx]; },
    get duration() { return parse(tracks[p.idx]?.duration); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(type) { for (const fn of listeners) fn(type, p); },
    play() {
      if (!tracks.length || p.playing) return;
      p.playing = true;
      p.started = true;
      last = performance.now();
      interval = setInterval(tick, 250);
      p.emit('state');
    },
    pause() {
      if (!p.playing) return;
      p.playing = false;
      clearInterval(interval);
      interval = 0;
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
    /** jump to track i (from the track list) and make sure it is playing */
    select(i) {
      if (!tracks.length) return;
      const n = ((i % tracks.length) + tracks.length) % tracks.length;
      if (n !== p.idx) { p.idx = n; p.elapsed = 0; }
      p.emit('track');
      if (!p.playing) p.play();
    },
    /** returns true when the volume actually changed (false at 0 % / 100 %) */
    nudgeVolume(d) {
      const v = Math.max(0, Math.min(1, Math.round((p.volume + d) * 1000) / 1000));
      if (v === p.volume) return false;
      p.volume = v;
      p.emit('volume');
      return true;
    },
    destroy() { clearInterval(interval); interval = 0; listeners.clear(); },
  };

  function tick() {
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
