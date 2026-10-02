// The one href rule for the iPod rows, the menu bar and (imported by vite.config.js) the <noscript>
// list: only http(s):, mailto:, tel: and relative paths. A relative path resolves against the site
// base, a leading '/' included, so "/downloads/x.pdf" works under a GitHub Pages sub-path as well.

const SCHEME = /^[a-z][a-z\d+.-]*:/i;
/** URL.canParse with a fallback for older engines */
const canParse = (s) => {
  if (URL.canParse) return URL.canParse(s);
  try { new URL(s); return true; } catch { return false; }
};

/** Safe href or null (the row is then plain text). Anything else (javascript:, data:, //host, …) is
 *  rejected with a console warning. */
// public/static.js (the legal pages and 404, served as they are) carries a copy of this rule: keep the two identical
export function safeHref(href, base = import.meta.env?.BASE_URL ?? './') {
  // test what the URL parser will see: it drops tabs and newlines anywhere, controls and spaces at the
  // ends; any other blank at the ends too (a no-break space or BOM pasted along with an address)
  const s = String(href ?? '').replace(/[\t\n\r]/g, '').replace(/^[\0- \s]+|[\0- \s]+$/g, '');
  if (!s) return null;
  if (/^(https?|mailto|tel):/i.test(s)) {
    if (canParse(s)) return s;
    console.warn('[ipod] link ignored (not a valid address):', s); // e.g. the placeholder "https://"
    return null;
  }
  const rel = s.replace(/^(?:\.?\/)+/, ''); // "./x", "/x" → "x"
  if (!SCHEME.test(s) && !/^[\\/]{2}/.test(s) && !SCHEME.test(rel) && !rel.startsWith('\\')) return base + rel;
  console.warn('[ipod] link ignored:', s);
  return null;
}

/** File name of a download path ("downloads/x.pdf?v=2" → "x.pdf"): the `download` attribute's value. */
export const fileName = (file) => String(file ?? '').split(/[?#]/)[0].split('/').pop();

/** How a row links (the iPod rows and the <noscript> list share it): `href` (safeHref), `download`
 *  (file name, only for a file on this site: browsers ignore it on other origins and would navigate the
 *  page away) and `newTab` (web links, and files hosted elsewhere). `origin`: the page's origin; without
 *  one (the build) every absolute http(s) address counts as another site. Null without a usable href. */
export function linkAttrs(href, { download = null, base, origin = null } = {}) {
  const url = safeHref(href, base);
  if (!url) return null;
  const web = /^https?:/i.test(url);
  let foreign = web;
  if (web && origin) {
    try { foreign = new URL(url).origin !== origin; } catch { /* safeHref parsed it already */ }
  }
  const dl = download != null && !foreign ? download : null;
  return { href: url, download: dl, newTab: web && dl == null, mail: /^mailto:/i.test(url) };
}

const hostOf = (href) => {
  try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; }
};

/** The label a row shows: its own, else the detail, the address's host or e-mail, or the file name, so a
 *  row is never blank. '' means the row has nothing to show (the caller skips it with a warning). */
export function rowLabel({ label, detail, href, file } = {}) {
  const own = String(label ?? '').trim();
  if (own) return own;
  if (detail) return String(detail);
  const s = String(href ?? file ?? '');
  if (/^mailto:/i.test(s)) return s.slice(7).split('?')[0];
  if (/^tel:/i.test(s)) return s.slice(4);
  return hostOf(s) || fileName(s);
}

/** The first of `values` with visible text, trimmed ('' when none): an empty or blank label, title or
 *  window title counts as missing, so the next one stands in (menu rows, screen titles, <noscript>). */
export const firstText = (...values) => values.map((v) => (v == null ? '' : String(v).trim())).find(Boolean) ?? '';

/** A `lang` from config.json (e.g. "en" for "Work Together"), or null when missing or malformed. */
export const langOf = (x) => (typeof x?.lang === 'string' && /^[a-z]{2,3}(-[a-z\d]{1,8})*$/i.test(x.lang) ? x.lang : null);

const SERVICES = [
  [/(^|\.)spotify\.com$/, 'Spotify'], [/^music\.apple\.com$/, 'Apple Music'], [/^music\.youtube\.com$/, 'YouTube Music'],
  [/(^|\.)soundcloud\.com$/, 'SoundCloud'], [/(^|\.)deezer\.com$/, 'Deezer'], [/(^|\.)tidal\.com$/, 'Tidal'],
  [/^music\.amazon\./, 'Amazon Music'],
];
/** The streaming service of a playlist address ("Spotify", "Apple Music", …), or null when unknown. */
export const serviceName = (href) => SERVICES.find(([re]) => re.test(hostOf(href)))?.[1] ?? null;
