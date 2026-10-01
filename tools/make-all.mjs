#!/usr/bin/env node
// Erzeugt alle generierten Assets neu: Icons, Playlist-Cover, OG-Bild und die
// drei Platzhalter-PDFs.
//
// Aufruf:  node tools/make-all.mjs

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const toolsDir = dirname(fileURLToPath(import.meta.url))
const scripts = ['make-icons.mjs', 'make-og.mjs', 'make-downloads.mjs']

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(toolsDir, script)], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} ist mit Code ${code} abgebrochen.`)),
    )
  })
}

for (const script of scripts) {
  console.log(`\n→ ${script}`)
  await run(script)
}
console.log('\nFertig.')
