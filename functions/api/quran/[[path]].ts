interface Env {
  QURAN_CLIENT_ID?: string;
  QURAN_CLIENT_SECRET?: string;
  QURAN_ENV?: string;
}

const PUBLIC_API_BASE = 'https://api.quran.com/api/v4';
const AUDIO_CDN_BASE = 'https://verses.quran.com';

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

async function getOAuthToken(env: Env): Promise<string | null> {
  if (!env.QURAN_CLIENT_ID || !env.QURAN_CLIENT_SECRET) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken;
  }

  const oauthUrl =
    env.QURAN_ENV === 'prelive'
      ? 'https://prelive-oauth2.quran.foundation/oauth2/token'
      : 'https://oauth2.quran.foundation/oauth2/token';

  const credentials = btoa(`${env.QURAN_CLIENT_ID}:${env.QURAN_CLIENT_SECRET}`);
  const resp = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=content',
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

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
  params: { path?: string[] };
}): Promise<Response> => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const subPath = (params.path || []).join('/');

  const contentApiBase =
    env.QURAN_ENV === 'prelive'
      ? 'https://apis-prelive.quran.foundation/content/api/v4'
      : 'https://apis.quran.foundation/content/api/v4';

  const token = await getOAuthToken(env);
  const headers: Record<string, string> = { Accept: 'application/json' };
  let baseUrl = PUBLIC_API_BASE;

  if (token && env.QURAN_CLIENT_ID) {
    baseUrl = contentApiBase;
    headers['x-auth-token'] = token;
    headers['x-client-id'] = env.QURAN_CLIENT_ID;
  }

  let upstreamPath = `/${subPath}${url.search}`;
  if (subPath.startsWith('verses/chapter/')) {
    const chapterId = subPath.replace('verses/chapter/', '');
    upstreamPath = `/verses/by_chapter/${chapterId}${url.search}`;
  } else if (subPath.startsWith('verses/juz/')) {
    const juzId = subPath.replace('verses/juz/', '');
    upstreamPath = `/verses/by_juz/${juzId}${url.search}`;
  } else if (subPath.startsWith('verses/key/')) {
    const key = subPath.replace('verses/key/', '');
    upstreamPath = `/verses/by_key/${key}${url.search}`;
  } else if (subPath.startsWith('audio/chapter/')) {
    const rest = subPath.replace('audio/chapter/', '');
    upstreamPath = `/chapter_recitations/${rest}${url.search}`;
  }

  const upstreamRes = await fetch(`${baseUrl}${upstreamPath}`, {
    headers,
  });

  if (!upstreamRes.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error (${upstreamRes.status})` }),
      { status: upstreamRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const json = (await upstreamRes.json()) as Record<string, unknown>;
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
};
