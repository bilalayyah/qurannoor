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
  autoPlayUrduAfterArabic: false,
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

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(() => {
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
  });

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() =>
    loadFromStorage<BookmarkItem[]>(STORAGE_KEYS.BOOKMARKS, LEGACY_KEYS.BOOKMARKS, [])
  );

  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(() =>
    loadFromStorage<ReadingProgress | null>(STORAGE_KEYS.PROGRESS, LEGACY_KEYS.PROGRESS, null)
  );

  const [lastRead, setLastRead] = useState<LastReadAyah | null>(() => {
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
  });

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const chaptersRef = useRef<Chapter[]>([]);
  chaptersRef.current = chapters;
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [chaptersError, setChaptersError] = useState<string | null>(null);
  const [juzs, setJuzs] = useState<Juz[]>([]);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [translations, setTranslations] = useState<TranslationResource[]>([]);
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

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
  }, [settings]);

  // Persist bookmarks
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
  }, [bookmarks]);

  // Persist progress
  useEffect(() => {
    if (!readingProgress) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(readingProgress));
    } catch {
      // ignore
    }
  }, [readingProgress]);

  // Persist last read ayah
  useEffect(() => {
    if (!lastRead) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_READ, JSON.stringify(lastRead));
    } catch {
      // ignore
    }
  }, [lastRead]);

  const loadMetadata = useCallback(async () => {
    setChaptersLoading(true);
    setChaptersError(null);
    try {
      const [chaptersData, juzsData, recitersData, translationsData] = await Promise.all([
        fetchChapters(),
        fetchJuzs(),
        fetchRecitations(),
        fetchTranslations(),
      ]);
      setChapters(chaptersData);
      setJuzs(juzsData);
      setReciters(recitersData);
      setTranslations(translationsData);
    } catch (err) {
      setChaptersError(err instanceof Error ? err.message : 'Unable to load Quran metadata');
    } finally {
      setChaptersLoading(false);
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
