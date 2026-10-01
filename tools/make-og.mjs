#!/usr/bin/env node
// Erzeugt public/og-image.png (1200x630) fuer Social-Media-Vorschauen.
// Hintergrund, Rahmen und Player-Illustration sind selbst gezeichnet.
//
// Aufruf:  node tools/make-og.mjs

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { brand, fontStack, palette, playerSvg } from './lib/brand.mjs'
import { formatSize, htmlToPng } from './lib/render.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const WIDTH = 1200
const HEIGHT = 630

const title = brand.name
const subtitle = 'Kontakt · Work Together · Playlist · Downloads'

const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
    font-family: ${fontStack};
    background:
      radial-gradient(120% 90% at 18% 6%, rgba(255,255,255,.45), rgba(255,255,255,0) 58%),
      linear-gradient(152deg, #86cdff 0%, ${palette.aqua} 46%, #0b3d72 100%);
  }
  /* feine Aqua-Pinstripes */
  .stripes {
    position: absolute; inset: 0;
    background: repeating-linear-gradient(180deg, rgba(255,255,255,.055) 0 2px, rgba(255,255,255,0) 2px 5px);
  }
  .frame {
    position: absolute; inset: 26px; border-radius: 22px;
    border: 1px solid rgba(255,255,255,.42);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
  }
  .stage { position: relative; height: 100%; display: flex; align-items: center; padding: 0 88px; }
  .copy { flex: 1; color: #fff; }
  .badge {
    display: inline-flex; align-items: center; gap: 14px;
    padding: 10px 22px 10px 12px; border-radius: 999px;
    background: linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,.14));
    border: 1px solid rgba(255,255,255,.45);
    font-size: 19px; letter-spacing: 2.4px; text-transform: uppercase; font-weight: 600;
  }
  .badge .mono {
    width: 42px; height: 42px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(180deg, #ffffff, #d7dee5);
    color: ${palette.aquaInk}; font-size: 20px; font-weight: 700; letter-spacing: 0;
    box-shadow: inset 0 -2px 4px rgba(0,0,0,.12);
  }
  h1 {
    margin: 34px 0 0; font-size: 104px; line-height: 1; font-weight: 700; letter-spacing: -2px;
    text-shadow: 0 3px 16px rgba(4,32,60,.38);
  }
  p.sub {
    margin: 28px 0 0; font-size: 31px; font-weight: 500; letter-spacing: .2px;
    color: rgba(255,255,255,.93); text-shadow: 0 2px 10px rgba(4,32,60,.3);
  }
  .rule { margin-top: 34px; width: 232px; height: 4px; border-radius: 2px;
          background: linear-gradient(90deg, rgba(255,255,255,.95), rgba(255,255,255,.1)); }
  .device { width: 330px; display: flex; justify-content: flex-end; }
  .device svg { transform: rotate(-7deg); filter: drop-shadow(0 26px 40px rgba(4,28,54,.42)); }
</style></head>
<body>
  <div class="stripes"></div>
  <div class="frame"></div>
  <div class="stage">
    <div class="copy">
      <span class="badge"><span class="mono">${brand.monogram}</span>Linktree</span>
      <h1>${title}</h1>
      <p class="sub">${subtitle}</p>
      <div class="rule"></div>
    </div>
    <div class="device">${playerSvg({ ns: 'og', width: 300, height: 485 })}</div>
  </div>
</body></html>`

const target = join(root, 'public/og-image.png')
await mkdir(dirname(target), { recursive: true })
const bytes = await htmlToPng(html, target, { width: WIDTH, height: HEIGHT })
console.log(`public/og-image.png  ${WIDTH}x${HEIGHT}  ${formatSize(bytes)}`)
