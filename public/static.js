// Shared by impressum.html, datenschutz.html and 404.html (plain script: public/ is served as it is).
// fillBar(root) fills the menu bar like the main page's: monogram and name from config.json, the legal
// links from config.legal (a missing one is left out, as in the main menu bar), and the clock; it also
// puts the name into the tab title. root: the site folder ('./', or on the 404 page the one it found).
window.fillBar = (root) => {
  const clock = document.querySelector('.bar .clock');
  const fmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
  const tick = () => { clock.textContent = fmt.format(new Date()); setTimeout(tick, 60050 - (Date.now() % 60000)); };
  tick();
  // the link rule of the main page: a copy of safeHref in src/shared/href.js (this file is served as it is
  // and cannot import it), keep the two identical. http(s), mailto, tel or a path inside the site
  const SCHEME = /^[a-z][a-z\d+.-]*:/i;
  const legalHref = (href) => {
    const s = String(href ?? '').replace(/[\t\n\r]/g, '').replace(/^[\0- \s]+|[\0- \s]+$/g, '');
    if (!s) return null;
    if (/^(https?|mailto|tel):/i.test(s)) { try { new URL(s); return s; } catch { return null; } }
    const rel = s.replace(/^(?:\.?\/)+/, '');
    return !SCHEME.test(s) && !/^[\\/]{2}/.test(s) && !SCHEME.test(rel) && !rel.startsWith('\\') ? root + rel : null;
  };
  // the same page: origin and path only (no query or hash; '/x', '/x.html' and '/' = '/index.html')
  const page = (u) => u.origin + u.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const samePage = (href) => page(new URL(href, location.href)) === page(location);
  fetch(root + 'config.json', { cache: 'no-cache' }).then((r) => r.json()).then((c) => {
    for (const el of document.querySelectorAll('.bar [data-brand]')) el.textContent = String(c?.brand?.[el.dataset.brand] ?? '');
    if (c?.brand?.name) document.title = `${document.title} · ${c.brand.name}`;
    // without JavaScript or config.json the static hrefs stay (the pages next to this one)
    for (const a of document.querySelectorAll('.bar [data-legal]')) {
      const href = legalHref(c?.legal?.[a.dataset.legal]);
      if (!href) { a.remove(); continue; }
      a.href = href;
      if (!samePage(href)) a.removeAttribute('aria-current'); // it now leads away from this page
    }
  }).catch(() => {});
};
