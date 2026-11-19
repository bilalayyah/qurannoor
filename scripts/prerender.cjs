#!/usr/bin/env node
/**
 * Prerender Noor Quran — audit H-1 (no prerendering).
 *
 * Generates one static HTML file per route under public/<route>/index.html
 * so every route's RAW HTML carries its real content (headings, first verses,
 * guide text) instead of an empty <div id="root"> shell.
 *
 * WHY THIS DESIGN (read before changing it): Cloudflare Pages' build
 * environment has NO Chromium / Playwright, so prerendering CANNOT run at
 * Cloudflare build time. Instead this script renders LOCALLY with headless
 * Chromium over a local origin server and COMMITS the output as static files
 * under public/ (Vite copies public/ verbatim into dist/, and Cloudflare
 * serves the most specific static file for each route). The Cloudflare build
 * itself stays a plain `vite build` — no browser needed.
 * Re-run this script after any content/route change and commit the result.
 *
 * Flow: `vite build` -> start the Express server in production mode
 * (`NODE_ENV=production npx tsx server.ts`, which serves dist/ statically
 * AND the real /api/* endpoints via the Quran Foundation API) -> render
 * every route with headless Chromium (Playwright, via the relay proxy at
 * 127.0.0.1:18080) -> sanitize the captured HTML (drop the absolute
 * preview-origin <link rel="modulepreload"> tags Vite's runtime injects,
 * or every live page would request chunks from localhost) -> save
 * documentElement.outerHTML to public/<route>/index.html -> `vite build`
 * again so dist/ contains the prerendered files (skipped with --no-rebuild).
 *
 * Why the Express server and not `vite preview`: vite preview serves dist/
 * but has NO /api/* endpoints, so Surah/Juz pages would render with no
 * verses. The Express server (server.ts) serves dist/ statically in
 * production mode AND /api/* with the real Quran Foundation API (OAuth when
 * QURAN_CLIENT_ID/SECRET are set, otherwise the public api.quran.com
 * fallback — the verse text is identical either way; only the reciter list
 * differs, 14 public vs 23 authenticated, which the client hydrates).
 *
 * Route list: public/sitemap.xml (186 URLs, including '/'). The home route
 * '/' is rendered to public/__home__/index.html — NOT public/index.html,
 * which Vite overwrites with its own index.html output on every build
 * (verified 2026-11-18 with a marker test). The middleware serves that
 * file for path '/' via ASSETS (see functions/_middleware.ts) and 301s
 * /__home__/ back to '/', so the raw path is never a public URL.
 *
 * Scope: first ~15-ayah chunk only per Surah/Juz page (Scope A, approved
 * 2026-11-18). The reader loads further chunks on scroll (IntersectionObserver);
 * the prerender does NOT scroll, so only the first chunk is in the static
 * HTML. Use --full-text to scroll each Surah/Juz page to the bottom and
 * capture the full text instead.
 *
 * Playwright is NOT a dependency of this repo. It resolves from the shared
 * screenshot-tool checkout (~/workspace/compressmypic/screenshot-tool/) via
 * createRequire; a plain require('playwright') is tried first so the script
 * also works if playwright is ever installed in this repo.
 *
 * REPRODUCIBILITY (I-11): Chromium only reaches the network through the
 * relay proxy at ~/workspace/compressmypic/screenshot-tool/relay.js
 * (listening on 127.0.0.1:18080 — see PROXY_ARGS); start the relay before
 * running this script. On low-memory machines use --concurrency 1.
 * BUILD FRESHNESS: distIsCurrent() below only compares dist/ against
 * src/main.tsx — after changes to any OTHER source file, an old dist/
 * still looks current. Rebuild (or delete dist/) before rendering when
 * anything besides main.tsx changed.
 *
 * Hard rules (from CMP's blank-site incident, 2026-11-17):
 * - HASH RULE: never push a source-only change that alters bundle hashes
 *   without regenerating the prerender HTML locally and committing it in the
 *   SAME push. Stale prerender HTML referencing dead bundle hashes renders
 *   the site BLANK.
 * - ZERO-ERROR RULE for Quran text: prerendering never edits, cleans, or
 *   replaces any Quran character. It only renders the existing React
 *   components with the existing API data (text_qpc_hafs). Spot-check the
 *   output against the API; no manual fixes to text, ever.
 * - NO FAKE CONTENT: the prerendered HTML is the real rendered page. If a
 *   route cannot render its real content, it is left out (served by the SPA)
 *   rather than prerendered with placeholder text.
 *
 * Usage (from the repo root):
 *   node scripts/prerender.cjs [--port 4182] [--concurrency 4]
 *     [--limit 5] [--routes /surah/al-fatihah,/juz/1] [--no-rebuild]
 *     [--skip-existing] [--keep-preview] [--preview-url http://127.0.0.1:4182]
 *     [--full-text] [--out-dir public]
 *
 * Exit code is non-zero if any route fails after its retry.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { createRequire } = require('module');

const REPO_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');
const SITEMAP_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');
const SITE_ORIGIN = 'https://qurannoor.com';
const EXTRA_ROUTES = [];
const PROXY_ARGS = ['--proxy-server=http://127.0.0.1:18080', '--ignore-certificate-errors'];
// /dev/shm on this machine is only 794 MB; without this flag Chromium exhausts
// it with several heavy pages open and the whole browser dies mid-run.
const CHROMIUM_ARGS = [...PROXY_ARGS, '--disable-dev-shm-usage'];
const BATCH_SIZE = 100; // fresh browser per batch: bounds Chromium memory growth
// Text of the short-lived loading state (Suspense fallback in src/App.tsx).
// A rendered page's <main> is far longer than this, so readiness is: <main>
// exists, is long, and contains none of these. Verse pages additionally
// require a real <article id="ayah-…"> — while verses load the page shows a
// VerseListSkeleton (placeholder divs, no text) under the header, which the
// plain text-length check would otherwise pass.
const LOADING_TEXTS = ['Loading...'];
// Routes whose content is API-backed verses; readiness requires a rendered ayah.
const VERSE_PAGE_PREFIXES = ['/surah/', '/juz/', '/ayah/', '/popular/'];

function parseArgs(argv) {
  const opts = { port: 4182, concurrency: 4, limit: 0, routes: null, rebuild: true, keepPreview: false, skipExisting: false, previewUrl: null, fullText: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--concurrency') opts.concurrency = Number(argv[++i]);
    else if (a === '--limit') opts.limit = Number(argv[++i]);
    else if (a === '--routes') opts.routes = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--preview-url') opts.previewUrl = argv[++i].replace(/\/+$/, '');
    else if (a === '--no-rebuild') opts.rebuild = false;
    else if (a === '--skip-existing') opts.skipExisting = true;
    else if (a === '--keep-preview') opts.keepPreview = true;
    else if (a === '--full-text') opts.fullText = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/prerender.cjs [--port 4182] [--concurrency 4] [--limit N] [--routes a,b] [--no-rebuild] [--skip-existing] [--keep-preview] [--preview-url http://127.0.0.1:4182] [--full-text]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const screenshotToolPkg = path.resolve(
      __dirname, '..', '..', 'compressmypic', 'screenshot-tool', 'package.json',
    );
    return createRequire(screenshotToolPkg)('playwright');
  }
}

function readRoutes() {
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const paths = [];
  const seen = new Set();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let url = m[1].trim();
    if (!url.startsWith(SITE_ORIGIN)) continue;
    let p = url.slice(SITE_ORIGIN.length) || '/';
    p = p.split('#')[0].split('?')[0];
    if (!p.startsWith('/')) p = `/${p}`;
    if (p.length > 1) p = p.replace(/\/+$/, '');
    if (seen.has(p)) continue;
    seen.add(p);
    paths.push(p);
  }
  for (const extra of EXTRA_ROUTES) {
    if (!seen.has(extra)) {
      seen.add(extra);
      paths.push(extra);
    }
  }
  return paths;
}

function outPathFor(routePath) {
  // '/surah/al-baqarah' -> public/surah/al-baqarah/index.html
  const clean = routePath.replace(/\/+$/, '') || '/';
  // Home renders to public/__home__/index.html, never public/index.html
  // (Vite overwrites that on every build). The middleware serves it for '/'.
  if (clean === '/') return path.join(PUBLIC_DIR, '__home__', 'index.html');
  return path.join(PUBLIC_DIR, ...clean.split('/').filter(Boolean), 'index.html');
}

function isVersePage(routePath) {
  return VERSE_PAGE_PREFIXES.some((prefix) => routePath.startsWith(prefix));
}

function viteBin() {
  return path.join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
}

function tsxBin() {
  return path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Build via Vite directly (not `npm run build`): npm's own log-file writing
// intermittently fails with EPERM in this environment, while Vite itself
// builds fine. Same command the package.json "build" script runs.
// Retries: Vite's config load intermittently fails with EPERM writing its
// bundled-config temp file (node_modules/.vite-temp) when the machine is
// under load from parallel workers; the failure comes in waves and a retry
// a few seconds later succeeds, so retry before giving up.
function distIsCurrent() {
  // Best-effort freshness check: dist/ counts as current when Vite's own
  // index.html exists and the newest built asset is newer than main.tsx
  // (the only source file this script's runs change between builds).
  try {
    const distIndex = path.join(REPO_ROOT, 'dist', 'index.html');
    if (!fs.existsSync(distIndex)) return false;
    const srcMtime = fs.statSync(path.join(REPO_ROOT, 'src', 'main.tsx')).mtimeMs;
    const assetsDir = path.join(REPO_ROOT, 'dist', 'assets');
    let newest = 0;
    for (const f of fs.readdirSync(assetsDir)) {
      const m = fs.statSync(path.join(assetsDir, f)).mtimeMs;
      if (m > newest) newest = m;
    }
    return newest >= srcMtime;
  } catch {
    return false;
  }
}

// Delete every stale prerendered file from dist/ (all nested index.html
// files — dist/<route>/index.html and dist/__home__/index.html — but NEVER
// the SPA shell dist/index.html). Vite copies public/ into dist/ on every
// build, so after build 1/2 dist/ holds the PREVIOUS run's snapshots; the
// Express server's express.static() would serve those stale files instead
// of the SPA shell, and the run would silently re-snapshot stale HTML
// (old bundle hash, old canonicals) instead of rendering the current app
// — observed 2026-11-19: 185/185 files rewritten with stale content plus
// one blank line of DOM-serialisation noise. Called after build 1/2 (or
// its distIsCurrent() fallback) and BEFORE the server starts, so every
// route renders from the live shell. Build 2/2 re-copies the fresh
// public/ files into dist/ afterwards.
function removeStalePrerenderedFromDist() {
  const distDir = path.join(REPO_ROOT, 'dist');
  let removed = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html' && dir !== distDir) {
        try {
          fs.rmSync(p, { force: true });
          removed += 1;
        } catch {
          // A single undeletable stale file is reported by the caller via
          // the render check below (its snapshot would still be stale).
        }
      }
    }
  };
  walk(distDir);
  return removed;
}

function viteBuild() {
  let lastErr;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      execSync(`${process.execPath} ${viteBin()} build`, { cwd: REPO_ROOT, stdio: 'inherit' });
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`[prerender] vite build attempt ${attempt} failed, retrying in 20s...`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20000);
    }
  }
  throw lastErr;
}

async function waitForServer(baseUrl, timeoutMs = 60000) {
  const started = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${baseUrl}/`, { redirect: 'manual' });
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    if (Date.now() - started > timeoutMs) throw new Error(`server did not come up at ${baseUrl}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

function sanitizePrerenderedHtml(html, baseUrl) {
  // Vite's runtime preload helper injects <link rel="modulepreload"> tags
  // with ABSOLUTE urls of the render-time origin (this local server,
  // e.g. http://127.0.0.1:4182/assets/SurahReaderPage-*.js). Shipping those
  // would make every live page request chunks from a localhost server
  // (connection refused, console errors on every page). Drop ONLY the
  // injected preload links — the app's relative dynamic imports fetch the
  // same chunks from the live origin anyway. (Do NOT drop every
  // absolute-origin <link>: the canonical link's href is also absolute
  // at render time, and removing it would leave prerendered pages with
  // no canonical at all — found live 2026-11-19. The canonical survives
  // here and the baseUrl rewrite below makes it absolute on the live
  // origin; root-relative canonicals/og URLs fail validators — M-1 fix
  // 2026-11-19. The client also sets the absolute live URL at runtime.)
  const escaped = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = html.replace(
    new RegExp(`<link[^>]*rel="modulepreload"[^>]*href="${escaped}[^"]*"[^>]*>`, 'g'),
    '',
  );
  out = out.replace(
    new RegExp(`<link[^>]*href="${escaped}[^"]*"[^>]*rel="modulepreload"[^>]*>`, 'g'),
    '',
  );
  // M-1: rewrite the render-time origin to the LIVE origin instead of
  // stripping it — stripping left root-relative canonical / og:url /
  // og:image / twitter:image / BreadcrumbList URLs in all 185 files.
  out = out.split(baseUrl).join(SITE_ORIGIN);
  return out;
}

async function renderRoute(browser, baseUrl, routePath, opts, attempt) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    // Defensive: AdSense was removed from this site (2026-11-18) and GA4 is
    // not wired, so no third-party ad/analytics script should ever load.
    // Block them anyway so a stray tag can never pollute the snapshot or
    // fire real events during the prerender.
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (/googlesyndication\.com|doubleclick\.net|googleadservices\.com|googletagmanager\.com|google-analytics\.com/.test(u)) return route.abort();
      return route.continue();
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Never wait for networkidle: fonts and the Quran API can keep the
    // network busy behind the proxy. Instead wait for the app to be
    // actually rendered, then settle.
    try {
      await page.waitForFunction(
        ({ loadingTexts, needsAyah }) => {
          const root = document.getElementById('root');
          if (!root) return false;
          const main = document.querySelector('#root main');
          if (!main) return false;
          const text = main.innerText || '';
          if (text.length < 80) return false;
          const head = text.slice(0, 300);
          if (loadingTexts.some((t) => head.includes(t))) return false;
          // Verse pages: a rendered ayah (<article id="ayah-…">) must exist.
          // The VerseListSkeleton shows placeholder divs under the header
          // while verses load, which the text-length check alone would pass.
          if (needsAyah && !document.querySelector('article[id^="ayah-"]')) return false;
          return true;
        },
        { loadingTexts: LOADING_TEXTS, needsAyah: isVersePage(routePath) },
        { timeout: 60000 },
      );
    } catch {
      // Fall through and snapshot anyway; the run summary flags thin pages.
    }
    // --full-text (Scope B): scroll Surah/Juz pages to the bottom
    // repeatedly so the infinite scroll loads every chunk, then snapshot.
    // Default (Scope A) skips this — only the first ~15-ayah chunk is kept.
    if (opts.fullText && (routePath.startsWith('/surah/') || routePath.startsWith('/juz/'))) {
      for (let scroll = 0; scroll < 40; scroll += 1) {
        const grew = await page.evaluate(() => {
          const before = document.documentElement.scrollHeight;
          window.scrollTo(0, document.documentElement.scrollHeight);
          return before;
        });
        await page.waitForTimeout(900);
        const after = await page.evaluate(() => document.documentElement.scrollHeight);
        if (after <= grew) break;
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(900);
    const rawHtml = await page.evaluate(() => document.documentElement.outerHTML);
    const html = sanitizePrerenderedHtml(rawHtml, baseUrl);
    if (html.includes(baseUrl)) {
      throw new Error(`prerendered HTML still contains the preview origin ${baseUrl}`);
    }
    // URL-encoded form of the origin (e.g. inside a request URL):
    // encodeURIComponent(baseUrl) must not survive either — the sanitizer
    // only strips the raw form, so check the encoded form explicitly.
    if (html.includes(encodeURIComponent(baseUrl))) {
      throw new Error(`prerendered HTML still contains the URL-encoded preview origin ${encodeURIComponent(baseUrl)}`);
    }
    // Defensive: no third-party ad/analytics script tag may ship in a
    // snapshot (AdSense removed 2026-11-18, GA4 not wired).
    if (/<script[^>]*src="[^"]*(?:googlesyndication\.com|googletagmanager\.com|google-analytics\.com)/.test(html)) {
      throw new Error('prerendered HTML still contains a third-party script tag (adsbygoogle/gtag.js)');
    }
    const title = await page.evaluate(() => document.title);
    const h1 = await page.evaluate(() => {
      const el = document.querySelector('h1');
      return el ? el.textContent.trim().slice(0, 120) : '';
    });
    return { html, title, h1, errors, thin: !html.includes('<footer') || html.length < 8000 };
  } finally {
    await page.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const { chromium } = loadPlaywright();

  let routes = readRoutes();
  if (opts.routes) {
    const wanted = new Set(opts.routes.map((r) => (r.length > 1 ? r.replace(/\/+$/, '') : r)));
    routes = routes.filter((r) => wanted.has(r));
    const missing = [...wanted].filter((r) => !routes.includes(r));
    if (missing.length) console.warn(`[prerender] WARNING routes not in sitemap+extras, skipped: ${missing.join(', ')}`);
  }
  const toRender = routes.filter((r) => outPathFor(r) !== null);
  let renderList = toRender;
  if (opts.skipExisting) {
    renderList = toRender.filter((r) => {
      const outFile = outPathFor(r);
      try {
        return fs.statSync(outFile).size < 8000;
      } catch {
        return true;
      }
    });
    console.log(`[prerender] --skip-existing: ${toRender.length - renderList.length} already rendered, ${renderList.length} remaining`);
  }
  // --limit applies after --skip-existing so it counts remaining work.
  if (opts.limit > 0) renderList = renderList.slice(0, opts.limit);
  console.log(`[prerender] ${renderList.length} routes to render (home '/' -> public/__home__/index.html), concurrency ${opts.concurrency}${opts.fullText ? ', --full-text ON' : ', Scope A (first chunk only)'}`);
  if (renderList.length === 0) {
    console.log('[prerender] nothing to render — exiting without building.');
    process.exit(0);
  }

  // --preview-url: render against an already-running origin server instead
  // of building + starting the Express server. Needed when the server is
  // already up (e.g. a dev server on another port). Example:
  //   NODE_ENV=production PORT=4182 npx tsx server.ts
  //   node scripts/prerender.cjs --preview-url http://127.0.0.1:4182
  const baseUrl = opts.previewUrl || `http://127.0.0.1:${opts.port}`;
  let server = null;
  if (opts.previewUrl) {
    console.log(`[prerender] using external server at ${baseUrl} (skipping build 1/2 + Express server)`);
    if (!distIsCurrent()) {
      console.warn('[prerender] WARNING dist/ does not look current (newest asset older than src/main.tsx) — rendering against a stale build; run `npm run build` first when the EPERM wave passes');
    }
    // The external server may itself serve stale prerendered HTML from
    // its dist/ (see removeStalePrerenderedFromDist) — nothing this
    // script can do about that; start the server from a clean dist/.
    console.warn('[prerender] WARNING --preview-url: make sure the external server was started from a dist/ WITHOUT stale prerendered route files, or this run will re-snapshot stale HTML.');
  } else {
    console.log('[prerender] build 1/2: vite build');
    try {
      viteBuild();
    } catch (e) {
      // Vite's config load intermittently fails with EPERM writing its
      // bundled-config temp file (node_modules/.vite-temp) when the shared VM
      // is under load from parallel workers. If dist/ is already built from
      // the current sources, the server can serve it as-is — do not abort
      // a long render run for a redundant rebuild.
      if (distIsCurrent()) {
        console.warn('[prerender] WARNING build 1/2 failed (EPERM wave?) but dist/ is current — continuing with the existing dist/');
      } else {
        throw e;
      }
    }

    // Remove stale prerendered HTML from dist/ BEFORE starting the
    // server (see removeStalePrerenderedFromDist) — otherwise
    // express.static() serves the previous run's snapshots and the
    // render silently re-snapshots stale content.
    const staleRemoved = removeStalePrerenderedFromDist();
    console.log(`[prerender] removed ${staleRemoved} stale prerendered file(s) from dist/`);

    console.log(`[prerender] starting Express server (production mode) on port ${opts.port}`);
    server = spawn(
      process.execPath,
      [tsxBin(), 'server.ts'],
      {
        cwd: REPO_ROOT,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production', PORT: String(opts.port) },
      },
    );
    server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
    server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  }
  try {
    await waitForServer(baseUrl);
    console.log(`[prerender] server up at ${baseUrl}`);

    // Batches of BATCH_SIZE routes per fresh browser: a single Chromium
    // instance accumulates memory over hundreds of heavy pages and dies
    // mid-run (observed at route ~300 with /dev/shm exhaustion). A dead
    // browser fails its whole batch fast; those routes are retried in the
    // next pass with a fresh browser instead of aborting the run.
    const results = [];
    let failures = [];
    let totalBytes = 0;
    let done = 0;
    const renderOne = async (browser, baseUrl, routePath) => {
      const outFile = outPathFor(routePath);
      const routeStarted = Date.now();
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const { html, title, h1, errors, thin } = await renderRoute(browser, baseUrl, routePath, opts, attempt);
          if (!title) throw new Error('empty document.title after render');
          if (!h1) throw new Error('no <h1> after render');
          const doc = `<!doctype html>\n${html}\n`;
          fs.mkdirSync(path.dirname(outFile), { recursive: true });
          fs.writeFileSync(outFile, doc, 'utf8');
          // Verify the write: this VM's overlay filesystem intermittently
          // fails writes with EPERM or silently truncates files to 0 bytes
          // under load (observed 2026-11-14 ~16:44-17:05). A truncated file
          // must fail the route (and be retried) rather than ship empty.
          const written = fs.statSync(outFile).size;
          if (written !== Buffer.byteLength(doc)) {
            throw new Error(`write verification failed for ${outFile}: wrote ${written} of ${Buffer.byteLength(doc)} bytes`);
          }
          totalBytes += Buffer.byteLength(doc);
          if (thin) console.warn(`[prerender] WARNING thin HTML for ${routePath} (${doc.length} bytes)`);
          if (errors.length) console.warn(`[prerender] WARNING pageerrors on ${routePath}: ${errors.slice(0, 2).join(' | ')}`);
          const routeSecs = ((Date.now() - routeStarted) / 1000).toFixed(1);
          if (Number(routeSecs) > 15) console.log(`[prerender] slow route ${routePath}: ${routeSecs}s`);
          results.push({ routePath, title, h1, bytes: Buffer.byteLength(doc) });
          return null;
        } catch (e) {
          const msg = String((e && e.message) || e).slice(0, 300);
          if (attempt === 2) return { routePath, error: msg };
          console.warn(`[prerender] retry ${routePath} after: ${msg.slice(0, 160)}`);
        }
      }
      return null;
    };
    let remaining = [...renderList];
    // A browser launch can die under memory pressure (observed SIGTRAP at
    // the batch boundary with ~360 MB free on the shared VM) — retry the
    // launch instead of aborting the whole run; if all attempts fail, the
    // batch is recorded as failed and retried in the next pass.
    const launchBrowser = async () => {
      for (let a = 1; a <= 3; a += 1) {
        try {
          return await chromium.launch({ args: CHROMIUM_ARGS });
        } catch (e) {
          console.warn(`[prerender] browser launch attempt ${a}/3 failed: ${String((e && e.message) || e).slice(0, 140)}`);
          await sleep(10000);
        }
      }
      return null;
    };
    for (let pass = 1; pass <= 3 && remaining.length; pass += 1) {
      const passFailures = [];
      for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
        const batch = remaining.slice(i, i + BATCH_SIZE);
        const browser = await launchBrowser();
        if (!browser) {
          for (const routePath of batch) passFailures.push({ routePath, error: 'browser launch failed after 3 attempts' });
          done += batch.length;
          console.log(`[prerender] ${done}/${renderList.length} done, ${failures.length + passFailures.length} failed (launch failed, batch queued for next pass)`);
          continue;
        }
        try {
          const queue = [...batch];
          const workers = Array.from({ length: Math.min(opts.concurrency, queue.length) }, async () => {
            while (queue.length) {
              const routePath = queue.shift();
              const failure = await renderOne(browser, baseUrl, routePath);
              if (failure) passFailures.push(failure);
              done += 1;
              if (done % 50 === 0 || done === renderList.length) {
                console.log(`[prerender] ${done}/${renderList.length} done, ${failures.length + passFailures.length} failed`);
              }
            }
          });
          await Promise.all(workers);
        } finally {
          await browser.close().catch(() => {});
        }
      }
      failures = passFailures;
      remaining = passFailures.map((f) => f.routePath);
      if (remaining.length) console.log(`[prerender] pass ${pass} done, retrying ${remaining.length} failed routes with fresh browsers`);
    }
    const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(2);
    console.log(`[prerender] DONE in ${elapsedMin} min: ${results.length} rendered, ${failures.length} failed, total ${totalBytes} bytes (${(totalBytes / 1048576).toFixed(1)} MB) across ${results.length} files`);
    if (failures.length) {
      for (const f of failures) console.error(`[prerender] FAILED ${f.routePath}: ${f.error}`);
    }
    if (failures.length) process.exitCode = 1;
    return { failures, results };
  } finally {
    if (server) {
      if (!opts.keepPreview) {
        server.kill('SIGTERM');
      } else {
        console.log(`[prerender] server kept running on port ${opts.port} (pid ${server.pid})`);
      }
    }
  }
}

main()
  .then(async ({ failures }) => {
    if (failures && failures.length) {
      console.error('[prerender] finished WITH FAILURES — not rebuilding; fix the failures and re-run.');
      // Set exitCode and return instead of process.exit(): process.exit()
      // truncates stdout buffered to a redirected file, losing the log.
      process.exitCode = 1;
      return;
    }
    const opts = parseArgs(process.argv.slice(2));
    if (opts.rebuild) {
      console.log('[prerender] build 2/2: vite build (copies prerendered files into dist/)');
      try {
        viteBuild();
      } catch (e) {
        // Same EPERM wave as build 1/2. Build 2/2 only copies public/
        // verbatim into dist/ (the JS bundles are already current from
        // build 1/2), so a plain recursive copy reaches the identical
        // end state without Vite.
        console.warn('[prerender] WARNING build 2/2 failed — copying public/ into dist/ directly instead');
        fs.cpSync(path.join(REPO_ROOT, 'public'), path.join(REPO_ROOT, 'dist'), { recursive: true });
        console.log('[prerender] public/ copied into dist/ (fallback for failed build 2/2)');
      }
      console.log('[prerender] all done. Verify with: python3 -m http.server --directory dist <port>  (plain static server, no SPA fallback)');
    } else {
      console.log('[prerender] --no-rebuild: run `npm run build` yourself so dist/ picks up the new files.');
    }
    // No process.exit(0) here — see the comment above about truncated
    // redirected stdout; the process exits naturally once the loop drains.
  })
  .catch((e) => {
    console.error('[prerender] FATAL', e);
    // exitCode, not process.exit(): see the comment above — process.exit()
    // truncates stdout buffered to a redirected file.
    process.exitCode = 1;
  });
