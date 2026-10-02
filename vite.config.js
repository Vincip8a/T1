import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { linkAttrs, fileName, rowLabel, langOf, safeHref, serviceName } from './src/shared/href.js';
import { introEnabled } from './src/shared/config.js';

const CONFIG_PATH = fileURLToPath(new URL('./public/config.json', import.meta.url));
const readConfig = () => JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const langAttr = (x) => (langOf(x) ? ` lang="${esc(langOf(x))}"` : '');

/** The public address: config.siteUrl, else SITE_URL, else (in the GitHub Pages workflow) the Pages
 *  address of the repository (a custom domain redirects from there). '' when unknown. */
function siteUrlOf(config) {
  if (config.siteUrl) return String(config.siteUrl);
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const [owner, repo] = (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY || '').split('/');
  if (!owner || !repo) return '';
  const host = `${owner.toLowerCase()}.github.io`;
  return repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`;
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
      rows = [row(service ? `${item.title ?? 'Playlist'} auf ${service}` : (item.title ?? 'Playlist'), url)];
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
    sections.push(`<section><h2${langAttr(item)}>${esc(item.title ?? item.label)}</h2>${body}${rows.length ? `<ul>${rows.join('')}</ul>` : ''}</section>`);
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

/** Fills <title>, the meta description, the og: tags (absolute with config.siteUrl) and the <noscript>
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
        const siteUrl = siteUrlOf(config);
        let site = null;
        try { site = /^https?:\/\//i.test(siteUrl) ? new URL(siteUrl.replace(/\/?$/, '/')) : null; } catch { /* invalid: stay relative */ }
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

/** Preload for the lazily imported intro chunk: its download starts while the HTML is parsed, not after
 *  the entry ran and config.json arrived (main.js imports it only then). A tiny inline script adds the
 *  <link rel="modulepreload"> only where WebGL 2 exists, so browsers that cannot play the intro never
 *  download it. Left out when config.json turns the intro off at build time (turning it off in a deployed
 *  config.json without a rebuild still skips the intro, but the chunk is still preloaded). */
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
        const script = `if (window.WebGL2RenderingContext) for (const f of ${files}) { const l = document.createElement('link'); l.rel = 'modulepreload'; l.crossOrigin = ''; l.href = f; document.head.append(l); }`;
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
  plugins: [configHtml(), introPreload()],
  // config.legal at build time: the config error window still links the Impressum and Datenschutz
  define: { __LEGAL__: JSON.stringify(readConfig().legal ?? null) },
  server: {
    // test runs write screenshots there; reloads on those writes broke them
    watch: { ignored: ['**/.shots/**'] },
  },
});
