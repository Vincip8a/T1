// Rendert HTML nach PDF bzw. PNG mit einem lokal vorhandenen Chromium.
//
// Bewusst ohne zusaetzliche npm-Abhaengigkeit: das Skript nimmt das Chromium, das
// Playwright mitbringt (falls installiert, auch unter PLAYWRIGHT_BROWSERS_PATH),
// sonst ein System-Chrome/Chromium/Edge. Mit CHROME_PATH laesst sich ein
// beliebiger Binaerpfad erzwingen. scripts/browser.mjs nutzt dieselbe Suche.

import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SYSTEM_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

function playwrightCacheRoot() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0') {
    return process.env.PLAYWRIGHT_BROWSERS_PATH
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? home, 'ms-playwright')
  if (process.platform === 'darwin') return join(home, 'Library', 'Caches', 'ms-playwright')
  return join(home, '.cache', 'ms-playwright')
}

// Playwright installiert je nach Version Chromium oder "Chrome for Testing"
const PLAYWRIGHT_BINS = [
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
  'chrome-win64/chrome.exe',
  'chrome-win/chrome.exe',
]

async function playwrightChromium() {
  // 1. das Chromium, das das installierte Playwright selbst verwenden wuerde (devDependency)
  try {
    const { chromium } = await import('playwright')
    const bin = chromium.executablePath()
    if (bin && existsSync(bin)) return bin
  } catch {
    /* Playwright nicht installiert */
  }
  // 2. irgendein Chromium-Build im Playwright-Browserverzeichnis, neuester zuerst
  const root = playwrightCacheRoot()
  if (!existsSync(root)) return null
  const builds = (await readdir(root))
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))
  for (const build of builds) {
    for (const rel of PLAYWRIGHT_BINS) {
      const bin = join(root, build, ...rel.split('/'))
      if (existsSync(bin)) return bin
    }
  }
  return null
}

/** Pfad zum Chromium-Binary, oder Fehler mit Hinweis zur Abhilfe. */
export async function findChromium() {
  if (process.env.CHROME_PATH) {
    if (!existsSync(process.env.CHROME_PATH)) {
      throw new Error(`CHROME_PATH zeigt auf nichts: ${process.env.CHROME_PATH}`)
    }
    return process.env.CHROME_PATH
  }
  const fromPlaywright = await playwrightChromium()
  if (fromPlaywright) return fromPlaywright
  const fromSystem = SYSTEM_CANDIDATES.find((candidate) => existsSync(candidate))
  if (fromSystem) return fromSystem
  throw new Error(
    'Kein Chromium gefunden. Installiere Google Chrome oder fuehre\n' +
      '  npx playwright install chromium\n' +
      'aus, oder setze CHROME_PATH auf ein Chromium-Binary.',
  )
}

// Chromium schreibt die Zieldatei fertig, beendet sich danach aber je nach
// Version nicht von selbst. Darum: Prozess starten, auf eine vollstaendige
// Datei warten und den Prozess anschliessend selbst abraeumen.
const RENDER_TIMEOUT_MS = 90_000
const POLL_INTERVAL_MS = 100

const PNG_IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
const PDF_EOF = Buffer.from('%%EOF')

function endsWith(buffer, marker) {
  // Chromium haengt hinter %%EOF teils noch einen Zeilenumbruch an.
  const tail = buffer.subarray(-(marker.length + 2))
  return tail.includes(marker)
}

async function readWhenComplete(path, marker) {
  try {
    const buffer = await readFile(path)
    return buffer.length > marker.length && endsWith(buffer, marker) ? buffer.length : null
  } catch {
    return null
  }
}

// Chromium startet Renderer- und Crashpad-Prozesse, die ein Signal an den
// gestarteten Prozess nicht erreicht. Aufgeraeumt wird deshalb ueber das
// Profilverzeichnis: es ist pro Aufruf frisch angelegt und steht in der
// Kommandozeile jedes beteiligten Prozesses, fremde Browser-Fenster der
// Nutzerin bleiben dadurch unberuehrt.
async function killByProfile(profileDir) {
  if (process.platform === 'win32') return
  let stdout = ''
  try {
    ;({ stdout } = await execFileAsync('ps', ['-eo', 'pid=,command='], { maxBuffer: 8 * 1024 * 1024 }))
  } catch {
    return
  }
  for (const line of stdout.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/)
    if (!match || !match[2].includes(profileDir)) continue
    try {
      process.kill(Number(match[1]), 'SIGKILL')
    } catch {
      /* Prozess war schon beendet */
    }
  }
}

async function stopChromium(child, profileDir) {
  try {
    child.kill('SIGKILL')
  } catch {
    /* Prozess war schon beendet */
  }
  child.unref()
  await killByProfile(profileDir)
}

async function renderWithChromium(args, outPath, marker, profileDir) {
  const bin = await findChromium()
  await rm(outPath, { force: true })
  const child = spawn(bin, args, { stdio: 'ignore', detached: process.platform !== 'win32' })
  try {
    const deadline = Date.now() + RENDER_TIMEOUT_MS
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      const size = await readWhenComplete(outPath, marker)
      if (size !== null) return size
    }
    throw new Error(
      `Chromium hat ${outPath} nicht innerhalb von ${RENDER_TIMEOUT_MS / 1000}s vollstaendig geschrieben.`,
    )
  } finally {
    await stopChromium(child, profileDir)
  }
}

async function withTempHtml(html, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ipod-assets-'))
  try {
    const htmlPath = join(dir, 'page.html')
    await writeFile(htmlPath, html, 'utf8')
    return await fn({ url: pathToFileURL(htmlPath).href, profile: join(dir, 'profile') })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const BASE_FLAGS = ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars']

/** HTML -> PDF. Seitengroesse kommt aus der @page-Regel im HTML. */
export function htmlToPdf(html, outPath) {
  return withTempHtml(html, ({ url, profile }) =>
    renderWithChromium(
      [...BASE_FLAGS, `--user-data-dir=${profile}`, '--no-pdf-header-footer', `--print-to-pdf=${outPath}`, url],
      outPath,
      PDF_EOF,
      profile,
    ),
  )
}

/** HTML -> PNG im angegebenen Viewport. Mit Playwright (devDependency) exakt im
 *  Viewport; ohne Playwright ueber --screenshot (neuere Chromium-Versionen ziehen
 *  dort die Fensterleisten von --window-size ab, das Bild wird unten abgeschnitten). */
export async function htmlToPng(html, outPath, { width, height }) {
  let chromium = null
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    /* Playwright nicht installiert: Kommandozeilen-Weg */
  }
  if (chromium) {
    const browser = await chromium.launch({ executablePath: await findChromium(), args: ['--disable-gpu', '--hide-scrollbars'] })
    try {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
      await withTempHtml(html, async ({ url }) => {
        await page.goto(url, { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        await page.screenshot({ path: outPath, omitBackground: false })
      })
    } finally {
      await browser.close()
    }
    return (await readFile(outPath)).length
  }
  return withTempHtml(html, ({ url, profile }) =>
    renderWithChromium(
      [
        ...BASE_FLAGS,
        `--user-data-dir=${profile}`,
        `--window-size=${width},${height}`,
        `--screenshot=${outPath}`,
        url,
      ],
      outPath,
      PNG_IEND,
      profile,
    ),
  )
}

/** "308 kB" / "1,2 MB" (SI, 1 kB = 1000 Byte): genau die Schreibweise von `size` in public/config.json. */
export function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)} kB`
  return `${(bytes / 1000 / 1000).toFixed(1).replace('.', ',')} MB`
}
