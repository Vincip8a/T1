import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { safeHref as sharedSafeHref } from './src/shared/href.js';

const CONFIG_PATH = fileURLToPath(new URL('./public/config.json', import.meta.url));

/** The runtime href rule (src/shared/href.js): relative paths stay page-relative ('./x'), base './'. */
const safeHref = (href) => sharedSafeHref(href, './');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const link = (label, href, extra = '') => {
  const h = safeHref(href);
  if (!h) return '';
  const ext = /^https?:/i.test(h) ? ' rel="noopener"' : '';
  return `<li><a href="${esc(h)}"${ext}${extra}>${esc(label)}</a></li>`;
};

/** Plain HTML linktree for crawlers and visitors without JavaScript. */
function noscriptHtml(config) {
  const brand = config.brand ?? {};
  const sections = [];
  for (const item of Array.isArray(config.menu) ? config.menu : []) {
    if (!item || typeof item !== 'object') continue;
    let rows = [];
    if (item.type === 'list') rows = (item.items ?? []).map((i) => link(i.detail ? `${i.label}: ${i.detail}` : i.label, i.href));
    else if (item.type === 'page') rows = (item.actions ?? []).map((a) => link(a.label, a.href));
    else if (item.type === 'nowplaying') rows = [link(item.title ? `${item.title} auf Spotify` : 'Playlist auf Spotify', item.spotifyUrl)];
    else if (item.type === 'downloads') {
      rows = (item.items ?? []).map((d) => {
        const meta = [d.format, d.size].filter(Boolean).join(', ');
        const name = String(d.file ?? '').split(/[?#]/)[0].split('/').pop();
        return link(meta ? `${d.label} (${meta})` : d.label, d.file, ` download="${esc(name)}"`);
      });
    }
    rows = rows.filter(Boolean);
    const body = item.type === 'page' && item.body ? `<p>${esc(item.body)}</p>` : '';
    if (!rows.length && !body) continue;
    sections.push(`<section><h2>${esc(item.title ?? item.label)}</h2>${body}${rows.length ? `<ul>${rows.join('')}</ul>` : ''}</section>`);
  }
  const legal = config.legal ?? {};
  const legalLinks = [link('Impressum', legal.impressum), link('Datenschutz', legal.datenschutz)].filter(Boolean);
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
        const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
        const brand = config.brand ?? {};
        const title = esc(brand.name ? `${brand.name} · Links` : 'Links');
        const desc = esc(brand.tagline ?? '');
        // link previews need absolute URLs: with config.siteUrl set, og:image and og:url are absolute
        let site = null;
        try { site = /^https?:\/\//i.test(config.siteUrl ?? '') ? new URL(String(config.siteUrl).replace(/\/?$/, '/')) : null; } catch { /* invalid: stay relative */ }
        const ogImage = esc(site ? new URL('og-image.png', site).href : 'og-image.png');
        const ogUrl = site ? `\n  <meta property="og:url" content="${esc(site.href)}" />` : '';
        // function replacements: a '$' in the content is never read as a replacement pattern
        const meta = (attr) => new RegExp(`(<meta ${attr} content=")[^"]*(")`);
        return html
          .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`)
          .replace(meta('name="description"'), (_, a, b) => a + desc + b)
          .replace(meta('property="og:title"'), (_, a, b) => a + title + b)
          .replace(meta('property="og:description"'), (_, a, b) => a + desc + b)
          .replace(meta('property="og:image"'), (_, a, b) => a + ogImage + b)
          .replace(/<meta property="og:image"[^>]*>/, (m) => m + ogUrl)
          .replace(/<noscript>[\s\S]*?<\/noscript>/, () => `<noscript>${noscriptHtml(config)}</noscript>`);
      },
    },
  };
}

/** <link rel="modulepreload"> for the lazily imported intro chunk: its download starts while the HTML
 *  is parsed, not after the entry ran and config.json arrived (main.js imports it only then).
 *  Left out when config.json turns the intro off. */
function introPreload() {
  return {
    name: 'intro-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
        if ([false, 'never', 'off'].includes(config.settings?.intro) || !ctx.bundle) return html;
        const chunks = Object.values(ctx.bundle);
        const intro = chunks.find((c) => c.type === 'chunk' && c.isDynamicEntry && /\/src\/intro\/index\.js$/.test(c.facadeModuleId ?? ''));
        if (!intro) return html;
        const files = [intro.fileName, ...intro.imports.filter((f) => !html.includes(f))];
        return html.replace('</head>', () => `${files.map((f) => `  <link rel="modulepreload" crossorigin href="./${esc(f)}">\n`).join('')}</head>`);
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
  server: {
    // agents and QA write screenshots there; reloads on those writes broke test runs
    watch: { ignored: ['**/.shots/**', '**/qa/**'] },
  },
});
