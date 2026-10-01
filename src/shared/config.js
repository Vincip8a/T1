// Loads public/config.json relative to the page so the site works under any base path.
export async function loadConfig(url = new URL('config.json', document.baseURI).href) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`config.json: HTTP ${res.status}`);
  return res.json();
}

export const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
