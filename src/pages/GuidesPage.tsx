import { ArrowLeft, ArrowRight, BookOpen, Clock, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { GUIDE_ARTICLES, getGuideBySlug } from '../data/guides';
import { usePageMetadata } from '../hooks/usePageMetadata';
import type { GuideCategory } from '../types/guides';

const CATEGORIES: Array<'All' | GuideCategory> = [
  'All',
  'Daily Reading',
  'Tajweed & Hifz',
  'Quran Study',
];

export function GuidesIndexPage() {
  usePageMetadata({
    title: 'Quran Reading & Study Guides – QuranNoor',
    description: `Explore ${GUIDE_ARTICLES.length} practical guides on reading the Quran daily, Tajweed rules, Hifz memorization, Tafsir commentary, Qibla direction, prayer times, translations, and more.`,
    canonicalPath: '/guides',
  });

  const [selectedCategory, setSelectedCategory] = useState<'All' | GuideCategory>('All');

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'All') return GUIDE_ARTICLES;
    return GUIDE_ARTICLES.filter((article) => article.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 space-y-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Guides' }]} />

      <header className="space-y-4 border-b pb-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--gold)' }}>
          {`QuranNoor Reading & Study Library · ${GUIDE_ARTICLES.length} Guides`}
        </p>
        <h1
          className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance"
          style={{ color: 'var(--text-primary)' }}
        >
          Guides to Reading, Memorizing &amp; Understanding the Quran
        </h1>
        <p className="max-w-2xl font-editorial text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Clear, practical companions written by the QuranNoor Team to help you build a steady daily
          reading rhythm, understand Tajweed and Tafsir, and reflect on key Surahs.
        </p>

        <div
          className="pt-2 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter guides by topic"
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className="min-h-[44px] rounded-xl border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: active ? 'var(--accent)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                  color: active ? '#FFFFFF' : 'var(--text-secondary)',
                }}
              >
                {category === 'All' ? `All Guides (${GUIDE_ARTICLES.length})` : category}
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredArticles.map((article, idx) => (
          <Link
            key={article.slug}
            to={`/guides/${article.slug}`}
            className="group flex flex-col justify-between rounded-2xl border p-6 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span style={{ color: 'var(--gold)' }}>{article.category}</span>
                  <span aria-hidden="true" style={{ color: 'var(--border-strong)' }}>
                    ·
                  </span>
                  <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {`${article.readingTimeMinutes} min read`}
                  </span>
                </div>
                <span
                  className="text-xs font-medium tabular-nums shrink-0"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </div>

              {article.arabicAccent && (
                <p
                  dir="rtl"
                  lang="ar"
                  translate="no"
                  className="notranslate font-quran-scheherazade quran-arabic-text text-lg leading-[1.6] !py-0"
                  style={{ color: 'var(--accent-text)' }}
                >
                  {article.arabicAccent}
                </p>
              )}

              <h2
                className="text-lg sm:text-xl font-semibold tracking-tight leading-snug group-hover:underline underline-offset-4"
                style={{ color: 'var(--text-primary)' }}
              >
                {article.title}
              </h2>

              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {article.summary}
              </p>
            </div>

            <div
              className="mt-5 flex items-center justify-between border-t pt-4 text-xs"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span style={{ color: 'var(--text-tertiary)' }}>{`By ${article.author}`}</span>
              <span
                className="inline-flex items-center gap-1 font-medium whitespace-nowrap"
                style={{ color: 'var(--accent-text)' }}
              >
                <span>Read guide</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GuideArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = getGuideBySlug(slug);

  const jsonLd = useMemo(() => {
    if (!article) return undefined;
    const articleUrl = `https://qurannoor.com/guides/${article.slug}`;
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.metaDescription,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      author: {
        '@type': 'Organization',
        name: article.author,
      },
      publisher: {
        '@type': 'Organization',
        name: 'QuranNoor',
        url: 'https://qurannoor.com',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': articleUrl,
      },
    };
  }, [article]);

  usePageMetadata({
    title: article ? article.seoTitle : 'Guide Not Found – QuranNoor',
    description: article
      ? article.metaDescription
      : 'Explore practical Quran reading, Tajweed, Hifz, and Tafsir guides on QuranNoor.',
    canonicalPath: article ? `/guides/${article.slug}` : '/guides',
    ogType: article ? 'article' : 'website',
    noindex: !article,
    jsonLd,
  });

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Guides', to: '/guides' },
            { label: 'Not Found' },
          ]}
        />
        <div
          className="rounded-2xl border p-8 text-center space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Guide Not Found
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            We could not find the requested guide article. Browse all {GUIDE_ARTICLES.length} QuranNoor guides below.
          </p>
          <Link
            to="/guides"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Guides</span>
          </Link>
        </div>
      </div>
    );
  }

  const currentIdx = GUIDE_ARTICLES.findIndex((item) => item.slug === article.slug);
  const prevArticle = currentIdx > 0 ? GUIDE_ARTICLES[currentIdx - 1] : null;
  const nextArticle =
    currentIdx >= 0 && currentIdx < GUIDE_ARTICLES.length - 1
      ? GUIDE_ARTICLES[currentIdx + 1]
      : null;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 space-y-10">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Guides', to: '/guides' },
          { label: article.title },
        ]}
      />

      <header className="space-y-4 border-b pb-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
          <span style={{ color: 'var(--gold)' }}>{article.category}</span>
          <span aria-hidden="true" style={{ color: 'var(--border-strong)' }}>
            ·
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            <Clock className="h-3.5 w-3.5" />
            <span>{`${article.readingTimeMinutes} min read`}</span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--border-strong)' }}>
            ·
          </span>
          <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <User className="h-3.5 w-3.5" />
            <span>{article.author}</span>
          </span>
        </div>

        {article.arabicAccent && (
          <p
            dir="rtl"
            lang="ar"
            translate="no"
            className="notranslate font-quran-scheherazade quran-arabic-text text-xl sm:text-2xl leading-[1.6] !py-1"
            style={{ color: 'var(--accent-text)' }}
          >
            {article.arabicAccent}
          </p>
        )}

        <h1
          className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance"
          style={{ color: 'var(--text-primary)' }}
        >
          {article.title}
        </h1>

        <div className="space-y-4 font-editorial text-base leading-[1.8]" style={{ color: 'var(--text-secondary)' }}>
          {article.intro.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </header>

      <div className="space-y-9 font-editorial text-base leading-[1.8]" style={{ color: 'var(--text-secondary)' }}>
        {article.sections.map((section) => (
          <section key={section.heading} className="space-y-3.5">
            <h2
              className="font-ui text-xl sm:text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, pIdx) => (
              <p key={pIdx}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      {/* Key Takeaways */}
      <section
        aria-labelledby="key-takeaways-heading"
        className="rounded-2xl border p-6 space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <h2
          id="key-takeaways-heading"
          className="font-ui text-lg font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Key takeaways
        </h2>
        <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base leading-relaxed font-editorial" style={{ color: 'var(--text-secondary)' }}>
          {article.keyTakeaways.map((point, idx) => (
            <li key={idx}>{point}</li>
          ))}
        </ul>
      </section>

      {/* FAQs */}
      <section aria-labelledby="guide-faqs-heading" className="space-y-4">
        <h2
          id="guide-faqs-heading"
          className="font-ui text-xl sm:text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {article.faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border p-5 space-y-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <h3 className="font-ui text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {faq.question}
              </h3>
              <p className="font-editorial text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Practice Links inside QuranNoor */}
      {article.relatedLinks.length > 0 && (
        <section
          className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Put this guide into practice on QuranNoor
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {article.relatedLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-[#0E6B4B]/50 whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--accent-text)',
                }}
              >
                <span>{link.label}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Prev / Next Navigation */}
      <nav
        aria-label="Guide navigation"
        className="border-t pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-4">
          <Link
            to="/guides"
            className="inline-flex min-h-[44px] items-center gap-1.5 font-medium hover:underline underline-offset-4"
            style={{ color: 'var(--accent-text)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>All Guides</span>
          </Link>
          {prevArticle && (
            <Link
              to={`/guides/${prevArticle.slug}`}
              className="inline-flex min-h-[44px] items-center text-xs sm:text-sm hover:underline underline-offset-4 truncate max-w-[220px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Previous: {prevArticle.title}
            </Link>
          )}
        </div>

        {nextArticle && (
          <Link
            to={`/guides/${nextArticle.slug}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 font-medium hover:underline underline-offset-4 truncate max-w-[300px]"
            style={{ color: 'var(--accent-text)' }}
          >
            <span className="truncate">Next: {nextArticle.title}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}
      </nav>
    </article>
  );
}
