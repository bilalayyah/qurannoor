interface Env {
  QURAN_CLIENT_ID?: string;
  QURAN_CLIENT_SECRET?: string;
  QURAN_ENV?: string;
  QF_CLIENT_ID?: string;
  QF_CLIENT_SECRET?: string;
  QF_ENV?: string;
}

const PUBLIC_API_BASE = 'https://api.quran.com/api/v4';
const AUDIO_CDN_BASE = 'https://verses.quran.com';

const SCOPES_CONTENT = [
  'content.quran.read',
  'content.translations.read',
  'content.audio.read',
  'content.tafsirs.read',
].join(' ');

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

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

  if (!resp.ok) return null;
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
  if (!qs.has('words')) qs.set('words', 'false');
  if (!qs.has('fields')) qs.set('fields', 'text_uthmani,text_indopak');

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
  const subPath = (params.path || []).join('/');

  const clientId = (env.QURAN_CLIENT_ID || env.QF_CLIENT_ID)?.trim();
  const rawEnv = (env.QURAN_ENV || env.QF_ENV)?.trim() || 'production';
  const environment = rawEnv === 'prelive' ? 'prelive' : 'production';

  // Environment status route
  if (subPath === 'env-status') {
    return new Response(
      JSON.stringify({
        environment,
        appName: 'Noor Quran',
        isPrelive: environment === 'prelive',
        hasCredentials: Boolean(clientId),
        scopes: SCOPES_CONTENT.split(' '),
        supportedSurahs: environment === 'prelive' ? [1, 2] : Array.from({ length: 114 }, (_, i) => i + 1),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
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
  if (subPath === 'recitations' || subPath === 'quran/resources/recitations') {
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
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to load reciters' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle /api/verses/keys?keys=1:1,2:255,...
  if (subPath === 'verses/keys' || subPath === 'quran/verses/keys') {
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
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to load requested verses' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  let upstreamPath = `/${subPath}${url.search}`;

  // Map route patterns
  if (subPath.startsWith('chapters/') || subPath.startsWith('quran/chapters/')) {
    const id = Number(subPath.replace('chapters/', '').replace('quran/chapters/', ''));
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
  } else if (subPath === 'chapters' || subPath === 'quran/chapters') {
    upstreamPath = `/chapters${url.search}`;
  } else if (subPath.startsWith('verses/by_chapter/') || subPath.startsWith('quran/verses/chapter/')) {
    const chapterId = Number(
      subPath.replace('verses/by_chapter/', '').replace('quran/verses/chapter/', '')
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
  } else if (subPath.startsWith('verses/by_juz/') || subPath.startsWith('quran/verses/juz/')) {
    const juzId = Number(subPath.replace('verses/by_juz/', '').replace('quran/verses/juz/', ''));
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
  } else if (subPath === 'juz' || subPath === 'juzs' || subPath === 'quran/juzs') {
    upstreamPath = `/juzs${url.search}`;
  } else if (subPath === 'translations' || subPath === 'quran/resources/translations') {
    const tQs = new URLSearchParams(url.searchParams);
    if (!tQs.has('language')) tQs.set('language', 'en');
    upstreamPath = `/resources/translations?${tQs.toString()}`;
  } else if (subPath.startsWith('audio/chapter/') || subPath.startsWith('quran/audio/chapter/')) {
    const rest = subPath.replace('audio/chapter/', '').replace('quran/audio/chapter/', '');
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
    const chapterRes = await fetch(`${baseUrl}/chapter_recitations/${rest}${url.search}`, { headers });
    if (chapterRes.ok) {
      const json = (await chapterRes.json()) as { audio_file?: { audio_url?: string } };
      if (json.audio_file?.audio_url) {
        json.audio_file = { ...json.audio_file, audio_url: normalizeAudioUrl(json.audio_file.audio_url) };
      }
      return new Response(JSON.stringify({ ...json, playback_type: 'chapter_file', environment }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
      });
    }
    const verseSeqRes = await fetch(`${baseUrl}/recitations/${reciterId}/by_chapter/${chapterId}?per_page=300`, {
      headers,
    });
    if (verseSeqRes.ok) {
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
    return new Response(JSON.stringify({ error: `Upstream error (${chapterRes.status})` }), {
      status: chapterRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
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
  } else if (subPath.startsWith('verses/key/') || subPath.startsWith('quran/verses/key/')) {
    const key = subPath.replace('verses/key/', '').replace('quran/verses/key/', '');
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

  try {
    const upstreamRes = await fetch(`${baseUrl}${upstreamPath}`, { headers });

    if (upstreamRes.status === 401 && headers['x-auth-token']) {
      tokenCache = null;
    }

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => '');
      if (upstreamRes.status === 403 && (errText.includes('scope') || environment === 'prelive')) {
        if (subPath === 'search' || subPath === 'quran/search') {
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
      return new Response(
        JSON.stringify({ error: `Upstream error (${upstreamRes.status}): ${errText}` }),
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
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Network error' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
