import { ArrowRight, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ErrorBanner, VerseListSkeleton } from '../components/StatusStates';
import { SurahCard } from '../components/SurahCard';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { fetchVerseByKey } from '../services/quranApi';
import type { Verse } from '../types/quran';
import {
  MAX_LOCAL_SEARCH_RESULTS,
  searchLocalQuran,
  type LocalQuranSearchMatch,
} from '../utils/localSearch';
import { toSurahSlug } from '../utils/slugs';
import {
  getArabicFontClass,
  getEnglishTranslation,
  getUrduTranslation,
  getVerseArabicText,
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
      'Search the Noble Quran on QuranNoor.com by Surah name, Ayah reference (e.g. 2:255), Arabic text, English, or Urdu keywords.',
    canonicalPath: '/search',
    noindex: true,
  });

  const { chapters, settings } = useReader();

  const [inputValue, setInputValue] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);

  const [directVerse, setDirectVerse] = useState<Verse | null>(null);
  const [results, setResults] = useState<LocalQuranSearchMatch[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isCapped, setIsCapped] = useState(false);
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
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setDirectVerse(null);
        setResults([]);
        setTotalMatches(0);
        setIsCapped(false);
        return;
      }

      setLoading(true);
      setError(null);
      setDirectVerse(null);

      try {
        const isVerseKeyQuery = /^\d{1,3}:\d{1,3}$/.test(trimmed);
        if (isVerseKeyQuery) {
          try {
            const verse = await fetchVerseByKey({
              verseKey: trimmed,
              translationId: settings.translationId,
              reciterId: settings.reciterId,
            });
            setDirectVerse(verse);
          } catch {
            // Invalid verse key falls through cleanly
          }
        }

        const localRes = isVerseKeyQuery
          ? { results: [], totalMatches: 0, capped: false }
          : await searchLocalQuran(trimmed, MAX_LOCAL_SEARCH_RESULTS);

        setResults(localRes.results);
        setTotalMatches(localRes.totalMatches);
        setIsCapped(localRes.capped);
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
    if (qParam) {
      executeSearch(qParam);
    } else {
      setDirectVerse(null);
      setResults([]);
      setTotalMatches(0);
      setIsCapped(false);
    }
  }, [searchParams, executeSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setSearchParams({});
      return;
    }
    setSearchParams({ q: trimmed });
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
          Search by Surah name, Ayah reference (e.g. 2:255), Arabic text, English, or Urdu keywords.
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
            className="min-h-[44px] shrink-0 rounded-xl px-5 py-2 text-sm font-medium text-white"
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
                className="min-h-[44px] rounded-xl border px-3.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
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
                  className={`notranslate quran-arabic-text w-full text-right leading-[1.9] [word-spacing:0.02em] ${getArabicFontClass(
                    settings.arabicFont
                  )}`}
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: `${settings.arabicFontSize}px`,
                  }}
                >
                  {getVerseArabicText(directVerse, settings.script)}
                  <span
                    className="inline-block select-none px-1 text-[0.76em] font-normal"
                    style={{ color: 'var(--gold)' }}
                    aria-label={`Ayah ${directVerse.verse_number}`}
                  >
                    {` ﴿${toArabicIndicDigits(directVerse.verse_number)}﴾`}
                  </span>
                </p>
                {(() => {
                  const enTr = getEnglishTranslation(directVerse.translations, settings.translationId);
                  const urTr = getUrduTranslation(directVerse.translations);
                  return (
                    <>
                      {enTr && (
                        <p
                          className="mt-4 font-editorial text-base leading-relaxed"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {stripHtmlTags(enTr.text)}
                        </p>
                      )}
                      {urTr && (
                        <p
                          dir="rtl"
                          lang="ur"
                          className="mt-3 font-urdu w-full text-right text-[15px] leading-[2.05] [word-spacing:0.06em]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {stripHtmlTags(urTr.text)}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })()}
        </section>
      )}

      {/* Search Results */}
      {error ? (
        <ErrorBanner message={error} onRetry={() => executeSearch(activeQuery)} />
      ) : loading ? (
        <VerseListSkeleton count={4} />
      ) : activeQuery && results.length === 0 && !directVerse && matchingSurahs.length === 0 ? (
        <div
          className="rounded-2xl border p-8 sm:p-10 text-center"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}
          >
            <Search className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            No results found for “{activeQuery}”
          </h2>
          <p className="mt-2 mx-auto max-w-md text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            No matching Surahs or Ayahs were found. Try a different keyword in English, Arabic, or
            Urdu, search by Surah name, or jump directly to an Ayah reference such as 2:255.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Suggestions:
            </span>
            {[
              { label: 'Ayatul Kursi (2:255)', query: '2:255' },
              { label: 'Surah Al-Fatihah', query: 'Al-Fatihah' },
              { label: 'Mercy', query: 'Mercy' },
              { label: 'Patience', query: 'Patience' },
            ].map((s) => (
              <button
                key={s.query}
                type="button"
                onClick={() => setSearchParams({ q: s.query })}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-text)' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : results.length > 0 ? (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Matching Ayahs
            </h2>
            <p className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
              {isCapped
                ? `Showing top ${results.length} of ${totalMatches.toLocaleString()} matching Ayahs for “${activeQuery}”`
                : `Showing ${results.length} matching ${results.length === 1 ? 'Ayah' : 'Ayahs'} for “${activeQuery}”`}
            </p>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {results.map((item) => {
              const ch = chapters.find((c) => c.id === item.chapterId);

              return (
                <article key={item.verseKey} className="py-7">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      {ch ? `${ch.name_simple} · ${item.verseKey}` : item.verseKey}
                    </span>
                    <Link
                      to={`/surah/${ch ? toSurahSlug(ch.name_simple) : item.chapterId}?ayah=${item.verseNumber}`}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
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
                    className={`notranslate quran-arabic-text w-full text-right leading-[1.9] [word-spacing:0.02em] ${getArabicFontClass(
                      settings.arabicFont
                    )}`}
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: `${settings.arabicFontSize}px`,
                    }}
                  >
                    {item.textArabic}
                    <span
                      className="inline-block select-none px-1 text-[0.76em] font-normal"
                      style={{ color: 'var(--gold)' }}
                      aria-label={`Ayah ${item.verseNumber}`}
                    >
                      {` ﴿${toArabicIndicDigits(item.verseNumber)}﴾`}
                    </span>
                  </p>

                  {item.englishSnippet && (
                    <div className="mt-3 max-w-3xl space-y-1">
                      <p
                        className="font-editorial text-base leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {item.englishSnippet}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        Saheeh International
                      </p>
                    </div>
                  )}

                  {(item.matchedField === 'urdu' || settings.showTranslation) && item.textUrdu && (
                    <p
                      dir="rtl"
                      lang="ur"
                      className="mt-3 font-urdu w-full text-right text-[15px] leading-[2.05] [word-spacing:0.06em]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {item.textUrdu}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
