interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  QURAN_CLIENT_ID?: string;
  QURAN_CLIENT_SECRET?: string;
  QURAN_ENV?: string;
  QF_CLIENT_ID?: string;
  QF_CLIENT_SECRET?: string;
  QF_ENV?: string;
  // Optional: bound project-wide (wrangler.toml PUSH_KV). Used ONLY for the
  // best-effort per-IP rate-limit counters below (keys prefixed rl:api:).
  // Absent in preview -> rate limiting is skipped (fail open).
  PUSH_KV?: KVNamespaceLike;
}

const PUBLIC_API_BASE = 'https://api.quran.com/api/v4';
const AUDIO_CDN_BASE = 'https://verses.quran.com';

const SCOPES_CONTENT = [
  'content.quran.read',
  'content.translations.read',
  'content.audio.read',
  'content.tafsirs.read',
  // M-2 (final audit): the search scope was approved in the Quran Console
  // (Thu 19 Nov) but never requested here, so /api/search always returned
  // granted:false. Local search stays the default; API search is an option.
  'content.search.read',
].join(' ');

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

// M-9: best-effort per-IP rate limiting for the API proxy, backed by KV when
// the binding is present. Fail-open: any KV error (or a missing binding /
// missing CF-Connecting-IP) skips limiting rather than breaking reads.
// This is only an abuse backstop (300 req/min/IP — far above normal use);
// the primary protection should be a Cloudflare dashboard rate-limit rule
// on /api/*, which the coordinator should add (see report). KV is eventually
// consistent, so concurrent bursts can overshoot the limit slightly.
async function hashClientIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

// M-4 (re-audit): fail-open is kept, but silent fail-open is now visible.
// A missing KV binding / missing client IP logs once per isolate, and any
// KV error is logged in the catch below.
let apiRateLimitUnavailableWarned = false;

async function checkApiRateLimit(env: Env, request: Request): Promise<boolean> {
  try {
    const kv = env.PUSH_KV;
    const ip = request.headers.get('CF-Connecting-IP');
    if (!kv || !ip) {
      if (!apiRateLimitUnavailableWarned) {
        apiRateLimitUnavailableWarned = true;
        console.warn(
          'API rate limiting disabled (failing open):',
          !kv ? 'PUSH_KV binding missing' : 'CF-Connecting-IP header missing'
        );
      }
      return true;
    }
    const windowId = Math.floor(Date.now() / 60_000);
    const key = `rl:api:${await hashClientIp(ip)}:${windowId}`;
    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    if (count >= 300) return false;
    await kv.put(key, String(count + 1), { expirationTtl: 90 });
    return true;
  } catch (e) {
    console.error('API rate-limit check failed (failing open)', e);
    return true;
  }
}

// M-9: allow-list of real Quran API paths this proxy serves. Anything else
// gets a 404 instead of falling through to the upstream (the old open-proxy
// behaviour). "contact" and "push" are deliberately NOT here — they are
// handled by their own route files (functions/api/contact.ts,
// functions/api/push/*). The legacy 'quran/...' URL shapes are accepted
// because the handler strips a leading 'quran/' prefix once at entry
// (M-2, re-audit); this list holds the post-strip paths. The
// 'verses/chapter', 'verses/juz' and 'resources/*' entries are the
// post-strip forms of the old 'quran/verses/chapter', 'quran/verses/juz'
// and 'quran/resources/*' shapes.
const ALLOWED_API_PATHS: RegExp[] = [
  /^env-status$/,
  /^chapters$/,
  /^chapters\/\d+$/,
  /^verses\/by_chapter\/\d+$/,
  /^verses\/chapter\/\d+$/,
  /^verses\/by_juz\/\d{1,2}$/,
  /^verses\/juz\/\d{1,2}$/,
  /^verses\/by_key\/\d{1,3}:\d{1,3}$/,
  /^verses\/key\/\d{1,3}:\d{1,3}$/,
  /^verses\/keys$/,
  /^juz$/,
  /^juzs$/,
  /^translations$/,
  /^resources\/translations$/,
  /^tafsirs$/,
  /^resources\/tafsirs$/,
  /^tafsirs\/\d+\/by_ayah\/\d{1,3}:\d{1,3}$/,
  /^recitations$/,
  /^resources\/recitations$/,
  /^recitations\/\d+\/by_chapter\/\d+$/,
  /^audio$/,
  /^audio\/chapter\/\d+\/\d+$/,
  /^search$/,
];

function isAllowedApiPath(subPath: string): boolean {
  return ALLOWED_API_PATHS.some((re) => re.test(subPath));
}

async function getOAuthToken(env: Env): Promise<string | null> {
  const clientId = (env.QURAN_CLIENT_ID || env.QF_CLIENT_ID)?.trim();
  const clientSecret = (env.QURAN_CLIENT_SECRET || env.QF_CLIENT_SECRET)?.trim();
  const rawEnv = (env.QURAN_ENV || env.QF_ENV)?.trim() || 'production';
  const environment = rawEnv === 'prelive' ? 'prelive' : 'production';

  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken;
  }

  const oauthUrl =
    environment === 'prelive'
      ? 'https://prelive-oauth2.quran.foundation/oauth2/token'
      : 'https://oauth2.quran.foundation/oauth2/token';

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPES_CONTENT)}`,
  });

  if (!resp.ok) {
    // L-8: OAuth failures must not fail silently — log server-side. The proxy
    // still falls back to the public API (no token), but the failure is now
    // visible in Functions logs instead of silently degrading.
    console.error('Quran API OAuth token request failed', resp.status, oauthUrl);
    return null;
  }
  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return tokenCache.accessToken;
}

function normalizeAudioUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  if (rawUrl.startsWith('//')) return `https:${rawUrl}`;
  return `${AUDIO_CDN_BASE}/${rawUrl.replace(/^\//, '')}`;
}

function normalizeReciterName(name: string): string {
  return name.replace(/([^\s])\(/g, '$1 (');
}

function normalizeChapterRecord(ch: Record<string, unknown>): Record<string, unknown> {
  const tn = ch.translated_name as { name?: string; language_name?: string } | undefined;
  if (Number(ch.id) === 86 && tn?.name === 'The Nightcommer') {
    return {
      ...ch,
      translated_name: {
        ...tn,
        name: 'The Nightcomer',
      },
    };
  }
  return ch;
}

function deduplicateJuzs<T extends { id?: number; juz_number?: number }>(juzs: T[]): T[] {
  const uniqueMap = new Map<number, T>();
  for (const juz of juzs) {
    const num = Number(juz.juz_number);
    if (!Number.isInteger(num) || num < 1 || num > 30) continue;
    const existing = uniqueMap.get(num);
    if (!existing) {
      uniqueMap.set(num, juz);
    } else if (
      typeof juz.id === 'number' &&
      (typeof existing.id !== 'number' || juz.id < existing.id)
    ) {
      uniqueMap.set(num, juz);
    }
  }
  return Array.from(uniqueMap.values()).sort(
    (a, b) => Number(a.juz_number) - Number(b.juz_number)
  );
}

function buildUpstreamVersesParams(
  incoming: URLSearchParams,
  includePagination: boolean
): URLSearchParams {
  const qs = new URLSearchParams(incoming);

  if (!qs.has('language')) qs.set('language', 'en');
  if (!qs.has('words')) qs.set('words', 'true');
  if (!qs.has('fields')) {
    qs.set('fields', 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed');
  }
  if (!qs.has('word_fields')) {
    qs.set('word_fields', 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed');
  }

  if (!qs.has('translations')) {
    const translation = qs.get('translation') || '20,234';
    qs.set('translations', translation);
  }
  qs.delete('translation');

  if (!qs.has('audio')) {
    const reciter = qs.get('reciter') || '7';
    qs.set('audio', reciter);
  }
  qs.delete('reciter');

  if (includePagination) {
    const page = Math.max(1, Number(qs.get('page')) || 1);
    const perPage = Math.min(50, Math.max(1, Number(qs.get('per_page')) || 30));
    qs.set('page', String(page));
    qs.set('per_page', String(perPage));
  }

  return qs;
}

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
  params: { path?: string[] };
}): Promise<Response> => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  // M-2 (re-audit): strip a leading 'quran/' prefix ONCE here. The old
  // per-branch chained String.replace calls stripped the inner pattern out
  // of 'quran/...' paths (e.g. 'quran/verses/key/2:255' -> 'quran/2:255',
  // which upstream rejected with 403/404/400). Every branch below now
  // matches the stripped path only.
  // H-2 (final audit): Pages Functions passes path segments still
  // percent-encoded — the app sends encodeURIComponent(verseKey), so the
  // colon arrives as %3A and the allow-list regexes below (which expect a
  // literal ':', e.g. verses/key/2:255) never matched: every encoded verse
  // key 404'd with "Unknown API path." Decode each segment ONCE, before
  // the 'quran/' strip and the allow-list test. A malformed segment falls
  // back to its raw form (and then fails the allow-list → 404) — decode
  // must never throw out of the handler.
  const rawSubPath = (params.path || [])
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');
  const subPath = rawSubPath.startsWith('quran/')
    ? rawSubPath.slice('quran/'.length)
    : rawSubPath;

  const clientId = (env.QURAN_CLIENT_ID || env.QF_CLIENT_ID)?.trim();
  // L-8: hasCredentials must reflect id AND secret, matching the preview
  // server (server.ts), which requires both to obtain a token.
  const clientSecret = (env.QURAN_CLIENT_SECRET || env.QF_CLIENT_SECRET)?.trim();
  const rawEnv = (env.QURAN_ENV || env.QF_ENV)?.trim() || 'production';
  const environment = rawEnv === 'prelive' ? 'prelive' : 'production';

  // Environment status route
  if (subPath === 'env-status') {
    return new Response(
      JSON.stringify({
        environment,
        appName: 'Noor Quran',
        isPrelive: environment === 'prelive',
        hasCredentials: Boolean(clientId && clientSecret),
        scopes: SCOPES_CONTENT.split(' '),
        supportedSurahs: environment === 'prelive' ? [1, 2] : Array.from({ length: 114 }, (_, i) => i + 1),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // M-9: size cap — reject absurdly long query strings before proxying.
  if (url.search.length > 2048) {
    return new Response(JSON.stringify({ error: 'Query string too long.' }), {
      status: 414,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // M-9: per-IP rate limiting (best-effort via KV; fails open).
  if (!(await checkApiRateLimit(env, request))) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again shortly.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const contentApiBase =
    environment === 'prelive'
      ? 'https://apis-prelive.quran.foundation/content/api/v4'
      : 'https://apis.quran.foundation/content/api/v4';

  const token = await getOAuthToken(env);
  const headers: Record<string, string> = { Accept: 'application/json' };
  let baseUrl = PUBLIC_API_BASE;

  if (token && clientId) {
    baseUrl = contentApiBase;
    headers['x-auth-token'] = token;
    headers['x-client-id'] = clientId;
  }

  // Merge official verse-by-verse and chapter reciters dynamically from upstream API
  if (subPath === 'recitations' || subPath === 'resources/recitations') {
    try {
      const [verseResp, chapterResp] = await Promise.all([
        fetch(`${baseUrl}/resources/recitations?language=en`, { headers }),
        fetch(`${baseUrl}/resources/chapter_reciters?language=en`, { headers }),
      ]);
      const verseJson = verseResp.ok
        ? ((await verseResp.json()) as {
            recitations?: Array<{
              id: number;
              reciter_name: string;
              style: string | null;
              translated_name?: unknown;
            }>;
          })
        : { recitations: [] };
      const chapterJson = chapterResp.ok
        ? ((await chapterResp.json()) as {
            reciters?: Array<{
              id: number;
              name: string;
              style?: { name?: string | null } | null;
              qirat?: { name?: string | null } | null;
              translated_name?: unknown;
            }>;
          })
        : { reciters: [] };

      const merged = new Map<number, Record<string, unknown>>();
      for (const r of verseJson.recitations || []) {
        const tn = r.translated_name as { name?: string; language_name?: string } | undefined;
        merged.set(r.id, {
          id: r.id,
          reciter_name: normalizeReciterName(r.reciter_name),
          style: r.style ?? null,
          qirat: null,
          translated_name: tn?.name ? { ...tn, name: normalizeReciterName(tn.name) } : r.translated_name,
          audio_capabilities: { verse_by_verse: true, full_surah: false },
        });
      }
      for (const cr of chapterJson.reciters || []) {
        const existing = merged.get(cr.id);
        const crStyle = cr.style?.name || null;
        const crQirat = cr.qirat?.name || null;
        const tn = cr.translated_name as { name?: string; language_name?: string } | undefined;
        if (existing) {
          merged.set(cr.id, {
            ...existing,
            style: existing.style || crStyle,
            qirat: crQirat,
            audio_capabilities: { verse_by_verse: true, full_surah: true },
          });
        } else {
          merged.set(cr.id, {
            id: cr.id,
            reciter_name: normalizeReciterName(cr.name),
            style: crStyle,
            qirat: crQirat,
            translated_name: tn?.name ? { ...tn, name: normalizeReciterName(tn.name) } : cr.translated_name,
            audio_capabilities: { verse_by_verse: false, full_surah: true, verse_via_segments: true },
          });
        }
      }

      const recitations = Array.from(merged.values());
      return new Response(
        JSON.stringify({ recitations, total: recitations.length, environment }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
        }
      );
    } catch (e) {
      // L-4 (re-audit): log the upstream detail server-side only; the
      // client gets a generic message.
      console.error('Recitations upstream error', e);
      return new Response(
        JSON.stringify({ error: 'Failed to load reciters. Please try again.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle /api/verses/keys?keys=1:1,2:255,...
  if (subPath === 'verses/keys') {
    const keysParam = url.searchParams.get('keys') || '';
    const keys = keysParam
      .split(',')
      .map((k) => k.trim())
      .filter((k) => /^\d{1,3}:\d{1,3}$/.test(k))
      .slice(0, 15);

    if (keys.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Provide one or more valid verse keys.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const upstreamQs = buildUpstreamVersesParams(url.searchParams, false);
    upstreamQs.delete('keys');

    try {
      const results = await Promise.all(
        keys.map(async (key) => {
          const chId = Number(key.split(':')[0]);
          if (environment === 'prelive' && chId > 2) return null;
          const resp = await fetch(`${baseUrl}/verses/by_key/${key}?${upstreamQs.toString()}`, {
            headers,
          });
          if (!resp.ok) {
            throw new Error(`Upstream error (${resp.status})`);
          }
          const d = (await resp.json()) as { verse?: Record<string, unknown> };
          if (!d.verse) return null;
          const audio = d.verse.audio as { url?: string } | undefined;
          if (audio?.url) {
            return { ...d.verse, audio: { ...audio, url: normalizeAudioUrl(audio.url) } };
          }
          return d.verse;
        })
      );

      const filtered = results.filter(Boolean);
      if (filtered.length === 0) {
        return new Response(
          JSON.stringify({
            error: `Requested verses (${keys.join(', ')}) are awaiting Production API approval. The Pre-live developer sandbox provides Surahs 1 and 2.`,
            code: 'PRELIVE_LIMITED',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ verses: filtered, environment }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
        }
      );
    } catch (e) {
      // L-4 (re-audit): the thrown error includes the upstream status; log
      // it server-side only and return a generic message.
      console.error('Verses/keys upstream error', e);
      return new Response(
        JSON.stringify({ error: 'Failed to load requested verses. Please try again.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  let upstreamPath = `/${subPath}${url.search}`;

  // Map route patterns
  if (subPath.startsWith('chapters/')) {
    const id = Number(subPath.replace('chapters/', ''));
    if (environment === 'prelive' && id > 2) {
      return new Response(
        JSON.stringify({
          error: `Surah ${id} is not available in the Pre-live API sandbox. Pre-live developer credentials for 'Noor Quran' provide Surah 1 & 2. Production API access is required for Surahs 3 to 114.`,
          code: 'PRELIVE_LIMITED',
          chapterId: id,
          environment: 'prelive',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    upstreamPath = `/chapters/${id}${url.search}`;
  } else if (subPath === 'chapters') {
    upstreamPath = `/chapters${url.search}`;
  } else if (subPath.startsWith('verses/by_chapter/') || subPath.startsWith('verses/chapter/')) {
    const chapterId = Number(
      subPath.replace('verses/by_chapter/', '').replace('verses/chapter/', '')
    );
    if (environment === 'prelive' && chapterId > 2) {
      return new Response(
        JSON.stringify({
          error: `Surah ${chapterId} verses are not in the Pre-live sandbox. Pre-live credentials provide Surahs 1 & 2. Production API access is required for Surahs 3 to 114.`,
          code: 'PRELIVE_LIMITED',
          chapterId,
          environment: 'prelive',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const upstreamQs = buildUpstreamVersesParams(url.searchParams, true);
    upstreamPath = `/verses/by_chapter/${chapterId}?${upstreamQs.toString()}`;
  } else if (subPath.startsWith('verses/by_juz/') || subPath.startsWith('verses/juz/')) {
    const juzId = Number(subPath.replace('verses/by_juz/', '').replace('verses/juz/', ''));
    if (environment === 'prelive' && juzId > 2) {
      return new Response(
        JSON.stringify({
          error: `Juz ${juzId} is not in the Pre-live sandbox. Pre-live credentials provide Juz 1 & 2. Production API access is required for Juz 3 to 30.`,
          code: 'PRELIVE_LIMITED',
          juzId,
          environment: 'prelive',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const upstreamQs = buildUpstreamVersesParams(url.searchParams, true);
    upstreamPath = `/verses/by_juz/${juzId}?${upstreamQs.toString()}`;
  } else if (subPath === 'juz' || subPath === 'juzs') {
    upstreamPath = `/juzs${url.search}`;
  } else if (subPath === 'translations' || subPath === 'resources/translations') {
    const tQs = new URLSearchParams(url.searchParams);
    if (!tQs.has('language')) tQs.set('language', 'en');
    upstreamPath = `/resources/translations?${tQs.toString()}`;
  } else if (subPath.startsWith('audio/chapter/')) {
    const rest = subPath.replace('audio/chapter/', '');
    const [reciterId, chapterIdStr] = rest.split('/');
    const chapterId = Number(chapterIdStr);
    if (environment === 'prelive' && chapterId > 2) {
      return new Response(
        JSON.stringify({
          error: `Full Surah audio for Surah ${chapterId} requires Production API approval.`,
          code: 'PRELIVE_LIMITED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // A fetch that throws (network/TLS failure) must NOT escape this
    // branch: an uncaught throw leaves onRequestGet, the middleware
    // falls through to Pages, and an API URL would serve the SPA shell
    // HTML with 200. Guard both fetches and fall through to the
    // verse-sequence fallback, then to the generic 502 below.
    let chapterRes: Response | null = null;
    try {
      chapterRes = await fetch(`${baseUrl}/chapter_recitations/${rest}${url.search}`, { headers });
    } catch (e) {
      console.error('Chapter audio fetch failed', rest, e);
    }
    if (chapterRes?.ok) {
      const json = (await chapterRes.json()) as { audio_file?: { audio_url?: string } };
      if (json.audio_file?.audio_url) {
        json.audio_file = { ...json.audio_file, audio_url: normalizeAudioUrl(json.audio_file.audio_url) };
      }
      return new Response(JSON.stringify({ ...json, playback_type: 'chapter_file', environment }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
      });
    }
    let verseSeqRes: Response | null = null;
    try {
      verseSeqRes = await fetch(`${baseUrl}/recitations/${reciterId}/by_chapter/${chapterId}?per_page=300`, {
        headers,
      });
    } catch (e) {
      console.error('Chapter audio fallback fetch failed', rest, e);
    }
    if (verseSeqRes?.ok) {
      const vJson = (await verseSeqRes.json()) as {
        audio_files?: Array<{ verse_key: string; url: string }>;
      };
      return new Response(
        JSON.stringify({
          audio_file: null,
          verse_audio_files: (vJson.audio_files || []).map((f) => ({
            verse_key: f.verse_key,
            url: normalizeAudioUrl(f.url),
          })),
          playback_type: 'verse_sequence',
          environment,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
        }
      );
    }
    // L-4 (re-audit): generic message + 502; the upstream status is logged
    // server-side only, never returned to the client.
    console.error('Chapter audio upstream error', chapterRes?.status, rest);
    return new Response(
      JSON.stringify({ error: 'The Quran API returned an error. Please try again.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  } else if (subPath === 'audio') {
    const reciterId = url.searchParams.get('reciter_id') || url.searchParams.get('reciterId') || '7';
    const chapterId = url.searchParams.get('chapter_id') || url.searchParams.get('chapterId') || '1';
    if (environment === 'prelive' && Number(chapterId) > 2) {
      return new Response(
        JSON.stringify({
          error: `Full Surah audio for Surah ${chapterId} requires Production API approval.`,
          code: 'PRELIVE_LIMITED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    upstreamPath = `/chapter_recitations/${reciterId}/${chapterId}`;
  } else if (subPath.startsWith('verses/key/')) {
    const key = subPath.replace('verses/key/', '');
    const chId = Number(key.split(':')[0]);
    if (environment === 'prelive' && chId > 2) {
      return new Response(
        JSON.stringify({
          error: `Verse ${key} requires Production API approval. Pre-live sandbox provides Surah 1 & 2.`,
          code: 'PRELIVE_LIMITED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const upstreamQs = buildUpstreamVersesParams(url.searchParams, false);
    upstreamPath = `/verses/by_key/${key}?${upstreamQs.toString()}`;
  } else if (subPath.startsWith('verses/by_key/')) {
    // L-1: /api/verses/by_key/2:255 previously fell through to the generic
    // passthrough with no default fields, so it returned metadata only (no
    // Arabic, no translations) unless the caller passed ?fields= explicitly.
    // It now gets the same defaults as verses/key/ and the other verse
    // branches (buildUpstreamVersesParams).
    const key = subPath.replace('verses/by_key/', '');
    if (!/^\d{1,3}:\d{1,3}$/.test(key)) {
      return new Response(JSON.stringify({ error: 'Provide a valid verse key (chapter:verse).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const chId = Number(key.split(':')[0]);
    if (environment === 'prelive' && chId > 2) {
      return new Response(
        JSON.stringify({
          error: `Verse ${key} requires Production API approval. Pre-live sandbox provides Surah 1 & 2.`,
          code: 'PRELIVE_LIMITED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const upstreamQs = buildUpstreamVersesParams(url.searchParams, false);
    upstreamPath = `/verses/by_key/${key}?${upstreamQs.toString()}`;
  }

  // M-9: drop unknown paths with 404 instead of proxying them upstream.
  // (env-status, recitations, verses/keys and audio/chapter returned above.)
  if (!isAllowedApiPath(subPath)) {
    return new Response(JSON.stringify({ error: 'Unknown API path.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // M-9: clamp per_page on the generic passthrough. Clamp INSIDE
  // upstreamPath's own query string — rebuilding it from the raw incoming
  // query (url.search) discards the defaults buildUpstreamVersesParams
  // added (fields, translations, audio), which made by_chapter/by_juz
  // return metadata-only verses (blank Arabic + "Translation unavailable"
  // in the reader). The old code did exactly that rebuild; do not restore it.
  {
    const qIndex = upstreamPath.indexOf('?');
    if (qIndex >= 0) {
      const qs = new URLSearchParams(upstreamPath.slice(qIndex + 1));
      if (qs.has('per_page')) {
        qs.set(
          'per_page',
          String(Math.min(50, Math.max(1, Number(qs.get('per_page')) || 30)))
        );
        upstreamPath = `${upstreamPath.slice(0, qIndex)}?${qs.toString()}`;
      }
    }
  }

  try {
    let upstreamRes = await fetch(`${baseUrl}${upstreamPath}`, { headers });

    // L-8: on upstream 401, clear the cached token and retry once with a
    // fresh token instead of handing the client a raw 401.
    if (upstreamRes.status === 401 && headers['x-auth-token']) {
      tokenCache = null;
      const freshToken = await getOAuthToken(env);
      if (freshToken && clientId) {
        upstreamRes = await fetch(`${baseUrl}${upstreamPath}`, {
          headers: { ...headers, 'x-auth-token': freshToken },
        });
      }
    }

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => '');
      if (upstreamRes.status === 403 && (errText.includes('scope') || environment === 'prelive')) {
        if (subPath === 'search') {
          return new Response(
            JSON.stringify({
              search: {
                query: url.searchParams.get('q') || '',
                total_results: 0,
                current_page: 1,
                total_pages: 0,
                results: [],
              },
              scope_status: {
                granted: false,
                missing_scope: 'content.search.read',
                message:
                  'The upstream search scope is not active on this client; QuranNoor provides local full-text search across Arabic, English, and Urdu.',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      // L-7: log the upstream detail server-side only; the client gets a
      // generic message (the full upstream JSON used to leak verbatim).
      console.error(
        'Upstream API error',
        upstreamRes.status,
        subPath,
        errText.slice(0, 500)
      );
      return new Response(
        JSON.stringify({
          error: 'The Quran API returned an error. Please try again.',
        }),
        { status: upstreamRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const json = (await upstreamRes.json()) as Record<string, unknown>;
    if (Array.isArray(json.chapters)) {
      json.chapters = (json.chapters as Array<Record<string, unknown>>).map(normalizeChapterRecord);
    }
    if (json.chapter && typeof json.chapter === 'object') {
      json.chapter = normalizeChapterRecord(json.chapter as Record<string, unknown>);
    }
    if (Array.isArray(json.translations)) {
      const list = json.translations as Array<{ id?: number; language_name?: string }>;
      const englishOnly = list.filter(
        (t) => t.language_name?.toLowerCase() === 'english' || t.id === 85 || t.id === 20
      );
      if (englishOnly.length > 0) {
        json.translations = englishOnly;
      }
    }
    if (Array.isArray(json.juzs)) {
      json.juzs = deduplicateJuzs(
        json.juzs as Array<{ id?: number; juz_number?: number }>
      );
    }
    if (Array.isArray(json.verses)) {
      json.verses = json.verses.map((v: Record<string, unknown>) => {
        const audio = v.audio as { url?: string } | undefined;
        if (audio?.url) {
          return { ...v, audio: { ...audio, url: normalizeAudioUrl(audio.url) } };
        }
        return v;
      });
    }
    if (json.verse && typeof json.verse === 'object') {
      const v = json.verse as Record<string, unknown>;
      const audio = v.audio as { url?: string } | undefined;
      if (audio?.url) {
        json.verse = { ...v, audio: { ...audio, url: normalizeAudioUrl(audio.url) } };
      }
    }
    if (json.audio_file && typeof json.audio_file === 'object') {
      const af = json.audio_file as { audio_url?: string };
      if (af.audio_url) {
        json.audio_file = { ...af, audio_url: normalizeAudioUrl(af.audio_url) };
      }
    }

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (e) {
    // L-4 (re-audit): log the detail server-side only; the client gets a
    // generic message.
    console.error('API proxy error', subPath, e);
    return new Response(
      JSON.stringify({ error: 'The Quran API returned an error. Please try again.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
