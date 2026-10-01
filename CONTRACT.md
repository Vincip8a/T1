# iPod Linktree – Build Contract

Shared rules for every module so parallel work fits together without edits to each other's files.

## Concept

1. The page loads as a retro **Mac OS X Aqua desktop**. A brushed-metal window titled
   `config.brand.windowTitle` is centred on it. The window's content area holds the iPod.
2. **Intro (Three.js, full-viewport overlay canvas):** a silver iPod Classic appears assembled,
   then gets **completely disassembled into an exploded view** with every part from `PARTS`
   (front plate, display window, click wheel, flex, LCD, logic board, battery, hard drive,
   mid-frame, back shell, plus small screws and clips) flying apart along its depth axis in 3D.
   It holds briefly while the camera orbits, then **reassembles** with satisfying, physical
   easing and lands frontal, **pixel-aligned with the DOM iPod's rect inside the window**. Parts
   may fly beyond the window's edges because the canvas covers the whole viewport.
3. **Handoff:** the canvas cross-fades (≤ 250 ms) into the DOM iPod. The DOM screen "boots"
   (the brand monogram, **never the Apple logo**, ~0.8 s) and then shows the main menu.
4. **Linktree UI:** an authentic iPod Classic interface (6th/7th gen). It has a title bar with a
   battery icon, a list with the blue gradient highlight and a right-hand chevron, and the
   split-screen preview pane on the right for top-level items. Menu items come from
   `config.menu`. Item types:
   - `list`: a submenu of links. Selecting an item opens its `href` (new tab for http).
   - `page`: a text page plus `actions` as selectable rows.
   - `nowplaying`: an iPod "Now Playing" screen with cover, title, artist, a progress bar and
     the track list. Centre opens `spotifyUrl`. An optional Spotify embed is allowed if it stays tasteful.
   - `downloads`: a file list with format and size. Selecting one downloads `file` (`<a download>`).

## Shared modules (owned by the lead, read-only for others)

- `src/shared/ipodSpec.js`: `IPOD` (mm geometry), `PARTS` (exploded layers), `COLORS`, `mmToPx`.
  **All sizes derive from this**, in both 3D and DOM.
- `src/shared/config.js`: `loadConfig()`, `prefersReducedMotion()`.
- `public/config.json`: all content. Never hard-code content in modules.
- `src/main.js`: the orchestrator. During the build phase it picks variants via
  `?intro=a|b&ipod=a|b`.
- `scripts/shot.mjs`, `scripts/intro-frames.mjs`: headless screenshots with software WebGL.

## Module APIs

### Intro: `src/intro/variants/<v>/index.js` (final: `src/intro/index.js`)

```js
export function runIntro({ getTargetRect, reducedMotion = false }) → controller
// getTargetRect(): DOMRect in viewport px of the DOM iPod's outer body; it can change on resize.
controller = {
  duration,        // seconds, total timeline length (target 5.5–7.5 s; reducedMotion ≤ 1.2 s fade)
  done,            // Promise resolving once the final frontal frame matches getTargetRect()
  skip(),          // jump to the final aligned frame and resolve `done`
  seek(t), pause(), play(),   // test hooks (seconds)
  dispose(),       // remove the canvas, free GPU resources and listeners
}
```
- It creates its own `<canvas>` with `position:fixed; inset:0; pointer-events:none; z-index:50`
  and a transparent background, so the desktop and window stay visible behind the parts.
- Final frame: the front face fills `getTargetRect()` exactly (±2 px), seen straight on, with the
  LCD dark. Use the same mm proportions as the DOM iPod.
- No external model files: build the geometry procedurally (extrusions, rounded boxes, canvas
  textures for the PCB, drive label and wheel labels). Keep the JS for the intro under 60 KB, not counting three/gsap.
- `three` and `gsap` are installed. Don't add other dependencies.

### iPod UI: `src/ipod/variants/<v>/index.js` (final: `src/ipod/index.js`)

```js
export function mountIpod(container, { config }) → api
api = {
  el,                 // root element (the body of the iPod)
  getShellRect(),     // DOMRect of the outer body. Must be valid before reveal(), even while invisible
  reveal({ boot = true }) → Promise,  // fade in, run the boot screen, show the main menu
  press(button),      // 'menu' | 'center' | 'play' | 'next' | 'prev'   (test + keyboard)
  scroll(steps),      // +down / -up, like turning the wheel
  getState(),         // { screen: string, path: string[], index: number }
  destroy(),
}
```
- Size: the body is `height: var(--ipod-h, 560px)` with width = height × 61.8/103.5. Every inner
  measurement is `calc(var(--ipod-h) / 103.5 * <mm>)` using `IPOD` values (CSS custom
  properties set from JS are fine).
- Before `reveal()` the body renders with `visibility:hidden` (still laid out, so the rect is measurable).
- Input: dragging around the click wheel scrolls (~ one step per 18–24° of arc). Also mouse wheel,
  touch, keyboard (↑/↓ or ←/→ scroll, Enter = centre, Esc/Backspace = MENU, Space = play), and
  clicks on MENU, ⏮ ⏭ ⏯ and the centre button. Add WebAudio click ticks, respecting
  `config.settings.clickSound`, and honour reduced motion.
- A11y: the screen list is a `role="listbox"` with `aria-activedescendant`. Real `<a>` links are used for
  hrefs. Focus is visible.
- Expose `window.__ipod = api` on the dev page only (the orchestrator does that itself).

### Desktop + window: `src/window/index.js`

```js
export function createDesktop(host, { config }) → { el, contentEl, setInteractive(bool), destroy() }
```
- It renders the Aqua desktop (CSS-only wallpaper, no copyrighted images), a slim menu bar (brand
  name and clock) and a brushed-metal window with traffic lights. The window is draggable by its
  title bar (desktop only) and clamped to the viewport. Red/yellow minimise it to a desktop icon,
  and double-click/Enter restores it. Green toggles zoom.
- `contentEl` sets `--ipod-h` so the iPod fits: desktop `min(74vh, 600px)`. Under 640 px wide the
  window turns into a near-full-screen sheet and `--ipod-h` fits the screen height and width.
- `setInteractive(false)` during the intro (no drag, no traffic lights).

## Dev pages

- `dev/intro.html?variant=a&t=2.5` shows the intro against a dummy target box (`t` seeks and pauses).
- `dev/ipod.html?variant=a` shows the iPod alone, revealed, with `window.__ipod` exposed.
- `index.html?intro=a&ipod=a` shows the full experience.

Run your own dev server on your assigned port: `npx vite --port <PORT> --strictPort`
(in the background). Take screenshots with `node scripts/shot.mjs` / `node scripts/intro-frames.mjs`
into `.shots/<your-area>/` (gitignored).

## Ownership

Only edit files inside your own area. If a shared file needs changing, report it in your result
and don't edit it.
