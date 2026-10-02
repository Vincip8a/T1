import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { linkAttrs, fileName, rowLabel, langOf, safeHref, serviceName, firstText } from './src/shared/href.js';
import { introEnabled } from './src/shared/config.js';
import { formatSize } from './tools/lib/size.mjs';

const CONFIG_PATH = fileURLToPath(new URL('./public/config.json', import.meta.url));
// a typo in the hand-edited file must name the file, not "failed to load config from vite.config.js"
const readConfig = () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`public/config.json is not valid JSON: ${e.message}`); // (Node names line and column)
  }
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const langAttr = (x) => (langOf(x) ? ` lang="${esc(langOf(x))}"` : '');

/** An http(s) site address as a URL ending in '/', or null. A bare host ("deinname.de/links") gets
 *  https://; anything else that is not an address is ignored with a warning (`from`: where it came from). */
function siteUrlFrom(value, from) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`;
  try {
    const url = new URL(withScheme.replace(/\/?$/, '/'));
    if (/^https?:$/.test(url.protocol) && (withScheme === v || url.hostname.includes('.'))) return url;
  } catch { /* reported below */ }
  console.warn(`[config-html] ${from} ignored (not a web address like https://deinname.de/):`, v);
  return null;
}

/** The public address as a URL: config.siteUrl, else SITE_URL, else (in the GitHub Pages workflow) the
 *  Pages address of the repository (a custom domain redirects from there). A value that is not an
 *  address is skipped with a warning, so the next source still counts. null when unknown. */
function siteUrlOf(config) {
  const url = siteUrlFrom(config.siteUrl, 'siteUrl in public/config.json') ?? siteUrlFrom(process.env.SITE_URL, 'SITE_URL');
  if (url) return url;
  const [owner, repo] = (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY || '').split('/');
  if (!owner || !repo) return null;
  const host = `${owner.toLowerCase()}.github.io`;
  return new URL(repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`);
}

/** Plain HTML linktree for crawlers and visitors without JavaScript. Rows follow the iPod's rules
 *  (src/shared/href.js): the same labels, links, new tabs and downloads, and a row without a usable
 *  link is plain text, as on the iPod. `origin`: the site's origin, when known. */
function noscriptHtml(config, origin = null) {
  const brand = config.brand ?? {};
  const row = (label, href, { download = null, lang = '' } = {}) => {
    const a = href ? linkAttrs(href, { download, base: './', origin }) : null;
    if (!a) return label ? `<li${lang}>${esc(label)}</li>` : '';
    const attrs = (a.newTab ? ' target="_blank" rel="noopener"' : '') + (a.download != null ? ` download="${esc(a.download)}"` : '');
    return `<li${lang}><a href="${esc(a.href)}"${attrs}>${esc(label)}</a></li>`;
  };
  const items = (a) => (Array.isArray(a) ? a : []).filter((x) => x && typeof x === 'object');
  const sections = [];
  for (const item of Array.isArray(config.menu) ? config.menu : []) {
    if (!item || typeof item !== 'object') continue;
    let rows = [];
    if (item.type === 'list' || item.type === 'page') {
      rows = items(item.type === 'list' ? item.items : item.actions).map((i) => {
        const label = rowLabel(i);
        return row(i.detail && i.detail !== label ? `${label}: ${i.detail}` : label, i.href, { lang: langAttr(i) });
      });
    } else if (item.type === 'nowplaying') {
      const url = safeHref(item.spotifyUrl, './');
      const service = url && serviceName(url);
      const name = firstText(item.title, item.label, 'Playlist');
      rows = [row(service ? `${name} auf ${service}` : name, url)];
    } else if (item.type === 'downloads') {
      rows = items(item.items).map((d) => {
        const label = rowLabel({ label: d.label, file: d.file });
        const meta = [d.format, d.size].filter(Boolean).join(', ');
        return label && row(meta ? `${label} (${meta})` : label, d.file, { download: fileName(d.file), lang: langAttr(d) });
      });
    }
    rows = rows.filter(Boolean);
    const body = item.type === 'page' && item.body ? `<p>${esc(item.body)}</p>` : '';
    if (!rows.length && !body) continue;
    sections.push(`<section><h2${langAttr(item)}>${esc(firstText(item.title, item.label))}</h2>${body}${rows.length ? `<ul>${rows.join('')}</ul>` : ''}</section>`);
  }
  const legal = config.legal ?? {};
  const legalLinks = [legal.impressum && row('Impressum', legal.impressum), legal.datenschutz && row('Datenschutz', legal.datenschutz)].filter(Boolean);
  return `
    <style>
      .nojs { position: relative; z-index: 1; max-width: 560px; margin: 0 auto; padding: 32px 20px 48px; color: #111;
        font: 15px/1.5 "Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif; }
      .nojs-card { background: #e4e4e4; border: 1px solid rgba(0,0,0,.5); border-radius: 8px; padding: 20px 24px;
        box-shadow: 0 14px 40px rgba(0,16,60,.45); }
      .nojs h1 { margin: 0; font-size: 22px; } .nojs h2 { margin: 18px 0 4px; font-size: 15px; }
      .nojs p { margin: 4px 0 8px; } .nojs ul { margin: 0; padding-left: 20px; } .nojs a { color: #0b4fc4; }
      .nojs-legal { margin-top: 20px; font-size: 13px; } .nojs-legal ul { padding: 0; list-style: none; display: flex; gap: 16px; }
      body { overflow: auto; min-height: 100vh; background: radial-gradient(130% 100% at 50% 118%, #6cc0f7 0%, #3f9bea 36%, #1f6fd0 62%, #12489f 100%) fixed; }
    </style>
    <main class="nojs"><div class="nojs-card">
      <h1>${esc(brand.name)}</h1>${brand.tagline ? `<p>${esc(brand.tagline)}</p>` : ''}
      <p>Der iPod braucht JavaScript. Hier sind alle Links direkt:</p>
      ${sections.join('\n      ')}
      ${legalLinks.length ? `<nav class="nojs-legal" aria-label="Rechtliches"><ul>${legalLinks.join('')}</ul></nav>` : ''}
    </div></main>
  `;
}

/** Fills <title>, the meta description, the og: tags (og:image and og:url absolute when the site address
 *  is known: config.siteUrl, SITE_URL or the GitHub Pages workflow, see siteUrlOf) and the <noscript>
 *  linktree from public/config.json. */
function configHtml() {
  return {
    name: 'config-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx?.path && !/(^|\/)index\.html$/.test(ctx.path)) return html; // dev/*.html stay as they are
        const config = readConfig();
        const brand = config.brand ?? {};
        const title = esc(brand.name ? `${brand.name} · Links` : 'Links');
        const desc = esc(brand.tagline ?? '');
        // link previews need absolute URLs: with a known site address (siteUrlOf) og:image and og:url are absolute
        const site = siteUrlOf(config);
        const ogImage = esc(site ? new URL('og-image.png', site).href : 'og-image.png');
        const ogUrl = (site ? `\n  <meta property="og:url" content="${esc(site.href)}" />` : '')
          + '\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />';
        // function replacements: a '$' in the content is never read as a replacement pattern
        const meta = (attr) => new RegExp(`(<meta ${attr} content=")[^"]*(")`);
        return html
          .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`)
          .replace(meta('name="description"'), (_, a, b) => a + desc + b)
          .replace(meta('property="og:title"'), (_, a, b) => a + title + b)
          .replace(meta('property="og:description"'), (_, a, b) => a + desc + b)
          .replace(meta('property="og:image"'), (_, a, b) => a + ogImage + b)
          .replace(/<meta property="og:image"[^>]*>/, (m) => m + ogUrl)
          .replace(/<noscript>[\s\S]*?<\/noscript>/, () => `<noscript>${noscriptHtml(config, site?.origin)}</noscript>`);
      },
    },
  };
}

/** `size` of every download that lives in the site (`file` relative to it), set from the file itself in
 *  `dir`; a download elsewhere keeps the `size` written in config.json */
function withSizes(config, dir) {
  for (const entry of Array.isArray(config.menu) ? config.menu : []) {
    for (const item of entry?.type === 'downloads' && Array.isArray(entry.items) ? entry.items : []) {
      const file = typeof item?.file === 'string' ? item.file.split(/[?#]/)[0] : '';
      if (!file || /^([a-z][a-z\d+.-]*:|\/\/)/i.test(file)) continue;
      const path = resolve(dir, decodeURIComponent(file.replace(/^\.?\//, '')));
      if (relative(dir, path).startsWith('..') || !existsSync(path)) continue;
      item.size = formatSize(statSync(path).size);
    }
  }
  return config;
}

/** Download sizes are never stale: the built config.json (and the one the dev server hands out) carries
 *  the real size of each file in the site, so a replaced PDF needs no hand-edited `size`. */
function downloadSizes() {
  let outDir = '', publicDir = '';
  return {
    name: 'download-sizes',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); publicDir = c.publicDir; },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/config.json') return next();
        let config;
        try { config = readConfig(); } catch { return next(); } // the browser then gets the file and its error
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(JSON.stringify(withSizes(config, publicDir), null, 2));
      });
    },
    closeBundle() {
      const path = join(outDir, 'config.json');
      if (!existsSync(path)) return;
      const config = JSON.parse(readFileSync(path, 'utf8'));
      writeFileSync(path, `${JSON.stringify(withSizes(config, outDir), null, 2)}\n`);
    },
  };
}

/** Preload for the lazily imported intro chunk: its download starts while the HTML is parsed, not after
 *  the entry ran and config.json arrived (main.js imports it only then). A tiny inline script adds the
 *  <link rel="modulepreload"> only where the intro will play: a WebGL 2 context can really be created (the
 *  answer goes to main.js as window.__gl2, so it probes once), no reduced motion, and not yet played in
 *  this session (main.js's 'ipodc-intro-seen'). Left out when config.json turns the intro off at build
 *  time (turning it off in a deployed config.json without a rebuild still skips the intro, but the chunk
 *  is still preloaded). */
function introPreload() {
  return {
    name: 'intro-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!introEnabled(readConfig()) || !ctx.bundle) return html;
        const chunks = Object.values(ctx.bundle);
        const intro = chunks.find((c) => c.type === 'chunk' && c.isDynamicEntry && /\/src\/intro\/index\.js$/.test(c.facadeModuleId ?? ''));
        if (!intro) return html;
        const files = JSON.stringify([intro.fileName, ...intro.imports.filter((f) => !html.includes(f))].map((f) => `./${f}`));
        const script = `try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches && sessionStorage.getItem('ipodc-intro-seen') !== '1') {`
          + ` const gl = document.createElement('canvas').getContext('webgl2'); window.__gl2 = !!gl; gl?.getExtension('WEBGL_lose_context')?.loseContext();`
          + ` if (gl) for (const f of ${files}) { const l = document.createElement('link'); l.rel = 'modulepreload'; l.crossOrigin = ''; l.href = f; document.head.append(l); } } } catch {}`;
        // before the entry script and the stylesheet (an inline script after a stylesheet waits for it)
        return html.replace(/(\s*)<script type="module"/, (m, ws) => `${ws}<script>${script}</script>${m}`);
      },
    },
  };
}

// Relative base so the build works on GitHub Pages sub-paths and any static host.
export default defineConfig({
  base: './',
  // the lazily loaded intro chunk carries three.js (~610 kB minified, ~160 kB gzip) by design
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  plugins: [configHtml(), introPreload(), downloadSizes()],
  // config.legal at build time: the config error window still links the Impressum and Datenschutz
  define: { __LEGAL__: JSON.stringify(readConfig().legal ?? null) },
  server: {
    // test runs write screenshots there; reloads on those writes broke them
    watch: { ignored: ['**/.shots/**'] },
  },
});
