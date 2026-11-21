import type {
  Chapter,
  ChapterAudioFile,
  Juz,
  PaginationInfo,
  Reciter,
  SearchResponse,
  TafsirContent,
  TranslationResource,
  Verse,
} from '../types/quran';

export interface QuranApiError extends Error {
  status?: number;
  code?: string;
  chapterId?: number;
  juzId?: number;
  environment?: string;
}

const DEFAULT_API_TIMEOUT_MS = 15_000;

async function apiGet<T>(url: string, timeoutMs = DEFAULT_API_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const timeoutErr = new Error('Request timed out. Please try again.') as QuranApiError;
      timeoutErr.status = 408;
      timeoutErr.code = 'TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }

  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    let code: string | undefined;
    let chapterId: number | undefined;
    let juzId: number | undefined;
    let environment: string | undefined;

    try {
      const errData = (await res.json()) as {
        error?: string;
        code?: string;
        chapterId?: number;
        juzId?: number;
        environment?: string;
      };
      if (errData.error) errorMsg = errData.error;
      code = errData.code;
      chapterId = errData.chapterId;
      juzId = errData.juzId;
      environment = errData.environment;
    } catch {
      // ignore json parse error
    }

    const err = new Error(errorMsg) as QuranApiError;
    err.status = res.status;
    err.code = code;
    err.chapterId = chapterId;
    err.juzId = juzId;
    err.environment = environment;
    throw err;
  }
  return (await res.json()) as T;
}

export async function fetchEnvStatus(): Promise<{
  environment: 'prelive' | 'production';
  appName: string;
  isPrelive: boolean;
  hasCredentials: boolean;
  scopes: string[];
  supportedSurahs: number[];
}> {
  return apiGet('/api/env-status');
}

export function normalizeChapterMetadata(ch: Chapter): Chapter {
  if (ch.id === 86 && ch.translated_name?.name === 'The Nightcommer') {
    return {
      ...ch,
      translated_name: {
        ...ch.translated_name,
        name: 'The Nightcomer',
      },
    };
  }
  return ch;
}

function normalizeReciterDisplayName(name: string): string {
  return name.replace(/([^\s])\(/g, '$1 (');
}

export function normalizeReciterMetadata(reciter: Reciter): Reciter {
  const fixedName = normalizeReciterDisplayName(reciter.reciter_name);
  const fixedTranslated = reciter.translated_name
    ? {
        ...reciter.translated_name,
        name: normalizeReciterDisplayName(reciter.translated_name.name),
      }
    : undefined;
  return {
    ...reciter,
    reciter_name: fixedName,
    ...(fixedTranslated ? { translated_name: fixedTranslated } : {}),
  };
}

export async function fetchChapters(): Promise<Chapter[]> {
  const data = await apiGet<{ chapters: Chapter[] }>('/api/chapters');
  return data.chapters.map(normalizeChapterMetadata);
}

export async function fetchChapterDetails(id: number): Promise<{
  chapter: Chapter;
  chapter_info: { short_text?: string; source?: string } | null;
  environment?: string;
}> {
  const data = await apiGet<{
    chapter: Chapter;
    chapter_info: { short_text?: string; source?: string } | null;
    environment?: string;
  }>(`/api/chapters/${id}`);
  return {
    ...data,
    chapter: normalizeChapterMetadata(data.chapter),
  };
}

export async function fetchJuzs(): Promise<Juz[]> {
  const data = await apiGet<{ juzs: Juz[] }>('/api/juz');
  return data.juzs;
}

export const DEFAULT_ENGLISH_TRANSLATION_ID = 20;

// Urdu removed (2026-11-21): only the selected English translation is
// requested. A stored legacy value of 234 (Urdu) falls back to English.
export function buildTranslationsParam(translationId: number): string {
  const enId =
    Number.isInteger(translationId) && translationId > 0 && translationId !== 234
      ? translationId
      : DEFAULT_ENGLISH_TRANSLATION_ID;
  return String(enId);
}

export async function fetchVersesByChapter(params: {
  chapterId: number;
  page?: number;
  perPage?: number;
  translationId: number;
  reciterId: number;
}): Promise<{ verses: Verse[]; pagination: PaginationInfo; environment?: string }> {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    per_page: String(params.perPage ?? 30),
    translation: buildTranslationsParam(params.translationId),
    reciter: String(params.reciterId),
  });
  return apiGet(`/api/verses/by_chapter/${params.chapterId}?${qs.toString()}`);
}

export async function fetchVersesByJuz(params: {
  juzNumber: number;
  page?: number;
  perPage?: number;
  translationId: number;
  reciterId: number;
}): Promise<{ verses: Verse[]; pagination: PaginationInfo; environment?: string }> {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    per_page: String(params.perPage ?? 30),
    translation: buildTranslationsParam(params.translationId),
    reciter: String(params.reciterId),
  });
  return apiGet(`/api/verses/by_juz/${params.juzNumber}?${qs.toString()}`);
}

export async function fetchVerseByKey(params: {
  verseKey: string;
  translationId: number;
  reciterId: number;
}): Promise<Verse> {
  const qs = new URLSearchParams({
    translation: buildTranslationsParam(params.translationId),
    reciter: String(params.reciterId),
  });
  const data = await apiGet<{ verse: Verse }>(
    `/api/verses/key/${encodeURIComponent(params.verseKey)}?${qs.toString()}`
  );
  return data.verse;
}

export async function fetchVersesByKeys(params: {
  keys: string[];
  translationId: number;
  reciterId: number;
}): Promise<Verse[]> {
  const qs = new URLSearchParams({
    keys: params.keys.join(','),
    translation: buildTranslationsParam(params.translationId),
    reciter: String(params.reciterId),
  });
  const data = await apiGet<{ verses: Verse[] }>(`/api/verses/keys?${qs.toString()}`);
  return data.verses;
}

export async function fetchTranslations(): Promise<TranslationResource[]> {
  const data = await apiGet<{ translations: TranslationResource[] }>('/api/translations');
  return data.translations;
}

export const DEFAULT_TAFSIR_ID = 14; // Tafsir Ibn Kathir (Arabic) — matches the UI default language on first open

export async function fetchVerseTafsir(
  verseKey: string,
  tafsirId: number = DEFAULT_TAFSIR_ID
): Promise<TafsirContent> {
  const data = await apiGet<{
    tafsir?: TafsirContent | null;
    tafsirs?: TafsirContent[];
    text?: string;
  }>(`/api/tafsirs/${tafsirId}/by_ayah/${encodeURIComponent(verseKey)}`, DEFAULT_API_TIMEOUT_MS);

  const resolved =
    data.tafsir ||
    (Array.isArray(data.tafsirs) ? data.tafsirs[0] : undefined) ||
    (typeof data.text === 'string' ? (data as unknown as TafsirContent) : undefined);

  if (!resolved || typeof resolved.text !== 'string') {
    throw new Error('Tafsir unavailable for this Ayah.');
  }
  return resolved;
}

export async function fetchRecitations(): Promise<Reciter[]> {
  const data = await apiGet<{ recitations: Reciter[] }>('/api/recitations');
  return data.recitations.map(normalizeReciterMetadata);
}

export interface ChapterAudioResponse {
  audio_file: ChapterAudioFile | null;
  verse_audio_files?: Array<{ verse_key: string; url: string }>;
  playback_type?: 'chapter_file' | 'verse_sequence';
}

export async function fetchChapterAudioData(
  reciterId: number,
  chapterId: number,
  includeSegments = false
): Promise<ChapterAudioResponse> {
  const qs = includeSegments ? '?segments=true' : '';
  return apiGet<ChapterAudioResponse>(`/api/audio/chapter/${reciterId}/${chapterId}${qs}`);
}

export async function fetchChapterAudioUrl(reciterId: number, chapterId: number): Promise<string> {
  const data = await fetchChapterAudioData(reciterId, chapterId, false);
  return data.audio_file?.audio_url || '';
}

export interface SearchApiResult extends SearchResponse {
  scope_status?: {
    granted: boolean;
    missing_scope: string;
    message: string;
  };
}

export async function searchQuran(params: {
  query: string;
  page?: number;
  size?: number;
}): Promise<SearchApiResult> {
  const qs = new URLSearchParams({
    q: params.query,
    page: String(params.page ?? 1),
    size: String(params.size ?? 20),
    language: 'en',
  });
  const data = await apiGet<{ search: SearchResponse; scope_status?: SearchApiResult['scope_status'] }>(
    `/api/search?${qs.toString()}`
  );
  return {
    ...data.search,
    scope_status: data.scope_status,
  };
}
