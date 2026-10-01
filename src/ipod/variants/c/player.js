// Simulated playback for the Now Playing screen: elapsed time advances while playing, tracks
// wrap, volume steps in 1/16. It lives for the whole mount, so it keeps playing across screens.
// onChange(kind) receives 'state' | 'track' | 'time' | 'volume'.
import { clamp, parseDuration } from './util.js';

export function createPlayer(tracks, onChange) {
  let ticker = 0;
  let last = 0;
  const p = {
    tracks,
    track: 0,
    elapsed: 0,
    playing: false,
    started: false,
    volume: 0.625,
    get duration() { return parseDuration(tracks[p.track]?.duration); },
    setPlaying(v) {
      if (!tracks.length || p.playing === v) return;
      p.playing = v;
      if (v) {
        p.started = true;
        last = performance.now();
        ticker = setInterval(tick, 250);
      } else ticker = clearInterval(ticker);
      onChange('state');
    },
    /** jump to track i (wraps); a paused player stays paused, an untouched one starts */
    go(i) {
      if (!tracks.length) return;
      p.track = (i + tracks.length) % tracks.length;
      p.elapsed = 0;
      onChange('track');
      if (!p.started) p.setPlaying(true);
    },
    /** ⏮ restarts a track that has played for more than 3 s, like the real thing */
    skip(dir) {
      if (dir < 0 && p.elapsed > 3) { p.elapsed = 0; onChange('time'); } else p.go(p.track + dir);
    },
    /** returns true when the volume really changed */
    nudge(d) {
      const v = clamp(Math.round((p.volume + d / 16) * 16) / 16, 0, 1);
      if (v === p.volume) return false;
      p.volume = v;
      onChange('volume');
      return true;
    },
    destroy() { clearInterval(ticker); },
  };
  function tick() {
    const now = performance.now();
    p.elapsed += Math.min(1, (now - last) / 1000); // clamp after background throttling
    last = now;
    if (p.elapsed >= p.duration) p.go(p.track + 1);
    else onChange('time');
  }
  return p;
}
