/**
 * QuranNoor service worker — push notifications + offline reading (audit L-3).
 *
 * WHAT IT CACHES
 * - App shell / HTML navigations: NETWORK-FIRST (never cache-first for HTML).
 *   A new deploy ships a new JS bundle hash; serving a stale cached shell
 *   would point at bundle URLs that no longer exist. Network-first picks up
 *   the fresh shell when online and falls back to the cached shell offline.
 * - Hashed static assets (`/assets/*`, icons, manifest, favicon):
 *   CACHE-FIRST. Vite emits content-hashed filenames, so a new bundle has a
 *   new URL and can never collide with a stale cached entry.
 * - Search index (`/quran-search-index.json`, ~3.6 MB): CACHE-FIRST.
 *   It is a large static file; the versioned cache name (below) means a new
 *   index version replaces it.
 * - API GETs (`/api/*`): STALE-WHILE-REVALIDATE. Serve the cached response
 *   immediately (so the app works offline), then refresh in the background.
 *
 * WHAT IT NEVER CACHES
 * - `/api/push/vapid-key` and every `/api/push/*` endpoint (the VAPID key
 *   endpoint is `no-store` server-side and must always go to the network).
 * - POST requests and any non-GET request.
 * - Any user data: no bookmarks, reading progress, push subscription data,
 *   or personal data is ever written to a cache (the app keeps those in
 *   localStorage, untouched by this worker).
 * - Cross-origin requests (Google Fonts, audio/CDN hosts, Quran Foundation):
 *   left to the network; the worker only handles same-origin requests.
 *
 * VERSIONING
 * - The SW file itself is static (`public/sw.js`), so the version comes from
 *   the `CACHE_VERSION` constant below, bumped deliberately whenever the
 *   caching logic or a cached asset's shape changes (e.g. `qurannoor-v1` ->
 *   `qurannoor-v2`). A new deploy does NOT need a version bump for JS/CSS:
 *   hashed asset URLs change by themselves, and HTML is network-first.
 * - On `activate`, every cache whose name does not start with the current
 *   `CACHE_VERSION` is deleted, and the new worker takes control of all
 *   open clients (`clients.claim()`), so a deploy never serves stale bundles.
 *
 * ROBUSTNESS
 * - Every cache operation is wrapped so a failure falls through to the
 *   network; a cache error must never break the page. The push handlers
 *   below are unchanged and independent of the fetch handler.
 */

const CACHE_VERSION = 'qurannoor-v1';
const CACHE_STATIC = `${CACHE_VERSION}-static`; // shell, hashed assets, search index
const CACHE_API = `${CACHE_VERSION}-api`; // stale-while-revalidate API GETs

const SEARCH_INDEX_PATH = '/quran-search-index.json';

// ---------------------------------------------------------------------------
// Push notifications (pre-existing — unchanged)
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      try {
        payload = { body: event.data.text() };
      } catch {
        payload = {};
      }
    }
  }

  const title = payload.title || 'QuranNoor';
  const body = payload.body || 'Your daily Quran reminder — read a few ayahs today';
  const targetUrl = payload.url || '/';

  const options = {
    body,
    icon: '/icon-app.svg',
    badge: '/icon-app.svg',
    tag: payload.tag || 'daily-reminder',
    renotify: true,
    data: { url: targetUrl },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

// ---------------------------------------------------------------------------
// Lifecycle: activate promptly, drop caches from older versions, take control
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  // Activate the new worker as soon as it is installed, instead of waiting
  // for all tabs to close. Old caches are deleted in `activate` below.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => !name.startsWith(CACHE_VERSION))
            .map((name) => caches.delete(name).catch(() => false))
        );
      } catch {
        // Cache cleanup failing must not block activation.
      }
      // Take control of open pages so the new worker serves them immediately.
      await self.clients.claim().catch(() => undefined);
    })()
  );
});

// ---------------------------------------------------------------------------
// Fetch / cache handling
// ---------------------------------------------------------------------------

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

/** Never cache anything under /api/push/* (includes the VAPID key endpoint). */
function isPushEndpoint(pathname) {
  return pathname === '/api/push' || pathname.startsWith('/api/push/');
}

/** Hashed Vite output + unversioned public static files. Safe for cache-first. */
function isStaticAsset(pathname) {
  if (pathname.startsWith('/assets/')) return true;
  return (
    pathname === '/favicon.svg' ||
    pathname === '/icon-app.svg' ||
    pathname === '/icon-social.svg' ||
    pathname === '/site.webmanifest' ||
    pathname.startsWith('/icons/')
  );
}

/** Cache-first: serve from cache, fetch + store on a miss. Failures -> network. */
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      // Store a clone; a failed put must not break the response.
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return fetch(request);
  }
}

/** Network-first (HTML): fresh shell when online, cached shell when offline. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      try {
        const cache = await caches.open(CACHE_STATIC);
        cache.put(request, response.clone()).catch(() => undefined);
      } catch {
        // Storing the shell failing must not break the response.
      }
    }
    return response;
  } catch {
    // Offline: fall back to the cached copy of this exact URL (query string
    // included — a cached page must never be served for a different query),
    // then to the shell.
    try {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(request);
      if (cached) return cached;
      const shell = await cache.match('/');
      if (shell) return shell;
    } catch {
      // Fall through to the network error below.
    }
    return fetch(request);
  }
}

/** Stale-while-revalidate (API GETs): cached now, refreshed in the background. */
async function staleWhileRevalidate(request, event) {
  try {
    const cache = await caches.open(CACHE_API);
    const cached = await cache.match(request, { ignoreSearch: false });
    const networkPromise = fetch(request)
      .then((response) => {
        if (response && response.ok) {
          cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      })
      .catch(() => undefined);
    if (cached) {
      // Refresh in the background; the user gets the cached answer now.
      event.waitUntil(networkPromise);
      return cached;
    }
    const response = await networkPromise;
    if (response) return response;
    // Offline with nothing cached: let the page's own API-error UI handle it.
    return fetch(request);
  } catch {
    return fetch(request);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only GET, only same-origin. Everything else goes straight to the network.
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!isSameOrigin(url)) return;

  const pathname = url.pathname;

  // Never intercept push endpoints (VAPID key, subscribe, unsubscribe).
  if (isPushEndpoint(pathname)) return;

  // Navigations / HTML: network-first so a new deploy is picked up.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Search index: cache-first (large static file, replaced via version bump).
  if (pathname === SEARCH_INDEX_PATH) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // API GETs: stale-while-revalidate.
  if (pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  // Hashed static assets + public static files: cache-first.
  if (isStaticAsset(pathname)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Anything else (e.g. robots.txt, sitemap.xml, ads.txt): network only.
});
