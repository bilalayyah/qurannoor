import { BookOpen, Pause, Play, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ReciterSelector } from '../components/ReciterSelector';
import { ErrorBanner } from '../components/StatusStates';
import { useAudio } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { toSurahSlug } from '../utils/slugs';

export function ListenPage() {
  usePageMetadata({
    title: 'Listen to the Noble Quran – QuranNoor',
    description:
      'Listen to full Surah recitations of the Noble Quran on QuranNoor.com by renowned reciters including Mishary Rashid Alafasy, AbdulBaset AbdulSamad, Abdur-Rahman as-Sudais, and Al-Minshawi.',
    canonicalPath: '/listen',
  });

  const {
    chapters,
    chaptersLoading,
    chaptersError,
    reloadMetadata,
    reciters,
    settings,
    updateSettings,
  } = useReader();

  const {
    isPlaying,
    playbackKind,
    activeChapterId,
    playFullSurah,
    togglePlayPause,
  } = useAudio();

  const [searchParams] = useSearchParams();
  const reciterQuery = Number(searchParams.get('reciter') || 0);

  useEffect(() => {
    if (reciterQuery > 0 && reciters.some((r) => r.id === reciterQuery)) {
      if (settings.reciterId !== reciterQuery) {
        updateSettings({ reciterId: reciterQuery });
      }
    }
  }, [reciterQuery, reciters, settings.reciterId, updateSettings]);

  const [filterQuery, setFilterQuery] = useState('');

  const filteredChapters = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter(
      (ch) =>
        ch.name_simple.toLowerCase().includes(q) ||
        ch.translated_name?.name?.toLowerCase().includes(q) ||
        ch.name_arabic.includes(q) ||
        String(ch.id) === q
    );
  }, [chapters, filterQuery]);

  const activeReciter = reciters.find((r) => r.id === settings.reciterId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Listen Quran' }]} />

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Listen to the Noble Quran
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Stream full Surah Arabic recitations from the Quran Foundation audio archive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label
              htmlFor="listen-reciter"
              className="text-xs font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Reciter
            </label>
            <ReciterSelector id="listen-reciter" className="w-full sm:w-auto" />
          </div>

          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label
              htmlFor="listen-filter"
              className="text-xs font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Filter Surah
            </label>
            <div
              className="flex min-h-[42px] items-center gap-2 rounded-xl border px-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <input
                id="listen-filter"
                type="search"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Surah name or number..."
                className="w-full sm:w-48 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {activeReciter && (
        <div
          className="mb-8 rounded-2xl border p-5 space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
                Active Reciter
              </p>
              <p className="mt-0.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {activeReciter.reciter_name}
                {activeReciter.style ? ` · ${activeReciter.style}` : ''}
                {activeReciter.qirat ? ` · ${activeReciter.qirat}` : ''}
              </p>
              {activeReciter.audio_capabilities && (
                <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {activeReciter.audio_capabilities.verse_by_verse &&
                  activeReciter.audio_capabilities.full_surah
                    ? 'Supports both full Surah streaming and individual Ayah playback.'
                    : activeReciter.audio_capabilities.full_surah
                    ? 'Full Surah recitation with segment-timed Ayah playback where indexed.'
                    : 'Streams full Surah sequentially Ayah-by-Ayah from individual verse audio.'}
                </p>
              )}
            </div>
            <Link
              to="/quran-text-and-translation-methodology"
              className="text-xs font-medium hover:underline underline-offset-4 shrink-0"
              style={{ color: 'var(--accent-text)' }}
            >
              Audio Source &amp; Reciter Attribution
            </Link>
          </div>

          {reciters.length > 0 && (
            <div
              className="space-y-2.5 border-t pt-4"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  All Available Official Reciters ({reciters.length})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {reciters.map((r) => {
                  const isActive = r.id === activeReciter.id;
                  const meta = [r.style, r.qirat].filter(Boolean).join(' · ');
                  return (
                    <Link
                      key={r.id}
                      to={`/listen?reciter=${r.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        borderColor: isActive ? 'var(--accent)' : 'var(--border-subtle)',
                        backgroundColor: isActive ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                        color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                    >
                      <span>{r.reciter_name}</span>
                      {meta && (
                        <span
                          className="text-[11px] font-normal"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          ({meta})
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {chaptersError ? (
        <ErrorBanner message={chaptersError} onRetry={reloadMetadata} />
      ) : chaptersLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border animate-pulse"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredChapters.map((ch) => {
            const isThisSurahPlaying =
              playbackKind === 'surah' && activeChapterId === ch.id && isPlaying;
            const isThisSurahLoaded =
              playbackKind === 'surah' && activeChapterId === ch.id;

            return (
              <div
                key={ch.id}
                className="flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
                style={{
                  backgroundColor: isThisSurahLoaded
                    ? 'var(--highlight-ayah)'
                    : 'var(--bg-surface)',
                  borderColor: isThisSurahLoaded
                    ? 'var(--accent)'
                    : 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isThisSurahLoaded) {
                        togglePlayPause();
                      } else {
                        playFullSurah(ch.id, ch.name_simple);
                      }
                    }}
                    aria-label={
                      isThisSurahPlaying
                        ? `Pause Surah ${ch.name_simple}`
                        : `Play Surah ${ch.name_simple}`
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {isThisSurahPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 translate-x-0.5" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {ch.id}.
                      </span>
                      <h3
                        className="truncate text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Link
                          to={`/surah/${toSurahSlug(ch.name_simple)}`}
                          className="hover:underline underline-offset-4"
                        >
                          {ch.name_simple}
                        </Link>
                      </h3>
                    </div>
                    <p
                      className="mt-0.5 truncate text-xs"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {ch.translated_name?.name} · {ch.verses_count} Ayahs
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className="notranslate font-quran-amiri-quran quran-arabic-text text-lg leading-[1.75]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {ch.name_arabic}
                  </span>
                  <Link
                    to={`/surah/${toSurahSlug(ch.name_simple)}`}
                    title={`Read Surah ${ch.name_simple}`}
                    aria-label={`Read Surah ${ch.name_simple}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <BookOpen className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
