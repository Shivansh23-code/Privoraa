// Post-build prerender: inject server-rendered HTML for the public marketing
// routes into the built index.html template, writing one static file per route.
// Crawlers, link-unfurlers, and no-JS visitors get real content; the client
// bundle then takes over (createRoot) for full interactivity.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

const { render } = await import(url.pathToFileURL(path.join(root, 'dist-server', 'entry-server.js')).href);

// Public routes only — anything auth-gated stays a client-rendered SPA route
// (served by the index.html fallback).
const routes = ['/', '/plans', '/download'];

let ok = 0;
for (const route of routes) {
  try {
    const appHtml = render(route);
    const html = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
    const outFile =
      route === '/' ? path.join(distDir, 'index.html') : path.join(distDir, route, 'index.html');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    console.log(`prerendered ${route} -> ${path.relative(root, outFile)} (${appHtml.length} bytes)`);
    ok++;
  } catch (e) {
    console.error(`prerender FAILED for ${route}:`, e.message);
    process.exitCode = 1;
  }
}
console.log(`prerender: ${ok}/${routes.length} routes`);
