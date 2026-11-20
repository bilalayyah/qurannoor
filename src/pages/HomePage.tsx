import { BookOpen, ArrowRight, Headphones, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QuranNoorMark } from '../components/BrandLogo';
import { ContinueReading } from '../components/ContinueReading';
import { GuidesHomeSection } from '../components/GuidesHomeSection';
import { PopularSections } from '../components/PopularSections';
import { QuranSearch } from '../components/QuranSearch';
import { usePageMetadata } from '../hooks/usePageMetadata';

export function HomePage() {
  usePageMetadata({
    title: 'QuranNoor – Read. Listen. Reflect.',
    description:
      'QuranNoor.com — Read, listen to, and reflect upon the Noble Quran with authentic Uthmani and IndoPak Arabic script, recognized English translations, Surah and Juz navigation, and curated recitations.',
    canonicalPath: '/',
  });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6 sm:space-y-8 pb-12">
      {/* Compact Hero Section (~1/4 viewport height) */}
      <section className="pt-2 sm:pt-3 text-center">
        <div className="mx-auto mb-1 flex justify-center">
          <QuranNoorMark size={24} />
        </div>

        <p
          dir="rtl"
          lang="ar"
          translate="no"
          className="notranslate font-quran-scheherazade quran-arabic-text text-lg sm:text-xl leading-[1.35] !py-0.5"
          style={{ color: 'var(--accent-text)' }}
        >
          الْقُرْآنُ الْكَرِيمُ
        </p>

        <h1
          className="mt-0.5 text-lg sm:text-2xl font-semibold tracking-tight text-balance"
          style={{ color: 'var(--text-primary)' }}
        >
          The Noble Quran
        </h1>

        <p
          className="mt-0.5 mx-auto max-w-xl text-xs sm:text-sm font-medium tracking-[-0.01em]"
          style={{ color: 'var(--text-secondary)' }}
        >
          Read. Listen. Reflect.
        </p>

        {/* Subtle Gold Hairline Rule */}
        <div className="mx-auto mt-1.5 flex items-center justify-center gap-2.5" aria-hidden="true">
          <span className="h-px w-8 sm:w-10" style={{ backgroundColor: 'var(--border-strong)' }} />
          <span className="text-[10px]" style={{ color: 'var(--gold)' }}>
            ✦
          </span>
          <span className="h-px w-8 sm:w-10" style={{ backgroundColor: 'var(--border-strong)' }} />
        </div>

        {/* Prominent Quran Search */}
        <QuranSearch compact className="mx-auto mt-2.5 max-w-lg" />

        {/* Hero CTAs */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            to="/surah/al-fatihah"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs sm:text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Read Quran</span>
          </Link>

          <Link
            to="/listen"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <Headphones className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Listen Quran</span>
          </Link>
        </div>
      </section>

      {/* Continue Reading */}
      <ContinueReading />

      {/* Browse Quran: Two Large Navigation Cards (Surah & Juz) + Statistics */}
      <section aria-labelledby="browse-quran-heading" className="space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between">
          <h2
            id="browse-quran-heading"
            className="text-lg sm:text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Browse Quran
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            <p
              className="text-xs sm:text-sm font-medium tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              114 Surahs <span aria-hidden="true">·</span> 30 Juz <span aria-hidden="true">·</span> 6,236 Ayahs
            </p>
            <Link
              to="/quran"
              className="inline-flex min-h-[44px] items-center gap-1 text-xs sm:text-sm font-medium hover:underline underline-offset-4"
              style={{ color: 'var(--accent-text)' }}
            >
              <span>Explore Directory</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Card 1: Surah */}
          <Link
            to="/surahs"
            className="group flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-xs font-medium tabular-nums"
                  style={{ color: 'var(--gold)' }}
                >
                  114 Surahs · 6,236 Ayahs
                </p>
                <h3
                  className="mt-1.5 text-xl sm:text-2xl font-semibold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Surah
                </h3>
                <p
                  className="mt-1.5 max-w-md text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Explore all 114 chapters from Al-Fatihah to An-Nas with authentic Uthmani
                  script, English translations, and verse-by-verse audio.
                </p>
              </div>
              <div
                className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-text)',
                }}
              >
                <BookOpen className="h-5 w-5" />
              </div>
            </div>

            <div
              className="mt-4 sm:mt-5 flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--accent-text)' }}
            >
              <span>Browse All Surahs</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          {/* Card 2: Juz */}
          <Link
            to="/juz"
            className="group flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-colors hover:border-[#0E6B4B]/45 dark:hover:border-[#3FD09A]/40"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-xs font-medium tabular-nums"
                  style={{ color: 'var(--gold)' }}
                >
                  30 Juz · Structured Reading
                </p>
                <h3
                  className="mt-1.5 text-xl sm:text-2xl font-semibold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Juz
                </h3>
                <p
                  className="mt-1.5 max-w-md text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Navigate the Quran across its 30 traditional equal sections for daily reading,
                  study plans, and continuous recitation.
                </p>
              </div>
              <div
                className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-text)',
                }}
              >
                <Layers className="h-5 w-5" />
              </div>
            </div>

            <div
              className="mt-4 sm:mt-5 flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--accent-text)' }}
            >
              <span>Explore All 30 Juz</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      </section>

      {/* Popular Quran Sections */}
      <PopularSections />

      {/* Guides Section */}
      <GuidesHomeSection />
    </div>
  );
}
