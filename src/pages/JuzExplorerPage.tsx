import { Breadcrumbs } from '../components/Breadcrumbs';
import { JuzCard } from '../components/JuzCard';
import { ErrorBanner } from '../components/StatusStates';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';

export function JuzExplorerPage() {
  usePageMetadata({
    title: 'All 30 Juz – QuranNoor',
    description:
      'Browse all 30 Juz (Ajza) of the Noble Quran on QuranNoor.com with starting and ending Surah and Ayah references.',
    canonicalPath: '/juz',
  });

  const { juzs, chapters, chaptersLoading, chaptersError, reloadMetadata } = useReader();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Quran', to: '/quran' }, { label: 'All 30 Juz' }]} />

      <div className="mb-8">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          All 30 Juz
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          The Quran is divided into 30 equal Juz sections for structured daily reading and reflection.
        </p>
      </div>

      {chaptersError ? (
        <ErrorBanner message={chaptersError} onRetry={reloadMetadata} />
      ) : chaptersLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-xl border animate-pulse"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {juzs.map((juz) => (
            <JuzCard key={juz.juz_number} juz={juz} chapters={chapters} />
          ))}
        </div>
      )}
    </div>
  );
}
