import { ArrowRight, ChevronLeft, ChevronRight, Info, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ErrorBanner, VerseListSkeleton } from '../components/StatusStates';
import { SurahCard } from '../components/SurahCard';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { fetchVerseByKey, searchQuran, type SearchApiResult } from '../services/quranApi';
import type { SearchResult, Verse } from '../types/quran';
import { toSurahSlug } from '../utils/slugs';
import {
  formatTranslationHtmlToText,
  getArabicFontClass,
  stripHtmlTags,
  toArabicIndicDigits,
} from '../utils/text';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  usePageMetadata({
    title: initialQuery
      ? `Search: ${initialQuery} – QuranNoor`
      : 'Search the Noble Quran – QuranNoor',
    description:
      'Search the Noble Quran on QuranNoor.com by Surah name, Ayah reference (e.g. 2:255), Arabic text, or English translation keywords.',
    canonicalPath: '/search',
    noindex: true,
  });

  const { chapters, settings } = useReader();

  const [inputValue, setInputValue] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const [directVerse, setDirectVerse] = useState<Verse | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [scopeStatus, setScopeStatus] = useState<SearchApiResult['scope_status'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchingSurahs = useMemo(() => {
    const q = activeQuery.trim().toLowerCase();
    if (!q) return [];
    return chapters
      .filter(
        (ch) =>
          ch.name_simple.toLowerCase().includes(q) ||
          ch.translated_name?.name?.toLowerCase().includes(q) ||
          ch.name_arabic.includes(q) ||
          String(ch.id) === q
      )
      .slice(0, 6);
  }, [chapters, activeQuery]);

  const executeSearch = useCallback(
    async (q: string, pageNum: number) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setDirectVerse(null);
        setResults([]);
        setTotalResults(0);
        setTotalPages(0);
        setScopeStatus(null);
        return;
      }

      setLoading(true);
      setError(null);
      setDirectVerse(null);

      try {
        // Check if query is an exact Surah:Ayah reference like 2:255
        if (/^\d{1,3}:\d{1,3}$/.test(trimmed)) {
          try {
            const verse = await fetchVerseByKey({
              verseKey: trimmed,
              translationId: settings.translationId,
              reciterId: settings.reciterId,
            });
            setDirectVerse(verse);
          } catch {
            // Fall through to normal search if verse key doesn't exist
          }
        }

        const data = await searchQuran({
          query: trimmed,
          page: pageNum,
          size: 20,
        });

        setResults(data?.results || []);
        setTotalResults(data?.total_results || 0);
        setTotalPages(data?.total_pages || 0);
        setScopeStatus(data?.scope_status || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [settings.translationId, settings.reciterId]
  );

  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    setInputValue(qParam);
    setActiveQuery(qParam);
    setPage(1);
    if (qParam) {
      executeSearch(qParam, 1);
    }
  }, [searchParams, executeSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSearchParams({ q: trimmed });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    executeSearch(activeQuery, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Search' }]} />

      <div className="mb-8">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Search the Quran
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Search by Surah name, Ayah reference (e.g. 2:255), Arabic text, or English keywords.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-10" role="search">
        <div
          className="flex items-center gap-2 rounded-2xl border p-1.5 shadow-sm"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <Search className="ml-3 h-5 w-5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Try 'mercy', '2:255', 'Al-Kahf', or 'الرحمن'..."
            className="w-full min-h-[44px] bg-transparent px-2 text-sm sm:text-base outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <button
            type="submit"
            className="min-h-[40px] shrink-0 rounded-xl px-5 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Suggested Searches when empty */}
      {!activeQuery && (
        <div className="space-y-4">
          <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Try searching for:
          </p>
          <div className="flex flex-wrap gap-2">
            {['2:255', 'Patience', 'Mercy', 'Yaseen', 'Guidance', 'Gratitude'].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setSearchParams({ q: term })}
                className="min-h-[38px] rounded-xl border px-3.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matching Surahs */}
      {matchingSurahs.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Matching Surahs
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {matchingSurahs.map((ch) => (
              <SurahCard key={ch.id} chapter={ch} />
            ))}
          </div>
        </section>
      )}

      {/* Direct Verse Key Match */}
      {directVerse && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Exact Ayah Reference
          </h2>
          {(() => {
            const [chIdStr, vNumStr] = directVerse.verse_key.split(':');
            const ch = chapters.find((c) => c.id === Number(chIdStr));
            return (
              <div
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--accent)',
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {ch ? `${ch.name_simple} · ${directVerse.verse_key}` : directVerse.verse_key}
                  </span>
                  <Link
                    to={`/surah/${ch ? toSurahSlug(ch.name_simple) : chIdStr}?ayah=${vNumStr}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    <span>Open Ayah</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p
                  dir="rtl"
                  lang="ar"
                  translate="no"
                  className={`notranslate quran-arabic-text text-2xl sm:text-3xl leading-[2.2] ${getArabicFontClass(
                    settings.arabicFont
                  )}`}
                  style={{ color: 'var(--text-primary)' }}
                >
                  {settings.script === 'indopak' && directVerse.text_indopak
                    ? directVerse.text_indopak
                    : directVerse.text_uthmani}{' '}
                  <span
                    className="inline-block select-none px-1.5 text-[0.74em] font-normal"
                    style={{ color: 'var(--gold)' }}
                    aria-label={`Ayah ${directVerse.verse_number}`}
                  >
                    ﴿{toArabicIndicDigits(directVerse.verse_number)}﴾
                  </span>
                </p>
                {directVerse.translations?.[0] && (
                  <p
                    className="mt-4 font-editorial text-base leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {stripHtmlTags(directVerse.translations[0].text)}
                  </p>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* Search Results */}
      {error ? (
        <ErrorBanner message={error} onRetry={() => executeSearch(activeQuery, page)} />
      ) : loading ? (
        <VerseListSkeleton count={4} />
      ) : activeQuery && results.length === 0 && !directVerse && matchingSurahs.length === 0 ? (
        scopeStatus && !scopeStatus.granted ? (
          <div
            className="rounded-2xl border p-8 sm:p-10 text-center"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl mb-4"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <Info className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Full-Text Search Awaiting Production API Scope
            </h2>
            <p className="mt-2 max-w-lg mx-auto text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              The developer application (<span className="font-semibold text-emerald-800 dark:text-emerald-400">Noor Quran</span>) is authenticated with pre-live read scopes for chapters, verses, translations, and audio recitations. Full-text keyword search (<code className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-xs">content.search.read</code>) will become active once approved in Production.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                You can still search by:
              </span>
              <button
                type="button"
                onClick={() => setSearchParams({ q: '2:255' })}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-text)' }}
              >
                Ayatul Kursi (2:255)
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ q: 'Al-Fatihah' })}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-text)' }}
              >
                Surah Al-Fatihah
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ q: 'Al-Baqarah' })}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-text)' }}
              >
                Surah Al-Baqarah
              </button>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl border p-10 text-center"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No verses matched “{activeQuery}”. Try another keyword or Surah:Ayah reference.
            </p>
          </div>
        )
      ) : results.length > 0 ? (
        <section>
          <p className="mb-4 text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            Showing {results.length} of {totalResults.toLocaleString()} verse results for “{activeQuery}”
          </p>

          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {results.map((item) => {
              const [chIdStr, ayahStr] = item.verse_key.split(':');
              const ch = chapters.find((c) => c.id === Number(chIdStr));
              const translation = item.translations?.[0];

              return (
                <article key={`${item.verse_key}-${item.verse_id}`} className="py-7">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      {ch ? `${ch.name_simple} · ${item.verse_key}` : item.verse_key}
                    </span>
                    <Link
                      to={`/surah/${ch ? toSurahSlug(ch.name_simple) : chIdStr}?ayah=${ayahStr}`}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span>Open Ayah</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className={`notranslate quran-arabic-text text-2xl sm:text-3xl leading-[2.2] ${getArabicFontClass(
                      settings.arabicFont
                    )}`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.text}
                  </p>

                  {translation && (
                    <div className="mt-4 max-w-3xl space-y-1">
                      <p
                        className="font-editorial text-base leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {formatTranslationHtmlToText(translation.text)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {translation.name}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div
              className="mt-8 flex items-center justify-between border-t pt-6"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 text-sm font-medium disabled:opacity-40"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 text-sm font-medium disabled:opacity-40"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
