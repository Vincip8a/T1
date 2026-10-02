// The one DOM helper of the window and the iPod UI.

/** Element with a class and attributes; `text` sets textContent, null / false attributes are left out. */
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
