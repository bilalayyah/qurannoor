import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AyahCard } from '../components/AyahCard';
import { AyahTafsirSection } from '../components/AyahTafsirSection';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { HifzControlsBar } from '../components/HifzControlsBar';
import { ErrorBanner, VerseListSkeleton } from '../components/StatusStates';
import { useAudio, type PlayableAyah } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { fetchVerseByKey } from '../services/quranApi';
import { getEmbeddedVerseByKey } from '../utils/prerenderData';
import type { Verse } from '../types/quran';
import { POPULAR_SECTIONS, resolveChapterIdFromParam, toSurahSlug } from '../utils/slugs';
import { getEnglishTranslation, stripHtmlTags } from '../utils/text';

export function AyahPage() {
  const { slug, ayahNumber } = useParams<{ slug: string; ayahNumber: string }>();
  const { chapters, settings } = useReader();
  const { updateQueue } = useAudio();

  const chapterId = useMemo(
    () => resolveChapterIdFromParam(slug, chapters),
    [slug, chapters]
  );

  const chapter = useMemo(
    () => (chapterId ? chapters.find((c) => c.id === chapterId) : undefined),
    [chapters, chapterId]
  );

  const verseNum = Number(ayahNumber);
  const isValidVerseNum =
    Number.isInteger(verseNum) &&
    verseNum >= 1 &&
    (!chapter || verseNum <= chapter.verses_count);

  const verseKey = chapterId && isValidVerseNum ? `${chapterId}:${verseNum}` : null;

  // H-1: seed the first render from the embedded prerender data (same
  // pattern as the reader pages) — keyed to the default settings.
  const seededVerse = verseKey
    ? getEmbeddedVerseByKey(verseKey, settings.translationId, settings.reciterId)
    : null;

  const [verse, setVerse] = useState<Verse | null>(() => seededVerse);
  const [loading, setLoading] = useState(() => seededVerse === null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const loadAyah = useCallback(async () => {
    if (!verseKey) {
      if (chapters.length > 0) {
        setError('Requested Ayah reference could not be found.');
        setLoading(false);
      }
      return;
    }

    // H-1: seeded fast-path — apply the embedded verse without fetching.
    if (seededVerse) {
      setVerse(seededVerse);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const data = await fetchVerseByKey({
        verseKey,
        translationId: settings.translationId,
        reciterId: settings.reciterId,
      });
      setVerse(data);
    } catch (err: unknown) {
      const errObj = err as { message?: string; code?: string };
      const msg = errObj?.message || 'Unable to load Ayah.';
      setError(msg);
      setErrorCode(errObj?.code || (msg.includes('Pre-live') ? 'PRELIVE_LIMITED' : null));
    } finally {
      setLoading(false);
    }
  }, [verseKey, chapters.length, settings.translationId, settings.reciterId, seededVerse]);

  useEffect(() => {
    loadAyah();
  }, [loadAyah]);

  const queue: PlayableAyah[] = useMemo(() => {
    if (!verse || !chapter) return [];
    return [
      {
        verseKey: verse.verse_key,
        chapterId: chapter.id,
        verseNumber: verse.verse_number,
        chapterName: chapter.name_simple,
        audioUrl: verse.audio?.url,
        translationText: stripHtmlTags(
          getEnglishTranslation(verse.translations, settings.translationId)?.text || ''
        ),
      },
    ];
  }, [verse, chapter, settings.translationId]);

  useEffect(() => {
    if (queue.length > 0) updateQueue(queue);
  }, [queue, updateQueue]);

  const canonicalSlug = chapter ? toSurahSlug(chapter.name_simple) : slug || '';
  const relatedPopular = useMemo(() => {
    if (!verseKey) return [];
    return POPULAR_SECTIONS.filter(
      (s) => s.verseKeys?.includes(verseKey) || (s.type === 'chapter' && s.chapterId === chapterId)
    );
  }, [verseKey, chapterId]);

  usePageMetadata({
    title:
      chapter && isValidVerseNum
        ? `Surah ${chapter.name_simple} Ayah ${verseNum} (${chapter.id}:${verseNum}) – QuranNoor`
        : 'Ayah Reader – QuranNoor',
    description:
      chapter && isValidVerseNum
        ? `Read and listen to Surah ${chapter.name_simple}, Ayah ${verseNum} (${chapter.id}:${verseNum}) in authentic Uthmani Arabic script with English translation on QuranNoor.com.`
        : 'Read an individual Ayah of the Noble Quran with Arabic script, translation, and audio on QuranNoor.com.',
    canonicalPath:
      canonicalSlug && isValidVerseNum ? `/ayah/${canonicalSlug}/${verseNum}` : undefined,
  });

  if ((!chapterId || !isValidVerseNum) && chapters.length > 0) {
    return (
      <div className="mx-auto max-w-[850px] px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Ayah Not Found
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          The requested Ayah reference is out of range or unavailable.
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
    <div className="mx-auto max-w-[850px] px-2.5 py-6 sm:px-6 sm:py-10 space-y-8">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Quran', to: '/quran' },
          {
            label: chapter ? `Surah ${chapter.name_simple}` : 'Surah',
            to: `/surah/${canonicalSlug}`,
          },
          { label: `Ayah ${verseNum}` },
        ]}
      />

      {chapter && (
        <header
          className="rounded-2xl border p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="space-y-1.5">
            <p className="text-xs font-medium tabular-nums" style={{ color: 'var(--gold)' }}>
              {`Surah ${chapter.id} · Ayah ${verseNum} of ${chapter.verses_count}${verse ? ` · Juz ${verse.juz_number}` : ''}`}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {`${chapter.name_simple} — Ayah ${verseNum}`}
            </h1>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
              <Link to={`/surah/${canonicalSlug}?ayah=${verseNum}`} className="inline-flex min-h-[44px] items-center hover:underline underline-offset-4">
                {`Read Full Surah ${chapter.name_simple}`}
              </Link>
              {verse && (
                <Link to={`/juz/${verse.juz_number}`} className="inline-flex min-h-[44px] items-center gap-1 hover:underline underline-offset-4">
                  <Layers className="h-3.5 w-3.5" />
                  <span>{`Open Juz ${verse.juz_number}`}</span>
                </Link>
              )}
            </div>
          </div>

          <p
            dir="rtl"
            lang="ar"
            translate="no"
            className="notranslate font-quran-scheherazade quran-arabic-text text-xl sm:text-2xl leading-[1.55] !py-0"
            style={{ color: 'var(--text-primary)' }}
          >
            {chapter.name_arabic}
          </p>
        </header>
      )}

      {error ? (
        errorCode === 'PRELIVE_LIMITED' ? (
          <div
            className="rounded-2xl border p-8 sm:p-10 text-center"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl mb-4"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Ayah {verseKey} · Awaiting Production API Access
            </h2>
            <p className="mt-3 max-w-lg mx-auto text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              The pre-live Quran Foundation sandbox currently provides live verses for Surah 1
              (Al-Fatihah) and Surah 2 (Al-Baqarah). Individual Ayah pages for Surahs 3 to 114
              will unlock automatically once Production API access is active.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/ayah/al-baqarah/255"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2 text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span>Read Ayatul Kursi (2:255)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/surah/al-fatihah"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                Read Surah Al-Fatihah
              </Link>
            </div>
          </div>
        ) : (
          <ErrorBanner message={error} onRetry={loadAyah} />
        )
      ) : loading ? (
        <VerseListSkeleton count={1} />
      ) : verse ? (
        <div className="space-y-6">
          <HifzControlsBar queue={queue} />
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <AyahCard
              verse={verse}
              chapterName={chapter?.name_simple || `Surah ${chapterId}`}
              chapterArabicName={chapter?.name_arabic || ''}
              queue={queue}
              showTafsirToggle={false}
            />
          </div>
          <AyahTafsirSection
            verseKey={verse.verse_key}
            isExpanded
            standaloneCard
          />
        </div>
      ) : null}

      {relatedPopular.length > 0 && (
        <section
          className="rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Featured Passage Collection:
          </span>
          <div className="flex flex-wrap gap-3">
            {relatedPopular.map((item) => (
              <Link
                key={item.slug}
                to={item.type === 'chapter' ? `/surah/${item.slug}` : `/popular/${item.slug}`}
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

      {/* Ayah Prev / Surah / Next Navigation */}
      {chapter && isValidVerseNum && (
        <nav
          aria-label="Ayah Navigation"
          className="flex flex-wrap items-center justify-between gap-3 border-t pt-6"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {verseNum > 1 ? (
            <Link
              to={`/ayah/${canonicalSlug}/${verseNum - 1}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium tabular-nums"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Ayah {verseNum - 1}</span>
            </Link>
          ) : (
            <div />
          )}

          <Link
            to={`/surah/${canonicalSlug}?ayah=${verseNum}`}
            className="inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--accent-text)',
            }}
          >
            Full Surah {chapter.name_simple}
          </Link>

          {verseNum < chapter.verses_count ? (
            <Link
              to={`/ayah/${canonicalSlug}/${verseNum + 1}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium tabular-nums"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <span>Ayah {verseNum + 1}</span>
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
