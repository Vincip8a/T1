// Procedural SVG artwork for variant C (no external assets). Gradient ids are prefixed per call
// (`p`) so several iPods on one page never share or collide on ids.
const esc = (s) => String(s ?? '').replace(/[<&>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const svg = (vb, body, cls = '') => `<svg${cls && ` class="${cls}"`} viewBox="${vb}" aria-hidden="true">${body}</svg>`;

// Front-plate grain: near-isotropic fine noise, so the face reads as uniform satin at any size.
export const NOISE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.5" numOctaves="2" seed="11" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="256" height="256" filter="url(#n)"/></svg>';

export const CHEVRON = svg('0 0 7 12', '<path d="M1.2 1.2 5.6 6l-4.4 4.8" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="square"/>', 'ipodc-chev');

// Wheel glyphs, drawn in the wheel-label grey via currentColor
export const GLYPH = {
  next: svg('0 0 20 9', '<path d="M0 0l7.2 4.5L0 9zM7.2 0l7.2 4.5L7.2 9zM15.4 0h2.4v9h-2.4z"/>'),
  prev: svg('0 0 20 9', '<path d="M20 0l-7.2 4.5L20 9zM12.8 0L5.6 4.5l7.2 4.5zM4.6 0H2.2v9h2.4z"/>'),
  play: svg('0 0 20 9', '<path d="M1 0l7.4 4.5L1 9zM11.4 0h2.6v9h-2.6zM16.2 0h2.6v9h-2.6z"/>'),
};

export const playIndicator = (p) => svg('0 0 10 10', `<defs>${lg(`${p}pg`, [[0, '#a6d3ff'], [0.5, '#3f8fe6'], [1, '#1d5fbf']])}</defs><g fill="url(#${p}pg)" stroke="#123f80" stroke-width=".8" stroke-linejoin="round"><path class="ipodc-ind-play" d="M1.2.6 9.2 5l-8 4.4z"/><path class="ipodc-ind-pause" d="M1.4.8H4v8.4H1.4zM6 .8h2.6v8.4H6z"/></g>`);

export const battery = (p) => svg('0 0 23 11', `<defs>${lg(`${p}bs`, [[0, '#fff'], [1, '#c9ccd0']])}${lg(`${p}bf`, [[0, '#d4f7a6'], [0.45, '#7fd23f'], [0.55, '#55b51d'], [1, '#3f9a12']])}</defs><rect x=".5" y=".5" width="19.5" height="10" rx="1.6" fill="url(#${p}bs)" stroke="#55595f"/><rect x="20" y="3.2" width="2.2" height="4.6" rx=".6" fill="#8b8f95" stroke="#55595f" stroke-width=".6"/><rect x="2" y="2" width="16.5" height="7" rx=".7" fill="url(#${p}bf)"/><rect x="2" y="2" width="16.5" height="3" rx=".7" fill="#fff" opacity=".28"/>`);

const ring = '<circle cx="13" cy="13" r="12" fill="none" stroke="#fff" stroke-width="2"/>';
const stroke = (d, w = 2.4) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const TOAST_ICON = {
  check: svg('0 0 26 26', ring + stroke('M7.5 13.4l3.7 3.7 7.3-8', 2.6)),
  out: svg('0 0 26 26', ring + stroke('M10 8.5h7.5V16M17.2 8.8 8.5 17.5')),
  mail: svg('0 0 26 26', ring + stroke('M7 9h12v8.5H7zM7.6 9.8 13 14l5.4-4.2', 1.9)),
  back: svg('0 0 26 26', ring + stroke('M14.5 8 9.5 13l5 5', 2.6)),
};

const SPK = '<path d="M0 3.5h2.5L6 .8v9.4L2.5 7.5H0z"/>';
const WAVES = '<path d="M8 3.2a3 3 0 0 1 0 4.6M9.8 1.6a5.4 5.4 0 0 1 0 7.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
export const SPEAKER_LO = svg('-1 0 13 11', SPK);
export const SPEAKER_HI = svg('0 0 13 11', SPK + WAVES);
export const SPEAKER_NOW = svg('0 0 13 11', SPK + WAVES, 'ipodc-trk-ico'); // "now playing" marker

// Gradients shared by every preview icon and its reflection copy: emitted once per iPod.
export const sharedDefs = (p) => `<svg class="ipodc-defs" aria-hidden="true" focusable="false"><defs>${lg(`${p}gl`, [[0, '#fff', 0.8], [1, '#fff', 0.04]])}${lg(`${p}bl`, [[0, '#a3d2ff'], [0.48, '#3f8fe6'], [1, '#1b56b0']])}</defs></svg>`;

// Large glossy preview icons for the split-screen pane (6th-gen style), 100×100 viewBox.
// `p` prefixes this icon's own gradient ids, `s` the shared ones from sharedDefs().
export function previewIcon(kind, p, monogram, s) {
  const gloss = (d, o = 0.55) => `<path d="${d}" fill="url(#${s}gl)" opacity="${o}"/>`;
  const blue = `fill="url(#${s}bl)" stroke="#164f9e" stroke-width="1.4"`;
  const paper = (c) => `fill="url(#${p}a)" stroke="${c}" stroke-width="1.4"`;
  let body;
  if (kind === 'contacts') {
    const rings = [20, 38, 56, 74].map((y) => `<rect x="13" y="${y}" width="16" height="6" rx="3"/>`).join('');
    body = `<defs>${lg(`${p}r`, [[0, '#8a8f96'], [0.5, '#f4f5f6'], [1, '#9aa0a7']], 1, 0)}${lg(`${p}a`, [[0, '#e9ecef'], [1, '#fff']], 1, 0)}</defs><rect x="24" y="10" width="64" height="82" rx="6" ${paper('#a3a9b0')}/><rect x="20" y="8" width="64" height="84" rx="7" ${blue}/><rect x="27" y="8" width="2" height="84" fill="#173f7d" opacity=".35"/><circle cx="56" cy="39" r="12" fill="#fff"/><path d="M34 74c0-13 10-21 22-21s22 8 22 21z" fill="#fff"/><g fill="url(#${p}r)" stroke="#5f656c" stroke-width=".8">${rings}</g>${gloss('M30 9h48a6 6 0 0 1 6 6v24C64 46 46 46 30 41z')}`;
  } else if (kind === 'chat') {
    body = `<defs>${lg(`${p}a`, [[0, '#fbfbfc'], [1, '#c3c8ce']])}</defs><path d="M44 20h40a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10h-4l2 12-14-12H44a10 10 0 0 1-10-10V30a10 10 0 0 1 10-10z" ${paper('#8d939a')}/><path d="M14 36h42a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H34L18 88l3-12h-7A10 10 0 0 1 4 66V46a10 10 0 0 1 10-10z" ${blue}/>${gloss('M14 37h42a9 9 0 0 1 9 9v6C46 58 26 58 5 53v-7a9 9 0 0 1 9-9z', 0.6)}<g fill="#fff"><circle cx="21" cy="57" r="3.6"/><circle cx="35" cy="57" r="3.6"/><circle cx="49" cy="57" r="3.6"/></g>`;
  } else if (kind === 'download') {
    body = `<defs>${lg(`${p}a`, [[0, '#fff'], [1, '#d9dde2']])}</defs><path d="M22 6h40l18 18v68a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" ${paper('#8d939a')}/><path d="M62 6v15a3 3 0 0 0 3 3h15" fill="#e7eaee" stroke="#8d939a" stroke-width="1.4"/><path d="M28 34h30M28 42h40M28 50h36M28 58h22" stroke="#b9bfc6" stroke-width="2.4" stroke-linecap="round"/><circle cx="68" cy="72" r="19" ${blue}/><path d="M68 61v19M60 73l8 8 8-8" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>${gloss('M51 68a17 17 0 0 1 34 0c-10 4-24 4-34 0z')}`;
  } else { // brand monogram medallion
    const m = esc(String(monogram ?? '').slice(0, 3));
    body = `<defs><radialGradient id="${p}a" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#d9dce0"/><stop offset="1" stop-color="#9ea3aa"/></radialGradient>${lg(`${p}b`, [[0, '#5d6168'], [1, '#2b2e33']])}</defs><circle cx="50" cy="50" r="42" fill="url(#${p}a)" stroke="#80868e" stroke-width="1.5"/><circle cx="50" cy="50" r="35" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/><circle cx="50" cy="50" r="36.2" fill="none" stroke="#000" stroke-opacity=".12"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial,Liberation Sans,sans-serif" font-weight="700" font-size="${m.length > 2 ? 26 : 34}" letter-spacing="-1.5" fill="url(#${p}b)">${m}</text>${gloss('M14 44a36 36 0 0 1 72 0c-22 8-50 8-72 0z', 0.5)}`;
  }
  return svg('0 0 100 100', body);
}
