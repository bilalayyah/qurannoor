import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchChapters,
  fetchJuzs,
  fetchRecitations,
  fetchTranslations,
} from '../services/quranApi';
import type {
  BookmarkItem,
  Chapter,
  Juz,
  LastReadAyah,
  ReaderSettings,
  ReadingProgress,
  Reciter,
  ThemeMode,
  TranslationResource,
} from '../types/quran';
import {
  getEmbeddedChapters,
  getEmbeddedJuzs,
  getEmbeddedRecitations,
  getEmbeddedTranslations,
} from '../utils/prerenderData';
import { SURAH_NAMES, SURAH_VERSE_COUNTS } from '../utils/surahCatalog';
import { toSurahSlug } from '../utils/slugs';

const STORAGE_KEYS = {
  SETTINGS: 'qurannoor_reader_settings_v1',
  ARABIC_SIZE_MIGRATED: 'qurannoor_arabic_size_v2_migrated',
  ARABIC_SIZE_MIGRATED_V3: 'qurannoor_arabic_size_v3_migrated',
  BOOKMARKS: 'qurannoor_bookmarks_v1',
  PROGRESS: 'qurannoor_reading_progress_v1',
  LAST_READ: 'qurannoor_last_read',
};

const LEGACY_KEYS = {
  SETTINGS: 'bayan_reader_settings_v1',
  BOOKMARKS: 'bayan_bookmarks_v1',
  PROGRESS: 'bayan_reading_progress_v1',
};

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  script: 'uthmani',
  arabicFont: 'scheherazade',
  arabicFontSize: 28,
  translationFontSize: 17,
  translationId: 20, // Saheeh International
  reciterId: 7, // Mishary Rashid al-Afasy
  showTranslation: true,
  autoPlayNext: true,
  repeatAyah: false,
  hifzMode: false,
  tajweedColors: false,
  ttsRate: 1.0,
  ttsVoiceURI: '',
};

interface ReaderContextValue {
  settings: ReaderSettings;
  updateSettings: (partial: Partial<ReaderSettings>) => void;
  cycleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  chapters: Chapter[];
  chaptersLoading: boolean;
  chaptersError: string | null;
  reloadMetadata: () => void;
  juzs: Juz[];
  reciters: Reciter[];
  translations: TranslationResource[];
  bookmarks: BookmarkItem[];
  isBookmarked: (verseKey: string) => boolean;
  toggleBookmark: (item: Omit<BookmarkItem, 'createdAt'>) => void;
  removeBookmark: (verseKey: string) => void;
  readingProgress: ReadingProgress | null;
  saveReadingProgress: (progress: Omit<ReadingProgress, 'updatedAt'>) => void;
  lastRead: LastReadAyah | null;
  recordAyahRead: (verseKey: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const ReaderContext = createContext<ReaderContextValue | null>(null);

function loadFromStorage<T>(key: string, legacyKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key) || localStorage.getItem(legacyKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// H-1: first-render parity with the prerendered HTML. The prerender
// snapshot was rendered with DEFAULT settings and EMPTY stored state
// (fresh browser), so the first client render must use exactly those —
// stored settings/bookmarks/progress are applied in the mount effect
// below (one post-hydration update). The migration logic lives here too
// (it used to run inside the state initializer).
function resolveStoredSettings(): ReaderSettings {
  const stored = loadFromStorage<
    Omit<Partial<ReaderSettings>, 'arabicFont'> & { arabicFont?: string }
  >(STORAGE_KEYS.SETTINGS, LEGACY_KEYS.SETTINGS, {});
  const normalizedFont: ReaderSettings['arabicFont'] =
    stored.arabicFont === 'noto-naskh' || stored.arabicFont === 'lateef'
      ? stored.arabicFont
      : 'scheherazade';

  let resolvedArabicSize =
    typeof stored.arabicFontSize === 'number' && Number.isFinite(stored.arabicFontSize)
      ? stored.arabicFontSize
      : DEFAULT_SETTINGS.arabicFontSize;

  try {
    const migrated = localStorage.getItem(STORAGE_KEYS.ARABIC_SIZE_MIGRATED);
    if (!migrated) {
      if (stored.arabicFontSize === undefined || stored.arabicFontSize < 28) {
        resolvedArabicSize = DEFAULT_SETTINGS.arabicFontSize;
      }
      localStorage.setItem(STORAGE_KEYS.ARABIC_SIZE_MIGRATED, '1');
    }
  } catch {
    // ignore storage errors
  }

  try {
    const migratedV3 = localStorage.getItem(STORAGE_KEYS.ARABIC_SIZE_MIGRATED_V3);
    if (!migratedV3) {
      if (resolvedArabicSize < 28) {
        resolvedArabicSize = 28;
      }
      localStorage.setItem(STORAGE_KEYS.ARABIC_SIZE_MIGRATED_V3, '1');
    }
  } catch {
    // ignore storage errors
  }

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    arabicFont: normalizedFont,
    arabicFontSize: resolvedArabicSize,
  };
}

function loadStoredLastRead(): LastReadAyah | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_READ);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastReadAyah>;
    if (
      typeof parsed?.chapterId === 'number' &&
      typeof parsed?.verseNumber === 'number' &&
      typeof parsed?.verseKey === 'string' &&
      typeof parsed?.chapterName === 'string' &&
      typeof parsed?.chapterSlug === 'string'
    ) {
      return {
        chapterId: parsed.chapterId,
        chapterName: parsed.chapterName,
        chapterArabicName: parsed.chapterArabicName || '',
        chapterSlug: parsed.chapterSlug,
        verseNumber: parsed.verseNumber,
        verseKey: parsed.verseKey,
        totalVerses:
          typeof parsed.totalVerses === 'number' && parsed.totalVerses > 0
            ? parsed.totalVerses
            : SURAH_VERSE_COUNTS[parsed.chapterId - 1] || 7,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  // H-1: defaults on first render (= the prerendered HTML); stored state
  // is applied by the mount effect below, after hydration.
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null);
  const [lastRead, setLastRead] = useState<LastReadAyah | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // H-1: apply stored state AFTER the first render (post-hydration), so
  // the first render matches the prerendered HTML. The `hydrated` flag
  // gates the persist effects below: without it they would write the
  // mount-time defaults over the stored values before they are read
  // (effects in the mount commit still see the pre-update state).
  useEffect(() => {
    setSettings(resolveStoredSettings());
    setBookmarks(loadFromStorage<BookmarkItem[]>(STORAGE_KEYS.BOOKMARKS, LEGACY_KEYS.BOOKMARKS, []));
    setReadingProgress(
      loadFromStorage<ReadingProgress | null>(STORAGE_KEYS.PROGRESS, LEGACY_KEYS.PROGRESS, null)
    );
    setLastRead(loadStoredLastRead());
    setHydrated(true);
  }, []);

  // H-1: metadata seeded from the embedded prerender data (the same
  // responses the prerendered HTML was rendered from), so list pages
  // hydrate with their content instead of a loading state.
  const [chapters, setChapters] = useState<Chapter[]>(() => getEmbeddedChapters() ?? []);
  const chaptersRef = useRef<Chapter[]>([]);
  chaptersRef.current = chapters;
  const [chaptersLoading, setChaptersLoading] = useState(() => getEmbeddedChapters() === null);
  const [chaptersError, setChaptersError] = useState<string | null>(null);
  const [juzs, setJuzs] = useState<Juz[]>(() => getEmbeddedJuzs() ?? []);
  const [reciters, setReciters] = useState<Reciter[]>(() => getEmbeddedRecitations() ?? []);
  const [translations, setTranslations] = useState<TranslationResource[]>(() => getEmbeddedTranslations() ?? []);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'sepia');
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'sepia') {
      root.classList.add('sepia');
    }
  }, [settings.theme]);

  // Persist settings (H-1: gated on `hydrated` — without the gate this
  // effect would write the mount-time defaults over the stored values
  // in the mount commit, before the hydration effect above reads them).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
  }, [settings, hydrated]);

  // Persist bookmarks
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
  }, [bookmarks, hydrated]);

  // Persist progress
  useEffect(() => {
    if (!hydrated || !readingProgress) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(readingProgress));
    } catch {
      // ignore
    }
  }, [readingProgress, hydrated]);

  // Persist last read ayah
  useEffect(() => {
    if (!hydrated || !lastRead) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_READ, JSON.stringify(lastRead));
    } catch {
      // ignore
    }
  }, [lastRead, hydrated]);

  const loadMetadata = useCallback(async () => {
    // H-1: chapters/juzs seeded from the embedded prerender data need no
    // fetch (the data is static). Recitations/translations are ALWAYS
    // refreshed in the background: the embedded copies come from the
    // PUBLIC API host used by the local prerender server (14 reciters),
    // while production serves the authenticated list (23 reciters) — the
    // refresh swaps in the authoritative lists without touching the
    // loading state, so list pages never flash.
    const needChapters = getEmbeddedChapters() === null;
    const needJuzs = getEmbeddedJuzs() === null;
    if (needChapters || needJuzs) {
      setChaptersLoading(true);
      setChaptersError(null);
      try {
        const [chaptersData, juzsData] = await Promise.all([
          needChapters ? fetchChapters() : Promise.resolve(null),
          needJuzs ? fetchJuzs() : Promise.resolve(null),
        ]);
        if (chaptersData) setChapters(chaptersData);
        if (juzsData) setJuzs(juzsData);
      } catch (err) {
        setChaptersError(err instanceof Error ? err.message : 'Unable to load Quran metadata');
      } finally {
        setChaptersLoading(false);
      }
    } else {
      setChaptersLoading(false);
    }
    // Background refresh of the two lists that can differ between the
    // public (prerender) and authenticated (production) hosts. Failures
    // are silent — the seeded lists keep working.
    try {
      const [recitersData, translationsData] = await Promise.all([
        fetchRecitations(),
        fetchTranslations(),
      ]);
      setReciters(recitersData);
      setTranslations(translationsData);
    } catch {
      // ignore — seeded lists remain
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const updateSettings = useCallback((partial: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const cycleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  const isBookmarked = useCallback(
    (verseKey: string) => bookmarks.some((b) => b.verseKey === verseKey),
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    (item: Omit<BookmarkItem, 'createdAt'>) => {
      setBookmarks((prev) => {
        const exists = prev.some((b) => b.verseKey === item.verseKey);
        if (exists) {
          showToast(`Removed ${item.verseKey} from bookmarks`);
          return prev.filter((b) => b.verseKey !== item.verseKey);
        }
        showToast(`Bookmarked ${item.chapterName} ${item.verseKey}`);
        return [{ ...item, createdAt: Date.now() }, ...prev];
      });
    },
    [showToast]
  );

  const removeBookmark = useCallback(
    (verseKey: string) => {
      setBookmarks((prev) => prev.filter((b) => b.verseKey !== verseKey));
      showToast(`Removed ${verseKey} from bookmarks`);
    },
    [showToast]
  );

  const saveReadingProgress = useCallback((progress: Omit<ReadingProgress, 'updatedAt'>) => {
    setReadingProgress({
      ...progress,
      updatedAt: Date.now(),
    });
  }, []);

  const recordAyahRead = useCallback((verseKey: string) => {
    if (!verseKey) return;

    const [chStr, vStr] = verseKey.split(':');
    const chapterId = Number(chStr);
    const verseNumber = Number(vStr);
    if (
      Number.isInteger(chapterId) &&
      chapterId >= 1 &&
      chapterId <= 114 &&
      Number.isInteger(verseNumber) &&
      verseNumber >= 1
    ) {
      const ch = chaptersRef.current.find((c) => c.id === chapterId);
      const chapterName = ch?.name_simple || SURAH_NAMES[chapterId - 1] || `Surah ${chapterId}`;
      const nextLastRead: LastReadAyah = {
        chapterId,
        chapterName,
        chapterArabicName: ch?.name_arabic || '',
        chapterSlug: toSurahSlug(chapterName),
        verseNumber,
        verseKey,
        totalVerses: ch?.verses_count || SURAH_VERSE_COUNTS[chapterId - 1] || 7,
        updatedAt: Date.now(),
      };
      setLastRead(nextLastRead);
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_READ, JSON.stringify(nextLastRead));
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <ReaderContext.Provider
      value={{
        settings,
        updateSettings,
        cycleTheme,
        setTheme,
        chapters,
        chaptersLoading,
        chaptersError,
        reloadMetadata: loadMetadata,
        juzs,
        reciters,
        translations,
        bookmarks,
        isBookmarked,
        toggleBookmark,
        removeBookmark,
        readingProgress,
        saveReadingProgress,
        lastRead,
        recordAyahRead,
        isSettingsOpen,
        setIsSettingsOpen,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const ctx = useContext(ReaderContext);
  if (!ctx) throw new Error('useReader must be used within ReaderProvider');
  return ctx;
}
