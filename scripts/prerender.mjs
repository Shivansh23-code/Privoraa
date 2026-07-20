// Post-build prerender: inject server-rendered HTML + per-route <head> meta into
// the built index.html template, writing one static file per route. Crawlers,
// link-unfurlers, and no-JS visitors get real, page-specific content; the client
// bundle then takes over for full interactivity.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

const { render } = await import(url.pathToFileURL(path.join(root, 'dist-server', 'entry-server.js')).href);

const SITE = 'https://vedix.vercel.app';

// Per-route head. Without this all pages shipped the landing's title/description/
// canonical/OG, which hurts SEO and produces wrong link-unfurl previews.
const META = {
  '/': {
    title: 'Vedix — Your Private AI Companion',
    desc: 'Vedix is a private AI companion that helps you focus, remember, and feel safe — your conversations stay sealed in a vault only you can open.',
  },
  '/plans': {
    title: 'Plans & Pricing — Vedix',
    desc: 'Choose your Vedix plan. Start free; upgrade for bigger models and more power. Private AI that runs in the cloud or fully on your device.',
  },
  '/download': {
    title: 'Vedix Offline — Run AI privately on your device',
    desc: 'Run Vedix fully offline with the open-source Ollama engine. Download a model once, then chat with no internet — nothing leaves your device.',
  },
};

// Public routes only — anything auth-gated stays a client-rendered SPA route
// (served by the index.html fallback).
const routes = Object.keys(META);

const sub = (html, re, repl) => html.replace(re, repl);

function applyHead(html, route) {
  const m = META[route];
  const loc = SITE + (route === '/' ? '/' : route);
  return [
    [/<title>[\s\S]*?<\/title>/, `<title>${m.title}</title>`],
    [/(<meta name="description" content=")[^"]*(")/, `$1${m.desc}$2`],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${loc}$2`],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${loc}$2`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${m.title}$2`],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${m.desc}$2`],
    [/(<meta name="twitter:url" content=")[^"]*(")/, `$1${loc}$2`],
    [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${m.title}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${m.desc}$2`],
  ].reduce((acc, [re, repl]) => sub(acc, re, repl), html);
}

let ok = 0;
for (const route of routes) {
  try {
    const appHtml = render(route);
    const html = applyHead(template, route).replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`
    );
    const outFile =
      route === '/' ? path.join(distDir, 'index.html') : path.join(distDir, route, 'index.html');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    console.log(`prerendered ${route} -> ${path.relative(root, outFile)} (${appHtml.length} bytes, title="${META[route].title}")`);
    ok++;
  } catch (e) {
    console.error(`prerender FAILED for ${route}:`, e.message);
    process.exitCode = 1;
  }
}
console.log(`prerender: ${ok}/${routes.length} routes`);
