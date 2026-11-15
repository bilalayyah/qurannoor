import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Chapter, Juz } from '../types/quran';

interface JuzCardProps {
  juz: Juz;
  chapters: Chapter[];
}

export function JuzCard({ juz, chapters }: JuzCardProps) {
  const entries = Object.entries(juz.verse_mapping || {}).sort(
    ([a], [b]) => Number(a) - Number(b)
  );

  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];

  const getChapterName = (idStr?: string) => {
    if (!idStr) return '';
    const ch = chapters.find((c) => c.id === Number(idStr));
    return ch ? ch.name_simple : `Surah ${idStr}`;
  };

  const parseRangeStart = (range?: string) => (range ? range.split('-')[0] : '1');
  const parseRangeEnd = (range?: string) => {
    if (!range) return '1';
    const parts = range.split('-');
    return parts[parts.length - 1];
  };

  const startSurahName = getChapterName(firstEntry?.[0]);
  const startAyah = parseRangeStart(firstEntry?.[1]);
  const endSurahName = getChapterName(lastEntry?.[0]);
  const endAyah = parseRangeEnd(lastEntry?.[1]);

  return (
    <Link
      to={`/juz/${juz.juz_number}`}
      className="group flex flex-col justify-between rounded-xl border p-5 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className="text-base font-semibold tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            Juz {juz.juz_number}
          </h3>
          <div className="flex items-center gap-2">
            {juz.available_in_prelive === false && (
              <span style={{ color: 'var(--gold)' }} className="text-[11px] font-medium">
                Pending Prod API
              </span>
            )}
            <span
              className="text-xs tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {juz.verses_count} Ayahs
            </span>
          </div>
        </div>

        {firstEntry && lastEntry && (
          <div
            className="mt-3 space-y-1 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            <p className="truncate">
              From: <span className="font-medium">{startSurahName}</span>{' '}
              <span className="tabular-nums">
                ({firstEntry[0]}:{startAyah})
              </span>
            </p>
            <p className="truncate">
              To: <span className="font-medium">{endSurahName}</span>{' '}
              <span className="tabular-nums">
                ({lastEntry[0]}:{endAyah})
              </span>
            </p>
          </div>
        )}
      </div>

      <div
        className="mt-4 flex items-center justify-between border-t pt-3 text-xs font-medium"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--accent-text)',
        }}
      >
        <span>Read Juz {juz.juz_number}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
