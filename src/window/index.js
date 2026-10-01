// Placeholder – replaced by the window/desktop builder.
export function createDesktop(host) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#3a6fb5';
  const contentEl = document.createElement('div');
  contentEl.style.cssText = '--ipod-h:min(74vh,600px);padding:24px;background:#e8e8e8;border-radius:8px';
  el.append(contentEl);
  host.append(el);
  return { el, contentEl, setInteractive() {}, destroy: () => el.remove() };
}
