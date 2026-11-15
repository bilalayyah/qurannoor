import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Play, SlidersHorizontal } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AyahCard } from '../components/AyahCard';
import { BismillahHeader } from '../components/BismillahHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ReciterSelector } from '../components/ReciterSelector';
import { ErrorBanner, VerseListSkeleton } from '../components/StatusStates';
import { useAudio, type PlayableAyah } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { fetchVersesByJuz } from '../services/quranApi';
import type { PaginationInfo, Verse } from '../types/quran';
import { toSurahSlug } from '../utils/slugs';
import { stripHtmlTags } from '../utils/text';

const PER_PAGE = 30;

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
  const { playAyah, updateQueue } = useAudio();

  const [verses, setVerses] = useState<Verse[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [juzId]);

  const loadJuz = useCallback(async () => {
    if (!isValidJuz) {
      setError('Invalid Juz number. Please choose a Juz between 1 and 30.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const data = await fetchVersesByJuz({
        juzNumber: juzId,
        page: currentPage,
        perPage: PER_PAGE,
        translationId: settings.translationId,
        reciterId: settings.reciterId,
      });
      setVerses(data.verses);
      setPagination(data.pagination);
    } catch (err: unknown) {
      const errObj = err as { message?: string; code?: string };
      const msg = errObj?.message || 'Unable to load Juz verses.';
      setError(msg);
      setErrorCode(errObj?.code || (msg.includes('Pre-live') ? 'PRELIVE_LIMITED' : null));
    } finally {
      setLoading(false);
    }
  }, [isValidJuz, juzId, currentPage, settings.translationId, settings.reciterId]);

  useEffect(() => {
    loadJuz();
  }, [loadJuz]);

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
        translationText: stripHtmlTags(v.translations?.[0]?.text || ''),
      };
    });
  }, [verses, getChapterForVerse]);

  useEffect(() => {
    if (queue.length > 0) updateQueue(queue);
  }, [queue, updateQueue]);

  const juzMeta = juzs.find((j) => j.juz_number === juzId);

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

  return (
    <div className="mx-auto max-w-[850px] px-4 py-8 sm:px-6 sm:py-12">
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
              Quran Section · {juzMeta ? `${juzMeta.verses_count} Verses` : 'Juz'}
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
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Play className="h-3.5 w-3.5" />
              <span>Play Juz</span>
            </button>

            <ReciterSelector id="juz-reciter" compact className="max-w-[225px]" />

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium"
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
                className="font-medium hover:underline underline-offset-4 tabular-nums"
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
              This application (<span className="font-semibold text-emerald-800 dark:text-emerald-400">Noor Quran</span>) is authenticated with Quran Foundation Pre-live developer credentials. The sandbox provides verified verses for <strong>Juz 1</strong> and <strong>Juz 2</strong> (covering Surah 1 & 2).
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Juz 3 to 30 will be enabled automatically once Production API approval is granted by the Quran Foundation.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/juz/1"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span>Read Juz 1</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/juz/2"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-5 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
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
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium"
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
          <ErrorBanner message={error} onRetry={loadJuz} />
        )
      ) : loading ? (
        <VerseListSkeleton count={5} />
      ) : (
        <div>
          {verses.map((verse, idx) => {
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
                        className="text-base font-semibold hover:underline"
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
                      className="notranslate font-quran-amiri-quran quran-arabic-text text-2xl leading-[1.8]"
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
                />
              </Fragment>
            );
          })}
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
    </div>
  );
}
