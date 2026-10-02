// Single source of truth for the iPod Classic (6th/7th gen, silver) geometry and palette.
// Both the Three.js intro and the DOM iPod derive every size from these millimetre values,
// so the 3D model's final frontal frame lines up exactly with the DOM iPod it hands off to.
//
// Coordinate convention (front view): origin at the top-left corner of the front face,
// x → right, y → down, all values in millimetres.

export const IPOD = {
  // Outer body
  width: 61.8,
  height: 103.5,
  depth: 10.5,
  cornerRadius: 8.5, // plan-view corner radius of the front plate / shell

  // Display window (black glass area that contains the LCD)
  screenWindow: { x: 4.4, y: 7.0, width: 53.0, height: 41.4, radius: 1.2 },
  // Active LCD area, centred inside the window (2.5" 320×240, 4:3)
  screen: { width: 50.8, height: 38.1, pxWidth: 320, pxHeight: 240 },

  // Click wheel (concentric ring + centre button)
  wheel: { cx: 30.9, cy: 73.6, diameter: 38.6 },
  centerButton: { diameter: 15.4 },
  // Labels on the wheel: their distance from the centre as a fraction of the wheel radius, the word
  // MENU and the transport glyphs (SVG path data in a 20 × 9 box; the DOM wheel and the 3D wheel texture)
  wheelLabels: {
    radiusFactor: 0.72,
    menu: 'MENU',
    glyphs: {
      next: 'M0 0l7.2 4.5L0 9zM7.2 0l7.2 4.5L7.2 9zM15.4 0h2.4v9h-2.4z',
      prev: 'M20 0l-7.2 4.5L20 9zM12.8 0L5.6 4.5l7.2 4.5zM4.6 0H2.2v9h2.4z',
      play: 'M1 0l7.4 4.5L1 9zM11.4 0h2.6v9h-2.6zM16.2 0h2.6v9h-2.6z',
    },
  },

  // Edge details on the top edge (front view x positions)
  holdSwitch: { x: 10.5, width: 7.0 },
  headphoneJack: { x: 51.0, diameter: 3.6 },
  dockConnector: { width: 21.0, height: 2.6 }, // centred on the bottom edge
};

// Exploded-view layers, front → back. `z` is the layer's front face measured from the
// front of the device (mm); each part's own depth is its geometry in src/intro/model.js.
export const PARTS = [
  { id: 'faceplate',   label: 'Front plate (anodised aluminium)', z: 0.0 },
  { id: 'screenGlass', label: 'Display window (acrylic)',         z: 0.1 },
  { id: 'clickWheel',  label: 'Click wheel + centre button',      z: 0.2 },
  { id: 'wheelFlex',   label: 'Click wheel flex PCB',             z: 1.6 },
  { id: 'lcd',         label: 'LCD module + metal frame',         z: 1.0 },
  { id: 'logicBoard',  label: 'Logic board',                      z: 3.4 },
  { id: 'battery',     label: 'Li-ion battery',                   z: 4.6 },
  { id: 'storage',     label: '1.8" hard drive + bumpers',        z: 4.6 },
  { id: 'midframe',    label: 'Internal frame / clips',           z: 0.8 },
  { id: 'backShell',   label: 'Back shell (polished stainless)',  z: 9.4 },
];

// Palette (silver iPod Classic). sRGB hex strings.
export const COLORS = {
  aluminium: '#c8cbcf',
  wheel: '#e4e5e7',
  wheelLabel: '#5f6368', // printed grey, 4.8:1 on the wheel (WCAG 1.4.3 for the word MENU, 1.4.11 for the glyphs)
  centerButton: '#cfd2d6',
  screenWindow: '#0b0c0e',
  lcdOff: '#14171a',
  steel: '#d9dde2',
  pcb: '#1d5a3a',
  battery: '#2a2c30',
  drive: '#b9bcc0',
  flex: '#c7862b', // copper/kapton
  // iPod Classic UI (the selection gloss starts at uiHighlightTop, ipodc.css --ipodc-gloss)
  uiHighlightTop: '#86b6ee',
  uiHighlightBottom: '#2f75cf',
  uiText: '#000000',
  uiBackground: '#ffffff',
};

// Helpers
/** width / height of the body: the window CSS (--ipod-aspect) and the dev pages size the iPod with it */
export const aspect = IPOD.width / IPOD.height;
