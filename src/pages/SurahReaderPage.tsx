import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Pause,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AyahCard } from '../components/AyahCard';
import { BackToTopButton } from '../components/BackToTopButton';
import { BismillahHeader } from '../components/BismillahHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { HifzControlsBar } from '../components/HifzControlsBar';
import { ReciterSelector } from '../components/ReciterSelector';
import { ErrorBanner, VerseListSkeleton } from '../components/StatusStates';
import {
  VirtualizedVerseChunks,
  type LoadedVerseChunk,
} from '../components/VirtualizedVerseChunks';
import { useAudio, type PlayableAyah } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import { useHifzReader } from '../hooks/useHifzReader';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { fetchChapterDetails, fetchVersesByChapter } from '../services/quranApi';
import { getEmbeddedChapter, getEmbeddedVersesByChapter } from '../utils/prerenderData';
import type { Chapter, Verse } from '../types/quran';
import { POPULAR_SECTIONS, resolveChapterIdFromParam, toSurahSlug } from '../utils/slugs';
import { getEnglishTranslation, stripHtmlTags } from '../utils/text';

const CHUNK_SIZE = 15;

export function SurahReaderPage() {
  const { slug, ayahNumber } = useParams<{ slug: string; ayahNumber?: string }>();
  const [searchParams] = useSearchParams();

  const {
    chapters,
    juzs,
    settings,
    saveReadingProgress,
    setIsSettingsOpen,
  } = useReader();
  const {
    isPlaying,
    audioMode,
    playbackKind,
    activeChapterId,
    playFullSurah,
    playAyah,
    togglePlayPause,
    updateQueue,
    activeVerseKey,
    setQueueEndHandler,
    continueAfterPageAdvance,
    cancelPageAdvance,
  } = useAudio();

  const targetAyahParam = Number(searchParams.get('ayah') || ayahNumber || 0) || null;

  const chapterId = useMemo(
    () => resolveChapterIdFromParam(slug, chapters),
    [slug, chapters]
  );

  // H-1: seed the first render from the embedded prerender data (the same
  // responses the prerendered HTML was rendered from), so hydration
  // reproduces the 15 prerendered articles instead of a skeleton. The
  // embedded data is keyed to the DEFAULT settings (the settings the
  // prerender used), so the lookups only hit while settings are still
  // defaults — after hydration applies stored settings they miss and the
  // existing settings-refresh effect re-fetches. On client-side
  // navigation they miss too (no embedded data for that page) and the
  // fetch path runs, unchanged.
  const startChunk = targetAyahParam && targetAyahParam > 0
    ? Math.ceil(targetAyahParam / CHUNK_SIZE)
    : 1;
  const seededChapter = chapterId !== null ? getEmbeddedChapter(chapterId) : null;
  const seededVerses = chapterId !== null
    ? getEmbeddedVersesByChapter(chapterId, startChunk, CHUNK_SIZE, settings.translationId, settings.reciterId)
    : null;

  const [chapter, setChapter] = useState<Chapter | null>(() => seededChapter?.chapter ?? null);
  const [chapterInfoText, setChapterInfoText] = useState<string>(() => seededChapter?.chapter_info?.short_text || '');
  const [showSurahInfo, setShowSurahInfo] = useState(false);

  const [chunksByPage, setChunksByPage] = useState<Record<number, Verse[]>>(() =>
    seededVerses ? { [startChunk]: seededVerses.verses } : {}
  );
  const [totalPages, setTotalPages] = useState<number>(() =>
    seededVerses ? Math.max(1, seededVerses.pagination?.total_pages || 1) : 1
  );
  const [loadingInitial, setLoadingInitial] = useState(() => seededVerses === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [jumpAyahInput, setJumpAyahInput] = useState('');
  const [highlightedVerseKey, setHighlightedVerseKey] = useState<string | null>(null);
  const [forcedMountPage, setForcedMountPage] = useState<number | null>(() =>
    seededVerses ? startChunk : null
  );

  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const requestVersionRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const loadingEarlierRef = useRef(false);
  const pendingScrollTargetKeyRef = useRef<string | null>(null);
  const pendingAutoAdvanceRef = useRef<{ page: number; firstVerseKey: string | null } | null>(null);
  const prependLockRef = useRef<{ page: number; prevTop: number } | null>(null);
  const jumpCooldownUntilRef = useRef(0);
  const activeSettingsRef = useRef({
    translationId: settings.translationId,
    reciterId: settings.reciterId,
  });
  const loadedSessionChapterRef = useRef<number | null>(null);
  const chunksByPageRef = useRef<Record<number, Verse[]>>({});
  chunksByPageRef.current = chunksByPage;

  const loadedPages = useMemo(
    () =>
      Object.keys(chunksByPage)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
        .sort((a, b) => a - b),
    [chunksByPage]
  );

  const chunks: LoadedVerseChunk[] = useMemo(
    () => loadedPages.map((page) => ({ page, verses: chunksByPage[page] || [] })),
    [loadedPages, chunksByPage]
  );

  const verses: Verse[] = useMemo(
    () => chunks.flatMap((c) => c.verses),
    [chunks]
  );

  const minLoadedPage = loadedPages[0] ?? 1;
  const maxLoadedPage = loadedPages[loadedPages.length - 1] ?? 1;
  const hasMore = maxLoadedPage < totalPages;
  const hasEarlier = minLoadedPage > 1;

  const { isVerseBlurred, revealVerse } = useHifzReader(
    verses,
    activeVerseKey,
    settings.hifzMode,
    `surah-${chapterId || 0}`
  );

  // Clear one-shot forcedMountPage after allowing VirtualizedVerseChunks to pick up the anchor
  useEffect(() => {
    if (forcedMountPage === null) return;
    const id = window.setTimeout(() => setForcedMountPage(null), 150);
    return () => window.clearTimeout(id);
  }, [forcedMountPage]);

  // Preserve exact scroll offset when earlier chunks prepend above the current viewport
  useLayoutEffect(() => {
    const lock = prependLockRef.current;
    if (!lock) return;
    prependLockRef.current = null;
    const anchorEl = document.querySelector<HTMLElement>(`[data-chunk-page="${lock.page}"]`);
    if (anchorEl) {
      const nextTop = anchorEl.getBoundingClientRect().top;
      const delta = nextTop - lock.prevTop;
      if (Math.abs(delta) > 1) {
        window.scrollBy(0, delta);
      }
    }
  }, [chunks]);

  // Applies a loaded first chunk (fetched or seeded) — shared tail of the
  // initial load: chapter metadata, the chunk, the anchor, highlight and
  // the reading-progress save.
  const applyInitialLoad = useCallback((
    details: { chapter: Chapter; chapter_info?: { short_text?: string } | null },
    versesData: { verses: Verse[]; pagination?: { total_pages?: number } | null },
  ) => {
    loadedSessionChapterRef.current = details.chapter.id;
    setChapter(details.chapter);
    setChapterInfoText(details.chapter_info?.short_text || '');
    setChunksByPage({ [startChunk]: versesData.verses });
    setTotalPages(Math.max(1, versesData.pagination?.total_pages || 1));
    setForcedMountPage(startChunk);

    if (targetAyahParam && targetAyahParam > 0) {
      const key = `${details.chapter.id}:${targetAyahParam}`;
      setHighlightedVerseKey(key);
      pendingScrollTargetKeyRef.current = key;
      jumpCooldownUntilRef.current = Date.now() + 900;
    } else {
      setHighlightedVerseKey(null);
      pendingScrollTargetKeyRef.current = null;
    }

    const firstVerse = versesData.verses[0];
    if (firstVerse && details.chapter) {
      const targetVerse = targetAyahParam
        ? versesData.verses.find((v) => v.verse_number === targetAyahParam) || firstVerse
        : firstVerse;

      saveReadingProgress({
        chapterId: details.chapter.id,
        chapterName: details.chapter.name_simple,
        chapterArabicName: details.chapter.name_arabic,
        chapterSlug: toSurahSlug(details.chapter.name_simple),
        verseNumber: targetVerse.verse_number,
        verseKey: targetVerse.verse_key,
        totalVerses: details.chapter.verses_count,
        juzNumber: targetVerse.juz_number,
      });
    }
  }, [
    startChunk,
    targetAyahParam,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    saveReadingProgress,
  ]);

  // Initial load on chapter change or deep-linked targetAyahParam
  const loadInitialSurah = useCallback(async () => {
    if (!chapterId) {
      if (chapters.length > 0) {
        setError('Surah not found.');
        setLoadingInitial(false);
      }
      return;
    }

    const reqVersion = ++requestVersionRef.current;

    // H-1: seeded fast-path — the embedded payload is the data the
    // prerendered HTML was rendered from, so apply it without fetching.
    // The state initializers already hold it; this applies the success
    // tail (anchor, highlight, progress save) and marks the session
    // loaded so the settings-refresh effect can re-fetch after hydration
    // applies stored settings.
    if (seededVerses && seededChapter) {
      activeSettingsRef.current = {
        translationId: settings.translationId,
        reciterId: settings.reciterId,
      };
      applyInitialLoad(seededChapter, seededVerses);
      setLoadingInitial(false);
      return;
    }

    setShowSurahInfo(false);
    setLoadingInitial(true);
    setLoadingMore(false);
    setLoadingEarlier(false);
    loadingMoreRef.current = false;
    loadingEarlierRef.current = false;
    setLoadMoreError(null);
    setError(null);
    setErrorCode(null);
    setChunksByPage({});
    pendingAutoAdvanceRef.current = null;
    cancelPageAdvance();
    activeSettingsRef.current = {
      translationId: settings.translationId,
      reciterId: settings.reciterId,
    };

    try {
      const [details, versesData] = await Promise.all([
        fetchChapterDetails(chapterId),
        fetchVersesByChapter({
          chapterId,
          page: startChunk,
          perPage: CHUNK_SIZE,
          translationId: settings.translationId,
          reciterId: settings.reciterId,
        }),
      ]);

      if (reqVersion !== requestVersionRef.current) return;

      applyInitialLoad(details, versesData);
    } catch (err: unknown) {
      if (reqVersion !== requestVersionRef.current) return;
      pendingAutoAdvanceRef.current = null;
      cancelPageAdvance();
      const errObj = err as { message?: string; code?: string };
      const msg = errObj?.message || 'Unable to load Surah.';
      setError(msg);
      setErrorCode(errObj?.code || (msg.includes('Pre-live') ? 'PRELIVE_LIMITED' : null));
    } finally {
      if (reqVersion === requestVersionRef.current) {
        setLoadingInitial(false);
      }
    }
  }, [
    chapterId,
    chapters.length,
    targetAyahParam,
    applyInitialLoad,
    // NOTE: seededVerses/seededChapter are intentionally NOT deps — they
    // are mount/navigation-time constants; including them would re-run the
    // initial load (full reset + fetch) when hydration applies stored
    // settings, duplicating the settings-refresh effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    cancelPageAdvance,
  ]);

  useEffect(() => {
    loadInitialSurah();
  }, [loadInitialSurah]);

  // Refresh all already-loaded chunks in place when user changes translation or reciter mid-Surah
  useEffect(() => {
    if (!chapterId || loadingInitial) return;
    if (loadedSessionChapterRef.current !== chapterId) return;

    const prev = activeSettingsRef.current;
    if (
      prev.translationId === settings.translationId &&
      prev.reciterId === settings.reciterId
    ) {
      return;
    }
    activeSettingsRef.current = {
      translationId: settings.translationId,
      reciterId: settings.reciterId,
    };

    const currentPages = Object.keys(chunksByPageRef.current)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);

    if (currentPages.length === 0) return;

    const reqVersion = requestVersionRef.current;
    let cancelled = false;

    Promise.all(
      currentPages.map(async (page) => {
        const res = await fetchVersesByChapter({
          chapterId,
          page,
          perPage: CHUNK_SIZE,
          translationId: settings.translationId,
          reciterId: settings.reciterId,
        });
        return { page, verses: res.verses };
      })
    )
      .then((results) => {
        if (cancelled || reqVersion !== requestVersionRef.current) return;
        const updated: Record<number, Verse[]> = {};
        for (const item of results) {
          updated[item.page] = item.verses;
        }
        setChunksByPage(updated);
      })
      .catch(() => {
        // Ignore transient refresh failure; user retains already-rendered verses
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, loadingInitial, settings.translationId, settings.reciterId]);

  const loadNextChunk = useCallback(async () => {
    if (
      !chapterId ||
      loadingInitial ||
      loadingMoreRef.current ||
      maxLoadedPage >= totalPages
    ) {
      return false;
    }

    const nextPage = maxLoadedPage + 1;
    const reqVersion = requestVersionRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const data = await fetchVersesByChapter({
        chapterId,
        page: nextPage,
        perPage: CHUNK_SIZE,
        translationId: activeSettingsRef.current.translationId,
        reciterId: activeSettingsRef.current.reciterId,
      });

      if (reqVersion !== requestVersionRef.current) return false;

      setChunksByPage((prev) => ({
        ...prev,
        [nextPage]: data.verses,
      }));
      if (data.pagination?.total_pages) {
        setTotalPages(Math.max(1, data.pagination.total_pages));
      }
      if (
        pendingAutoAdvanceRef.current &&
        pendingAutoAdvanceRef.current.page === nextPage
      ) {
        pendingAutoAdvanceRef.current.firstVerseKey = data.verses[0]?.verse_key || null;
      }
      return true;
    } catch {
      if (reqVersion !== requestVersionRef.current) return false;
      setLoadMoreError('Unable to load more ayahs right now.');
      if (pendingAutoAdvanceRef.current?.page === nextPage) {
        pendingAutoAdvanceRef.current = null;
        cancelPageAdvance();
      }
      return false;
    } finally {
      if (reqVersion === requestVersionRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [chapterId, loadingInitial, maxLoadedPage, totalPages, cancelPageAdvance]);

  const loadPreviousChunk = useCallback(async () => {
    if (
      !chapterId ||
      loadingInitial ||
      loadingEarlierRef.current ||
      minLoadedPage <= 1
    ) {
      return false;
    }

    const prevPage = minLoadedPage - 1;
    const reqVersion = requestVersionRef.current;
    loadingEarlierRef.current = true;
    setLoadingEarlier(true);

    const anchorEl = document.querySelector<HTMLElement>(`[data-chunk-page="${minLoadedPage}"]`);
    if (anchorEl) {
      prependLockRef.current = {
        page: minLoadedPage,
        prevTop: anchorEl.getBoundingClientRect().top,
      };
    }

    try {
      const data = await fetchVersesByChapter({
        chapterId,
        page: prevPage,
        perPage: CHUNK_SIZE,
        translationId: activeSettingsRef.current.translationId,
        reciterId: activeSettingsRef.current.reciterId,
      });

      if (reqVersion !== requestVersionRef.current) return false;

      setChunksByPage((prev) => ({
        ...prev,
        [prevPage]: data.verses,
      }));
      return true;
    } catch {
      prependLockRef.current = null;
      return false;
    } finally {
      if (reqVersion === requestVersionRef.current) {
        loadingEarlierRef.current = false;
        setLoadingEarlier(false);
      }
    }
  }, [chapterId, loadingInitial, minLoadedPage]);

  // Bottom infinite scroll observer + scroll fallback
  useEffect(() => {
    if (loadingInitial || !hasMore || loadMoreError) return;

    const el = bottomSentinelRef.current;
    let observer: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            loadNextChunk();
          }
        },
        { rootMargin: '550px 0px' }
      );
      observer.observe(el);
    }

    const handleScrollCheck = () => {
      if (!bottomSentinelRef.current) return;
      const rect = bottomSentinelRef.current.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 550) {
        loadNextChunk();
      }
    };

    window.addEventListener('scroll', handleScrollCheck, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', handleScrollCheck);
    };
  }, [loadingInitial, hasMore, loadMoreError, loadNextChunk]);

  // Top infinite scroll observer (when user jumped past chunk 1 and scrolls upward)
  useEffect(() => {
    if (loadingInitial || !hasEarlier) return;

    const el = topSentinelRef.current;
    let observer: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && Date.now() > jumpCooldownUntilRef.current) {
            loadPreviousChunk();
          }
        },
        { rootMargin: '300px 0px' }
      );
      observer.observe(el);
    }

    return () => {
      observer?.disconnect();
    };
  }, [loadingInitial, hasEarlier, loadPreviousChunk]);

  // One-shot smooth scroll when jumping or opening a deep-linked ayah
  useEffect(() => {
    const key = pendingScrollTargetKeyRef.current;
    if (loadingInitial || !key) return;

    const scrollIfMounted = () => {
      const el = document.getElementById(`ayah-${key}`);
      if (el) {
        pendingScrollTargetKeyRef.current = null;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };

    if (!scrollIfMounted()) {
      const rafId = window.requestAnimationFrame(() => {
        scrollIfMounted();
      });
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [loadingInitial, chunks]);

  // Save Continue Reading when audio plays across verses
  useEffect(() => {
    if (!activeVerseKey || !chapter) return;
    const [chStr, vStr] = activeVerseKey.split(':');
    if (Number(chStr) === chapter.id) {
      const verseNum = Number(vStr);
      const matched = verses.find((v) => v.verse_number === verseNum);
      saveReadingProgress({
        chapterId: chapter.id,
        chapterName: chapter.name_simple,
        chapterArabicName: chapter.name_arabic,
        chapterSlug: toSurahSlug(chapter.name_simple),
        verseNumber: verseNum,
        verseKey: activeVerseKey,
        totalVerses: chapter.verses_count,
        juzNumber: matched?.juz_number,
      });
    }
  }, [activeVerseKey, chapter, verses, saveReadingProgress]);

  const queue: PlayableAyah[] = useMemo(() => {
    if (!chapter) return [];
    return verses.map((v) => ({
      verseKey: v.verse_key,
      chapterId: chapter.id,
      verseNumber: v.verse_number,
      chapterName: chapter.name_simple,
      audioUrl: v.audio?.url,
      translationText: stripHtmlTags(
        getEnglishTranslation(v.translations, settings.translationId)?.text || ''
      ),
    }));
  }, [verses, chapter, settings.translationId]);

  useEffect(() => {
    if (!loadingInitial && chapterId && queue.length > 0) {
      updateQueue(queue);
    }
  }, [loadingInitial, chapterId, queue, updateQueue]);

  // Auto-advance audio cleanly across infinite-scroll chunk boundaries, stopping at Surah end
  useEffect(() => {
    setQueueEndHandler(({ lastAyah }) => {
      if (
        loadingInitial ||
        loadingMoreRef.current ||
        !chapterId ||
        maxLoadedPage >= totalPages ||
        verses.length === 0 ||
        lastAyah.chapterId !== chapterId ||
        verses[verses.length - 1].verse_key !== lastAyah.verseKey
      ) {
        return false;
      }

      const nextPage = maxLoadedPage + 1;
      pendingAutoAdvanceRef.current = { page: nextPage, firstVerseKey: null };
      loadNextChunk();
      return true;
    });

    return () => {
      setQueueEndHandler(null);
    };
  }, [
    loadingInitial,
    chapterId,
    maxLoadedPage,
    totalPages,
    verses,
    loadNextChunk,
    setQueueEndHandler,
  ]);

  useEffect(() => {
    const pending = pendingAutoAdvanceRef.current;
    if (
      loadingInitial ||
      !chapterId ||
      !pending ||
      !chunksByPage[pending.page] ||
      queue.length === 0
    ) {
      return;
    }
    const firstNewVerseKey =
      pending.firstVerseKey || chunksByPage[pending.page]?.[0]?.verse_key;
    pendingAutoAdvanceRef.current = null;
    continueAfterPageAdvance(queue, firstNewVerseKey);
  }, [loadingInitial, chapterId, chunksByPage, queue, continueAfterPageAdvance]);

  useEffect(() => {
    return () => {
      pendingAutoAdvanceRef.current = null;
      cancelPageAdvance();
    };
  }, [cancelPageAdvance]);

  const catalogChapter = useMemo(
    () => (chapterId ? chapters.find((c) => c.id === chapterId) || null : null),
    [chapterId, chapters]
  );
  const activeChapter = chapter?.id === chapterId ? chapter : catalogChapter;

  usePageMetadata({
    title: activeChapter
      ? `Surah ${activeChapter.name_simple}${activeChapter.translated_name?.name ? ` (${activeChapter.translated_name.name})` : ''} – QuranNoor`
      : 'Read Quran – QuranNoor',
    description: activeChapter
      ? `Read and listen to Surah ${activeChapter.name_simple}${activeChapter.translated_name?.name ? ` (${activeChapter.translated_name.name})` : ''} — ${activeChapter.verses_count} Ayahs with authentic Uthmani Arabic script and English translation on QuranNoor.com.`
      : 'Read the Noble Quran on QuranNoor.com with authentic Uthmani Arabic script and English translations.',
    canonicalPath: activeChapter ? `/surah/${toSurahSlug(activeChapter.name_simple)}` : undefined,
  });

  const prevChapter = chapterId && chapterId > 1 ? chapters.find((c) => c.id === chapterId - 1) : null;
  const nextChapter = chapterId && chapterId < 114 ? chapters.find((c) => c.id === chapterId + 1) : null;

  const surahJuzNumbers = useMemo(() => {
    if (!activeChapter) return [] as number[];
    const key = String(activeChapter.id);
    const fromCatalog = juzs
      .filter((j) => j.verse_mapping && Object.prototype.hasOwnProperty.call(j.verse_mapping, key))
      .map((j) => j.juz_number)
      .sort((a, b) => a - b);
    if (fromCatalog.length > 0) return fromCatalog;
    return Array.from(
      new Set(
        verses
          .filter((v) => v.verse_key.startsWith(`${activeChapter.id}:`))
          .map((v) => v.juz_number)
          .filter((n) => Number.isInteger(n) && n > 0)
      )
    ).sort((a, b) => a - b);
  }, [activeChapter, juzs, verses]);

  const juzRangeLabel = useMemo(() => {
    if (surahJuzNumbers.length === 0) return null;
    if (surahJuzNumbers.length === 1) return `Juz ${surahJuzNumbers[0]}`;
    return `Juz ${surahJuzNumbers[0]}–${surahJuzNumbers[surahJuzNumbers.length - 1]}`;
  }, [surahJuzNumbers]);

  const relatedPopular = useMemo(
    () => (chapterId ? POPULAR_SECTIONS.filter((s) => s.chapterId === chapterId && s.type !== 'chapter') : []),
    [chapterId]
  );

  const handleJumpToAyah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChapter || !chapterId) return;
    const num = Number(jumpAyahInput);
    if (!Number.isInteger(num) || num < 1 || num > activeChapter.verses_count) return;

    const targetChunk = Math.ceil(num / CHUNK_SIZE);
    const targetKey = `${activeChapter.id}:${num}`;
    setJumpAyahInput('');
    setHighlightedVerseKey(targetKey);
    pendingAutoAdvanceRef.current = null;
    cancelPageAdvance();
    jumpCooldownUntilRef.current = Date.now() + 900;

    // If the target chunk is already loaded, ensure it's mounted and scroll straight to it
    if (chunksByPageRef.current[targetChunk]) {
      setForcedMountPage(targetChunk);
      pendingScrollTargetKeyRef.current = targetKey;
      const existingEl = document.getElementById(`ayah-${targetKey}`);
      if (existingEl) {
        pendingScrollTargetKeyRef.current = null;
        existingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // If target is immediately the next chunk, append cleanly without discarding prior chunks
    if (targetChunk === maxLoadedPage + 1) {
      pendingScrollTargetKeyRef.current = targetKey;
      await loadNextChunk();
      setForcedMountPage(targetChunk);
      return;
    }

    // Otherwise load the target chunk directly so far-away jumps (e.g. Ayah 255) are instant
    const reqVersion = ++requestVersionRef.current;
    setLoadingInitial(true);
    setLoadMoreError(null);
    pendingScrollTargetKeyRef.current = targetKey;

    try {
      const versesData = await fetchVersesByChapter({
        chapterId,
        page: targetChunk,
        perPage: CHUNK_SIZE,
        translationId: activeSettingsRef.current.translationId,
        reciterId: activeSettingsRef.current.reciterId,
      });

      if (reqVersion !== requestVersionRef.current) return;

      setChunksByPage({ [targetChunk]: versesData.verses });
      setTotalPages(Math.max(1, versesData.pagination?.total_pages || totalPages));
      setForcedMountPage(targetChunk);
    } catch {
      if (reqVersion !== requestVersionRef.current) return;
      setLoadMoreError('Unable to jump to that Ayah. Please try again.');
      pendingScrollTargetKeyRef.current = null;
    } finally {
      if (reqVersion === requestVersionRef.current) {
        setLoadingInitial(false);
      }
    }
  };

  const handleBackToTop = useCallback(async () => {
    if (!chapterId) return;
    if (minLoadedPage > 1) {
      const reqVersion = ++requestVersionRef.current;
      jumpCooldownUntilRef.current = Date.now() + 900;
      setLoadingInitial(true);
      try {
        const versesData = await fetchVersesByChapter({
          chapterId,
          page: 1,
          perPage: CHUNK_SIZE,
          translationId: activeSettingsRef.current.translationId,
          reciterId: activeSettingsRef.current.reciterId,
        });
        if (reqVersion !== requestVersionRef.current) return;
        setChunksByPage({ 1: versesData.verses });
        setTotalPages(Math.max(1, versesData.pagination?.total_pages || totalPages));
        setForcedMountPage(1);
        setHighlightedVerseKey(null);
      } finally {
        if (reqVersion === requestVersionRef.current) {
          setLoadingInitial(false);
        }
      }
    } else {
      setForcedMountPage(1);
    }
  }, [chapterId, minLoadedPage, totalPages]);

  if (!chapterId && chapters.length > 0) {
    return (
      <div className="mx-auto max-w-[850px] px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Surah Not Found
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          The requested Surah could not be located.
        </p>
        <Link
          to="/surahs"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-xl px-5 py-2.5 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Browse All 114 Surahs
        </Link>
      </div>
    );
  }

  const revelationCity =
    activeChapter?.revelation_place === 'makkah'
      ? 'Makkah'
      : activeChapter?.revelation_place === 'madinah'
      ? 'Madinah'
      : activeChapter?.revelation_place || '';
  const revelationType =
    activeChapter?.revelation_place === 'makkah'
      ? 'Meccan'
      : activeChapter?.revelation_place === 'madinah'
      ? 'Medinan'
      : activeChapter?.revelation_place || '';
  const verseCountLabel = activeChapter
    ? `${activeChapter.verses_count} ${activeChapter.verses_count === 1 ? 'verse' : 'verses'}`
    : '';
  const isThisSurahAudio =
    Boolean(activeChapter) &&
    playbackKind === 'surah' &&
    activeChapterId === activeChapter?.id &&
    audioMode === 'arabic';
  const isThisSurahPlaying = isThisSurahAudio && isPlaying;

  return (
    <div className="mx-auto max-w-[850px] px-2.5 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Quran', to: '/quran' },
          { label: 'Surahs', to: '/surahs' },
          { label: activeChapter ? `Surah ${activeChapter.name_simple}` : 'Surah Reader' },
        ]}
      />

      {/* Surah Header Card */}
      {activeChapter && (
        <header
          className="mb-7 rounded-2xl border p-5 sm:p-7"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 min-w-0">
              {/* Decorative Arabic Calligraphy Frame */}
              <div
                className="inline-flex shrink-0 items-center justify-center gap-3 self-start sm:self-center rounded-2xl border px-5 py-3 sm:px-6 sm:py-3.5"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'color-mix(in srgb, var(--gold) 36%, var(--border-subtle))',
                }}
              >
                <span className="text-xs select-none" style={{ color: 'var(--gold)' }} aria-hidden="true">
                  ✦
                </span>
                <p
                  dir="rtl"
                  lang="ar"
                  translate="no"
                  className="notranslate font-quran-scheherazade quran-arabic-text text-3xl sm:text-4xl leading-[1.35] !py-0"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {activeChapter.name_arabic}
                </p>
                <span className="text-xs select-none" style={{ color: 'var(--gold)' }} aria-hidden="true">
                  ✦
                </span>
              </div>

              {/* English Surah Title, Meaning & Short API Description Line */}
              <div className="min-w-0 space-y-1">
                <h1
                  className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {`${activeChapter.id}. Surah ${activeChapter.name_simple}`}
                </h1>
                {activeChapter.translated_name?.name && (
                  <p
                    className="text-sm sm:text-[15px] font-medium"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {activeChapter.translated_name.name}
                  </p>
                )}
                <p
                  className="text-xs sm:text-[13px] font-medium tabular-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>{verseCountLabel}</span>
                  {revelationCity ? <span>{` · Revealed in ${revelationCity}`}</span> : null}
                  {juzRangeLabel && surahJuzNumbers[0] ? (
                    <>
                      {' · '}
                      <Link
                        to={`/juz/${surahJuzNumbers[0]}`}
                        className="hover:underline underline-offset-4"
                        style={{ color: 'var(--gold)' }}
                      >
                        {juzRangeLabel}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Primary Header Actions: Play Surah & Info */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (isThisSurahAudio) {
                    togglePlayPause();
                  } else {
                    playFullSurah(activeChapter.id, activeChapter.name_simple);
                  }
                }}
                aria-label={
                  isThisSurahPlaying
                    ? `Pause Surah ${activeChapter.name_simple}`
                    : `Play Surah ${activeChapter.name_simple}`
                }
                aria-pressed={isThisSurahPlaying}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {isThisSurahPlaying ? (
                  <Pause className="h-4 w-4 fill-current shrink-0" />
                ) : (
                  <Play className="h-4 w-4 fill-current shrink-0" />
                )}
                <span>{isThisSurahPlaying ? 'Pause Surah' : 'Play Surah'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSurahInfo((prev) => !prev)}
                aria-expanded={showSurahInfo}
                aria-controls="surah-info-panel"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: showSurahInfo ? 'var(--gold-soft)' : 'var(--bg-canvas)',
                  borderColor: showSurahInfo ? 'var(--gold)' : 'var(--border-subtle)',
                  color: showSurahInfo ? 'var(--gold)' : 'var(--text-primary)',
                }}
              >
                <Info className="h-4 w-4 shrink-0" />
                <span>Info</span>
              </button>
            </div>
          </div>

          {/* Collapsible Surah Info Metadata */}
          {showSurahInfo && (
            <div
              id="surah-info-panel"
              className="mt-5 border-t pt-4 space-y-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                <div>
                  <dt className="font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Revelation Place
                  </dt>
                  <dd className="mt-0.5 font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {revelationType}
                    {revelationCity ? ` (${revelationCity})` : ''}
                    {activeChapter.revelation_order ? (
                      <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>
                        {` · Order #${activeChapter.revelation_order}`}
                      </span>
                    ) : null}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Verse Count
                  </dt>
                  <dd className="mt-0.5 font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {verseCountLabel}
                    {activeChapter.pages && activeChapter.pages.length === 2 ? (
                      <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>
                        {` · Pages ${activeChapter.pages[0]}–${activeChapter.pages[1]}`}
                      </span>
                    ) : null}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Juz Range
                  </dt>
                  <dd className="mt-0.5 font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {surahJuzNumbers.length > 0 ? (
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span>{juzRangeLabel}</span>
                        <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>
                          (
                          {surahJuzNumbers.map((jNum, idx) => (
                            <Fragment key={jNum}>
                              {idx > 0 ? ', ' : ''}
                              <Link
                                to={`/juz/${jNum}`}
                                className="hover:underline underline-offset-4"
                                style={{ color: 'var(--accent-text)' }}
                              >
                                {`Juz ${jNum}`}
                              </Link>
                            </Fragment>
                          ))}
                          )
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>

              {chapter?.id === activeChapter.id && chapterInfoText && (
                <p
                  className="text-xs sm:text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {stripHtmlTags(chapterInfoText)}
                </p>
              )}
            </div>
          )}

          {/* Reader Action Toolbar */}
          <div
            className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t pt-4"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (queue.length > 0) {
                    playAyah(queue[0], queue);
                  }
                }}
                disabled={queue.length === 0}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 whitespace-nowrap"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <Play className="h-3.5 w-3.5" />
                <span>Play Ayahs</span>
              </button>

              <ReciterSelector id="surah-reciter" compact className="w-full sm:w-auto sm:max-w-[310px]" />
            </div>

            <div className="flex items-center gap-2">
              <form onSubmit={handleJumpToAyah} className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={activeChapter.verses_count}
                  value={jumpAyahInput}
                  onChange={(e) => setJumpAyahInput(e.target.value)}
                  placeholder={`Ayah 1–${activeChapter.verses_count}`}
                  aria-label="Jump to Ayah number"
                  className="min-h-[44px] w-28 rounded-xl border px-3 text-xs tabular-nums outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl border px-3 text-xs font-medium whitespace-nowrap"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Go
                </button>
              </form>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium whitespace-nowrap"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {error ? (
        errorCode === 'PRELIVE_LIMITED' ? (
          <div
            className="my-10 rounded-2xl border p-8 sm:p-10 text-center"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl mb-4"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {`Surah ${chapterId} · Awaiting Production API Access`}
            </h2>
            <p className="mt-3 max-w-lg mx-auto text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This application (<span className="font-semibold text-emerald-800 dark:text-emerald-400">Noor Quran</span>) is authenticated with Quran Foundation Pre-live credentials. The developer sandbox provides full verified access to <strong>Surah 1 (Al-Fatihah)</strong> and <strong>Surah 2 (Al-Baqarah)</strong>.
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Surahs 3 to 114 will become active immediately once Production API approval is granted by the Quran Foundation.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/surah/al-fatihah"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span>Read Surah Al-Fatihah (7 Ayahs)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/surah/al-baqarah"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-5 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>Read Surah Al-Baqarah (286 Ayahs)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/surahs"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                All 114 Surahs
              </Link>
            </div>
          </div>
        ) : (
          <ErrorBanner message={error} onRetry={loadInitialSurah} />
        )
      ) : loadingInitial ? (
        <VerseListSkeleton count={5} />
      ) : (
        <div>
          <HifzControlsBar queue={queue} />

          {/* Earlier chunk loader when user jumped directly to a later ayah */}
          {hasEarlier && (
            <div ref={topSentinelRef} className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={loadPreviousChunk}
                disabled={loadingEarlier}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {loadingEarlier ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--accent-text)' }} />
                    <span>Loading earlier ayahs...</span>
                  </>
                ) : (
                  <span>
                    Load earlier ayahs (1–{(minLoadedPage - 1) * CHUNK_SIZE})
                  </span>
                )}
              </button>
            </div>
          )}

          <VirtualizedVerseChunks
            chunks={chunks}
            layoutKey={`${settings.arabicFontSize}|${settings.showTranslation}|${settings.tajweedColors}|${settings.script}`}
            activeVerseKey={activeVerseKey}
            highlightedVerseKey={highlightedVerseKey}
            forcedMountPage={forcedMountPage}
            renderVerse={(verse) => (
              <Fragment key={verse.verse_key}>
                {verse.verse_number === 1 && chapter?.bismillah_pre && <BismillahHeader />}
                <AyahCard
                  verse={verse}
                  chapterName={chapter?.name_simple || ''}
                  chapterArabicName={chapter?.name_arabic || ''}
                  queue={queue}
                  isHighlighted={highlightedVerseKey === verse.verse_key}
                  isHifzBlurred={isVerseBlurred(verse.verse_key)}
                  onRevealHifz={() => revealVerse(verse.verse_key)}
                />
              </Fragment>
            )}
          />

          {/* Infinite scroll bottom sentinel & loading indicator */}
          {hasMore && (
            <div ref={bottomSentinelRef} className="py-6 flex flex-col items-center justify-center gap-3">
              {loadingMore && (
                <div
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--accent-text)' }} />
                  <span>Loading more ayahs...</span>
                </div>
              )}

              {loadMoreError && (
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {loadMoreError}
                  </p>
                  <button
                    type="button"
                    onClick={loadNextChunk}
                    className="inline-flex min-h-[44px] items-center rounded-xl border px-4 text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {!hasMore && verses.length > 0 && chapter && (
            <p
              className="py-6 text-center text-xs tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {`End of Surah ${chapter.name_simple} · ${chapter.verses_count} ${chapter.verses_count === 1 ? 'ayah' : 'ayahs'}`}
            </p>
          )}
        </div>
      )}

      {chapter && relatedPopular.length > 0 && (
        <section
          aria-label="Featured Passages in this Surah"
          className="mt-4 rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {`Featured Passages in ${chapter.name_simple}:`}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            {relatedPopular.map((item) => (
              <Link
                key={item.slug}
                to={`/popular/${item.slug}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium hover:underline underline-offset-4"
                style={{ color: 'var(--accent-text)' }}
              >
                <span>{item.title}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {chapter && (
        <nav
          aria-label="Surah Navigation"
          className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-8"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {prevChapter ? (
            <Link
              to={`/surah/${toSurahSlug(prevChapter.name_simple)}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>
                {`${prevChapter.id}. ${prevChapter.name_simple}`}
              </span>
            </Link>
          ) : (
            <div />
          )}

          <Link
            to="/surahs"
            className="inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--accent-text)',
            }}
          >
            All 114 Surahs
          </Link>

          {nextChapter ? (
            <Link
              to={`/surah/${toSurahSlug(nextChapter.name_simple)}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <span>
                {`${nextChapter.id}. ${nextChapter.name_simple}`}
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div />
          )}
        </nav>
      )}

      <BackToTopButton onBeforeScrollTop={handleBackToTop} />
    </div>
  );
}
