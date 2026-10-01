// Placeholder – replaced by the iPod UI builder for this variant.
export function mountIpod(container) {
  const el = document.createElement('div');
  el.style.cssText = 'height:var(--ipod-h,560px);aspect-ratio:61.8/103.5;background:#c8cbcf;border-radius:12px';
  container.append(el);
  return {
    el, getShellRect: () => el.getBoundingClientRect(), reveal: async () => {}, press() {}, scroll() {},
    getState: () => ({ screen: 'placeholder', path: [], index: 0 }), destroy: () => el.remove(),
  };
}
