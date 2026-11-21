import { createRoot, hydrateRoot } from 'react-dom/client';
import App, { preloadRouteForPath } from './App.tsx';
import './index.css';

// H-1 (final audit): the site ships prerendered HTML (186 routes), but
// createRoot DISCARDED it on every load — React re-rendered from scratch
// (doc height 4,700 → 1,090 → 4,700 px across hydration; CLS 0.38–1.62).
// Hydrate instead, so the prerendered DOM is kept and only event
// listeners + effects attach.
//
// The prerendered HTML is only present on prerendered routes. The SPA
// shell (non-prerendered routes such as /search, /bookmarks, and the
// 404 page) serves an EMPTY #root, so hydrate there: when #root has no
// children, fall back to createRoot (hydrating an empty container would
// only log a recoverable-error warning and client-render anyway).
//
// Hydration only matches when the first client render reproduces the
// prerendered DOM. The data-driven pages seed their first render from
// the embedded prerender data (src/utils/prerenderData.ts), stored
// settings are gated behind mount (ReaderContext), and time-derived
// text carries suppressHydrationWarning (Header pill, Footer year).
//
// H-1 (iteration 2): the route chunk must ALSO be in memory before
// hydrateRoot runs. Every route is React.lazy behind one <Suspense>;
// a plain awaited import is NOT enough, because React.lazy suspends on
// first render even for an already-fetched chunk (its .then callbacks
// are microtasks — see src/utils/lazyRoute.ts). preloadRouteForPath
// loads the current route's chunk AND makes its lazy factory resolve
// synchronously from the loaded module, so the first render is the
// resolved page, not the "Loading..." fallback (which mismatches the
// snapshot → React error 418 → the page is discarded and
// client-rendered). If the preload fails (offline / bad chunk),
// hydrate anyway — the lazy import retries and the app still works.
const rootEl = document.getElementById('root')!;
if (rootEl.children.length > 0) {
  preloadRouteForPath(window.location.pathname)
    .catch(() => undefined)
    .then(() => {
      hydrateRoot(rootEl, <App />);
    });
} else {
  // SPA shell (no prerendered HTML: /search, /bookmarks, 404): preload
  // the current route's chunk BEFORE the first render, exactly like the
  // hydration path above. Without this, the first paint is the 148px
  // "Loading..." Suspense fallback and the footer jumps when the real
  // page renders — /search mobile CLS 0.29 (footer shift 0.28), /search
  // with a query up to 0.58, /bookmarks 0.42. The route chunk is small
  // (SearchPage ~3 KB + shared deps), so the first paint waits only
  // for that fetch; if the preload fails, render anyway and the lazy
  // import retries, exactly as the hydration path does.
  // Search CLS fix (2026-11-21).
  preloadRouteForPath(window.location.pathname)
    .catch(() => undefined)
    .then(() => {
      createRoot(rootEl).render(<App />);
    });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    // Registration can fail in unsupported or restricted preview frames;
    // warn so a broken offline/push setup is visible instead of silent.
    console.warn('Service worker registration failed:', error);
  });
}
