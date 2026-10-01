// Small DOM / format helpers and a timer registry shared by the iPod UI modules.

export function h(tag, cls, attrs = {}) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const k in attrs) {
    const v = attrs[k];
    if (k === 'text') n.textContent = v ?? '';
    else if (v != null && v !== false) n.setAttribute(k, v);
  }
  return n;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const fmtTime = (sec) => {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** Only web, mail and phone links plus relative paths (resolved against the site base). Anything
 *  else (javascript:, data:, …) is rejected with a console warning; its row is then plain text. */
export function safeHref(href) {
  const s = String(href ?? '').trim();
  const m = /^([a-z][a-z\d+.-]*:|\/)/i.exec(s);
  if (!s || /^(https?|mailto|tel):|^\//i.test(s)) return s || null;
  if (!m) return (import.meta.env?.BASE_URL ?? './') + s.replace(/^\.\//, '');
  console.warn('[ipod] link ignored:', s);
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
    cancel(id) { clearTimeout(id); ids.delete(id); return 0; },
    clearAll() { ids.forEach(clearTimeout); ids.clear(); },
  };
}
