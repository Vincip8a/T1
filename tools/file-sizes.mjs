#!/usr/bin/env node
// Gibt die Dateigröße der Downloads genau in der Schreibweise von `size` in public/config.json aus
// (SI, 1 kB = 1000 Byte, auf ganze kB gerundet; dieselbe Funktion wie in make-downloads.mjs).
// Braucht kein Chromium.
//
// Aufruf:  node tools/file-sizes.mjs                  (alle Dateien in public/downloads/)
//          node tools/file-sizes.mjs pfad/datei.pdf   (einzelne Dateien)

import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatSize } from './lib/render.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const downloads = join(root, 'public', 'downloads')

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(downloads).filter((f) => !f.startsWith('.')).sort().map((f) => join(downloads, f))

for (const file of files) {
  const name = relative(process.cwd(), file) || file
  console.log(`${name.padEnd(42)} "size": "${formatSize(statSync(file).size)}"`)
}
