// Pages Functions middleware — audit M-2 (true HTTP 404s) + M-4 (301 normalisation).
//
// - Lowercases the path and strips trailing slashes (except root) with a single 301.
// - Returns a real HTTP 404 status for unmatched routes and invalid slugs, serving
//   the SPA shell body (via context.next(), which already serves index.html for
//   unmatched paths) so the client-side NotFoundPage UI still renders.
// - Valid routes, /api/*, and static assets pass through untouched (status preserved).
// - Also applies the H-2 security headers to every response, including /api/*
//   Function responses (public/_headers does not reliably cover Functions).
// - Serves prerendered HTML (public/<path>/index.html) directly via
//   env.ASSETS for valid canonical routes. Pages would otherwise 308-redirect
//   the no-slash URL to the slash URL for a directory index, which loops
//   against the M-4 slash-strip 301 above (loop found live 2026-11-19:
//   /surah/al-baqarah <-> /surah/al-baqarah/). Routes without a prerendered
//   file (user pages) fall through to the SPA shell. The home route '/' is
//   served the same way from public/__home__/index.html (Cache-Control:
//   public, max-age=1800, must-revalidate); /__home__/ itself 301s to '/'.
// - L-1: numeric chapter ids and non-canonical alias slugs 301 to the
//   canonical slug (/surah/2 -> /surah/al-baqarah). L-2: /qibla, /privacy,
//   /terms 301 to their canonical pages. L-3: /search and /bookmarks get
//   X-Robots-Tag: noindex + Cache-Control: no-store.
//
// Valid slugs are embedded statically (derived 2026-11-18 from the route
// definitions in src/App.tsx, the 186 sitemap URLs in public/sitemap.xml, the
// slug aliases in src/utils/slugs.ts, and verse counts in
// server/chaptersCatalog.json). The client also resolves numeric chapter ids
// (/surah/2) and alias slugs (/surah/fatihah, /surah/yaseen, ...), but those
// are 301-redirected to the canonical slug below (L-1) instead of being
// served — 404ing them would break working client routes, serving them
// would duplicate content.
// /qibla, /privacy and /terms 301 to their canonical pages (L-2); they
// remain in EXACT_ROUTES only as a fallback.

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://verses.quran.foundation; img-src 'self' data: blob:; media-src 'self' https://verses.quran.com https://verses.quran.foundation https://download.quranicaudio.com https://mirrors.quranicaudio.com; connect-src 'self' https://api.quran.com https://apis.quran.foundation https://apis-prelive.quran.foundation https://oauth2.quran.foundation https://prelive-oauth2.quran.foundation https://verses.quran.foundation https://verses.quran.com https://api.aladhan.com https://api.bigdatacloud.net https://nominatim.openstreetmap.org https://ipapi.co https://ipwho.is https://get.geojs.io https://formsubmit.co; worker-src 'self'; manifest-src 'self'; form-action 'self' https://formsubmit.co; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
};

// Verse counts per chapter id (1..114), from server/chaptersCatalog.json.
const SURAH_VERSE_COUNTS: number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73,
  54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60,
  49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19,
  26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3,
  6, 3, 5, 4, 5, 6,
];

// Canonical surah slugs (from the sitemap) + every alias the client resolves
// (src/utils/slugs.ts SLUG_ALIASES), mapped to chapter id.
const SURAH_SLUG_TO_ID: Record<string, number> = {
  'abasa': 80, 'ad-duhaa': 93, 'ad-dukhan': 44, 'adh-dhariyat': 51, 'adiyat': 100,
  'ahqaf': 46, 'ahzab': 33, 'al-adiyat': 100, 'al-ahqaf': 46, 'al-ahzab': 33,
  'al-ala': 87, 'al-alaq': 96, 'al-anam': 6, 'al-anbiya': 21, 'al-anbya': 21,
  'al-anfal': 8, 'al-ankabut': 29, 'al-araf': 7, 'al-asr': 103, 'al-balad': 90,
  'al-baqara': 2, 'al-baqarah': 2, 'al-bayyinah': 98, 'al-buruj': 85, 'al-fajr': 89,
  'al-falaq': 113, 'al-fath': 48, 'al-fatiha': 1, 'al-fatihah': 1, 'al-fil': 105,
  'al-furqan': 25, 'al-ghashiyah': 88, 'al-hadid': 57, 'al-hajj': 22, 'al-haqqah': 69,
  'al-hashr': 59, 'al-hijr': 15, 'al-hujurat': 49, 'al-humazah': 104, 'al-ikhlas': 112,
  'al-imran': 3, 'al-infitar': 82, 'al-insan': 76, 'al-inshiqaq': 84, 'al-isra': 17,
  'al-jathiyah': 45, 'al-jinn': 72, 'al-jumuah': 62, 'al-kafirun': 109, 'al-kahf': 18,
  'al-kawthar': 108, 'al-layl': 92, 'al-maarij': 70, 'al-maidah': 5, 'al-masad': 111,
  'al-maun': 107, 'al-muddaththir': 74, 'al-mujadila': 58, 'al-mulk': 67,
  'al-muminun': 23, 'al-mumtahanah': 60, 'al-munafiqun': 63, 'al-mursalat': 77,
  'al-mutaffifin': 83, 'al-muzzammil': 73, 'al-qadr': 97, 'al-qalam': 68,
  'al-qamar': 54, 'al-qariah': 101, 'al-qasas': 28, 'al-qiyamah': 75, 'al-waqiah': 56,
  'ala': 87, 'alaq': 96, 'ali-imran': 3, 'an-naba': 78, 'an-nahl': 16,
  'an-najm': 53, 'an-naml': 27, 'an-nas': 114, 'an-nasr': 110, 'an-naziat': 79,
  'an-nisa': 4, 'an-nur': 24, 'anam': 6, 'anbiya': 21, 'anfal': 8, 'ankabut': 29,
  'ar-rad': 13, 'ar-rahman': 55, 'ar-rum': 30, 'araf': 7, 'as-saf': 61,
  'as-saffat': 37, 'as-sajdah': 32, 'ash-shams': 91, 'ash-sharh': 94,
  'ash-shuara': 26, 'ash-shuraa': 42, 'asr': 103, 'at-taghabun': 64, 'at-tahrim': 66,
  'at-takathur': 102, 'at-takwir': 81, 'at-talaq': 65, 'at-tariq': 86,
  'at-tawbah': 9, 'at-tin': 95, 'at-tur': 52, 'az-zalzalah': 99, 'az-zukhruf': 43,
  'az-zumar': 39, 'balad': 90, 'baqarah': 2, 'bayyinah': 98, 'buruj': 85,
  'dhariyat': 51, 'duha': 93, 'dukhan': 44, 'fajr': 89, 'falaq': 113, 'fath': 48,
  'fatihah': 1, 'fatir': 35, 'fil': 105, 'furqan': 25, 'fussilat': 41, 'ghafir': 40,
  'ghashiyah': 88, 'hadid': 57, 'hajj': 22, 'haqqah': 69, 'hashr': 59, 'hijr': 15,
  'hud': 11, 'hujurat': 49, 'humazah': 104, 'ibrahim': 14, 'ikhlas': 112,
  'infitar': 82, 'insan': 76, 'inshiqaq': 84, 'isra': 17, 'jathiyah': 45,
  'jinn': 72, 'jumuah': 62, 'kafirun': 109, 'kahf': 18, 'kawthar': 108, 'layl': 92,
  'luqman': 31, 'maarij': 70, 'maidah': 5, 'maryam': 19, 'masad': 111,
  'maun': 107, 'muddaththir': 74, 'muhammad': 47, 'mujadila': 58, 'mulk': 67,
  'muminun': 23, 'mumtahanah': 60, 'munafiqun': 63, 'mursalat': 77,
  'mutaffifin': 83, 'muzzammil': 73, 'naba': 78, 'nahl': 16, 'najm': 53,
  'naml': 27, 'nas': 114, 'nasr': 110, 'naziat': 79, 'nisa': 4, 'nuh': 71,
  'nur': 24, 'qadr': 97, 'qaf': 50, 'qalam': 68, 'qamar': 54, 'qariah': 101,
  'qasas': 28, 'qiyamah': 75, 'quraysh': 106, 'rad': 13, 'rahman': 55, 'rum': 30,
  'saba': 34, 'sad': 38, 'saff': 61, 'saffat': 37, 'sajdah': 32, 'shams': 91,
  'sharh': 94, 'shuara': 26, 'shura': 42, 'surah-yaseen': 36, 'taghabun': 64,
  'taha': 20, 'tahrim': 66, 'takathur': 102, 'takwir': 81, 'talaq': 65,
  'tariq': 86, 'tawbah': 9, 'tin': 95, 'tur': 52, 'waqiah': 56, 'ya-sin': 36,
  'yaseen': 36, 'yasin': 36, 'yunus': 10, 'yusuf': 12, 'zalzalah': 99,
  'zukhruf': 43, 'zumar': 39,
};

// Canonical slug per chapter id (1..114), inverted from SURAH_SLUG_TO_ID
// using the 114 canonical slugs in public/sitemap.xml (verified 2026-11-19:
// every sitemap slug is in the map, ids 1..114 covered exactly once).
// L-1 redirects numeric ids and alias slugs to these.
const SURAH_ID_TO_CANONICAL_SLUG: Record<number, string> = {
  1: 'al-fatihah', 2: 'al-baqarah', 3: 'ali-imran', 4: 'an-nisa',
  5: 'al-maidah', 6: 'al-anam', 7: 'al-araf', 8: 'al-anfal',
  9: 'at-tawbah', 10: 'yunus', 11: 'hud', 12: 'yusuf',
  13: 'ar-rad', 14: 'ibrahim', 15: 'al-hijr', 16: 'an-nahl',
  17: 'al-isra', 18: 'al-kahf', 19: 'maryam', 20: 'taha',
  21: 'al-anbya', 22: 'al-hajj', 23: 'al-muminun', 24: 'an-nur',
  25: 'al-furqan', 26: 'ash-shuara', 27: 'an-naml', 28: 'al-qasas',
  29: 'al-ankabut', 30: 'ar-rum', 31: 'luqman', 32: 'as-sajdah',
  33: 'al-ahzab', 34: 'saba', 35: 'fatir', 36: 'ya-sin',
  37: 'as-saffat', 38: 'sad', 39: 'az-zumar', 40: 'ghafir',
  41: 'fussilat', 42: 'ash-shuraa', 43: 'az-zukhruf', 44: 'ad-dukhan',
  45: 'al-jathiyah', 46: 'al-ahqaf', 47: 'muhammad', 48: 'al-fath',
  49: 'al-hujurat', 50: 'qaf', 51: 'adh-dhariyat', 52: 'at-tur',
  53: 'an-najm', 54: 'al-qamar', 55: 'ar-rahman', 56: 'al-waqiah',
  57: 'al-hadid', 58: 'al-mujadila', 59: 'al-hashr', 60: 'al-mumtahanah',
  61: 'as-saf', 62: 'al-jumuah', 63: 'al-munafiqun', 64: 'at-taghabun',
  65: 'at-talaq', 66: 'at-tahrim', 67: 'al-mulk', 68: 'al-qalam',
  69: 'al-haqqah', 70: 'al-maarij', 71: 'nuh', 72: 'al-jinn',
  73: 'al-muzzammil', 74: 'al-muddaththir', 75: 'al-qiyamah', 76: 'al-insan',
  77: 'al-mursalat', 78: 'an-naba', 79: 'an-naziat', 80: 'abasa',
  81: 'at-takwir', 82: 'al-infitar', 83: 'al-mutaffifin', 84: 'al-inshiqaq',
  85: 'al-buruj', 86: 'at-tariq', 87: 'al-ala', 88: 'al-ghashiyah',
  89: 'al-fajr', 90: 'al-balad', 91: 'ash-shams', 92: 'al-layl',
  93: 'ad-duhaa', 94: 'ash-sharh', 95: 'at-tin', 96: 'al-alaq',
  97: 'al-qadr', 98: 'al-bayyinah', 99: 'az-zalzalah', 100: 'al-adiyat',
  101: 'al-qariah', 102: 'at-takathur', 103: 'al-asr', 104: 'al-humazah',
  105: 'al-fil', 106: 'quraysh', 107: 'al-maun', 108: 'al-kawthar',
  109: 'al-kafirun', 110: 'an-nasr', 111: 'al-masad', 112: 'al-ikhlas',
  113: 'al-falaq', 114: 'an-nas',
};

// Legacy short paths (L-2) and their canonical targets.
const LEGACY_REDIRECTS: Record<string, string> = {
  '/qibla': '/prayer-times',
  '/privacy': '/privacy-policy',
  '/terms': '/terms-and-conditions',
};

const GUIDE_SLUGS = new Set([
  'how-to-read-the-quran-daily', 'understanding-tajweed-rules',
  'how-to-memorize-the-quran-hifz', 'what-is-tafsir', 'the-30-juz-explained',
  'how-to-choose-a-qari-recitation-styles', 'reading-quran-in-ramadan',
  'surah-al-baqarah-themes-lessons', 'last-10-surahs-short-surahs-daily-prayer',
  'how-to-find-qibla-direction', 'prayer-times-explained-calculation-methods',
  'quran-translations-how-to-choose', 'word-by-word-translation-learn-arabic',
  'benefits-of-listening-to-quran-recitation', 'daily-quran-habit-10-minutes',
  'surah-al-fatiha-explained-verse-by-verse', 'makki-madani-surahs-explained',
  'how-to-teach-children-the-quran', 'common-mistakes-reading-quran',
]);

// All sections the client renders at /popular/:slug (src/utils/slugs.ts
// POPULAR_SECTIONS). Only two are in the sitemap; the rest are real routes too.
const POPULAR_SLUGS = new Set([
  'ayatul-kursi', 'yaseen', 'al-mulk', 'al-kahf', 'ar-rahman', 'al-waqiah',
  'al-ikhlas', 'al-falaq', 'an-nas', 'last-two-ayahs-al-baqarah',
]);

const EXACT_ROUTES = new Set([
  '/', '/quran', '/surahs', '/juz', '/listen', '/search', '/bookmarks',
  '/prayer-times', '/qibla', '/guides', '/about', '/contact', '/privacy-policy',
  '/terms-and-conditions', '/disclaimer', '/cookie-policy', '/copyright',
  '/accessibility', '/quran-text-and-translation-methodology', '/brand',
  '/privacy', '/terms',
]);

function resolveSurahId(param: string): number | null {
  if (/^\d+$/.test(param)) {
    const id = Number(param);
    return id >= 1 && id <= 114 ? id : null;
  }
  return SURAH_SLUG_TO_ID[param] ?? null;
}

function isValidAyahNumber(chapterId: number, raw: string): boolean {
  if (!/^\d+$/.test(raw)) return false;
  const n = Number(raw);
  return n >= 1 && n <= SURAH_VERSE_COUNTS[chapterId - 1];
}

function isValidRoute(path: string): boolean {
  if (EXACT_ROUTES.has(path)) return true;
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return true;
  const [first, second, third] = parts;
  if (first === 'surah' && parts.length <= 3 && second) {
    const id = resolveSurahId(second);
    if (id === null) return false;
    if (parts.length === 2) return true;
    return isValidAyahNumber(id, third);
  }
  if (first === 'ayah' && parts.length === 3 && second) {
    const id = resolveSurahId(second);
    return id !== null && isValidAyahNumber(id, third);
  }
  if (first === 'juz' && parts.length === 2) {
    return /^\d+$/.test(second) && Number(second) >= 1 && Number(second) <= 30;
  }
  if (first === 'popular' && parts.length === 2) return POPULAR_SLUGS.has(second);
  if (first === 'guides' && parts.length === 2) return GUIDE_SLUGS.has(second);
  return false;
}

function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function redirect301(target: string): Response {
  const headers = new Headers();
  headers.set('Location', target);
  headers.set('Cache-Control', 'public, max-age=86400');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(null, { status: 301, headers });
}

function isStaticAsset(path: string): boolean {
  return (
    path.startsWith('/assets/') ||
    path.startsWith('/icons/') ||
    /\.[a-z0-9]+$/i.test(path)
  );
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: { ASSETS: { fetch: (req: Request) => Promise<Response> } };
}): Promise<Response> {
  const { request } = context;
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Never normalise or 404 API routes or static assets.
    if (path.startsWith('/api/') || isStaticAsset(path)) {
      return withSecurityHeaders(await context.next());
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      // H-1: the raw home-prerender path is never a public URL.
      if (path === '/__home__' || path === '/__home__/') {
        return redirect301(`/${url.search}`);
      }

      // M-4: lowercase + strip trailing slash (except root), one 301.
      const normalized =
        path.length > 1 ? path.toLowerCase().replace(/\/+$/, '') : path;
      if (normalized !== path) {
        const headers = new Headers();
        headers.set('Location', `${normalized}${url.search}`);
        headers.set('Cache-Control', 'public, max-age=86400');
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
        return new Response(null, { status: 301, headers });
      }

      // L-2: legacy short paths 301 to their canonical pages.
      if (LEGACY_REDIRECTS[path]) {
        return redirect301(`${LEGACY_REDIRECTS[path]}${url.search}`);
      }

      // L-1: numeric chapter ids and non-canonical alias slugs 301 to the
      // canonical slug, preserving an ayah segment (/surah/2/255 ->
      // /surah/al-baqarah/255, /surah/baqarah -> /surah/al-baqarah).
      {
        const parts = path.split('/').filter(Boolean);
        if (parts[0] === 'surah' && parts.length >= 2 && parts.length <= 3) {
          const id = resolveSurahId(parts[1]);
          if (id !== null) {
            const canonical = SURAH_ID_TO_CANONICAL_SLUG[id];
            if (parts[1] !== canonical) {
              const target = `/surah/${canonical}${parts[2] ? `/${parts[2]}` : ''}${url.search}`;
              return redirect301(target);
            }
          }
        }
      }

      // M-2: unmatched route / invalid slug -> true 404, SPA shell body.
      if (!isValidRoute(path)) {
        const shell = await context.next();
        const headers = new Headers(shell.headers);
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
          if (!headers.has(k)) headers.set(k, v);
        }
        headers.set('X-Robots-Tag', 'noindex');
        headers.set('Cache-Control', 'no-store');
        return new Response(shell.body, { status: 404, headers });
      }

      // L-3: /search and /bookmarks are user pages, not content — keep
      // them out of the index (client-side meta alone is not enough).
      if (path === '/search' || path === '/bookmarks') {
        const shell = await context.next();
        const headers = new Headers(shell.headers);
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
          if (!headers.has(k)) headers.set(k, v);
        }
        headers.set('X-Robots-Tag', 'noindex');
        headers.set('Cache-Control', 'no-store');
        return new Response(shell.body, {
          status: shell.status,
          statusText: shell.statusText,
          headers,
        });
      }

      // Prerendered HTML: serve public/<path>/index.html via ASSETS so the
      // canonical no-slash URL returns 200 instead of Pages' 308 to the
      // slash URL (which would loop against the M-4 301 above). No file
      // (user page) -> fall through to the SPA shell.
      // NOTE: ASSETS.fetch('<path>/index.html') itself 308s (Pages strips
      // /index.html), so fetch the directory URL '<path>/' which serves
      // the index file directly with 200.
      if (path === '/') {
        // H-1: the home prerender lives at public/__home__/index.html
        // (Vite overwrites public/index.html on every build). Same
        // directory-URL pattern as other routes; no file yet (prerender
        // not re-run) -> fall through to the SPA shell.
        const homeRes = await context.env.ASSETS.fetch(
          new Request(new URL('/__home__/', request.url), request),
        );
        if (homeRes.status === 200) {
          const headers = new Headers(homeRes.headers);
          headers.set('Cache-Control', 'public, max-age=1800, must-revalidate');
          return withSecurityHeaders(
            new Response(homeRes.body, {
              status: homeRes.status,
              statusText: homeRes.statusText,
              headers,
            }),
          );
        }
      } else {
        const assetRes = await context.env.ASSETS.fetch(
          new Request(new URL(`${path}/`, request.url), request),
        );
        if (assetRes.status === 200) {
          return withSecurityHeaders(assetRes);
        }
      }
    }

    return withSecurityHeaders(await context.next());
  } catch {
    // Middleware must never take the site down: fall through to Pages.
    return context.next();
  }
}
