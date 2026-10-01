// Dev harness: runs an intro variant against a dashed dummy target box (red outline = expected final rect).
const params = new URLSearchParams(location.search);
const variant = params.get('variant') ?? 'c';
const { runIntro } = await import(`../src/intro/variants/${variant}/index.js`);
const target = document.getElementById('target');
const intro = runIntro({
  getTargetRect: () => target.getBoundingClientRect(),
  reducedMotion: params.has('reduced'),
});
window.__intro = intro;
if (params.has('t')) { intro.pause(); intro.seek(Number(params.get('t'))); }
intro.done.then(() => { document.body.dataset.introDone = '1'; });
