import { ArrowRight, Pause, Volume2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import { POPULAR_SECTIONS } from '../utils/slugs';

export function PopularSections() {
  const navigate = useNavigate();
  const {
    isPlaying,
    playbackKind,
    activeChapterId,
    activeVerseKey,
    playFullSurah,
    playVerseKeys,
    togglePlayPause,
  } = useAudio();

  return (
    <section aria-labelledby="popular-sections-heading">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h2
            id="popular-sections-heading"
            className="text-xl sm:text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Popular Quran Sections
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Frequently read Surahs and treasured passages.
          </p>
        </div>
        <Link
          to="/surahs"
          className="text-sm font-medium hover:underline whitespace-nowrap shrink-0"
          style={{ color: 'var(--accent-text)' }}
        >
          All 114 Surahs
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {POPULAR_SECTIONS.map((item) => {
          const targetUrl =
            item.type === 'chapter' ? `/surah/${item.slug}` : `/popular/${item.slug}`;

          const isItemPlaying =
            isPlaying &&
            (item.type === 'chapter'
              ? playbackKind === 'surah' && activeChapterId === item.chapterId
              : item.verseKeys?.includes(activeVerseKey || '') ?? false);

          const isItemLoaded =
            item.type === 'chapter'
              ? playbackKind === 'surah' && activeChapterId === item.chapterId
              : item.verseKeys?.includes(activeVerseKey || '') ?? false;

          const handlePlayClick = () => {
            if (isItemLoaded) {
              togglePlayPause();
              return;
            }
            if (item.type === 'chapter') {
              playFullSurah(item.chapterId, item.title);
            } else if (item.verseKeys && item.verseKeys.length > 0) {
              playVerseKeys(item.verseKeys, item.title);
            }
          };

          const handleCardNavigate = () => {
            navigate(targetUrl);
          };

          return (
            <div
              key={item.slug}
              role="link"
              tabIndex={0}
              aria-label={`Open ${item.title}`}
              onClick={handleCardNavigate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCardNavigate();
                }
              }}
              className="group cursor-pointer flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40 focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: isItemPlaying ? 'var(--accent)' : 'var(--border-subtle)',
              }}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className="notranslate font-quran-scheherazade quran-arabic-text text-2xl leading-[1.85]"
                    style={{ color: 'var(--gold)' }}
                  >
                    {item.arabicTitle}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayClick();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                      }
                    }}
                    aria-label={isItemPlaying ? `Pause ${item.title}` : `Listen to ${item.title}`}
                    title={isItemPlaying ? `Pause ${item.title}` : `Listen to ${item.title}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{
                      borderColor: isItemPlaying ? 'var(--accent)' : 'var(--border-subtle)',
                      backgroundColor: isItemPlaying ? 'var(--accent-soft)' : 'transparent',
                      color: isItemPlaying ? 'var(--accent-text)' : 'var(--text-secondary)',
                    }}
                  >
                    {isItemPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <h3
                  className="mt-2.5 text-sm font-semibold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {item.subtitle}
                </p>
              </div>

              <div
                className="mt-4 flex items-center justify-between border-t pt-3"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                  {item.referenceLabel}
                </span>

                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-1 text-xs font-medium group-hover:underline whitespace-nowrap"
                  style={{ color: 'var(--accent-text)' }}
                >
                  <span>Open</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
