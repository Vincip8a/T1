// Layout-Bausteine fuer die Platzhalter-PDFs: A4, Aqua-Fensteroptik,
// Silber-Verlaeufe, Monogramm. Jede Seite ist ein .page-Element; Chromium
// macht daraus beim Druck genau eine PDF-Seite.

import { brand, fontStack, palette, playerSvg } from './brand.mjs'

const PLACEHOLDER_NOTE = 'Platzhalter-Dokument. Inhalte und Zahlen sind frei erfunden.'

export const css = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${fontStack};
    color: ${palette.ink};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    width: 210mm; height: 297mm;
    overflow: hidden;
    page-break-after: always;
    background: ${palette.paper};
  }
  .page:last-child { page-break-after: auto; }

  /* ---------- Titelseite ---------- */
  .cover {
    background:
      radial-gradient(110% 80% at 14% 4%, rgba(255,255,255,.42), rgba(255,255,255,0) 60%),
      linear-gradient(158deg, #8ed0ff 0%, ${palette.aqua} 44%, #0a3b6f 100%);
    color: #fff;
  }
  .cover .stripes {
    position: absolute; inset: 0;
    background: repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 1.4px, rgba(255,255,255,0) 1.4px 4px);
  }
  .cover .inner { position: relative; height: 100%; padding: 24mm 22mm 20mm; display: flex; flex-direction: column; }
  .cover .brandline { display: flex; align-items: center; gap: 5mm; }
  .cover .mono {
    width: 16mm; height: 16mm; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(180deg, #ffffff, #d4dbe2);
    color: ${palette.aquaInk}; font-size: 19pt; font-weight: 700;
    box-shadow: inset 0 -1mm 2mm rgba(0,0,0,.12), 0 1mm 3mm rgba(4,32,60,.25);
  }
  .cover .brandline .who { font-size: 13pt; font-weight: 600; letter-spacing: .4pt; }
  .cover .brandline .what { font-size: 9.5pt; opacity: .85; letter-spacing: 1.6pt; text-transform: uppercase; }
  .cover .headline { margin-top: auto; max-width: 118mm; }
  .cover h1 { margin: 0; font-size: 42pt; line-height: 1.04; font-weight: 700; letter-spacing: -1pt;
               text-shadow: 0 1mm 4mm rgba(4,32,60,.35); }
  .cover .sub { margin: 7mm 0 0; font-size: 14pt; font-weight: 500; line-height: 1.5; color: rgba(255,255,255,.93); }
  .cover .rule { margin-top: 9mm; width: 46mm; height: 1.2mm; border-radius: .6mm;
                 background: linear-gradient(90deg, rgba(255,255,255,.95), rgba(255,255,255,.08)); }
  .cover .foot { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm; }
  .cover .meta { font-size: 10pt; line-height: 1.7; color: rgba(255,255,255,.88); }
  .cover .device { position: absolute; right: 17mm; top: 36mm; }
  .cover .device svg { transform: rotate(-8deg); }

  .stamp {
    display: inline-flex; align-items: center; gap: 3mm;
    padding: 2.6mm 6mm; border-radius: 999px;
    border: .5mm solid rgba(255,255,255,.7);
    background: rgba(255,255,255,.16);
    font-size: 10pt; font-weight: 700; letter-spacing: 2.4pt; text-transform: uppercase;
  }
  .stamp .dot { width: 2.6mm; height: 2.6mm; border-radius: 50%; background: #ffd34d; }

  /* ---------- Inhaltsseiten: Aqua-Fenster ---------- */
  .window {
    position: absolute; top: 13mm; left: 13mm; right: 13mm; bottom: 17mm;
    border-radius: 5mm; overflow: hidden; background: #fff;
    border: .3mm solid #a9b2bb;
    /* bewusst ohne Weichzeichner: weiche Schatten rastert Chromium je Seite
       als Vollbild ins PDF und blaeht die Datei um ein Vielfaches auf */
    box-shadow: 0 .5mm 0 rgba(20,40,60,.10), 0 1.2mm 0 rgba(20,40,60,.05);
    display: flex; flex-direction: column;
  }
  .titlebar {
    height: 13mm; flex: none;
    background: linear-gradient(180deg, #fbfcfd 0%, #e6eaee 48%, #d2d8de 52%, #e9edf1 100%);
    border-bottom: .3mm solid #b4bcc4;
    display: flex; align-items: center; gap: 4mm; padding: 0 5mm;
  }
  .lights { display: flex; gap: 2mm; }
  .lights i { width: 3.4mm; height: 3.4mm; border-radius: 50%; display: block;
              box-shadow: inset 0 .4mm .5mm rgba(255,255,255,.75); }
  .lights i:nth-child(1) { background: #ff6159; }
  .lights i:nth-child(2) { background: #ffbe2f; }
  .lights i:nth-child(3) { background: #2bca44; }
  .titlebar .wtitle { font-size: 9.5pt; font-weight: 600; color: #4c5966; letter-spacing: .3pt; }
  .titlebar .wpage { margin-left: auto; font-size: 8.5pt; color: #8a95a1; letter-spacing: .4pt; }
  .content { position: relative; flex: 1; padding: 13mm 14mm; }

  .watermark {
    position: absolute; left: 50%; top: 52%;
    transform: translate(-50%, -50%) rotate(-24deg);
    font-size: 46pt; font-weight: 800; letter-spacing: 6pt;
    color: ${palette.aqua}; opacity: .085; white-space: nowrap; pointer-events: none;
  }
  .content > *:not(.watermark) { position: relative; }

  .eyebrow { font-size: 8.5pt; font-weight: 700; letter-spacing: 2.6pt; text-transform: uppercase;
             color: ${palette.aqua}; margin: 0 0 4mm; }
  h2 { margin: 0; font-size: 25pt; line-height: 1.15; font-weight: 700; color: ${palette.aquaInk}; letter-spacing: -.3pt; }
  h3 { margin: 0 0 2mm; font-size: 11.5pt; font-weight: 700; color: ${palette.aquaInk}; }
  .lead { margin: 7mm 0 0; font-size: 12pt; line-height: 1.62; color: ${palette.inkSoft}; max-width: 150mm; }
  p { margin: 0 0 3mm; font-size: 10.5pt; line-height: 1.6; color: ${palette.inkSoft}; }
  .divider { margin: 9mm 0; height: .3mm; background: linear-gradient(90deg, #c7d0d9, rgba(199,208,217,0)); }

  .cards { display: flex; flex-direction: column; gap: 5mm; }
  .card {
    border: .3mm solid #d3dae1; border-radius: 3mm; padding: 6mm 7mm;
    background: linear-gradient(180deg, #ffffff, #f5f8fa);
  }
  .card { margin: 0; }
  .card .top { display: flex; align-items: baseline; justify-content: space-between; gap: 6mm; margin-bottom: 2.5mm; }
  .card .tag { font-size: 8pt; font-weight: 700; letter-spacing: 1.4pt; text-transform: uppercase; color: ${palette.aqua}; }

  .stats { display: flex; gap: 4mm; }
  .stat {
    flex: 1; border-radius: 3mm; padding: 5mm 5mm 4.5mm;
    background: linear-gradient(180deg, #eef5fc, #dfe9f3);
    border: .3mm solid #c5d4e3;
  }
  .stat .v { font-size: 22pt; font-weight: 700; color: ${palette.aquaDeep}; line-height: 1; letter-spacing: -.5pt; }
  .stat .l { margin-top: 2.5mm; font-size: 9pt; line-height: 1.4; color: #5c6c7c; }

  .steps { display: flex; flex-direction: column; gap: 4.5mm; }
  .step { display: flex; gap: 5mm; align-items: flex-start; }
  .step .n {
    flex: none; width: 9mm; height: 9mm; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(180deg, ${palette.aquaLight}, ${palette.aquaDeep});
    color: #fff; font-size: 10pt; font-weight: 700;
    box-shadow: inset 0 .5mm .8mm rgba(255,255,255,.5);
  }
  .step .txt { padding-top: .8mm; }

  .kv { display: flex; flex-wrap: wrap; gap: 5mm 0; }
  .kv > div { width: 50%; }
  .kv dt { font-size: 8pt; font-weight: 700; letter-spacing: 1.4pt; text-transform: uppercase; color: #8694a2; }
  .kv dd { margin: 1.2mm 0 0; font-size: 11pt; color: ${palette.ink}; }

  ul.bullets { margin: 0; padding: 0; list-style: none; }
  ul.bullets li { position: relative; padding-left: 6mm; margin-bottom: 3.2mm; font-size: 10.5pt; line-height: 1.58; color: ${palette.inkSoft}; }
  ul.bullets li::before {
    content: ''; position: absolute; left: 0; top: 1.6mm;
    width: 2.4mm; height: 2.4mm; border-radius: 50%;
    background: linear-gradient(180deg, ${palette.aquaLight}, ${palette.aqua});
  }

  .note {
    margin-top: 8mm; padding: 4.5mm 5mm; border-radius: 2.5mm;
    background: #fff8e2; border: .3mm solid #e8d79a;
    font-size: 9pt; line-height: 1.5; color: #6b5a1f;
  }

  .pagefoot {
    position: absolute; left: 13mm; right: 13mm; bottom: 8mm;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 8pt; color: #93a0ac; letter-spacing: .3pt;
  }
  .pagefoot .mono {
    width: 6mm; height: 6mm; border-radius: 50%; margin-right: 2.5mm;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(180deg, #ffffff, #d7dee5); border: .25mm solid #bcc5ce;
    color: ${palette.aquaInk}; font-size: 6.5pt; font-weight: 700;
  }
  .pagefoot .left { display: flex; align-items: center; }
`

/** Titelseite eines Dokuments. */
export function cover({ kicker, title, subtitle, meta }) {
  const metaHtml = meta.map((line) => `<div>${line}</div>`).join('')
  return `
  <section class="page cover">
    <div class="stripes"></div>
    <div class="device">${playerSvg({ ns: 'cv', width: 62, height: 100 })}</div>
    <div class="inner">
      <div class="brandline">
        <div class="mono">${brand.monogram}</div>
        <div>
          <div class="who">${brand.name}</div>
          <div class="what">${kicker}</div>
        </div>
      </div>
      <div class="headline">
        <h1>${title}</h1>
        <p class="sub">${subtitle}</p>
        <div class="rule"></div>
      </div>
      <div class="foot">
        <div class="meta">${metaHtml}</div>
        <div class="stamp"><span class="dot"></span>Platzhalter</div>
      </div>
    </div>
  </section>`
}

/** Inhaltsseite im Aqua-Fenster. */
export function page({ windowTitle, eyebrow, title, body }) {
  return `
  <section class="page">
    <div class="window">
      <div class="titlebar">
        <div class="lights"><i></i><i></i><i></i></div>
        <div class="wtitle">${windowTitle}</div>
        <div class="wpage" data-page-indicator>Seite</div>
      </div>
      <div class="content">
        <div class="watermark">PLATZHALTER</div>
        <p class="eyebrow">${eyebrow}</p>
        <h2>${title}</h2>
        ${body}
      </div>
    </div>
    <div class="pagefoot">
      <span class="left"><span class="mono">${brand.monogram}</span>${brand.name} · ${PLACEHOLDER_NOTE}</span>
      <span data-page-number>·</span>
    </div>
  </section>`
}

/* ---------- Inhaltsbausteine ---------- */

export const lead = (text) => `<p class="lead">${text}</p>`

export const divider = () => '<div class="divider"></div>'

export const cards = (items) =>
  `<div class="cards">${items
    .map(
      (item) => `
    <div class="card">
      <div class="top"><h3>${item.title}</h3><span class="tag">${item.tag}</span></div>
      <p>${item.text}</p>
    </div>`,
    )
    .join('')}</div>`

export const stats = (items) =>
  `<div class="stats">${items
    .map((item) => `<div class="stat"><div class="v">${item.value}</div><div class="l">${item.label}</div></div>`)
    .join('')}</div>`

export const steps = (items) =>
  `<div class="steps">${items
    .map(
      (item, index) => `
    <div class="step">
      <div class="n">${index + 1}</div>
      <div class="txt"><h3>${item.title}</h3><p>${item.text}</p></div>
    </div>`,
    )
    .join('')}</div>`

export const kv = (items) =>
  `<div class="kv">${items.map((item) => `<div><dt>${item.term}</dt><dd>${item.value}</dd></div>`).join('')}</div>`

export const bullets = (items) =>
  `<ul class="bullets">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`

export const note = (text) => `<div class="note">${text}</div>`

/**
 * Baut das fertige HTML-Dokument und traegt die Seitenzahlen ein
 * (Titelseite zaehlt mit, bekommt aber keine Nummer).
 */
export function buildDocument({ title, sections }) {
  const total = sections.length
  let counter = 0
  const body = sections
    .map((section) => {
      counter += 1
      const number = counter
      return section
        .replace('<div class="wpage" data-page-indicator>Seite</div>', `<div class="wpage">Seite ${number} von ${total}</div>`)
        .replace('<span data-page-number>·</span>', `<span>${number} / ${total}</span>`)
    })
    .join('\n')

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
${body}
</body>
</html>`
}
