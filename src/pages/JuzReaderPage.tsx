import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
import { fetchVersesByJuz } from '../services/quranApi';
import { getEmbeddedVersesByJuz } from '../utils/prerenderData';
import type { Verse } from '../types/quran';
import { toSurahSlug } from '../utils/slugs';
import { getEnglishTranslation, stripHtmlTags } from '../utils/text';

const CHUNK_SIZE = 15;

export function JuzReaderPage() {
  const { juzNumber } = useParams<{ juzNumber: string }>();
  const juzId = Number(juzNumber);
  const isValidJuz = Number.isInteger(juzId) && juzId >= 1 && juzId <= 30;

  usePageMetadata({
    title: isValidJuz ? `Juz ${juzId} – QuranNoor` : 'Juz Reader – QuranNoor',
    description: isValidJuz
      ? `Read and listen to Juz ${juzId} of the Noble Quran on QuranNoor.com with authentic Uthmani Arabic script and English translation.`
      : 'Read the Noble Quran by Juz on QuranNoor.com.',
    canonicalPath: isValidJuz ? `/juz/${juzId}` : undefined,
  });

  const { chapters, juzs, settings, setIsSettingsOpen } = useReader();
  const {
    playAyah,
    updateQueue,
    activeVerseKey,
    setQueueEndHandler,
    continueAfterPageAdvance,
    cancelPageAdvance,
  } = useAudio();

  // H-1: seed the first render from the embedded prerender data (the same
  // responses the prerendered HTML was rendered from) — same pattern as
  // SurahReaderPage; keyed to the default settings, so it only hits on
  // the first render. Client-side navigation misses and fetches.
  const seededVerses = isValidJuz
    ? getEmbeddedVersesByJuz(juzId, 1, CHUNK_SIZE, settings.translationId, settings.reciterId)
    : null;

  const [chunksByPage, setChunksByPage] = useState<Record<number, Verse[]>>((): Record<number, Verse[]> =>
    seededVerses ? { 1: seededVerses.verses } : {}
  );
  const [totalPages, setTotalPages] = useState(() =>
    seededVerses ? Math.max(1, seededVerses.pagination?.total_pages || 1) : 1
  );
  const [totalJuzVerses, setTotalJuzVerses] = useState<number>(() =>
    seededVerses?.pagination?.total_records || 0
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
    seededVerses ? 1 : null
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
  const loadedSessionJuzRef = useRef<number | null>(null);
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
    `juz-${isValidJuz ? juzId : 0}`
  );

  useEffect(() => {
    if (forcedMountPage === null) return;
    const id = window.setTimeout(() => setForcedMountPage(null), 150);
    return () => window.clearTimeout(id);
  }, [forcedMountPage]);

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

  const loadInitialJuz = useCallback(async () => {
    if (!isValidJuz) {
      setError('Invalid Juz number. Please choose a Juz between 1 and 30.');
      setLoadingInitial(false);
      return;
    }

    const reqVersion = ++requestVersionRef.current;

    // H-1: seeded fast-path — apply the embedded payload without fetching.
    // The state initializers already hold it; this marks the session
    // loaded so the settings-refresh effect can re-fetch after hydration
    // applies stored settings.
    if (seededVerses) {
      activeSettingsRef.current = {
        translationId: settings.translationId,
        reciterId: settings.reciterId,
      };
      loadedSessionJuzRef.current = juzId;
      setChunksByPage({ 1: seededVerses.verses });
      setTotalPages(Math.max(1, seededVerses.pagination?.total_pages || 1));
      if (seededVerses.pagination?.total_records) {
        setTotalJuzVerses(seededVerses.pagination.total_records);
      }
      setForcedMountPage(1);
      setLoadingInitial(false);
      return;
    }

    setLoadingInitial(true);
    setLoadingMore(false);
    setLoadingEarlier(false);
    loadingMoreRef.current = false;
    loadingEarlierRef.current = false;
    setLoadMoreError(null);
    setError(null);
    setErrorCode(null);
    setChunksByPage({});
    setHighlightedVerseKey(null);
    pendingScrollTargetKeyRef.current = null;
    pendingAutoAdvanceRef.current = null;
    cancelPageAdvance();
    activeSettingsRef.current = {
      translationId: settings.translationId,
      reciterId: settings.reciterId,
    };

    try {
      const data = await fetchVersesByJuz({
        juzNumber: juzId,
        page: 1,
        perPage: CHUNK_SIZE,
        translationId: settings.translationId,
        reciterId: settings.reciterId,
      });

      if (reqVersion !== requestVersionRef.current) return;

      loadedSessionJuzRef.current = juzId;
      setChunksByPage({ 1: data.verses });
      setTotalPages(Math.max(1, data.pagination?.total_pages || 1));
      if (data.pagination?.total_records) {
        setTotalJuzVerses(data.pagination.total_records);
      }
      setForcedMountPage(1);
    } catch (err: unknown) {
      if (reqVersion !== requestVersionRef.current) return;
      pendingAutoAdvanceRef.current = null;
      cancelPageAdvance();
      const errObj = err as { message?: string; code?: string };
      const msg = errObj?.message || 'Unable to load Juz verses.';
      setError(msg);
      setErrorCode(errObj?.code || (msg.includes('Pre-live') ? 'PRELIVE_LIMITED' : null));
    } finally {
      if (reqVersion === requestVersionRef.current) {
        setLoadingInitial(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValidJuz, juzId, cancelPageAdvance]);

  useEffect(() => {
    loadInitialJuz();
  }, [loadInitialJuz]);

  // Refresh loaded chunks in place if user switches translation or reciter mid-Juz
  useEffect(() => {
    if (!isValidJuz || loadingInitial) return;
    if (loadedSessionJuzRef.current !== juzId) return;

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
        const res = await fetchVersesByJuz({
          juzNumber: juzId,
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
        // Ignore transient refresh failure; retain rendered verses
      });

    return () => {
      cancelled = true;
    };
  }, [isValidJuz, juzId, loadingInitial, settings.translationId, settings.reciterId]);

  const loadNextChunk = useCallback(async () => {
    if (
      !isValidJuz ||
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
      const data = await fetchVersesByJuz({
        juzNumber: juzId,
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
  }, [isValidJuz, juzId, loadingInitial, maxLoadedPage, totalPages, cancelPageAdvance]);

  const loadPreviousChunk = useCallback(async () => {
    if (
      !isValidJuz ||
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
      const data = await fetchVersesByJuz({
        juzNumber: juzId,
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
  }, [isValidJuz, juzId, loadingInitial, minLoadedPage]);

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

  const getChapterForVerse = useCallback(
    (verseKey: string) => {
      const chId = Number(verseKey.split(':')[0]);
      return chapters.find((c) => c.id === chId);
    },
    [chapters]
  );

  const queue: PlayableAyah[] = useMemo(() => {
    return verses.map((v) => {
      const ch = getChapterForVerse(v.verse_key);
      return {
        verseKey: v.verse_key,
        chapterId: ch?.id || Number(v.verse_key.split(':')[0]),
        verseNumber: v.verse_number,
        chapterName: ch?.name_simple || `Surah ${v.verse_key.split(':')[0]}`,
        audioUrl: v.audio?.url,
        translationText: stripHtmlTags(
          getEnglishTranslation(v.translations, settings.translationId)?.text || ''
        ),
      };
    });
  }, [verses, getChapterForVerse, settings.translationId]);

  useEffect(() => {
    if (!loadingInitial && isValidJuz && queue.length > 0) {
      updateQueue(queue);
    }
  }, [loadingInitial, isValidJuz, queue, updateQueue]);

  useEffect(() => {
    setQueueEndHandler(({ lastAyah }) => {
      if (
        loadingInitial ||
        loadingMoreRef.current ||
        !isValidJuz ||
        maxLoadedPage >= totalPages ||
        verses.length === 0 ||
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
    isValidJuz,
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
      !isValidJuz ||
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
  }, [loadingInitial, isValidJuz, chunksByPage, queue, continueAfterPageAdvance]);

  useEffect(() => {
    return () => {
      pendingAutoAdvanceRef.current = null;
      cancelPageAdvance();
    };
  }, [cancelPageAdvance]);

  const juzMeta = juzs.find((j) => j.juz_number === juzId);
  const maxVerseCount = juzMeta?.verses_count || totalJuzVerses || verses.length;

  const mappedChapters = useMemo(() => {
    if (!juzMeta?.verse_mapping) return [];
    return Object.entries(juzMeta.verse_mapping).map(([chIdStr, range]) => {
      const ch = chapters.find((c) => c.id === Number(chIdStr));
      return {
        id: Number(chIdStr),
        name: ch?.name_simple || `Surah ${chIdStr}`,
        slug: ch ? toSurahSlug(ch.name_simple) : chIdStr,
        range,
      };
    });
  }, [juzMeta, chapters]);

  const handleJumpToAyah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidJuz || !maxVerseCount) return;
    const num = Number(jumpAyahInput);
    if (!Number.isInteger(num) || num < 1 || num > maxVerseCount) return;

    const targetChunk = Math.ceil(num / CHUNK_SIZE);
    const indexInChunk = (num - 1) % CHUNK_SIZE;
    setJumpAyahInput('');
    pendingAutoAdvanceRef.current = null;
    cancelPageAdvance();
    jumpCooldownUntilRef.current = Date.now() + 900;

    const existingChunk = chunksByPageRef.current[targetChunk];
    if (existingChunk && existingChunk[indexInChunk]) {
      const targetKey = existingChunk[indexInChunk].verse_key;
      setHighlightedVerseKey(targetKey);
      setForcedMountPage(targetChunk);
      pendingScrollTargetKeyRef.current = targetKey;
      const existingEl = document.getElementById(`ayah-${targetKey}`);
      if (existingEl) {
        pendingScrollTargetKeyRef.current = null;
        existingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (targetChunk === maxLoadedPage + 1) {
      const reqVersion = requestVersionRef.current;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      try {
        const data = await fetchVersesByJuz({
          juzNumber: juzId,
          page: targetChunk,
          perPage: CHUNK_SIZE,
          translationId: activeSettingsRef.current.translationId,
          reciterId: activeSettingsRef.current.reciterId,
        });
        if (reqVersion !== requestVersionRef.current) return;
        const targetVerse = data.verses[indexInChunk] || data.verses[0];
        if (targetVerse) {
          setHighlightedVerseKey(targetVerse.verse_key);
          pendingScrollTargetKeyRef.current = targetVerse.verse_key;
        }
        setChunksByPage((prev) => ({ ...prev, [targetChunk]: data.verses }));
        setForcedMountPage(targetChunk);
      } finally {
        if (reqVersion === requestVersionRef.current) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
      return;
    }

    const reqVersion = ++requestVersionRef.current;
    setLoadingInitial(true);
    setLoadMoreError(null);

    try {
      const data = await fetchVersesByJuz({
        juzNumber: juzId,
        page: targetChunk,
        perPage: CHUNK_SIZE,
        translationId: activeSettingsRef.current.translationId,
        reciterId: activeSettingsRef.current.reciterId,
      });

      if (reqVersion !== requestVersionRef.current) return;

      const targetVerse = data.verses[indexInChunk] || data.verses[0];
      if (targetVerse) {
        setHighlightedVerseKey(targetVerse.verse_key);
        pendingScrollTargetKeyRef.current = targetVerse.verse_key;
      }
      setChunksByPage({ [targetChunk]: data.verses });
      setTotalPages(Math.max(1, data.pagination?.total_pages || totalPages));
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
    if (!isValidJuz) return;
    if (minLoadedPage > 1) {
      const reqVersion = ++requestVersionRef.current;
      jumpCooldownUntilRef.current = Date.now() + 900;
      setLoadingInitial(true);
      try {
        const data = await fetchVersesByJuz({
          juzNumber: juzId,
          page: 1,
          perPage: CHUNK_SIZE,
          translationId: activeSettingsRef.current.translationId,
          reciterId: activeSettingsRef.current.reciterId,
        });
        if (reqVersion !== requestVersionRef.current) return;
        setChunksByPage({ 1: data.verses });
        setTotalPages(Math.max(1, data.pagination?.total_pages || totalPages));
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
  }, [isValidJuz, juzId, minLoadedPage, totalPages]);

  return (
    <div className="mx-auto max-w-[850px] px-2.5 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Quran', to: '/quran' },
          { label: 'Juz', to: '/juz' },
          { label: isValidJuz ? `Juz ${juzId}` : 'Juz Reader' },
        ]}
      />

      <header
        className="mb-8 rounded-2xl border p-6 sm:p-8"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium tabular-nums" style={{ color: 'var(--accent-text)' }}>
              Quran Section · {maxVerseCount > 0 ? `${maxVerseCount} Verses` : 'Juz'}
            </p>
            <h1
              className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              Juz {juzId}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (queue.length > 0) playAyah(queue[0], queue);
              }}
              disabled={queue.length === 0}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Play className="h-3.5 w-3.5" />
              <span>Play Juz</span>
            </button>

            <ReciterSelector id="juz-reciter" compact className="w-full sm:w-auto sm:max-w-[300px]" />

            {maxVerseCount > 0 && (
              <form onSubmit={handleJumpToAyah} className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={maxVerseCount}
                  value={jumpAyahInput}
                  onChange={(e) => setJumpAyahInput(e.target.value)}
                  placeholder={`Ayah 1–${maxVerseCount}`}
                  aria-label="Jump to Ayah in Juz"
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
            )}

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {mappedChapters.length > 0 && (
          <div
            className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-xs"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Surahs Included:
            </span>
            {mappedChapters.map((item) => (
              <Link
                key={item.id}
                to={`/surah/${item.slug}`}
                className="inline-flex min-h-[44px] items-center font-medium hover:underline underline-offset-4 tabular-nums"
                style={{ color: 'var(--accent-text)' }}
              >
                {item.id}. {item.name} ({item.range})
              </Link>
            ))}
          </div>
        )}
      </header>

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
              Juz {juzId} · Awaiting Production API Access
            </h2>
            <p className="mt-3 max-w-lg mx-auto text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This application (<span className="font-semibold text-emerald-800 dark:text-emerald-400">QuranNoor</span>) is authenticated with Quran Foundation Pre-live developer credentials. The sandbox provides verified verses for <strong>Juz 1</strong> and <strong>Juz 2</strong> (covering Surah 1 & 2).
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Juz 3 to 30 will be enabled automatically once Production API approval is granted by the Quran Foundation.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/juz/1"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span>Read Juz 1</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/juz/2"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-5 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>Read Juz 2</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/juz"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                All 30 Juz
              </Link>
            </div>
          </div>
        ) : (
          <ErrorBanner message={error} onRetry={loadInitialJuz} />
        )
      ) : loadingInitial ? (
        <VerseListSkeleton count={5} />
      ) : (
        <div>
          <HifzControlsBar queue={queue} />

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
            renderVerse={(verse, idx) => {
              const ch = getChapterForVerse(verse.verse_key);
              const prevVerse = idx > 0 ? verses[idx - 1] : null;
              const prevChId = prevVerse ? Number(prevVerse.verse_key.split(':')[0]) : null;
              const currentChId = Number(verse.verse_key.split(':')[0]);
              const showSurahBanner = idx === 0 || prevChId !== currentChId;

              return (
                <Fragment key={verse.verse_key}>
                  {showSurahBanner && ch && (
                    <div
                      className="mt-6 mb-2 flex items-center justify-between rounded-xl border px-5 py-4"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div>
                        <Link
                          to={`/surah/${toSurahSlug(ch.name_simple)}`}
                          className="inline-flex min-h-[44px] items-center text-base font-semibold hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {ch.id}. {ch.name_simple}
                        </Link>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {ch.translated_name?.name} · {ch.verses_count} Verses
                        </p>
                      </div>
                      <p
                        dir="rtl"
                        lang="ar"
                        translate="no"
                        className="notranslate font-quran-scheherazade quran-arabic-text text-lg sm:text-xl leading-[1.55] !py-0"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {ch.name_arabic}
                      </p>
                    </div>
                  )}

                  {verse.verse_number === 1 && ch?.bismillah_pre && <BismillahHeader />}

                  <AyahCard
                    verse={verse}
                    chapterName={ch?.name_simple || `Surah ${currentChId}`}
                    chapterArabicName={ch?.name_arabic || ''}
                    queue={queue}
                    showChapterLink
                    isHighlighted={highlightedVerseKey === verse.verse_key}
                    isHifzBlurred={isVerseBlurred(verse.verse_key)}
                    onRevealHifz={() => revealVerse(verse.verse_key)}
                  />
                </Fragment>
              );
            }}
          />

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

          {!hasMore && verses.length > 0 && (
            <p
              className="py-6 text-center text-xs tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              End of Juz {juzId} · {verses.length} {verses.length === 1 ? 'ayah' : 'ayahs'} loaded
            </p>
          )}
        </div>
      )}

      <nav
        aria-label="Juz Navigation"
        className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-8"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {juzId > 1 ? (
          <Link
            to={`/juz/${juzId - 1}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium tabular-nums"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Juz {juzId - 1}</span>
          </Link>
        ) : (
          <div />
        )}

        <Link
          to="/juz"
          className="inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--accent-text)',
          }}
        >
          All 30 Juz
        </Link>

        {juzId < 30 ? (
          <Link
            to={`/juz/${juzId + 1}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium tabular-nums"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <span>Juz {juzId + 1}</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <div />
        )}
      </nav>

      <BackToTopButton onBeforeScrollTop={handleBackToTop} />
    </div>
  );
}
