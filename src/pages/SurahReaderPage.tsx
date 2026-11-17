import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AyahCard } from '../components/AyahCard';
import { BismillahHeader } from '../components/BismillahHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { HifzControlsBar } from '../components/HifzControlsBar';
import { ReciterSelector } from '../components/ReciterSelector';
import { ErrorBanner, VerseListSkeleton } from '../components/StatusStates';
import { useAudio, type PlayableAyah } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import { useHifzReader } from '../hooks/useHifzReader';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { fetchChapterDetails, fetchVersesByChapter } from '../services/quranApi';
import type { Chapter, PaginationInfo, Verse } from '../types/quran';
import { POPULAR_SECTIONS, resolveChapterIdFromParam, toSurahSlug } from '../utils/slugs';
import { getEnglishTranslation, stripHtmlTags } from '../utils/text';

const PER_PAGE = 30;

export function SurahReaderPage() {
  const { slug, ayahNumber } = useParams<{ slug: string; ayahNumber?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    chapters,
    settings,
    saveReadingProgress,
    setIsSettingsOpen,
  } = useReader();
  const {
    playFullSurah,
    playAyah,
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

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapterInfoText, setChapterInfoText] = useState<string>('');
  const [verses, setVerses] = useState<Verse[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [jumpAyahInput, setJumpAyahInput] = useState('');
  const [loadedPageKey, setLoadedPageKey] = useState('');
  const pendingAutoAdvancePageRef = useRef<number | null>(null);
  const prevChapterIdRef = useRef<number | null>(chapterId);
  const skipTargetResetRef = useRef(false);
  const { isVerseBlurred, revealVerse } = useHifzReader(
    verses,
    activeVerseKey,
    settings.hifzMode
  );

  useEffect(() => {
    const chapterChanged = prevChapterIdRef.current !== chapterId;
    prevChapterIdRef.current = chapterId;

    if (!chapterChanged && skipTargetResetRef.current) {
      skipTargetResetRef.current = false;
      return;
    }

    pendingAutoAdvancePageRef.current = null;
    cancelPageAdvance();

    if (targetAyahParam && targetAyahParam > 0) {
      setCurrentPage(Math.ceil(targetAyahParam / PER_PAGE));
    } else {
      setCurrentPage(1);
    }
  }, [chapterId, targetAyahParam, cancelPageAdvance]);

  const loadSurah = useCallback(async () => {
    if (!chapterId) {
      if (chapters.length > 0) {
        setError('Surah not found.');
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const [details, versesData] = await Promise.all([
        fetchChapterDetails(chapterId),
        fetchVersesByChapter({
          chapterId,
          page: currentPage,
          perPage: PER_PAGE,
          translationId: settings.translationId,
          reciterId: settings.reciterId,
        }),
      ]);

      setChapter(details.chapter);
      setChapterInfoText(details.chapter_info?.short_text || '');
      setVerses(versesData.verses);
      setPagination(versesData.pagination);
      setLoadedPageKey(`${details.chapter.id}:${currentPage}`);

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
    } catch (err: unknown) {
      pendingAutoAdvancePageRef.current = null;
      cancelPageAdvance();
      const errObj = err as { message?: string; code?: string };
      const msg = errObj?.message || 'Unable to load Surah.';
      setError(msg);
      setErrorCode(errObj?.code || (msg.includes('Pre-live') ? 'PRELIVE_LIMITED' : null));
    } finally {
      setLoading(false);
    }
  }, [
    chapterId,
    chapters.length,
    currentPage,
    settings.translationId,
    settings.reciterId,
    saveReadingProgress,
    targetAyahParam,
    cancelPageAdvance,
  ]);

  useEffect(() => {
    loadSurah();
  }, [loadSurah]);

  useEffect(() => {
    if (loading || !targetAyahParam || !chapterId) return;
    const el = document.getElementById(`ayah-${chapterId}:${targetAyahParam}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, targetAyahParam, chapterId, verses]);

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
    if (!loading && chapterId && loadedPageKey === `${chapterId}:${currentPage}` && queue.length > 0) {
      updateQueue(queue);
    }
  }, [loading, loadedPageKey, chapterId, currentPage, queue, updateQueue]);

  useEffect(() => {
    setQueueEndHandler(({ lastAyah }) => {
      if (
        loading ||
        !chapterId ||
        loadedPageKey !== `${chapterId}:${currentPage}` ||
        !pagination ||
        currentPage >= pagination.total_pages ||
        verses.length === 0 ||
        lastAyah.chapterId !== chapterId ||
        verses[verses.length - 1].verse_key !== lastAyah.verseKey
      ) {
        return false;
      }

      const nextPage = currentPage + 1;
      pendingAutoAdvancePageRef.current = nextPage;
      if (searchParams.has('ayah')) {
        skipTargetResetRef.current = true;
        setSearchParams({}, { replace: true });
      }
      setCurrentPage(nextPage);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      return true;
    });

    return () => {
      setQueueEndHandler(null);
    };
  }, [
    loading,
    chapterId,
    loadedPageKey,
    currentPage,
    pagination,
    verses,
    searchParams,
    setSearchParams,
    setQueueEndHandler,
  ]);

  useEffect(() => {
    if (
      loading ||
      !chapterId ||
      loadedPageKey !== `${chapterId}:${currentPage}` ||
      pendingAutoAdvancePageRef.current !== currentPage ||
      queue.length === 0
    ) {
      return;
    }
    pendingAutoAdvancePageRef.current = null;
    continueAfterPageAdvance(queue);
  }, [loading, loadedPageKey, chapterId, currentPage, queue, continueAfterPageAdvance]);

  useEffect(() => {
    return () => {
      pendingAutoAdvancePageRef.current = null;
      cancelPageAdvance();
    };
  }, [cancelPageAdvance]);

  usePageMetadata({
    title: chapter
      ? `Surah ${chapter.name_simple} (${chapter.translated_name?.name}) – QuranNoor`
      : 'Read Quran – QuranNoor',
    description: chapter
      ? `Read and listen to Surah ${chapter.name_simple} (${chapter.translated_name?.name}) — ${chapter.verses_count} Ayahs with authentic Uthmani Arabic script and English translation on QuranNoor.com.`
      : 'Read the Noble Quran on QuranNoor.com with authentic Uthmani Arabic script and English translations.',
    canonicalPath: chapter ? `/surah/${toSurahSlug(chapter.name_simple)}` : undefined,
  });

  const prevChapter = chapterId && chapterId > 1 ? chapters.find((c) => c.id === chapterId - 1) : null;
  const nextChapter = chapterId && chapterId < 114 ? chapters.find((c) => c.id === chapterId + 1) : null;
  const activeJuzNum = verses[0]?.juz_number || null;
  const relatedPopular = useMemo(
    () => (chapterId ? POPULAR_SECTIONS.filter((s) => s.chapterId === chapterId && s.type !== 'chapter') : []),
    [chapterId]
  );

  const handleJumpToAyah = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapter) return;
    const num = Number(jumpAyahInput);
    if (!Number.isInteger(num) || num < 1 || num > chapter.verses_count) return;
    pendingAutoAdvancePageRef.current = null;
    cancelPageAdvance();
    setSearchParams({ ayah: String(num) });
    setCurrentPage(Math.ceil(num / PER_PAGE));
    setJumpAyahInput('');
  };

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

  return (
    <div className="mx-auto max-w-[850px] px-2.5 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Quran', to: '/quran' },
          { label: 'Surahs', to: '/surahs' },
          { label: chapter ? `Surah ${chapter.name_simple}` : 'Surah Reader' },
        ]}
      />

      {/* Surah Header */}
      {chapter && (
        <header
          className="mb-8 rounded-2xl border p-6 sm:p-8"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium tabular-nums" style={{ color: 'var(--gold)' }}>
                Surah {chapter.id} · {chapter.revelation_place === 'makkah' ? 'Meccan' : 'Medinan'} ·{' '}
                {chapter.verses_count} Verses
                {activeJuzNum ? (
                  <>
                    {' '}·{' '}
                    <Link to={`/juz/${activeJuzNum}`} className="hover:underline underline-offset-4">
                      Juz {activeJuzNum}
                    </Link>
                  </>
                ) : null}
              </p>
              <h1
                className="text-2xl sm:text-3xl font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {chapter.name_simple}{' '}
                <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>
                  ({chapter.translated_name?.name})
                </span>
              </h1>
              {chapterInfoText && (
                <p
                  className="max-w-2xl text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {stripHtmlTags(chapterInfoText)}
                </p>
              )}
            </div>

            <div className="shrink-0 sm:text-right">
              <p
                dir="rtl"
                lang="ar"
                translate="no"
                className="notranslate font-quran-scheherazade quran-arabic-text text-xl sm:text-3xl leading-[1.5] !py-0"
                style={{ color: 'var(--text-primary)' }}
              >
                {chapter.name_arabic}
              </p>
            </div>
          </div>

          {/* Reader Action Toolbar */}
          <div
            className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => playFullSurah(chapter.id, chapter.name_simple)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Play className="h-3.5 w-3.5" />
                <span>Play Full Surah</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (queue.length > 0) {
                    playAyah(queue[0], queue);
                  }
                }}
                disabled={queue.length === 0}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 whitespace-nowrap"
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
                  max={chapter.verses_count}
                  value={jumpAyahInput}
                  onChange={(e) => setJumpAyahInput(e.target.value)}
                  placeholder={`Ayah 1–${chapter.verses_count}`}
                  aria-label="Jump to Ayah number"
                  className="min-h-[38px] w-28 rounded-xl border px-3 text-xs tabular-nums outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="submit"
                  className="min-h-[38px] rounded-xl border px-3 text-xs font-medium whitespace-nowrap"
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
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium whitespace-nowrap"
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

      {chapter && chapter.bismillah_pre && currentPage === 1 && !loading && (
        <BismillahHeader />
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
              Surah {chapterId} · Awaiting Production API Access
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
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span>Read Surah Al-Fatihah (7 Ayahs)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/surah/al-baqarah"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-5 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
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
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium"
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
          <ErrorBanner message={error} onRetry={loadSurah} />
        )
      ) : loading ? (
        <VerseListSkeleton count={5} />
      ) : (
        <div>
          <HifzControlsBar queue={queue} />
          {verses.map((verse) => (
            <AyahCard
              key={verse.verse_key}
              verse={verse}
              chapterName={chapter?.name_simple || ''}
              chapterArabicName={chapter?.name_arabic || ''}
              queue={queue}
              isHighlighted={targetAyahParam === verse.verse_number}
              isHifzBlurred={isVerseBlurred(verse.verse_key)}
              onRevealHifz={() => revealVerse(verse.verse_key)}
            />
          ))}
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <div
          className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => {
              pendingAutoAdvancePageRef.current = null;
              cancelPageAdvance();
              setSearchParams({});
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-4 text-sm font-medium disabled:opacity-40"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous Page</span>
          </button>

          <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            Page {currentPage} of {pagination.total_pages}
          </span>

          <button
            type="button"
            disabled={currentPage >= pagination.total_pages}
            onClick={() => {
              pendingAutoAdvancePageRef.current = null;
              cancelPageAdvance();
              setSearchParams({});
              setCurrentPage((p) => Math.min(pagination.total_pages, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-4 text-sm font-medium disabled:opacity-40"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <span>Next Page</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {chapter && relatedPopular.length > 0 && (
        <section
          aria-label="Featured Passages in this Surah"
          className="mt-8 rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Featured Passages in {chapter.name_simple}:
          </span>
          <div className="flex flex-wrap items-center gap-4">
            {relatedPopular.map((item) => (
              <Link
                key={item.slug}
                to={`/popular/${item.slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline underline-offset-4"
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
                {prevChapter.id}. {prevChapter.name_simple}
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
                {nextChapter.id}. {nextChapter.name_simple}
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div />
          )}
        </nav>
      )}
    </div>
  );
}
