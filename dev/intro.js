// Dev harness: runs the intro against a dashed dummy target box (red outline = expected final rect).
// ?t=2.5 seeks and pauses, ?reduced uses the reduced-motion timeline.
import { runIntro } from '../src/intro/index.js';
import { aspect } from '../src/shared/ipodSpec.js';

const params = new URLSearchParams(location.search);
const target = document.getElementById('target');
target.style.aspectRatio = String(aspect); // same body proportions as the DOM iPod
const intro = runIntro({
  getTargetRect: () => target.getBoundingClientRect(),
  reducedMotion: params.has('reduced'),
});
if (params.has('t')) { intro.pause(); intro.seek(Number(params.get('t'))); }
intro.ready.then(() => { window.__intro = intro; }); // test hook once the setup tasks are done
intro.done.then(() => { document.body.dataset.introDone = '1'; });
