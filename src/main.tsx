import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
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
const rootEl = document.getElementById('root')!;
if (rootEl.children.length > 0) {
  hydrateRoot(rootEl, <App />);
} else {
  createRoot(rootEl).render(<App />);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    // Registration can fail in unsupported or restricted preview frames;
    // warn so a broken offline/push setup is visible instead of silent.
    console.warn('Service worker registration failed:', error);
  });
}
