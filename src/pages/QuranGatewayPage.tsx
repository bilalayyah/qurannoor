import { ArrowRight, BookOpen, Compass, Headphones, Layers, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { POPULAR_SECTIONS } from '../utils/slugs';

const WEBSITE_FAQ = [
  {
    q: 'Which Arabic scripts and fonts does QuranNoor use?',
    a: 'QuranNoor defaults to Uthmani (Hafs) script rendered with Scheherazade New, and also supports IndoPak script alongside Noto Naskh Arabic and Lateef fonts inside Reader Settings.',
  },
  {
    q: 'Are English translations customizable?',
    a: 'Yes. You can switch between recognized English translations (including M.A.S. Abdel Haleem) or hide translations for pure Arabic Mushaf reading in Reader Settings.',
  },
  {
    q: 'How does Quran audio playback work?',
    a: 'You can play individual Ayahs directly from any verse card or stream full Surahs from the Listen page. Arabic recitations stream from the Quran Foundation audio archive, while optional English playback uses your browser’s speech synthesis.',
  },
  {
    q: 'Do I need an account to save bookmarks or reading progress?',
    a: 'No. Bookmarks, theme choices, and your last read Surah and Ayah are stored locally inside your browser so your progress stays private on your device.',
  },
];

export function QuranGatewayPage() {
  usePageMetadata({
    title: 'Read & Explore the Noble Quran – QuranNoor',
    description:
      'Navigate the Noble Quran on QuranNoor.com by 114 Surahs, 30 Juz, popular passages, audio recitations, and verified Arabic and English methodology.',
    canonicalPath: '/quran',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: WEBSITE_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    },
  });

  const { readingProgress } = useReader();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 space-y-14">
      <div>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Quran' }]} />

        <header className="space-y-3 border-b pb-8" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--gold)' }}>
            QuranNoor.com · 114 Surahs · 30 Juz · 6,236 Ayahs
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Read &amp; Explore the Noble Quran
          </h1>
          <p className="max-w-2xl text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Begin reading from Surah Al-Fatihah, resume your last saved position, explore the 30 Juz,
            or listen to continuous Arabic recitations.
          </p>
        </header>
      </div>

      {/* Primary Reading Gateways */}
      <section aria-label="Primary Quran Navigation" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to={
            readingProgress
              ? `/surah/${readingProgress.chapterSlug}?ayah=${readingProgress.verseNumber}`
              : '/surah/al-fatihah'
          }
          className="group flex flex-col justify-between rounded-2xl border p-5 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="space-y-2">
            <BookOpen className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {readingProgress ? `Resume ${readingProgress.chapterName}` : 'Start Reading'}
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {readingProgress
                ? `Continue from Ayah ${readingProgress.verseNumber} of ${readingProgress.totalVerses}.`
                : 'Open Surah Al-Fatihah with Uthmani Arabic script and English translation.'}
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
            Open Reader <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/surahs"
          className="group flex flex-col justify-between rounded-2xl border p-5 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="space-y-2">
            <Compass className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              All 114 Surahs
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Browse chapters in Quranic order with Meccan/Medinan classification and Ayah counts.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
            Browse Surahs <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/juz"
          className="group flex flex-col justify-between rounded-2xl border p-5 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="space-y-2">
            <Layers className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              All 30 Juz
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Explore the 30 traditional equal sections of the Quran with Surah and Ayah ranges.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
            Explore Juz <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/listen"
          className="group flex flex-col justify-between rounded-2xl border p-5 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="space-y-2">
            <Headphones className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Listen to Recitations
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Stream full Surah recitations from verified Qaris with continuous audio playback.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
            Open Audio Player <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </section>

      {/* Featured Passages */}
      <section aria-labelledby="featured-passages-heading" className="space-y-4">
        <h2 id="featured-passages-heading" className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Key Chapters &amp; Passages
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR_SECTIONS.slice(0, 6).map((item) => (
            <Link
              key={item.slug}
              to={item.type === 'chapter' ? `/surah/${item.slug}` : `/popular/${item.slug}`}
              className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:border-[#0E6B4B]/45"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {item.referenceLabel}
                </p>
              </div>
              <span
                dir="rtl"
                lang="ar"
                translate="no"
                className="notranslate font-quran-scheherazade quran-arabic-text text-base sm:text-lg leading-[1.6] !py-0"
                style={{ color: 'var(--gold)' }}
              >
                {item.arabicTitle}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Platform FAQ (Real Functionality) */}
      <section aria-labelledby="quran-faq-heading" className="space-y-5 border-t pt-10" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between gap-4">
          <h2 id="quran-faq-heading" className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Reading &amp; Platform Guide
          </h2>
          <Link
            to="/quran-text-and-translation-methodology"
            className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline underline-offset-4"
            style={{ color: 'var(--accent-text)' }}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Text Methodology</span>
          </Link>
        </div>

        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {WEBSITE_FAQ.map((item) => (
            <div
              key={item.q}
              className="rounded-2xl border p-5 space-y-2"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <dt className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {item.q}
              </dt>
              <dd className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
