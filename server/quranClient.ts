import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Chapter, Juz, TranslationResource, Reciter } from '../src/types/quran';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_API_BASE = 'https://api.quran.com/api/v4';
const AUDIO_CDN_BASE = 'https://verses.quran.com';

const SCOPES_CONTENT = [
  'content.quran.read',
  'content.translations.read',
  'content.audio.read',
  'content.tafsirs.read',
].join(' ');

interface TokenCache {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let oauthTokenCache: TokenCache | null = null;
const responseCache = new Map<string, CacheEntry<unknown>>();

// Load catalog fallbacks for metadata when running in limited environments
let chaptersCatalog: Chapter[] = [];
let juzsCatalog: Juz[] = [];

try {
  const chPath = path.join(__dirname, 'chaptersCatalog.json');
  if (fs.existsSync(chPath)) {
    chaptersCatalog = JSON.parse(fs.readFileSync(chPath, 'utf8'));
  }
  const jPath = path.join(__dirname, 'juzsCatalog.json');
  if (fs.existsSync(jPath)) {
    juzsCatalog = JSON.parse(fs.readFileSync(jPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not load static catalogs:', e);
}

export function getEnvConfig() {
  const clientId = (process.env.QURAN_CLIENT_ID || process.env.QF_CLIENT_ID)?.trim();
  const clientSecret = (process.env.QURAN_CLIENT_SECRET || process.env.QF_CLIENT_SECRET)?.trim();
  const rawEnv = (process.env.QURAN_ENV || process.env.QF_ENV)?.trim() || 'production';
  const env: 'prelive' | 'production' = rawEnv === 'prelive' ? 'prelive' : 'production';

  const oauthUrl =
    env === 'prelive'
      ? 'https://prelive-oauth2.quran.foundation/oauth2/token'
      : 'https://oauth2.quran.foundation/oauth2/token';

  const contentApiBase =
    env === 'prelive'
      ? 'https://apis-prelive.quran.foundation/content/api/v4'
      : 'https://apis.quran.foundation/content/api/v4';

  return { clientId, clientSecret, oauthUrl, contentApiBase, env };
}

export async function getOAuthAccessToken(): Promise<string | null> {
  const { clientId, clientSecret, oauthUrl } = getEnvConfig();
  if (!clientId || !clientSecret) {
    return null;
  }

  const now = Date.now();
  if (oauthTokenCache && oauthTokenCache.expiresAt > now + 30_000) {
    return oauthTokenCache.accessToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPES_CONTENT)}`,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Quran OAuth2 token request failed (${response.status}): ${errText}`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresInMs = (payload.expires_in ?? 3600) * 1000;
  oauthTokenCache = {
    accessToken: payload.access_token,
    expiresAt: now + expiresInMs,
    scopes: SCOPES_CONTENT.split(' '),
  };

  return oauthTokenCache.accessToken;
}

export async function fetchFromQuranApi<T>(
  path: string,
  ttlMs = 1000 * 60 * 15
): Promise<T> {
  const cacheKey = path;
  const now = Date.now();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const { clientId, clientSecret, contentApiBase } = getEnvConfig();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  let targetUrl = `${PUBLIC_API_BASE}${path}`;

  if (clientId && clientSecret) {
    try {
      const token = await getOAuthAccessToken();
      if (token) {
        targetUrl = `${contentApiBase}${path}`;
        headers['x-auth-token'] = token;
        headers['x-client-id'] = clientId;
      }
    } catch (oauthErr) {
      console.warn('Quran OAuth2 token error, falling back:', oauthErr);
      targetUrl = `${PUBLIC_API_BASE}${path}`;
    }
  }

  const response = await fetch(targetUrl, { headers });

  if (response.status === 401 && headers['x-auth-token']) {
    oauthTokenCache = null;
  }

  if (response.status === 429) {
    throw new Error('Upstream Quran API rate limit reached. Please try again shortly.');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let errMessage = `Quran API error (${response.status}): ${body || response.statusText}`;
    try {
      const jsonErr = JSON.parse(body);
      if (jsonErr.message) errMessage = jsonErr.message;
      else if (jsonErr.details?.error) errMessage = jsonErr.details.error;
      else if (jsonErr.error) errMessage = jsonErr.error;
    } catch {
      // ignore
    }
    const err = new Error(errMessage) as Error & { status: number; rawBody: string };
    err.status = response.status;
    err.rawBody = body;
    throw err;
  }

  const data = (await response.json()) as T;

  if (responseCache.size > 500) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(cacheKey, { data, expiresAt: now + ttlMs });

  return data;
}

export function normalizeAudioUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('//')) {
    return `https:${rawUrl}`;
  }
  const cleanPath = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
  return `${AUDIO_CDN_BASE}/${cleanPath}`;
}

export function normalizeVersesAudio<T extends { audio?: { url?: string } }>(verses: T[]): T[] {
  return verses.map((verse) => {
    if (!verse.audio?.url) return verse;
    return {
      ...verse,
      audio: {
        ...verse.audio,
        url: normalizeAudioUrl(verse.audio.url),
      },
    };
  });
}

export interface RawChapterReciter {
  id: number;
  name: string;
  style?: { name?: string | null; language_name?: string } | null;
  qirat?: { name?: string | null; language_name?: string } | null;
  translated_name?: {
    name: string;
    language_name: string;
  };
}

export function mergeReciters(
  verseRecitations: Reciter[],
  chapterReciters: RawChapterReciter[]
): Reciter[] {
  const merged = new Map<number, Reciter>();

  for (const r of verseRecitations) {
    merged.set(r.id, {
      id: r.id,
      reciter_name: r.reciter_name,
      style: r.style ?? null,
      qirat: r.qirat ?? null,
      translated_name: r.translated_name,
      audio_capabilities: {
        verse_by_verse: true,
        full_surah: false,
      },
    });
  }

  for (const cr of chapterReciters) {
    const existing = merged.get(cr.id);
    const crStyle = cr.style?.name || null;
    const crQirat = cr.qirat?.name || null;

    if (existing) {
      merged.set(cr.id, {
        ...existing,
        style: existing.style || crStyle,
        qirat: existing.qirat || crQirat,
        audio_capabilities: {
          verse_by_verse: true,
          full_surah: true,
        },
      });
    } else {
      merged.set(cr.id, {
        id: cr.id,
        reciter_name: cr.name,
        style: crStyle,
        qirat: crQirat,
        translated_name: cr.translated_name,
        audio_capabilities: {
          verse_by_verse: false,
          full_surah: true,
          verse_via_segments: true,
        },
      });
    }
  }

  return sortRecitations(Array.from(merged.values()));
}

export function sortRecitations<T extends { id: number }>(reciters: T[]): T[] {
  const POPULAR_RECITER_PRIORITY = [7, 6, 2, 1, 3, 9, 8, 10, 4, 5, 11, 12, 97, 161, 168, 173];
  return [...reciters].sort((a, b) => {
    const idxA = POPULAR_RECITER_PRIORITY.indexOf(a.id);
    const idxB = POPULAR_RECITER_PRIORITY.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.id - b.id;
  });
}

export function filterEnglishTranslations<
  T extends { id: number; language_name?: string }
>(translations: T[]): T[] {
  const englishOnly = translations.filter(
    (t) => t.language_name?.toLowerCase() === 'english' || t.id === 85 || t.id === 20
  );
  if (englishOnly.length > 0) return englishOnly;
  return translations;
}

export { chaptersCatalog, juzsCatalog };
