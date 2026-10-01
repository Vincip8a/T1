// Dev harness: runs the intro against a dashed dummy target box (red outline = expected final rect).
// ?t=2.5 seeks and pauses, ?reduced uses the reduced-motion timeline.
import { runIntro } from '../src/intro/index.js';

const params = new URLSearchParams(location.search);
const target = document.getElementById('target');
const intro = runIntro({
  getTargetRect: () => target.getBoundingClientRect(),
  reducedMotion: params.has('reduced'),
});
window.__intro = intro;
if (params.has('t')) { intro.pause(); intro.seek(Number(params.get('t'))); }
intro.done.then(() => { document.body.dataset.introDone = '1'; });
