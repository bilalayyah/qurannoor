export interface TranslatedName {
  language_name: string;
  name: string;
}

export interface Chapter {
  id: number;
  revelation_place: 'makkah' | 'madinah' | string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
  translated_name: TranslatedName;
  slug?: string;
  available_in_prelive?: boolean;
}

export interface VerseTranslation {
  id: number;
  resource_id: number;
  text: string;
  resource_name?: string;
}

export interface VerseAudio {
  url: string;
  segments?: Array<[number, number, number, number]>;
}

export interface VerseWord {
  id: number;
  position: number;
  audio_url?: string | null;
  char_type_name: 'word' | 'end' | string;
  text_qpc_hafs?: string;
  text_uthmani?: string;
  text_indopak?: string;
  text_uthmani_tajweed?: string;
  text?: string;
  translation?: {
    text: string;
    language_name?: string;
  } | null;
  transliteration?: {
    text: string;
    language_name?: string;
  } | null;
}

export interface Verse {
  id: number;
  verse_number: number;
  verse_key: string;
  hizb_number: number;
  rub_el_hizb_number: number;
  ruku_number: number;
  manzil_number: number;
  sajdah_number: number | null;
  text_qpc_hafs?: string;
  text_uthmani: string;
  text_indopak?: string;
  text_uthmani_tajweed?: string;
  page_number: number;
  juz_number: number;
  audio?: VerseAudio;
  words?: VerseWord[];
  translations?: VerseTranslation[];
}

export interface TafsirContent {
  resource_id: number;
  resource_name: string;
  slug?: string;
  language_id?: number;
  translated_name?: TranslatedName;
  text: string;
}

export interface PaginationInfo {
  per_page: number;
  current_page: number;
  next_page: number | null;
  total_pages: number;
  total_records: number;
}

export interface Juz {
  id: number;
  juz_number: number;
  verse_mapping: Record<string, string>;
  first_verse_id: number;
  last_verse_id: number;
  verses_count: number;
  available_in_prelive?: boolean;
}

export interface Reciter {
  id: number;
  reciter_name: string;
  style: string | null;
  qirat?: string | null;
  translated_name?: {
    name: string;
    language_name: string;
  };
  audio_capabilities?: {
    verse_by_verse: boolean;
    full_surah: boolean;
    verse_via_segments?: boolean;
  };
}

export interface ChapterTimestamp {
  verse_key: string;
  timestamp_from: number;
  timestamp_to: number;
  duration?: number | null;
}

export interface ChapterAudioFile {
  audio_url: string;
  file_size?: number;
  format?: string;
  timestamps?: ChapterTimestamp[];
}

export interface TranslationResource {
  id: number;
  name: string;
  author_name: string;
  slug: string;
  language_name: string;
  translated_name?: TranslatedName;
}

export interface SearchResult {
  verse_key: string;
  verse_id: number;
  text: string;
  highlighted?: string | null;
  translations?: Array<{
    text: string;
    resource_id: number;
    name: string;
    language_name: string;
  }>;
}

export interface SearchResponse {
  query: string;
  total_results: number;
  current_page: number;
  total_pages: number;
  results: SearchResult[];
}

export type ThemeMode = 'light' | 'sepia' | 'dark';
export type QuranScript = 'uthmani' | 'indopak';
export type ArabicFontFamily = 'scheherazade' | 'noto-naskh' | 'lateef';

export type RepeatMode = 1 | 3 | 5 | 'loop';

export interface AyahRepeatRange {
  startKey: string;
  endKey: string;
}

export interface ReaderSettings {
  theme: ThemeMode;
  script: QuranScript;
  arabicFont: ArabicFontFamily;
  arabicFontSize: number; // px, e.g. 28 - 52
  translationFontSize: number; // px, e.g. 14 - 22
  translationId: number;
  reciterId: number;
  showTranslation: boolean;
  autoPlayNext: boolean;
  autoPlayUrduAfterArabic: boolean;
  repeatAyah: boolean;
  hifzMode: boolean;
  tajweedColors: boolean;
  ttsRate: number;
  ttsVoiceURI: string;
}

export interface BookmarkItem {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  chapterName: string;
  chapterArabicName: string;
  textArabic: string;
  translationSnippet: string;
  createdAt: number;
}

export interface ReadingProgress {
  chapterId: number;
  chapterName: string;
  chapterArabicName: string;
  chapterSlug: string;
  verseNumber: number;
  verseKey: string;
  totalVerses: number;
  juzNumber?: number;
  updatedAt: number;
}

export interface LastReadAyah {
  chapterId: number;
  chapterName: string;
  chapterArabicName: string;
  chapterSlug: string;
  verseNumber: number;
  verseKey: string;
  totalVerses: number;
  updatedAt: number;
}

export interface PopularSectionItem {
  slug: string;
  title: string;
  arabicTitle: string;
  subtitle: string;
  referenceLabel: string;
  type: 'chapter' | 'verse' | 'range';
  chapterId: number;
  verseKeys?: string[];
}

