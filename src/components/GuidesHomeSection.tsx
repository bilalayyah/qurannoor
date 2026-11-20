import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GUIDE_ARTICLES } from '../data/guides';

const FEATURED_SLUGS = [
  'how-to-read-the-quran-daily',
  'understanding-tajweed-rules',
  'the-30-juz-explained',
  'how-to-memorize-the-quran-hifz',
];

export function GuidesHomeSection() {
  const featuredGuides = FEATURED_SLUGS.map((slug) =>
    GUIDE_ARTICLES.find((article) => article.slug === slug)
  ).filter((article): article is NonNullable<typeof article> => Boolean(article));

  return (
    <section aria-labelledby="home-guides-heading">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h2
            id="home-guides-heading"
            className="text-xl sm:text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Guides
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Practical articles on daily Quran reading, Tajweed, Hifz, and Tafsir.
          </p>
        </div>
        <Link
          to="/guides"
          className="inline-flex items-center gap-1 text-sm font-medium hover:underline whitespace-nowrap shrink-0"
          style={{ color: 'var(--accent-text)' }}
        >
          <span>{`All ${GUIDE_ARTICLES.length} Guides`}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {featuredGuides.map((guide) => (
          <Link
            key={guide.slug}
            to={`/guides/${guide.slug}`}
            className="group flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <span style={{ color: 'var(--gold)' }}>{guide.category}</span>
                <span aria-hidden="true" style={{ color: 'var(--border-strong)' }}>
                  ·
                </span>
                <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                  {`${guide.readingTimeMinutes} min read`}
                </span>
              </div>
              <h3
                className="text-sm font-semibold tracking-tight leading-snug"
                style={{ color: 'var(--text-primary)' }}
              >
                {guide.title}
              </h3>
              <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                {guide.summary}
              </p>
            </div>

            <div
              className="mt-4 flex items-center justify-between border-t pt-3 text-xs"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span style={{ color: 'var(--text-tertiary)' }}>{guide.author}</span>
              <span
                className="inline-flex items-center gap-1 font-medium group-hover:underline whitespace-nowrap"
                style={{ color: 'var(--accent-text)' }}
              >
                <span>Read</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
