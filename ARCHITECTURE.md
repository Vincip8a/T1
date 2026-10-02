# Architecture

A linktree that looks like a silver iPod Classic (6th/7th gen) inside a Mac OS X Aqua window.
Vite + plain JS, `three` and `gsap` are the only runtime dependencies. All content lives in
`public/config.json`; no content is hard-coded in modules.

## Flow

1. `index.html` starts fetching `config.json` itself (`window.__configP`, picked up by
   `loadConfig`, 8 s timeout), and the built page preloads the intro chunk (an inline script adds
   `<link rel="modulepreload">` where WebGL 2 exists; left out when `config.json` turns the intro
   off at build time). The chunk is imported only once the config says the intro plays and WebGL 2
   is available.
2. It mounts the Aqua desktop + brushed-metal window (`src/window/`) and, inside it, the DOM iPod
   (`src/ipod/`). The iPod is laid out but `visibility:hidden`, so its rect can be measured.
3. The intro (`src/intro/`, three.js, lazily imported) plays on a full-viewport canvas: the iPod
   is taken apart into an exploded view and reassembled. Its last frame lands frontal and
   pixel-aligned on the DOM iPod's rect (`ipod.getShellRect()`).
4. Handoff: the canvas fades out (220 ms), `ipod.reveal()` shows the boot screen (brand monogram)
   and then the main menu. The window becomes interactive and the iPod gets keyboard focus.

"Intro überspringen" (button, bottom right; centred on phones), Esc and "Links" in the menu bar
skip to the aligned final frame; pressed while the intro chunk is still downloading, they reveal
the iPod at once ("Links" then also focuses it).
While the chunk is still on its way, a small Aqua spinner appears in the empty window after
600 ms. Degradation: no WebGL 2, a failed chunk load, a chunk that takes longer than 6 s
(`INTRO_CHUNK_MS`; a chunk that lands later is ignored), an exception in `runIntro`, or
`settings.intro: false` all skip the intro and reveal the iPod directly. On a slow device the intro
skips frames rather than playing in slow motion; if the median frame stays over 50 ms it first
drops the pixel ratio to 1, then hands off early. A watchdog (intro length + 6 s after its setup)
reveals the iPod even if the render loop dies (it races `intro.done`, it does not rely on the
intro). If `config.json` cannot be loaded, the window shows a short German error with a reload
button and the Impressum / Datenschutz links (`config.legal` as it was at build time, `__LEGAL__`),
and the reason goes to the console; menu entries without a name or with an unknown type, and rows
with nothing to show, are skipped with a console warning.

## Modules

### `src/shared/ipodSpec.js`: single source of truth

`IPOD` (geometry in mm: body, display window, LCD, click wheel, edge details), `PARTS` (exploded
layers, front to back), `COLORS` (silver palette and iPod UI colours), `aspect` (width / height).
Both the 3D model and the DOM iPod derive every size from these values, which is why the
intro's last frame matches the DOM iPod exactly. Change a dimension here, never in a module.

### `src/shared/config.js`

`loadConfig(url?, early?)` fetches `config.json` relative to the page (works under any base path;
`early`: a response promise the page already started), `introEnabled(config)` (the one reading
of `settings.intro`, also used by the build), `prefersReducedMotion()`.

### `src/shared/href.js`

`safeHref(href, base?)`: the one link rule for the iPod rows, the menu bar and (imported by
`vite.config.js`) the `<noscript>` list. Only http(s), mailto, tel (each one that the URL parser
accepts, so a placeholder `"https://"` is rejected) and relative paths; tabs and newlines are
stripped first, as the URL parser does. Relative paths, a leading `/` included, resolve against
the site base, so `/downloads/x.pdf` works under a GitHub Pages sub-path. Built on it, shared by the
iPod rows and the `<noscript>` list: `linkAttrs(href, { download, origin })` (new tab for web links
and for files on another origin, `download` only on this one), `rowLabel(spec)` (label, else
detail, address or file name), `fileName(path)`, `langOf(x)` and `serviceName(url)` (Spotify,
Apple Music, … for the playlist button).

### `src/window/index.js`: desktop + window

```js
createDesktop(host, { config, onLinks, onFocus }) → { el, contentEl, setInteractive(bool), destroy() }
```
Aqua wallpaper (CSS only; the drift runs two slow sweeps, then rests), menu bar (monogram,
`brand.name`, which ellipsizes first when the bar is narrow and, under 400 px with a monogram, is
left out (the monogram stands for it), "Links" when `onLinks` is given,
"Kontakt" when `brand.email` is set; on the right the `config.legal` links and a clock),
brushed-metal window titled `brand.windowTitle` with `brand.tagline` in the status bar.
Draggable by the title bar and clamped to the viewport; red/yellow minimise to a desktop icon
(genie with gsap, loaded on idle; the icon shows its focus halo to keyboard users only), green
zooms (a FLIP transform; zooming out restores the frame from before; wherever zoom would grow the
iPod by less than 12 px, i.e. on phones, short screens and up to ~660 px high where both sizes hit
the 500 px floor, the green light is disabled: two hidden probes resolve both `--ipod-h` values,
re-checked on resize). The lights are 14 px gels with 24 px hit
areas. `contentEl` sets `--ipod-aspect` (from `ipodSpec.js`) and `--ipod-h`:
`min(74svh, 600px)` on desktop; under 640 px the window spans the width and hugs the iPod, and
`--ipod-h` is the largest size that fits the screen width and height; on screens up to 640 px
high the padding shrinks and the status bar is hidden. With a fine pointer (`--ipod-floor`) the
iPod never gets smaller than 500 CSS px, so browser zoom enlarges its text (WCAG 1.4.4), except
on a short (≤ 640 px) window that is not zoomed in: at 1x resolution, or 1024+ CSS px wide (zoom
shrinks both sides, a Retina or 125 %/150 % laptop window keeps its width); a window larger than the screen
stays centred, the stage scrolls and dragging is off. Title and status bar never widen the window.
The iPod is the window's key view: restoring from the desktop icon focuses it, and a press on
the metal, title bar or a traffic light leaves keyboard focus on it, all through `onFocus`
(main.js: `ipod.focus()`, so a screen of links gets its selected row). "Links" calls
`onLinks(event)` (main.js: skips a running intro, then `ipod.home({ keyboard: event.detail === 0 })`).
`setInteractive(false)` locks drag and traffic lights during the intro (the lights are `inert` then).

### `src/ipod/index.js`: iPod UI

```js
mountIpod(container, { config }) → {
  el,                       // the iPod body (role=listbox, the focus target)
  getShellRect(),           // DOMRect of the body, valid before reveal()
  reveal({ boot = true }),  // → Promise: show, boot screen, main menu
  press(button),            // 'menu' | 'center' | 'play' | 'next' | 'prev'
  scroll(steps),            // +down / -up, like turning the wheel
  home({ keyboard }),       // back to the main menu, MENU flashes, focus (ring for keyboard); waits for reveal
  focus(),                  // focus the key target (the selected row on a screen of links, else the body)
  getState(),               // { screen, path, index }
  destroy(),
}
```
Height is `var(--ipod-h)`, every inner size is `calc(var(--ipod-h) / 103.5 * <mm>)` from `IPOD`.
The LCD UI is a logical 320×240 px space. Files: `wheel.js` (click-wheel input), `screens.js`
(main menu with preview pane, list, page, Now Playing, downloads), `player.js` (simulated
playback), `sound.js` (WebAudio clicks, `settings.clickSound`), `art.js` (procedural SVG),
`util.js` (helpers, re-exports `h` from `src/shared/dom.js` and `safeHref`), `ipodc.css`.

Input: wheel drag, mouse wheel, touch, keys on the focused iPod (↑/↓/←/→ scroll, Enter centre,
Esc/Backspace MENU, Space play, Shift+←/→ prev/next, Home/End, PageUp/PageDown). A ring press
that slides off its zone (or onto the centre button) presses nothing on lift. The mouse wheel
never scrolls the page, except when browser zoom made the window larger than the screen: then,
at the end of the list, it scrolls the stage so the click wheel can be reached.
A screen that was just opened ignores the centre button / Enter for 450 ms (`SETTLE_MS`, measured
from when the press began), so a double press opens an item but never also fires its first link.
A11y: the main menu (and any screen without links) is a listbox with `aria-activedescendant`.
On a screen of links the rows are real `<a>` elements with a roving tabindex: DOM focus moves
with the selection, so screen readers announce links with their URL; the container is a
`group` named after the screen. Keys are handled on the iPod element either way, and the focus
ring (Aqua's halo, `::after`) is drawn around the iPod; `data-input` follows the last input
(any key shows it, any pointer press hides it). A polite live region (track changes are announced
only on Now Playing) and an invisible "Zurück" button (outside the tab order) for touch screen
readers complete it, because the wheel is `aria-hidden`. Now Playing's drawn screen is
`aria-hidden`; a visually hidden block carries the playing track and the track list. Rows and
screen titles get `lang` from `config.json`. The UI strings (German 6G firmware wording) are `DEFAULT_UI` in
`src/ipod/index.js`; they are not read from `config.json`.

### `src/intro/index.js`: 3D intro

```js
runIntro({ getTargetRect, getFrameRect, reducedMotion = false, config = null }) → {
  duration, done,            // seconds; Promise resolved on the aligned final frame
  ready,                     // Promise settled when the setup tasks have run (or were stopped)
  skip(), dispose(),         // jump to the end; free canvas, GPU resources, listeners
  seek(t), pause(), play(),  // test hooks (seconds); `paused` is true while a test hook paused it
  measure(), info(),         // test hooks: projected outline vs. target rect (px), renderer memory/calls
}
```
`done` resolves before the final frame is drawn, so a render error can never keep the iPod hidden.
The WebGL context, the renderer and the model are each created in a task of their own; then the
setup (environment bakes, one canvas texture drawn and uploaded per task, drawing buffer, shader
compile and first use per part) runs as a chain of short tasks, so the skip button and Esc respond
while it runs; a skip or `dispose()` stops it. A restored WebGL context ends the intro (the DOM
iPod takes over) instead of rebuilding it in one long task. `window.__intro` is set once `ready`
has settled. `getFrameRect` (the window's rect) keeps the floor shadow on the window's metal: it
fades out towards the window edges and never darkens the wallpaper.
Procedural geometry only (`model.js`, canvas textures in `tex.js`), no model files. It owns a
`position:fixed; inset:0; z-index:50; pointer-events:none` canvas. Without a WebGL 2 context
`done` resolves at once. `config.brand` is engraved on the back shell.

## Content: `public/config.json`

Loaded at runtime; edit and reload, no rebuild needed in dev. The build also reads it (see
`vite.config.js`) for `<title>`, the meta description, `og:title`/`og:description` (from
`brand.name` and `brand.tagline`), absolute `og:image`/`og:url` and the `<noscript>` linktree, so
rebuild after changes for crawlers and visitors without JavaScript.
The generated assets (`tools/`, OG image, cover, PDFs) read `brand`, the playlist title and the
menu labels from `config.json` too (`tools/lib/brand.mjs`); rerun `node tools/make-all.mjs` after
changing them.

- `siteUrl`: optional public URL of the site. Without it the build uses `SITE_URL`, else, in the
  GitHub Pages workflow (`GITHUB_REPOSITORY`), `https://<owner>.github.io/<repo>/`; with none of
  them `og:image` stays relative.

- `brand`: `name`, `monogram`, `tagline` (status bar, meta description, og:description),
  `windowTitle`, `email` (the menu bar's Kontakt).
- `menu[]`: one main-menu row per entry, in order. Common fields `id`, `label`, `type`, `title`,
  optional `lang` (of label and title, e.g. `"en"`).
  - `list`: `items[]` of `{ label, detail, href, lang? }`.
  - `page`: `body` text and `actions[]` of `{ label, href, lang? }`.
  - `nowplaying`: `artist`, `cover`, `spotifyUrl` (any streaming address; the button names the
    service, `serviceName`), `tracks[]` of `{ title, artist, duration }`.
  - `downloads`: `items[]` of `{ label, file, format, size }` (`size` like `"308 kB"`, SI); rows
    are `<a download>` (a file on another origin opens in a new tab).
  - A row without `label` shows its detail, address or file name (`rowLabel`).
- `legal`: `{ impressum, datenschutz }`, path or URL of each legal page (a missing one has no
  link), linked from the menu bar, the static pages and the `<noscript>` list.
- Paths (`cover`, `file`, `legal`) are page-relative; a leading `/` is treated the same.
- `settings`: `clickSound` (bool), `intro` (`false`, `"off"` or `"never"` skip the intro;
  anything else plays it on every load).

**Add a menu item:** append an object to `menu[]` with a unique `id` and one of the four
`type`s. The main menu, its preview pane, the sub screen and the `<noscript>` list follow
automatically. A new screen type needs a builder in `src/ipod/screens.js` (`buildScreen`) and
a preview in `buildPreview`.

Text rule: no em or en dashes as separators in visible text; use `·`, a comma or a period.

## Static pages

`public/impressum.html`, `public/datenschutz.html` (marked placeholders with `noindex`, replace
with your own legal texts) and `public/404.html` (GitHub Pages serves it for unknown paths; an
inline script finds the site root via `config.json`, then loads the shared files from there, so
its links work at any depth and under a sub-path). They share `public/static.css` (the Aqua
desktop, menu bar and window, the same look as `src/window/window.css`) and `public/static.js`
(`fillBar(root)`: monogram, name and `config.legal` links in the menu bar with the main page's
link rule, the brand in the tab title, the clock). Without JavaScript their links point to the
pages next to them.

## Build

`vite.config.js`: `base: './'` (works on GitHub Pages sub-paths and any static host), the
inline `config-html` plugin (meta tags and `<noscript>` from `config.json`, every value
HTML-escaped, rows through `src/shared/href.js`), the `intro-preload` plugin, the `__LEGAL__`
define (the config error window's legal links) and `server.watch.ignored` for `.shots/`. The entry chunk holds main, window and iPod; three.js and the intro are a
separate chunk loaded with `import()` and preloaded by the `intro-preload` plugin; gsap is its
own small chunk, loaded on idle.

Test hooks: `window.__ipod` and `window.__intro` exist only in dev or with `?debug`.

## Dev pages and scripts

- `dev/intro.html`: the intro against a red dashed target box (`?t=2.5` seeks and pauses,
  `?reduced`).
- `dev/ipod.html`: the iPod alone, revealed, `window.__ipod` exposed (`?noboot`).
- `dev/window.html`: desktop and window with a grey placeholder.
- `dev/webgl-smoke.html`: checks that WebGL renders.
- `node scripts/shot.mjs <url> <out.png> [--w --h --wait --eval --mobile --dpr]`: screenshot
  with headless Chromium and software WebGL (slow but correct). The scripts find Chromium like
  `tools/` do (`CHROME_PATH`, the Playwright browsers incl. `PLAYWRIGHT_BROWSERS_PATH`, a system
  Chrome); without any, run `npx playwright install chromium` once.
- `node scripts/intro-frames.mjs <url> <dir> [--times 0,1,2]`: intro frames via
  `window.__intro.seek()` (use the dev server or `?debug`).

Screenshots go to `.shots/<label>/` (gitignored, not watched by Vite).
