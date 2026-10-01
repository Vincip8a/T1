// Dev harness: mounts an iPod UI variant standalone and reveals it immediately.
import { loadConfig } from '../src/shared/config.js';
const params = new URLSearchParams(location.search);
const variant = params.get('variant') ?? 'c';
const [{ mountIpod }, config] = await Promise.all([
  import(`../src/ipod/variants/${variant}/index.js`),
  loadConfig(new URL('../config.json', location.href).href),
]);
const api = mountIpod(document.getElementById('stage'), { config });
window.__ipod = api;
await api.reveal({ boot: !params.has('noboot') });
document.body.dataset.ready = '1';
