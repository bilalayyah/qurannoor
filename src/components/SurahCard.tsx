import { Link } from 'react-router-dom';
import type { Chapter } from '../types/quran';
import { toSurahSlug } from '../utils/slugs';

export function SurahCard({ chapter }: { chapter: Chapter }) {
  const slug = chapter.slug || toSurahSlug(chapter.name_simple);
  const revelationLabel =
    chapter.revelation_place === 'makkah' ? 'Meccan' : 'Medinan';

  return (
    <Link
      to={`/surah/${slug}`}
      className="group flex items-center justify-between gap-4 rounded-xl border p-4 sm:p-5 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors group-hover:text-[var(--accent-text)]"
          style={{
            backgroundColor: 'var(--bg-muted)',
            color: 'var(--text-primary)',
          }}
        >
          {chapter.id}
        </span>

        <div className="min-w-0">
          <h3
            className="truncate text-base font-semibold tracking-tight group-hover:underline decoration-1 underline-offset-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {chapter.name_simple}
          </h3>
          <p
            className="mt-0.5 truncate text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {chapter.translated_name?.name}
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{chapter.verses_count} Ayahs</span>
            <span aria-hidden="true"> · </span>
            <span>{revelationLabel}</span>
            {chapter.available_in_prelive === false && (
              <>
                <span aria-hidden="true"> · </span>
                <span style={{ color: 'var(--gold)' }} className="font-medium">
                  Pending Prod API
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          dir="rtl"
          lang="ar"
          translate="no"
          className="notranslate font-quran-scheherazade quran-arabic-text text-xl leading-[1.85]"
          style={{ color: 'var(--text-primary)' }}
        >
          {chapter.name_arabic}
        </p>
      </div>
    </Link>
  );
}
