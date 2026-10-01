// Dev harness: mounts the iPod UI standalone and reveals it immediately (?noboot skips the boot screen).
import { loadConfig } from '../src/shared/config.js';
import { mountIpod } from '../src/ipod/index.js';

const params = new URLSearchParams(location.search);
const config = await loadConfig(new URL('../config.json', location.href).href);
const api = mountIpod(document.getElementById('stage'), { config });
window.__ipod = api;
await api.reveal({ boot: !params.has('noboot') });
document.body.dataset.ready = '1';
