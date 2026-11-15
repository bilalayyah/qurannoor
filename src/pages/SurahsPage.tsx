import { ArrowUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ErrorBanner } from '../components/StatusStates';
import { SurahCard } from '../components/SurahCard';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';

export function SurahsPage() {
  usePageMetadata({
    title: 'All 114 Surahs – QuranNoor',
    description:
      'Explore all 114 Surahs of the Noble Quran on QuranNoor.com with Meccan and Medinan classifications, Ayah counts, and English meanings.',
    canonicalPath: '/surahs',
  });

  const { chapters, chaptersLoading, chaptersError, reloadMetadata } = useReader();
  const [query, setQuery] = useState('');
  const [revelationFilter, setRevelationFilter] = useState<'all' | 'makkah' | 'madinah'>('all');
  const [ascending, setAscending] = useState(true);

  const visibleSurahs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = chapters.filter((ch) => {
      if (revelationFilter !== 'all' && ch.revelation_place !== revelationFilter) {
        return false;
      }
      if (!q) return true;
      return (
        ch.name_simple.toLowerCase().includes(q) ||
        ch.translated_name?.name?.toLowerCase().includes(q) ||
        ch.name_arabic.includes(q) ||
        String(ch.id) === q
      );
    });
    return ascending ? list : [...list].reverse();
  }, [chapters, query, revelationFilter, ascending]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Quran', to: '/quran' }, { label: 'All 114 Surahs' }]} />

      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            All 114 Surahs
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Browse the complete Noble Quran in authentic Quranic order.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div
            className="flex min-h-[42px] items-center gap-2 rounded-xl border px-3"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Surah name or number..."
              aria-label="Search Surahs"
              className="w-52 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          {/* Revelation Filter */}
          <div
            className="inline-flex rounded-xl p-1"
            style={{ backgroundColor: 'var(--bg-muted)' }}
          >
            {(['all', 'makkah', 'madinah'] as const).map((tab) => {
              const active = revelationFilter === tab;
              const label = tab === 'all' ? 'All' : tab === 'makkah' ? 'Meccan' : 'Medinan';
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRevelationFilter(tab)}
                  className="min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Order Toggle */}
          <button
            type="button"
            onClick={() => setAscending((v) => !v)}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>{ascending ? '1 → 114' : '114 → 1'}</span>
          </button>
        </div>
      </div>

      {chaptersError ? (
        <ErrorBanner message={chaptersError} onRetry={reloadMetadata} />
      ) : chaptersLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl border animate-pulse"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            />
          ))}
        </div>
      ) : visibleSurahs.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No Surahs matched “{query}”.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSurahs.map((ch) => (
            <SurahCard key={ch.id} chapter={ch} />
          ))}
        </div>
      )}
    </div>
  );
}
