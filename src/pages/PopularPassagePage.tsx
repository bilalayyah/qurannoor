import { ArrowRight, BookOpen, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AyahCard } from '../components/AyahCard';
import { BismillahHeader } from '../components/BismillahHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ErrorBanner, VerseListSkeleton } from '../components/StatusStates';
import { useAudio, type PlayableAyah } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { fetchVersesByChapter, fetchVersesByKeys } from '../services/quranApi';
import type { Verse } from '../types/quran';
import { POPULAR_SECTIONS, toSurahSlug } from '../utils/slugs';
import { stripHtmlTags } from '../utils/text';

export function PopularPassagePage() {
  const { slug } = useParams<{ slug: string }>();
  const section = POPULAR_SECTIONS.find((s) => s.slug === slug);

  usePageMetadata({
    title: section ? `${section.title} – QuranNoor` : 'Popular Quran Passage – QuranNoor',
    description: section
      ? `Read and listen to ${section.title} (${section.referenceLabel}) on QuranNoor.com with authentic Uthmani Arabic script and English translation.`
      : 'Read popular passages of the Noble Quran on QuranNoor.com.',
    canonicalPath: section ? `/popular/${section.slug}` : undefined,
  });

  const { chapters, settings } = useReader();
  const { playAyah, updateQueue } = useAudio();

  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const chapter = section ? chapters.find((c) => c.id === section.chapterId) : undefined;

  const loadPassage = useCallback(async () => {
    if (!section) {
      setError('Requested Quran passage not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      if (section.verseKeys && section.verseKeys.length > 0) {
        const data = await fetchVersesByKeys({
          keys: section.verseKeys,
          translationId: settings.translationId,
          reciterId: settings.reciterId,
        });
        setVerses(data);
      } else {
        // Chapter-type popular section: fetch first 50 verses
        const data = await fetchVersesByChapter({
          chapterId: section.chapterId,
          page: 1,
          perPage: 50,
          translationId: settings.translationId,
          reciterId: settings.reciterId,
        });
        setVerses(data.verses);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string; code?: string };
      const msg = errObj?.message || 'Unable to load passage.';
      setError(msg);
      setErrorCode(errObj?.code || (msg.includes('Pre-live') ? 'PRELIVE_LIMITED' : null));
    } finally {
      setLoading(false);
    }
  }, [section, settings.translationId, settings.reciterId]);

  useEffect(() => {
    loadPassage();
  }, [loadPassage]);

  const queue: PlayableAyah[] = useMemo(() => {
    if (!section) return [];
    return verses.map((v) => ({
      verseKey: v.verse_key,
      chapterId: section.chapterId,
      verseNumber: v.verse_number,
      chapterName: chapter?.name_simple || section.title,
      audioUrl: v.audio?.url,
      translationText: stripHtmlTags(v.translations?.[0]?.text || ''),
    }));
  }, [verses, section, chapter]);

  useEffect(() => {
    if (queue.length > 0) updateQueue(queue);
  }, [queue, updateQueue]);

  if (!section) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Passage Not Found
        </h1>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-xl px-5 py-2.5 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[850px] px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Quran', to: '/quran' },
          { label: section.title },
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
            <p className="text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
              {section.referenceLabel}
            </p>
            <h1
              className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {section.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {section.subtitle}
            </p>
          </div>

          <p
            dir="rtl"
            lang="ar"
            translate="no"
            className="notranslate font-quran-scheherazade quran-arabic-text text-3xl sm:text-4xl leading-[1.8]"
            style={{ color: 'var(--text-primary)' }}
          >
            {section.arabicTitle}
          </p>
        </div>

        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
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
            <span>Listen to Passage</span>
          </button>

          {chapter && (
            <Link
              to={`/surah/${toSurahSlug(chapter.name_simple)}${
                section.verseKeys?.[0]
                  ? `?ayah=${section.verseKeys[0].split(':')[1]}`
                  : ''
              }`}
              className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
              style={{ color: 'var(--accent-text)' }}
            >
              <span>Read in Surah {chapter.name_simple}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </header>

      {section.type === 'chapter' && chapter?.bismillah_pre && !loading && (
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
              {section.title} · Awaiting Production API Access
            </h2>
            <p className="mt-3 max-w-lg mx-auto text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This application (<span className="font-semibold text-emerald-800 dark:text-emerald-400">Noor Quran</span>) is authenticated with Quran Foundation Pre-live credentials. The developer sandbox provides full authentic access to <strong>Surah 1 (Al-Fatihah)</strong> and <strong>Surah 2 (Al-Baqarah)</strong>.
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Verses for Surah {section.chapterId} will become active immediately once Production API approval is granted by the Quran Foundation.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/popular/ayatul-kursi"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span>Read Ayatul Kursi (2:255)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/popular/last-two-ayahs-al-baqarah"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-5 py-2 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>Last 2 Ayahs of Al-Baqarah</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/surah/al-fatihah"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                Surah Al-Fatihah
              </Link>
            </div>
          </div>
        ) : (
          <ErrorBanner message={error} onRetry={loadPassage} />
        )
      ) : loading ? (
        <VerseListSkeleton count={section.verseKeys?.length || 4} />
      ) : (
        <div>
          {verses.map((verse) => (
            <AyahCard
              key={verse.verse_key}
              verse={verse}
              chapterName={chapter?.name_simple || section.title}
              chapterArabicName={chapter?.name_arabic || section.arabicTitle}
              queue={queue}
              showChapterLink
            />
          ))}
        </div>
      )}
    </div>
  );
}
