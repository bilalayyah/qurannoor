# Offline support (audit L-3)

Implemented in `public/sw.js` — the service worker was previously push-only
(50 lines, push + notificationclick handlers, no fetch/cache handling). The
PWA already installed (manifest correct) but offered no offline reading.

## Caching strategies

| Resource | Strategy | Why |
|---|---|---|
| HTML navigations (`/` and every route) | Network-first, fall back to cached shell | A cached-first shell would serve stale HTML pointing at bundle hashes that no longer exist after a deploy. Offline, the cached `/` shell boots the SPA from cached JS. |
| Hashed Vite assets (`/assets/*`) + icons/manifest/favicon | Cache-first | Content-hashed filenames: a new bundle has a new URL, so a stale entry can never collide. |
| Search index (`/quran-search-index.json`, ~3.6 MB) | Cache-first | Large static file; a version bump replaces it. Cached on first fetch while online. |
| API GETs (`/api/*`) | Stale-while-revalidate | Cached response served immediately (works offline), refreshed in the background when online. |

## Never cached

- `/api/push/*` — including the VAPID key endpoint (`no-store` server-side;
  must always go to the network). The fetch handler returns early for these.
- Any non-GET request (no POST caching).
- Any user data — no bookmarks, reading progress, push subscription data, or
  personal data is ever written to a cache (those stay in localStorage).
- Cross-origin requests (Google Fonts, audio/CDN hosts, Quran Foundation) —
  the worker only handles same-origin requests.

## Versioning

- Cache names are `qurannoor-v1-static` and `qurannoor-v1-api`, built from the
  `CACHE_VERSION` constant at the top of `sw.js`. Bump it (e.g. `v1` → `v2`)
  whenever the caching logic or a cached asset's shape changes. A new deploy
  does **not** need a bump for JS/CSS: hashed URLs change by themselves and
  HTML is network-first.
- On `activate`, every cache whose name does not start with the current
  version is deleted, and the worker calls `clients.claim()` so it takes
  control of open pages immediately (`skipWaiting()` in `install`).

## Robustness

- Every cache operation is wrapped so a failure falls through to the network;
  a cache error can never break the page. Push handlers are unchanged and
  independent of the fetch handler.

## Verification status

- `node --check public/sw.js` passes (syntax only).
- No live runtime test was done here (no build, no deploy per the task rules).
  The coordinator should verify after deploy: load the site, go offline, and
  confirm a Surah page renders from cache; confirm a new deploy is picked up
  (no stale shell); confirm push notifications still arrive.
