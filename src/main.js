// Orchestrator: desktop/window → hidden DOM iPod → 3D exploded-view intro → handoff → linktree.
// Build phase: variants are selectable via ?intro=a|b&ipod=a|b (final build imports the winners directly).
import './base.css';
import { loadConfig, prefersReducedMotion } from './shared/config.js';
import { createDesktop } from './window/index.js';

const params = new URLSearchParams(location.search);
const introVariant = params.get('intro') ?? 'a';
const ipodVariant = params.get('ipod') ?? 'c';

const [config, { runIntro }, { mountIpod }] = await Promise.all([
  loadConfig(),
  import(`./intro/variants/${introVariant}/index.js`),
  import(`./ipod/variants/${ipodVariant}/index.js`),
]);

document.title = `${config.brand.name} – Links`;

const desktop = createDesktop(document.getElementById('app'), { config });
const ipod = mountIpod(desktop.contentEl, { config });
window.__ipod = ipod;

desktop.setInteractive(false);
const intro = runIntro({ getTargetRect: () => ipod.getShellRect(), reducedMotion: prefersReducedMotion() });
window.__intro = intro;

const skipBtn = document.createElement('button');
skipBtn.className = 'intro-skip';
skipBtn.type = 'button';
skipBtn.textContent = 'Intro überspringen';
skipBtn.addEventListener('click', () => intro.skip());
document.body.append(skipBtn);
const onKey = (e) => { if (e.key === 'Escape') intro.skip(); };
window.addEventListener('keydown', onKey);

await intro.done;
window.removeEventListener('keydown', onKey);
skipBtn.remove();
await ipod.reveal({ boot: true });
intro.dispose();
desktop.setInteractive(true);
