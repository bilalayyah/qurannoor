// Pages Functions middleware — audit M-2 (true HTTP 404s) + M-4 (301 normalisation).
//
// - Lowercases the path and strips trailing slashes (except root) with a single 301.
// - Returns a real HTTP 404 status for unmatched routes and invalid slugs, serving
//   the SPA shell body (via context.next(), which already serves index.html for
//   unmatched paths) so the client-side NotFoundPage UI still renders.
// - Valid routes, /api/*, and static assets pass through untouched (status preserved).
// - Also applies the H-2 security headers to every response, including /api/*
//   Function responses (public/_headers does not reliably cover Functions).
//
// Valid slugs are embedded statically (derived 2026-11-18 from the route
// definitions in src/App.tsx, the 186 sitemap URLs in public/sitemap.xml, the
// slug aliases in src/utils/slugs.ts, and verse counts in
// server/chaptersCatalog.json). The client also resolves numeric chapter ids
// (/surah/2) and alias slugs (/surah/fatihah, /surah/yaseen, ...), so those are
// accepted here too — 404ing them would break working client routes.
// /qibla, /privacy and /terms are client-side redirects and are valid routes:
// they are NOT 404ed.

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://verses.quran.foundation; img-src 'self' data: blob:; media-src 'self' https://verses.quran.com https://verses.quran.foundation https://cdn.islamic.network; connect-src 'self' https://api.quran.com https://apis.quran.foundation https://apis-prelive.quran.foundation https://oauth2.quran.foundation https://prelive-oauth2.quran.foundation https://verses.quran.foundation https://verses.quran.com https://api.aladhan.com https://api.bigdatacloud.net https://nominatim.openstreetmap.org https://ipapi.co https://ipwho.is https://get.geojs.io https://cdn.islamic.network https://formsubmit.co; worker-src 'self'; manifest-src 'self'; form-action 'self' https://formsubmit.co; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
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
    }

    return withSecurityHeaders(await context.next());
  } catch {
    // Middleware must never take the site down: fall through to Pages.
    return context.next();
  }
}
