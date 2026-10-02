/** "308 kB" / "1,2 MB" (SI, 1 kB = 1000 Byte): genau die Schreibweise von `size` in public/config.json.
 *  Eigene Datei ohne weitere Imports, damit auch vite.config.js sie laden kann. */
export function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)} kB`
  return `${(bytes / 1000 / 1000).toFixed(1).replace('.', ',')} MB`
}
