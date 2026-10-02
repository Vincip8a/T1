// Loads public/config.json relative to the page so the site works under any base path.
// A request that never answers gives up after CONFIG_MS and lands in the caller's error path.
const CONFIG_MS = 8000;

export async function loadConfig(url = new URL('config.json', document.baseURI).href) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new Error(`config.json: no answer within ${CONFIG_MS / 1000} s`)), CONFIG_MS);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!res.ok) throw new Error(`config.json: HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
