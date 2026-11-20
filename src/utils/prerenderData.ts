// Prerendered-data reader (H-1, final audit 2026-11-20).
//
// WHY THIS EXISTS: the site ships prerendered HTML (186 routes), but the
// app used createRoot, which discarded that HTML on every load (CLS
// 0.38–1.62). Switching to hydrateRoot only helps if the first client
// render reproduces the prerendered DOM exactly — and the data-driven
// pages (Surah/Juz/Ayah readers, metadata lists) fetch their data in
// useEffect, so their first render was a loading skeleton, not the 15
// prerendered articles. Hydration would discard the articles anyway.
//
// FIX: the prerender script (scripts/prerender.cjs) records the /api/*
// responses the page fetched for its first render and embeds them as JSON
// in a <script id="__prerender-data__" type="application/json"> tag in
// the prerendered HTML. The page components seed their initial state from
// that embedded data synchronously (useState initializers), so the first
// client render IS the prerendered content and hydration matches.
//
// The embedded data is exactly what the prerendered DOM was rendered
// from (same responses, recorded live during the prerender), so first
// render parity holds BY CONSTRUCTION — as long as the first render uses
// the same inputs (default translation/reciter — see the ReaderContext
// gating, which keeps stored settings out of the first render).
//
// KEYS: the prerender script computes the same keys from the recorded
// request URLs (see buildPrerenderDataKey in scripts/prerender.cjs).
// A key embeds the translation/reciter the data was fetched with, so a
// user with custom settings simply misses the lookup and fetches
// normally — never stale data rendered as if it were theirs.
//
// SAFETY: every getter returns null when the embedded tag is absent
// (SPA shell, non-prerendered routes, client-side navigation) or the
// payload is malformed. Callers always fall back to fetching. Nothing
// here ever throws. No Quran text is generated or modified here — the
// payloads are verbatim API responses.

import {
  buildTranslationsParam,
  normalizeChapterMetadata,
  normalizeReciterMetadata,
} from '../services/quranApi';
import type {
  Chapter,
  Juz,
  PaginationInfo,
  Reciter,
  TafsirContent,
  TranslationResource,
  Verse,
} from '../types/quran';

type PrerenderDataMap = Record<string, unknown>;

let cachedMap: PrerenderDataMap | null | undefined;

function readEmbeddedMap(): PrerenderDataMap | null {
  if (cachedMap !== undefined) return cachedMap;
  cachedMap = null;
  try {
    if (typeof document === 'undefined') return cachedMap;
    const el = document.getElementById('__prerender-data__');
    if (!el || !el.textContent) return cachedMap;
    const parsed: unknown = JSON.parse(el.textContent);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      cachedMap = parsed as PrerenderDataMap;
    }
  } catch {
    cachedMap = null;
  }
  return cachedMap;
}

function getRaw(key: string): unknown {
  const map = readEmbeddedMap();
  if (!map) return undefined;
  return map[key];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// --- Key builders (must match buildPrerenderDataKey in scripts/prerender.cjs) ---

export function versesByChapterKey(
  chapterId: number,
  page: number,
  perPage: number,
  translationId: number,
  reciterId: number
): string {
  return `verses:by_chapter:${chapterId}:${page}:${perPage}:${buildTranslationsParam(translationId)}:${reciterId}`;
}

export function versesByJuzKey(
  juzNumber: number,
  page: number,
  perPage: number,
  translationId: number,
  reciterId: number
): string {
  return `verses:by_juz:${juzNumber}:${page}:${perPage}:${buildTranslationsParam(translationId)}:${reciterId}`;
}

export function verseByKeyKey(
  verseKey: string,
  translationId: number,
  reciterId: number
): string {
  return `verses:by_key:${verseKey}:${buildTranslationsParam(translationId)}:${reciterId}`;
}

export function versesByKeysKey(
  keys: string[],
  translationId: number,
  reciterId: number
): string {
  return `verses:keys:${keys.join(',')}:${buildTranslationsParam(translationId)}:${reciterId}`;
}

export function tafsirKey(tafsirId: number, verseKey: string): string {
  return `tafsirs:${tafsirId}:by_ayah:${verseKey}`;
}

// --- Metadata (seeded into ReaderContext) ---

export function getEmbeddedChapters(): Chapter[] | null {
  const rec = asRecord(getRaw('chapters'));
  const list = rec ? rec.chapters : null;
  if (!Array.isArray(list) || list.length === 0) return null;
  try {
    return (list as Chapter[]).map(normalizeChapterMetadata);
  } catch {
    return null;
  }
}

export function getEmbeddedChapter(
  id: number
): { chapter: Chapter; chapter_info: { short_text?: string; source?: string } | null } | null {
  const rec = asRecord(getRaw(`chapter:${id}`));
  if (!rec || !rec.chapter) return null;
  try {
    return {
      chapter: normalizeChapterMetadata(rec.chapter as Chapter),
      chapter_info: (rec.chapter_info as { short_text?: string; source?: string } | null) ?? null,
    };
  } catch {
    return null;
  }
}

export function getEmbeddedJuzs(): Juz[] | null {
  const rec = asRecord(getRaw('juzs'));
  const list = rec ? rec.juzs : null;
  return Array.isArray(list) && list.length > 0 ? (list as Juz[]) : null;
}

export function getEmbeddedRecitations(): Reciter[] | null {
  const rec = asRecord(getRaw('recitations'));
  const list = rec ? rec.recitations : null;
  if (!Array.isArray(list) || list.length === 0) return null;
  try {
    return (list as Reciter[]).map(normalizeReciterMetadata);
  } catch {
    return null;
  }
}

export function getEmbeddedTranslations(): TranslationResource[] | null {
  const rec = asRecord(getRaw('translations'));
  const list = rec ? rec.translations : null;
  return Array.isArray(list) && list.length > 0 ? (list as TranslationResource[]) : null;
}

// --- Verses (seeded into the reader pages) ---

export function getEmbeddedVersesByChapter(
  chapterId: number,
  page: number,
  perPage: number,
  translationId: number,
  reciterId: number
): { verses: Verse[]; pagination: PaginationInfo } | null {
  const rec = asRecord(
    getRaw(versesByChapterKey(chapterId, page, perPage, translationId, reciterId))
  );
  if (!rec || !Array.isArray(rec.verses) || rec.verses.length === 0) return null;
  const pagination = asRecord(rec.pagination);
  if (!pagination || typeof pagination.total_pages !== 'number') return null;
  return {
    verses: rec.verses as Verse[],
    pagination: pagination as unknown as PaginationInfo,
  };
}

export function getEmbeddedVersesByJuz(
  juzNumber: number,
  page: number,
  perPage: number,
  translationId: number,
  reciterId: number
): { verses: Verse[]; pagination: PaginationInfo } | null {
  const rec = asRecord(
    getRaw(versesByJuzKey(juzNumber, page, perPage, translationId, reciterId))
  );
  if (!rec || !Array.isArray(rec.verses) || rec.verses.length === 0) return null;
  const pagination = asRecord(rec.pagination);
  if (!pagination || typeof pagination.total_pages !== 'number') return null;
  return {
    verses: rec.verses as Verse[],
    pagination: pagination as unknown as PaginationInfo,
  };
}

export function getEmbeddedVerseByKey(
  verseKey: string,
  translationId: number,
  reciterId: number
): Verse | null {
  const rec = asRecord(getRaw(verseByKeyKey(verseKey, translationId, reciterId)));
  const verse = rec ? rec.verse : null;
  return verse && typeof verse === 'object' ? (verse as Verse) : null;
}

export function getEmbeddedVersesByKeys(
  keys: string[],
  translationId: number,
  reciterId: number
): Verse[] | null {
  const rec = asRecord(getRaw(versesByKeysKey(keys, translationId, reciterId)));
  const list = rec ? rec.verses : null;
  return Array.isArray(list) && list.length > 0 ? (list as Verse[]) : null;
}

// --- Tafsir (seeded into AyahTafsirSection on Ayah pages) ---
// The raw payload is the verbatim /api/tafsirs/<id>/by_ayah/<key> response
// ({tafsir} or {tafsirs: [...]}) — resolved the same way fetchVerseTafsir
// resolves it, so the seeded content is exactly what the snapshot shows.
export function getEmbeddedTafsir(
  tafsirId: number,
  verseKey: string
): TafsirContent | null {
  const rec = asRecord(getRaw(tafsirKey(tafsirId, verseKey)));
  if (!rec) return null;
  const resolved =
    (rec.tafsir as TafsirContent | null) ||
    (Array.isArray(rec.tafsirs) ? (rec.tafsirs[0] as TafsirContent) : undefined) ||
    (typeof rec.text === 'string' ? (rec as unknown as TafsirContent) : undefined);
  if (!resolved || typeof resolved.text !== 'string') return null;
  return resolved;
}
