import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';

export function AboutPage() {
  usePageMetadata({
    title: 'About Us – QuranNoor',
    description:
      'Learn about QuranNoor.com, our mission to provide a calm, accessible Quran reading and listening experience, and our commitment to Arabic text accuracy.',
    canonicalPath: '/about',
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 space-y-10">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'About Us' }]} />

      <header className="space-y-3 border-b pb-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--gold)' }}>
          QuranNoor.com · Read. Listen. Reflect.
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          About QuranNoor
        </h1>
      </header>

      <div className="space-y-6 font-editorial text-base leading-[1.8]" style={{ color: 'var(--text-secondary)' }}>
        <section className="space-y-3">
          <h2 className="font-ui text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Mission &amp; Purpose
          </h2>
          <p>
            QuranNoor is a digital Quran reading and listening platform designed to offer a calm,
            trustworthy, distraction-free environment for engaging with the Noble Quran across
            desktop, tablet, and mobile devices.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-ui text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Accessible Reading, Listening &amp; Navigation
          </h2>
          <p>
            Every core feature on QuranNoor is structured around effortless study and daily
            recitation: clear navigation across all{' '}
            <Link to="/surahs" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>
              114 Surahs
            </Link>{' '}
            and{' '}
            <Link to="/juz" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>
              30 Juz
            </Link>
            , direct verse-by-verse and full-Surah{' '}
            <Link to="/listen" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>
              audio recitations
            </Link>
            , adjustable Arabic and English typography, and local-first bookmarking and reading
            progress without forced account walls.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-ui text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Commitment to Arabic Accuracy
          </h2>
          <p>
            QuranNoor never fabricates, summarizes, or alters Quranic Arabic text using AI. All
            Arabic scripts and translations are sourced from verified Quran Foundation API endpoints
            with explicit translator and reciter attribution. Full technical details are published on
            our{' '}
            <Link
              to="/quran-text-and-translation-methodology"
              className="underline underline-offset-4"
              style={{ color: 'var(--accent-text)' }}
            >
              Quran Text &amp; Translation Methodology
            </Link>{' '}
            page.
          </p>
        </section>
      </div>

      <section
        className="rounded-2xl border p-6 space-y-3"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Explore QuranNoor
        </h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
          <Link to="/quran" className="hover:underline underline-offset-4">
            Quran Gateway
          </Link>
          <Link to="/surah/al-fatihah" className="hover:underline underline-offset-4">
            Read Surah Al-Fatihah
          </Link>
          <Link to="/ayah/al-baqarah/255" className="hover:underline underline-offset-4">
            Ayatul Kursi (2:255)
          </Link>
          <Link to="/brand" className="hover:underline underline-offset-4">
            Brand Identity System
          </Link>
          <Link to="/contact" className="hover:underline underline-offset-4">
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}

export function MethodologyPage() {
  usePageMetadata({
    title: 'Quran Text & Translation Methodology – QuranNoor',
    description:
      'How QuranNoor.com sources authentic Uthmani Arabic Quran text, attributes English translations and reciters, and prevents script alteration.',
    canonicalPath: '/quran-text-and-translation-methodology',
  });

  const { translations, reciters } = useReader();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 space-y-10">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Quran', to: '/quran' },
          { label: 'Text & Translation Methodology' },
        ]}
      />

      <header className="space-y-3 border-b pb-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--gold)' }}>
          QuranNoor.com · Preservation &amp; Sourcing Standards
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Quran Text and Translation Methodology
        </h1>
        <p className="font-editorial text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          A transparent overview of how Quranic Arabic text, English translations, Uthmani
          typography, and recitation audio are sourced and displayed on QuranNoor.com.
        </p>
      </header>

      <div className="space-y-8 font-editorial text-base leading-[1.8]" style={{ color: 'var(--text-secondary)' }}>
        <section className="space-y-3">
          <h2 className="font-ui text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            1. Arabic Quran Text Source &amp; API Configuration Status
          </h2>
          <p>
            QuranNoor connects to the official{' '}
            <a
              href="https://api-docs.quran.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
              style={{ color: 'var(--accent-text)' }}
            >
              Quran Foundation Content API (v4)
            </a>{' '}
            for verified Uthmani Hafs and IndoPak Arabic script, verse numbering, Juz boundaries,
            and page markers. No Quranic Arabic text is ever generated, paraphrased, or modified by
            artificial intelligence.
          </p>
          <p>
            QuranNoor&apos;s Production API integration is live and active, serving all{' '}
            <Link to="/surahs" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>
              114 Surahs
            </Link>
            ,{' '}
            <Link to="/juz" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>
              30 Juz
            </Link>
            , and 6,236 Ayahs live from the official Quran Foundation Content API without any
            chapter restrictions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-ui text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            2. Authentic Uthmani Typography &amp; Browser Protection
          </h2>
          <p>
            Quranic Arabic verses are rendered using <strong>Amiri Quran</strong> (default Uthmani
            script) and optional <strong>Scheherazade New</strong>, <strong>Noto Naskh Arabic</strong>,
            and <strong>Lateef</strong> (IndoPak style) fonts licensed under the open-source SIL
            Open Font License (OFL 1.1). Every Arabic verse enforces right-to-left Unicode isolation (
            <code className="font-ui text-xs">dir="rtl"</code>) and carries{' '}
            <code className="font-ui text-xs">translate="no"</code> attributes to prevent automated
            browser translation extensions from altering sacred text.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-ui text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            3. Translation &amp; Translator Attribution
          </h2>
          <p>
            English translations are displayed directly beneath each Ayah in{' '}
            <strong>Source Serif 4</strong> so they remain visually distinct from the Arabic
            revelation. Users can select their preferred translation inside Reader Settings, where
            each translation&apos;s translator name is clearly displayed.
          </p>
          {translations.length > 0 && (
            <div
              className="rounded-xl border p-4 font-ui text-xs space-y-2"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Currently Loaded Translations:
              </p>
              <ul className="space-y-1.5">
                {translations.map((t) => (
                  <li key={t.id} className="flex justify-between gap-4">
                    <span>{t.name}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{t.author_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-ui text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            4. Recitation Audio Attribution
          </h2>
          <p>
            Arabic Quran recitations are streamed directly from the Quran Foundation audio archive,
            with the active reciter&apos;s name and recitation style (e.g., Murattal) displayed inside
            both the Surah header and the persistent audio player. Optional spoken English playback
            uses your device&apos;s built-in Web Speech Synthesis engine and is explicitly labeled as
            synthetic speech.
          </p>
          {reciters.length > 0 && (
            <div
              className="rounded-xl border p-4 font-ui text-xs space-y-1.5"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Available Reciters:
              </p>
              <p>{reciters.map((r) => `${r.reciter_name}${r.style ? ` (${r.style})` : ''}`).join(' · ')}</p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-ui text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            5. Reporting Text or Rendering Discrepancies
          </h2>
          <p>
            If you observe any missing diacritic, glyph clipping, audio mismatch, or translation
            display error, please report the exact Surah and Ayah reference via our{' '}
            <Link to="/contact" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>
              Contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
