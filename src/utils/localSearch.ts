export interface LocalQuranSearchMatch {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  textArabic: string;
  textEnglish: string;
  englishSnippet: string;
  matchedField: 'english' | 'arabic';
}

export interface LocalQuranSearchResponse {
  query: string;
  results: LocalQuranSearchMatch[];
  totalMatches: number;
  capped: boolean;
}

type RawIndexRow = [string, string, string];

interface IndexedVerse {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  ar: string;
  en: string;
  arNorm: string;
  enNorm: string;
}

export const MAX_LOCAL_SEARCH_RESULTS = 50;

let cachedIndexPromise: Promise<IndexedVerse[]> | null = null;

export function normalizeLatinForSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeArabicForSearch(input: string): string {
  return input
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadSearchIndex(): Promise<IndexedVerse[]> {
  if (!cachedIndexPromise) {
    cachedIndexPromise = (async () => {
      const res = await fetch('/quran-search-index.json');
      if (!res.ok) {
        throw new Error(`Unable to load Quran search index (${res.status})`);
      }
      const rows = (await res.json()) as RawIndexRow[];
      return rows.map(([verseKey, ar, en]) => {
        const [chStr, vStr] = verseKey.split(':');
        return {
          verseKey,
          chapterId: Number(chStr),
          verseNumber: Number(vStr),
          ar,
          en,
          arNorm: normalizeArabicForSearch(ar),
          enNorm: normalizeLatinForSearch(en),
        };
      });
    })().catch((err) => {
      cachedIndexPromise = null;
      throw err;
    });
  }
  return cachedIndexPromise;
}

// M-8 (re-audit): single shared loader for the search index.
// BookmarksPage used to fetch '/quran-search-index.json' a second time to
// build its verseKey -> QPC-Arabic map; it now shares this module's cached
// promise, so a session that visits Search then Bookmarks (or vice versa)
// issues exactly one fetch (plus the service worker's cache-first layer).
export async function getQpcArabicMap(): Promise<Map<string, string>> {
  const verses = await loadSearchIndex();
  return new Map(verses.map((v) => [v.verseKey, v.ar]));
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEnglishSnippet(text: string, queryTerms: string[]): string {
  if (!text || text.length <= 240) return text;
  const lower = normalizeLatinForSearch(text);
  let firstIdx = -1;
  for (const term of queryTerms) {
    if (!term) continue;
    const idx = lower.indexOf(term);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }
  if (firstIdx === -1) {
    return `${text.slice(0, 220).trimEnd()}…`;
  }
  const start = Math.max(0, firstIdx - 70);
  const end = Math.min(text.length, start + 230);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

export async function searchLocalQuran(
  rawQuery: string,
  limit = MAX_LOCAL_SEARCH_RESULTS
): Promise<LocalQuranSearchResponse> {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { query: rawQuery, results: [], totalMatches: 0, capped: false };
  }

  const index = await loadSearchIndex();

  const latinQuery = normalizeLatinForSearch(trimmed);
  const latinTerms = latinQuery.split(' ').filter(Boolean);
  const arabicQuery = normalizeArabicForSearch(trimmed);
  const arabicTerms = arabicQuery.split(' ').filter(Boolean);

  const hasArabicChars = /[\u0600-\u06FF]/.test(trimmed);
  const hasLatinChars = /[a-z0-9]/i.test(latinQuery);

  const wholeWordRegexes = latinTerms.map((t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i'));

  const scored: Array<{ score: number; item: IndexedVerse; matchedField: 'english' | 'arabic' }> = [];

  for (const item of index) {
    let score = 0;
    let matchedField: 'english' | 'arabic' | null = null;

    if (hasLatinChars && latinTerms.length > 0) {
      const allEnMatch = latinTerms.every((term) => item.enNorm.includes(term));
      if (allEnMatch) {
        matchedField = 'english';
        score += 10;
        if (latinTerms.length > 1 && item.enNorm.includes(latinQuery)) {
          score += 20;
        }
        for (const rx of wholeWordRegexes) {
          if (rx.test(item.enNorm)) {
            score += 15;
          }
        }
      }
    }

    if (hasArabicChars) {
      if (arabicTerms.length > 0 && arabicTerms.every((term) => item.arNorm.includes(term))) {
        score += item.arNorm.includes(arabicQuery) ? 35 : 20;
        if (!matchedField) matchedField = 'arabic';
      }
    }

    if (matchedField && score > 0) {
      scored.push({ score, item, matchedField });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.item.chapterId !== b.item.chapterId) return a.item.chapterId - b.item.chapterId;
    return a.item.verseNumber - b.item.verseNumber;
  });

  const totalMatches = scored.length;
  const capped = totalMatches > limit;
  const results: LocalQuranSearchMatch[] = scored.slice(0, limit).map(({ item, matchedField }) => ({
    verseKey: item.verseKey,
    chapterId: item.chapterId,
    verseNumber: item.verseNumber,
    textArabic: item.ar,
    textEnglish: item.en,
    englishSnippet: buildEnglishSnippet(item.en, latinTerms),
    matchedField,
  }));

  return {
    query: trimmed,
    results,
    totalMatches,
    capped,
  };
}
