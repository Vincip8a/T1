// Procedural SVG artwork (no external assets). Gradient ids are prefixed per call
// (`p`) so several iPods on one page never share or collide on ids.
const esc = (s) => String(s ?? '').replace(/[<&>"]/g, (c) => `&#${c.charCodeAt(0)};`);
// lg(id, '0 #fff,1 #000 .5') → linear gradient (top → bottom unless x2/y2 given); stop = "offset colour [opacity]"
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x2="${x2}" y2="${y2}">${stops.split(',').map((st) => { const [o, c, a = 1] = st.split(' '); return `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`; }).join('')}</linearGradient>`;
const svg = (vb, body, cls = '') => `<svg${cls && ` class="${cls}"`} viewBox="${vb}" aria-hidden="true">${body}</svg>`;

export const CHEVRON = svg('0 0 7 12', '<path d="M1.2 1.2 5.6 6l-4.4 4.8" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="square"/>', 'ipodc-chev');

// Wheel glyphs, drawn in the wheel-label grey via currentColor
export const GLYPH = {
  next: svg('0 0 20 9', '<path d="M0 0l7.2 4.5L0 9zM7.2 0l7.2 4.5L7.2 9zM15.4 0h2.4v9h-2.4z"/>'),
  prev: svg('0 0 20 9', '<path d="M20 0l-7.2 4.5L20 9zM12.8 0L5.6 4.5l7.2 4.5zM4.6 0H2.2v9h2.4z"/>'),
  play: svg('0 0 20 9', '<path d="M1 0l7.4 4.5L1 9zM11.4 0h2.6v9h-2.6zM16.2 0h2.6v9h-2.6z"/>'),
};

export const playIndicator = (p) => svg('0 0 10 10', `<g fill="url(#${p}sbl)" stroke="#123f80" stroke-width=".8" stroke-linejoin="round"><path class="ipodc-ind-play" d="M1.2.6 9.2 5l-8 4.4z"/><path class="ipodc-ind-pause" d="M1.4.8H4v8.4H1.4zM6 .8h2.6v8.4H6z"/></g>`);

export const battery = (p) => svg('0 0 23 11', `<defs>${lg(`${p}bf`, '0 #d4f7a6,0.45 #7fd23f,0.55 #55b51d,1 #3f9a12')}</defs><rect x=".5" y=".5" width="19.5" height="10" rx="1.6" fill="#f1f2f3" stroke="#55595f"/><path d="M20.5 3.5h1.2v4h-1.2" fill="#8b8f95" stroke="#55595f" stroke-width=".6"/><rect x="2" y="2" width="16.5" height="7" rx=".7" fill="url(#${p}bf)"/>`);


const SPK = '<path d="M0 3.5h2.5L6 .8v9.4L2.5 7.5H0z"/>';
const WAVES = '<path d="M8 3.2a3 3 0 0 1 0 4.6M9.8 1.6a5.4 5.4 0 0 1 0 7.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
export const SPEAKER_LO = svg('-1 0 13 11', SPK);
export const SPEAKER_HI = svg('0 0 13 11', SPK + WAVES);
export const SPEAKER_NOW = svg('0 0 13 11', SPK + WAVES, 'ipodc-trk-ico'); // "now playing" marker

// Gradients shared by the indicator and every preview icon (and its reflection copy): emitted once per iPod.
export const sharedDefs = (p) => `<svg class="ipodc-defs" aria-hidden="true" focusable="false"><defs>${lg(`${p}gl`, '0 #fff 0.8,1 #fff 0.04')}${lg(`${p}bl`, '0 #a3d2ff,0.48 #3f8fe6,1 #1b56b0')}<radialGradient id="${p}md" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#d9dce0"/><stop offset="1" stop-color="#9ea3aa"/></radialGradient></defs></svg>`;

// Large preview icons for the split-screen pane: a glossy silver medallion carrying the brand
// monogram or a blue glyph for the item type (100×100 viewBox, gradients from sharedDefs(s)).
const ICON = {
  contacts: '<circle cx="50" cy="39" r="11"/><path d="M29 70c0-12 9-20 21-20s21 8 21 20z"/>',
  chat: '<path d="M31 29h38a9 9 0 0 1 9 9v17a9 9 0 0 1-9 9H50L37 74l2-10h-8a9 9 0 0 1-9-9V38a9 9 0 0 1 9-9z"/>',
  download: '<path d="M44 25h12v22h11L50 66 33 47h11zM31 70h38v7H31z"/>',
};
export function previewIcon(kind, monogram, s) {
  const m = esc(String(monogram ?? '').slice(0, 3));
  const inner = ICON[kind] ? `<g fill="url(#${s}bl)" stroke="#164f9e" stroke-width="1.2">${ICON[kind]}</g>`
    : `<text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="700" font-size="${m.length > 2 ? 26 : 34}" letter-spacing="-1.5" fill="#43474e">${m}</text>`;
  return svg('0 0 100 100', `<circle cx="50" cy="50" r="42" fill="url(#${s}md)" stroke="#80868e" stroke-width="1.5"/><circle cx="50" cy="50" r="35" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>${inner}<path d="M14 44a36 36 0 0 1 72 0c-22 8-50 8-72 0z" fill="url(#${s}gl)" opacity=".5"/>`);
}
