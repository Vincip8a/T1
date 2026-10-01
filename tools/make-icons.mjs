#!/usr/bin/env node
// Erzeugt die gezeichneten Marken-Assets:
//   public/favicon.svg
//   public/assets/playlist-cover.svg
//   public/apple-touch-icon.png  (aus SVG via Chromium gerendert)
//
// Aufruf:  node tools/make-icons.mjs

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { faviconSvg, playlistCoverSvg, touchIconSvg } from './lib/brand.mjs'
import { formatSize, htmlToPng } from './lib/render.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** SVG randlos in einem Viewport der Zielgroesse rendern. */
function svgPage(svg, { width, height }) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  svg { display: block; width: ${width}px; height: ${height}px; }
</style></head><body>${svg}</body></html>`
}

async function writeOut(relativePath, contents) {
  const target = join(root, relativePath)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, contents, 'utf8')
  return { target, size: Buffer.byteLength(contents) }
}

async function main() {
  const favicon = await writeOut('public/favicon.svg', faviconSvg())
  console.log(`public/favicon.svg              ${formatSize(favicon.size)}`)

  const cover = await writeOut('public/assets/playlist-cover.svg', playlistCoverSvg())
  console.log(`public/assets/playlist-cover.svg ${formatSize(cover.size)}`)

  const touchIconPath = join(root, 'public/apple-touch-icon.png')
  await mkdir(dirname(touchIconPath), { recursive: true })
  const bytes = await htmlToPng(svgPage(touchIconSvg(), { width: 180, height: 180 }), touchIconPath, {
    width: 180,
    height: 180,
  })
  console.log(`public/apple-touch-icon.png      ${formatSize(bytes)}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
