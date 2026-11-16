import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
  ReaderSettings,
  ReadingProgress,
  Reciter,
  ThemeMode,
  TranslationResource,
} from '../types/quran';

const STORAGE_KEYS = {
  SETTINGS: 'qurannoor_reader_settings_v1',
  BOOKMARKS: 'qurannoor_bookmarks_v1',
  PROGRESS: 'qurannoor_reading_progress_v1',
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
  arabicFontSize: 34,
  translationFontSize: 17,
  translationId: 85, // M.A.S. Abdel Haleem
  reciterId: 7, // Mishary Rashid al-Afasy
  showTranslation: true,
  autoPlayNext: true,
  repeatAyah: false,
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
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      arabicFont: normalizedFont,
    };
  });

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() =>
    loadFromStorage<BookmarkItem[]>(STORAGE_KEYS.BOOKMARKS, LEGACY_KEYS.BOOKMARKS, [])
  );

  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(() =>
    loadFromStorage<ReadingProgress | null>(STORAGE_KEYS.PROGRESS, LEGACY_KEYS.PROGRESS, null)
  );

  const [chapters, setChapters] = useState<Chapter[]>([]);
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
