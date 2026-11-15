import { ArrowRight, Bookmark, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { toSurahSlug } from '../utils/slugs';
import { getArabicFontClass, toArabicIndicDigits } from '../utils/text';

export function BookmarksPage() {
  usePageMetadata({
    title: 'Bookmarks & Progress – QuranNoor',
    description:
      'Access your saved Quran Ayah bookmarks and resume your reading progress on QuranNoor.com.',
    canonicalPath: '/bookmarks',
    noindex: true,
  });

  const { bookmarks, removeBookmark, readingProgress, settings } = useReader();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Bookmarks' }]} />

      <div className="mb-8">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Bookmarks & Reading Progress
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Saved locally in your browser for effortless continuation.
        </p>
      </div>

      {/* Last Read Position */}
      {readingProgress && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Last Read Position
          </h2>
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {readingProgress.chapterName} · Ayah {readingProgress.verseNumber}
              </p>
              <p className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                {readingProgress.verseNumber} of {readingProgress.totalVerses} Ayahs
              </p>
            </div>
            <Link
              to={`/surah/${readingProgress.chapterSlug}?ayah=${readingProgress.verseNumber}`}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <span>Resume Reading</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* Bookmarks List */}
      <section>
        <h2 className="mb-4 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          Saved Ayahs ({bookmarks.length})
        </h2>

        {bookmarks.length === 0 ? (
          <div
            className="rounded-2xl border p-12 text-center"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <Bookmark
              className="mx-auto h-7 w-7"
              style={{ color: 'var(--text-tertiary)' }}
            />
            <h3 className="mt-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              No bookmarked Ayahs yet
            </h3>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Tap the Bookmark button on any Ayah while reading to save it here.
            </p>
            <Link
              to="/surah/al-fatihah"
              className="mt-5 inline-flex min-h-[42px] items-center rounded-xl px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Start Reading
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookmarks.map((item) => (
              <article
                key={item.verseKey}
                className="rounded-2xl border p-5 sm:p-6"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <Link
                    to={`/surah/${toSurahSlug(item.chapterName)}?ayah=${item.verseNumber}`}
                    className="text-sm font-semibold hover:underline tabular-nums"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {item.chapterName} · {item.verseKey}
                  </Link>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/surah/${toSurahSlug(item.chapterName)}?ayah=${item.verseNumber}`}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-3 text-xs font-medium"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span>Open</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => removeBookmark(item.verseKey)}
                      aria-label={`Remove bookmark ${item.verseKey}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:text-red-600"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
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
                  {item.textArabic}{' '}
                  <span
                    className="inline-block select-none px-1.5 text-[0.74em] font-normal"
                    style={{ color: 'var(--gold)' }}
                    aria-label={`Ayah ${item.verseNumber}`}
                  >
                    ﴿{toArabicIndicDigits(item.verseNumber)}﴾
                  </span>
                </p>

                {item.translationSnippet && (
                  <p
                    className="mt-4 font-editorial text-sm sm:text-base leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {item.translationSnippet}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
