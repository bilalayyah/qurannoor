import { ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useReader } from '../context/ReaderContext';

export function ContinueReading() {
  const { lastRead, chapters } = useReader();

  if (!lastRead) {
    return null;
  }

  const matchedChapter = chapters.find((c) => c.id === lastRead.chapterId);
  const chapterName = matchedChapter?.name_simple || lastRead.chapterName;
  const chapterArabicName = matchedChapter?.name_arabic || lastRead.chapterArabicName;
  const totalVerses = matchedChapter?.verses_count || lastRead.totalVerses || 7;
  const progressPct = Math.min(
    100,
    Math.max(1, Math.round((lastRead.verseNumber / totalVerses) * 100))
  );

  return (
    <section aria-label="Continue Reading">
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 rounded-2xl border p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="space-y-2.5 flex-1 min-w-0">
          <div
            className="flex items-center gap-2 text-xs font-medium"
            style={{ color: 'var(--accent-text)' }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Continue Reading</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Continue Reading — Surah {chapterName}, Ayah {lastRead.verseNumber}
            </h2>
            {chapterArabicName && (
              <span
                dir="rtl"
                lang="ar"
                translate="no"
                className="notranslate font-quran-scheherazade quran-arabic-text text-base sm:text-lg leading-[1.6] !py-0"
                style={{ color: 'var(--text-secondary)' }}
              >
                {chapterArabicName}
              </span>
            )}
          </div>

          <p className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {`Ayah ${lastRead.verseNumber} of ${totalVerses}`}
            <span aria-hidden="true"> · </span>
            <span>{`${progressPct}% complete`}</span>
          </p>

          <div
            className="h-1.5 w-full max-w-md overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--bg-muted)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                backgroundColor: 'var(--accent)',
              }}
            />
          </div>
        </div>

        <Link
          to={`/surah/${lastRead.chapterSlug}?ayah=${lastRead.verseNumber}`}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <span>Continue Reading</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
