# Architecture

A linktree that looks like a silver iPod Classic (6th/7th gen) inside a Mac OS X Aqua window.
Vite + plain JS, `three` and `gsap` are the only runtime dependencies. All content lives in
`public/config.json`; no content is hard-coded in modules.

## Flow

1. `src/main.js` starts the intro chunk download right away (only if WebGL 2 is available) and
   loads `config.json` in parallel.
2. It mounts the Aqua desktop + brushed-metal window (`src/window/`) and, inside it, the DOM iPod
   (`src/ipod/`). The iPod is laid out but `visibility:hidden`, so its rect can be measured.
3. The intro (`src/intro/`, three.js, lazily imported) plays on a full-viewport canvas: the iPod
   is taken apart into an exploded view and reassembled. Its last frame lands frontal and
   pixel-aligned on the DOM iPod's rect (`ipod.getShellRect()`).
4. Handoff: the canvas fades out (220 ms), `ipod.reveal()` shows the boot screen (brand monogram)
   and then the main menu. The window becomes interactive and the iPod gets keyboard focus.

"Intro überspringen" (button, bottom right; centred on phones) and Esc skip to the aligned
final frame; pressed while the intro chunk is still downloading, they reveal the iPod at once.
Degradation: no WebGL 2, a failed chunk load, a chunk that takes longer than 6 s
(`INTRO_CHUNK_MS`; a chunk that lands later is ignored), an exception in `runIntro`, or
`settings.intro: false` all skip the intro and reveal the iPod directly. A watchdog reveals the
iPod even if the render loop dies. If `config.json` cannot be loaded, the window shows a short
German error with a reload button.

## Modules

### `src/shared/ipodSpec.js`: single source of truth

`IPOD` (geometry in mm: body, display window, LCD, click wheel, edge details), `PARTS` (exploded
layers, front to back), `COLORS` (silver palette and iPod UI colours), `mmToPx(heightPx)`.
Both the 3D model and the DOM iPod derive every size from these values, which is why the
intro's last frame matches the DOM iPod exactly. Change a dimension here, never in a module.

### `src/shared/config.js`

`loadConfig(url?)` fetches `config.json` relative to the page (works under any base path),
`prefersReducedMotion()`.

### `src/shared/href.js`

`safeHref(href, base?)`: the one link rule for the iPod rows, the menu bar and (imported by
`vite.config.js`) the `<noscript>` list. Only http(s), mailto, tel and relative paths; tabs and
newlines are stripped first, as the URL parser does. Relative paths, a leading `/` included,
resolve against the site base, so `/downloads/x.pdf` works under a GitHub Pages sub-path.

### `src/window/index.js`: desktop + window

```js
createDesktop(host, { config, onLinks, onFocus }) → { el, contentEl, setInteractive(bool), destroy() }
```
Aqua wallpaper (CSS only), menu bar (monogram, `brand.name`, Links, Kontakt; on the right the
`config.legal` links and a clock), brushed-metal window titled `brand.windowTitle` with
`brand.tagline` in the status bar. Draggable by the title bar and clamped to the viewport;
red/yellow minimise to a desktop icon, green zooms. `contentEl` sets `--ipod-h`:
`min(74svh, 600px)` on desktop; under 640 px the window spans the width and hugs the iPod, and
`--ipod-h` is the largest size that fits the screen width and height; on screens up to 640 px
high the padding shrinks and the status bar is hidden. With a fine pointer (`--ipod-floor`) the
iPod never gets smaller than 500 CSS px, so browser zoom enlarges its text (WCAG 1.4.4); a
window larger than the screen stays centred, the stage scrolls and dragging is off.
The iPod is the window's key view: restoring from the desktop icon focuses it, and a press on
the metal, title bar or a traffic light leaves keyboard focus on it, all through `onFocus`
(main.js: `ipod.focus()`, so a screen of links gets its selected row). "Links" calls `onLinks`
(main.js: `ipod.home()`). `setInteractive(false)` locks drag and traffic lights during the intro.

### `src/ipod/index.js`: iPod UI

```js
mountIpod(container, { config }) → {
  el,                       // the iPod body (role=listbox, the focus target)
  getShellRect(),           // DOMRect of the body, valid before reveal()
  reveal({ boot = true }),  // → Promise: show, boot screen, main menu
  press(button),            // 'menu' | 'center' | 'play' | 'next' | 'prev'
  scroll(steps),            // +down / -up, like turning the wheel
  home(),                   // back to the main menu, MENU flashes, focus with its ring
  focus(),                  // focus the key target (the selected row on a screen of links, else the body)
  getState(),               // { screen, path, index }
  destroy(),
}
```
Height is `var(--ipod-h)`, every inner size is `calc(var(--ipod-h) / 103.5 * <mm>)` from `IPOD`.
The LCD UI is a logical 320×240 px space. Files: `wheel.js` (click-wheel input), `screens.js`
(main menu with preview pane, list, page, Now Playing, downloads), `player.js` (simulated
playback), `sound.js` (WebAudio clicks, `settings.clickSound`), `art.js` (procedural SVG),
`util.js` (DOM helpers, re-exports `safeHref`), `ipodc.css`.

Input: wheel drag, mouse wheel, touch, keys on the focused iPod (↑/↓/←/→ scroll, Enter centre,
Esc/Backspace MENU, Space play, Shift+←/→ prev/next, Home/End, PageUp/PageDown).
A screen that was just opened ignores the centre button / Enter for 450 ms (`SETTLE_MS`, measured
from when the press began), so a double press opens an item but never also fires its first link.
A11y: the main menu (and any screen without links) is a listbox with `aria-activedescendant`.
On a screen of links the rows are real `<a>` elements with a roving tabindex: DOM focus moves
with the selection, so screen readers announce links with their URL; the container is a
`group` named after the screen. Keys are handled on the iPod element either way, and the focus
ring is drawn around the iPod. A polite live region and an invisible "Zurück" button (outside
the tab order) for touch screen readers complete it, because the wheel is `aria-hidden`. The UI strings (German 6G firmware wording) are `DEFAULT_UI` in
`src/ipod/index.js`; they are not read from `config.json`.

### `src/intro/index.js`: 3D intro

```js
runIntro({ getTargetRect, reducedMotion = false, config = null }) → {
  duration, done,            // seconds; Promise resolved on the aligned final frame
  skip(), dispose(),         // jump to the end; free canvas, GPU resources, listeners
  seek(t), pause(), play(),  // test hooks (seconds)
}
```
Procedural geometry only (`model.js`, canvas textures in `tex.js`), no model files. It owns a
`position:fixed; inset:0; z-index:50; pointer-events:none` canvas. Without a WebGL 2 context it
returns a no-op controller whose `done` is already resolved. `config.brand` is engraved on the
back shell.

## Content: `public/config.json`

Loaded at runtime; edit and reload, no rebuild needed in dev. The build also reads it (see
`vite.config.js`) for `<title>`, the meta description, `og:title`/`og:description` (from
`brand.name` and `brand.tagline`), absolute `og:image`/`og:url` (from `siteUrl`) and the
`<noscript>` linktree, so rebuild after changes for crawlers and visitors without JavaScript.
The generated assets (`tools/`, OG image, cover, PDFs) keep their own copy of the brand in
`tools/lib/brand.mjs`; they do not read `config.json`.

- `siteUrl`: optional public URL of the site; without it `og:image` stays relative.

- `brand`: `name`, `monogram`, `tagline`, `windowTitle`, `email`.
- `menu[]`: one main-menu row per entry, in order. Common fields `id`, `label`, `type`, `title`.
  - `list`: `items[]` of `{ label, detail, href }`.
  - `page`: `body` text and `actions[]` of `{ label, href }`.
  - `nowplaying`: `artist`, `cover`, `spotifyUrl`, `tracks[]` of `{ title, artist, duration }`.
  - `downloads`: `items[]` of `{ label, file, format, size }`; rows are `<a download>`.
- `legal`: `{ impressum, datenschutz }`, relative paths of the static legal pages, linked from
  the menu bar and the `<noscript>` list.
- Paths (`cover`, `file`, `legal`) are page-relative; a leading `/` is treated the same.
- `settings`: `clickSound` (bool), `intro` (`false`, `"off"` or `"never"` skip the intro;
  anything else plays it on every load).

**Add a menu item:** append an object to `menu[]` with a unique `id` and one of the four
`type`s. The main menu, its preview pane, the sub screen and the `<noscript>` list follow
automatically. A new screen type needs a builder in `src/ipod/screens.js` (`buildScreen`) and
a preview in `buildPreview`.

Text rule: no em or en dashes as separators in visible text; use `·`, a comma or a period.

## Static pages

`public/impressum.html`, `public/datenschutz.html` (marked placeholders, replace with your own
legal texts) and `public/404.html` (GitHub Pages serves it for unknown paths; a small script
finds the site root via `config.json`, so its links work at any depth and under a sub-path).
They are standalone pages with inline CSS in the same Aqua look.

## Build

`vite.config.js`: `base: './'` (works on GitHub Pages sub-paths and any static host), the
inline `config-html` plugin (meta tags and `<noscript>` from `config.json`, every value
HTML-escaped, hrefs through `src/shared/href.js`), and `server.watch.ignored` for
`.shots/` and `qa/`. The entry chunk holds main, window, iPod and gsap; three.js and the intro
are a separate chunk loaded with `import()`.

Test hooks: `window.__ipod` and `window.__intro` exist only in dev or with `?debug`.

## Dev pages and scripts

- `dev/intro.html`: the intro against a red dashed target box (`?t=2.5` seeks and pauses,
  `?reduced`).
- `dev/ipod.html`: the iPod alone, revealed, `window.__ipod` exposed (`?noboot`).
- `dev/window.html`: desktop and window with a grey placeholder.
- `dev/webgl-smoke.html`: checks that WebGL renders.
- `node scripts/shot.mjs <url> <out.png> [--w --h --wait --eval --mobile --dpr]`: screenshot
  with headless Chromium and software WebGL (slow but correct).
- `node scripts/intro-frames.mjs <url> <dir> [--times 0,1,2]`: intro frames via
  `window.__intro.seek()` (use the dev server or `?debug`).

Screenshots go to `.shots/<label>/` (gitignored, not watched by Vite).
