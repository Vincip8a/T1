// The one href rule for the iPod rows, the menu bar and (imported by vite.config.js) the <noscript>
// list: only http(s):, mailto:, tel: and relative paths. A relative path resolves against the site
// base, a leading '/' included, so "/downloads/x.pdf" works under a GitHub Pages sub-path as well.

const SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** Safe href or null (the row is then plain text). Anything else (javascript:, data:, //host, …) is
 *  rejected with a console warning. */
export function safeHref(href, base = import.meta.env?.BASE_URL ?? './') {
  // test what the URL parser will see: it drops tabs and newlines anywhere, controls and spaces at the ends
  const s = String(href ?? '').replace(/[\t\n\r]/g, '').replace(/^[\0- ]+|[\0- ]+$/g, '');
  if (!s) return null;
  if (/^(https?|mailto|tel):/i.test(s)) return s;
  const rel = s.replace(/^(?:\.?\/)+/, ''); // "./x", "/x" → "x"
  if (!SCHEME.test(s) && !/^[\\/]{2}/.test(s) && !SCHEME.test(rel) && !rel.startsWith('\\')) return base + rel;
  console.warn('[ipod] link ignored:', s);
  return null;
}
