// Loads public/config.json relative to the page so the site works under any base path.
// A request that never answers gives up after CONFIG_MS and lands in the caller's error path.
const CONFIG_MS = 8000;

// `early`: a fetch the page already started (index.html begins it before the entry script runs, so the
// window does not wait for one more round trip); it settles to null when it failed, then this fetches.
export async function loadConfig(url = new URL('config.json', document.baseURI).href, early = null) {
  const ctl = new AbortController();
  let timer = 0;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`config.json: no answer within ${CONFIG_MS / 1000} s`);
      ctl.abort(err);
      reject(err);
    }, CONFIG_MS);
  });
  try {
    const res = (await Promise.race([early, timeout])) ?? await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!res.ok) throw new Error(`config.json: HTTP ${res.status}`);
    return await Promise.race([res.json(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** A switch in config.json that is off: false, also written as a string ("false", "off", "never", "no",
 *  "0") or 0, the usual slips when the file is edited by hand */
export const isOff = (v) => v === false || /^(false|off|never|no|0)$/i.test(String(v ?? '').trim());

/** settings.intro: off (isOff) turns the intro off (main.js and the build's preload use this) */
export const introEnabled = (config) => !isOff(config?.settings?.intro);

export const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
