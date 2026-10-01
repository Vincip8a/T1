// Tracked timeouts: every pending handle lives in one set so destroy() can clear them all and
// nothing fires against detached DOM afterwards.
export function createTimers() {
  const ids = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { ids.delete(id); fn(); }, ms);
    ids.add(id);
    return id;
  };
  const cancel = (id) => { if (id) { clearTimeout(id); ids.delete(id); } return 0; };
  const clearAll = () => { for (const id of ids) clearTimeout(id); ids.clear(); };
  return { later, cancel, clearAll, get size() { return ids.size; } };
}
