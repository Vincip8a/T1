// Procedural SVG artwork for variant C (no external assets). Every gradient id is prefixed
// per call (`p`) so several iPods on one page never share or collide on ids.

const esc = (s) => String(s ?? '').replace(/[<&>"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]));

// Front-plate grain: very fine, slightly vertical satin streaks (anodised, not Aqua brushed).
export const NOISE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1 0.045" numOctaves="2" seed="11" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="256" height="256" filter="url(#n)"/></svg>';

export const CHEVRON = '<svg class="ipodc-chev" viewBox="0 0 7 12" aria-hidden="true"><path d="M1.2 1.2 5.6 6l-4.4 4.8" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="square" stroke-linejoin="miter"/></svg>';

// Wheel glyphs (drawn in the wheel-label grey via currentColor)
export const GLYPH = {
  next: '<svg viewBox="0 0 20 9" aria-hidden="true"><path d="M0 0l7.2 4.5L0 9zM7.2 0l7.2 4.5L7.2 9zM15.4 0h2.4v9h-2.4z"/></svg>',
  prev: '<svg viewBox="0 0 20 9" aria-hidden="true"><path d="M20 0l-7.2 4.5L20 9zM12.8 0L5.6 4.5l7.2 4.5zM4.6 0H2.2v9h2.4z"/></svg>',
  play: '<svg viewBox="0 0 20 9" aria-hidden="true"><path d="M1 0l7.4 4.5L1 9zM11.4 0h2.6v9h-2.6zM16.2 0h2.6v9h-2.6z"/></svg>',
};

export function playIndicator(p) {
  return `<svg viewBox="0 0 10 10" aria-hidden="true"><defs><linearGradient id="${p}pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6d3ff"/><stop offset=".5" stop-color="#3f8fe6"/><stop offset="1" stop-color="#1d5fbf"/></linearGradient></defs>
  <g class="ipodc-ind-play"><path d="M1.2 .6 9.2 5l-8 4.4z" fill="url(#${p}pg)" stroke="#123f80" stroke-width=".8" stroke-linejoin="round"/></g>
  <g class="ipodc-ind-pause" fill="url(#${p}pg)" stroke="#123f80" stroke-width=".8"><rect x="1.4" y=".8" width="2.6" height="8.4" rx=".3"/><rect x="6" y=".8" width="2.6" height="8.4" rx=".3"/></g></svg>`;
}

export function battery(p) {
  return `<svg viewBox="0 0 23 11" aria-hidden="true"><defs>
  <linearGradient id="${p}bs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9ccd0"/></linearGradient>
  <linearGradient id="${p}bf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4f7a6"/><stop offset=".45" stop-color="#7fd23f"/><stop offset=".55" stop-color="#55b51d"/><stop offset="1" stop-color="#3f9a12"/></linearGradient></defs>
  <rect x=".5" y=".5" width="19.5" height="10" rx="1.6" fill="url(#${p}bs)" stroke="#55595f"/>
  <rect x="20" y="3.2" width="2.2" height="4.6" rx=".6" fill="#8b8f95" stroke="#55595f" stroke-width=".6"/>
  <rect x="2" y="2" width="16.5" height="7" rx=".7" fill="url(#${p}bf)"/>
  <rect x="2" y="2" width="16.5" height="3" rx=".7" fill="#fff" opacity=".28"/></svg>`;
}

export const TOAST_ICON = {
  check: '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="none" stroke="#fff" stroke-width="2"/><path d="M7.5 13.4l3.7 3.7 7.3-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  out: '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 8.5h7.5V16M17.2 8.8 8.5 17.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="none" stroke="#fff" stroke-width="2"/><rect x="7" y="9" width="12" height="8.5" rx="1.2" fill="none" stroke="#fff" stroke-width="1.9"/><path d="M7.6 9.8 13 14l5.4-4.2" fill="none" stroke="#fff" stroke-width="1.9" stroke-linejoin="round"/></svg>',
};

export const SPEAKER_LO = '<svg viewBox="0 0 13 11" aria-hidden="true"><path d="M1 3.5h2.5L7 .8v9.4L3.5 7.5H1z" fill="#55595f"/></svg>';
// "now playing" marker in song lists (blue speaker, like the 6G)
export const SPEAKER_NOW = '<svg class="ipodc-trk-ico" viewBox="0 0 13 11" aria-hidden="true"><path d="M0 3.5h2.5L6 .8v9.4L2.5 7.5H0z"/><path d="M8 3.2a3 3 0 0 1 0 4.6M9.8 1.6a5.4 5.4 0 0 1 0 7.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
export const SPEAKER_HI = '<svg viewBox="0 0 13 11" aria-hidden="true"><path d="M0 3.5h2.5L6 .8v9.4L2.5 7.5H0z" fill="#55595f"/><path d="M8 3.2a3 3 0 0 1 0 4.6M9.8 1.6a5.4 5.4 0 0 1 0 7.8" fill="none" stroke="#55595f" stroke-width="1.1" stroke-linecap="round"/></svg>';

// Gradients shared by every preview icon (and its reflection copy): emitted once per iPod.
export function sharedDefs(p) {
  return `<svg class="ipodc-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="${p}gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>
  <linearGradient id="${p}bl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3d2ff"/><stop offset=".48" stop-color="#3f8fe6"/><stop offset="1" stop-color="#1b56b0"/></linearGradient></defs></svg>`;
}

// Large glossy preview icons for the split-screen pane (6th-gen style), 100×100 viewBox.
// `p` prefixes this icon's own gradient ids, `s` the shared ones from sharedDefs().
export function previewIcon(kind, p, monogram, s) {
  switch (kind) {
    case 'contacts':
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
        <linearGradient id="${p}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a8f96"/><stop offset=".5" stop-color="#f4f5f6"/><stop offset="1" stop-color="#9aa0a7"/></linearGradient>
        <linearGradient id="${p}pg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9ecef"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
        <rect x="24" y="10" width="64" height="82" rx="6" fill="url(#${p}pg)" stroke="#a3a9b0" stroke-width="1.2"/>
        <rect x="20" y="8" width="64" height="84" rx="7" fill="url(#${s}bl)" stroke="#173f7d" stroke-width="1.5"/>
        <rect x="27" y="8" width="2" height="84" fill="#173f7d" opacity=".35"/>
        <circle cx="56" cy="39" r="12" fill="#fff"/>
        <path d="M34 74c0-13 10-21 22-21s22 8 22 21z" fill="#fff"/>
        <g fill="url(#${p}r)" stroke="#5f656c" stroke-width=".8">
          <rect x="13" y="20" width="16" height="6" rx="3"/><rect x="13" y="38" width="16" height="6" rx="3"/>
          <rect x="13" y="56" width="16" height="6" rx="3"/><rect x="13" y="74" width="16" height="6" rx="3"/></g>
        <path d="M30 9h48a6 6 0 0 1 6 6v24C64 46 46 46 30 41z" fill="url(#${s}gl)" opacity=".55"/></svg>`;
    case 'chat':
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
        <linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbfc"/><stop offset="1" stop-color="#c3c8ce"/></linearGradient></defs>
        <path d="M44 20h40a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10h-4l2 12-14-12H44a10 10 0 0 1-10-10V30a10 10 0 0 1 10-10z" fill="url(#${p}b)" stroke="#8d939a" stroke-width="1.4"/>
        <path d="M14 36h42a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H34L18 88l3-12h-7A10 10 0 0 1 4 66V46a10 10 0 0 1 10-10z" fill="url(#${s}bl)" stroke="#164f9e" stroke-width="1.4"/>
        <path d="M14 37h42a9 9 0 0 1 9 9v6C46 58 26 58 5 53v-7a9 9 0 0 1 9-9z" fill="url(#${s}gl)" opacity=".6"/>
        <g fill="#fff"><circle cx="21" cy="57" r="3.6"/><circle cx="35" cy="57" r="3.6"/><circle cx="49" cy="57" r="3.6"/></g></svg>`;
    case 'download':
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
        <linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dde2"/></linearGradient></defs>
        <path d="M22 6h40l18 18v68a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="url(#${p}a)" stroke="#8d939a" stroke-width="1.4"/>
        <path d="M62 6v15a3 3 0 0 0 3 3h15" fill="#e7eaee" stroke="#8d939a" stroke-width="1.4"/>
        <g stroke="#b9bfc6" stroke-width="2.4" stroke-linecap="round"><path d="M28 34h30M28 42h40M28 50h36M28 58h22"/></g>
        <circle cx="68" cy="72" r="19" fill="url(#${s}bl)" stroke="#164f9e" stroke-width="1.4"/>
        <path d="M68 61v19M60 73l8 8 8-8" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M51 68a17 17 0 0 1 34 0c-10 4-24 4-34 0z" fill="url(#${s}gl)" opacity=".55"/></svg>`;
    default: { // brand monogram medallion
      const m = esc(String(monogram ?? '').slice(0, 3));
      const fs = m.length > 2 ? 26 : 34;
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
        <radialGradient id="${p}a" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#d9dce0"/><stop offset="1" stop-color="#9ea3aa"/></radialGradient>
        <linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d6168"/><stop offset="1" stop-color="#2b2e33"/></linearGradient></defs>
        <circle cx="50" cy="50" r="42" fill="url(#${p}a)" stroke="#80868e" stroke-width="1.5"/>
        <circle cx="50" cy="50" r="35" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>
        <circle cx="50" cy="50" r="36.2" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="1"/>
        <text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, Liberation Sans, sans-serif" font-weight="700" font-size="${fs}" letter-spacing="-1.5" fill="url(#${p}b)">${m}</text>
        <path d="M14 44a36 36 0 0 1 72 0c-22 8-50 8-72 0z" fill="url(#${s}gl)" opacity=".5"/></svg>`;
    }
  }
}
