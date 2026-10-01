// Small DOM / format helpers and a timer registry shared by the variant C modules.

export function h(tag, cls, attrs) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  return n;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function parseDuration(s) {
  const parts = String(s ?? '').split(':').map(Number);
  return (parts.every(Number.isFinite) && parts.reduce((a, n) => a * 60 + n, 0)) || 210;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Relative config paths (cover, downloads) resolve against the site base. */
export function resolveAsset(path) {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(path)) return path;
  return (import.meta.env?.BASE_URL ?? './') + String(path).replace(/^\.\//, '');
}

const warned = new Set();
/** Only web, mail and phone links plus relative paths. Anything else (javascript:, data:, …) is
 *  rejected with one console warning per value, so authors see why a row is inert. */
export function safeHref(href) {
  const s = String(href ?? '').trim();
  if (!s) return null;
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  if (!m) return resolveAsset(s);
  if (/^(https?|mailto|tel)$/i.test(m[1])) return s;
  if (!warned.has(s)) {
    warned.add(s);
    console.warn(`[ipod] config.json: link "${s}" ignored – only http(s):, mailto:, tel: or relative paths are allowed.`);
  }
  return null;
}

/** Tracked timeouts: destroy() clears every pending one, nothing fires against detached DOM. */
export function createTimers() {
  const ids = new Set();
  return {
    later(fn, ms) {
      const id = setTimeout(() => { ids.delete(id); fn(); }, ms);
      ids.add(id);
      return id;
    },
    cancel(id) { if (id) { clearTimeout(id); ids.delete(id); } return 0; },
    clearAll() { for (const id of ids) clearTimeout(id); ids.clear(); },
  };
}
