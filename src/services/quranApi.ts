import type {
  Chapter,
  ChapterAudioFile,
  Juz,
  PaginationInfo,
  Reciter,
  SearchResponse,
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

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
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

export async function fetchChapters(): Promise<Chapter[]> {
  const data = await apiGet<{ chapters: Chapter[] }>('/api/chapters');
  return data.chapters;
}

export async function fetchChapterDetails(id: number): Promise<{
  chapter: Chapter;
  chapter_info: { short_text?: string; source?: string } | null;
  environment?: string;
}> {
  return apiGet(`/api/chapters/${id}`);
}

export async function fetchJuzs(): Promise<Juz[]> {
  const data = await apiGet<{ juzs: Juz[] }>('/api/juz');
  return data.juzs;
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
    translation: String(params.translationId),
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
    translation: String(params.translationId),
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
    translation: String(params.translationId),
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
    translation: String(params.translationId),
    reciter: String(params.reciterId),
  });
  const data = await apiGet<{ verses: Verse[] }>(`/api/verses/keys?${qs.toString()}`);
  return data.verses;
}

export async function fetchTranslations(): Promise<TranslationResource[]> {
  const data = await apiGet<{ translations: TranslationResource[] }>('/api/translations');
  return data.translations;
}

export async function fetchRecitations(): Promise<Reciter[]> {
  const data = await apiGet<{ recitations: Reciter[] }>('/api/recitations');
  return data.recitations;
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
