import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';

const LAST_UPDATED = 'November 18, 2026';

interface LegalLayoutProps {
  title: string;
  subtitle: string;
  canonicalPath: string;
  breadcrumbLabel: string;
  children: ReactNode;
}

function LegalLayout({
  title,
  subtitle,
  canonicalPath,
  breadcrumbLabel,
  children,
}: LegalLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 space-y-10">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: breadcrumbLabel }]} />

      <header className="space-y-3 border-b pb-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--gold)' }}>
          QuranNoor.com · Last Updated: {LAST_UPDATED}
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        <p className="font-editorial text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      </header>

      <div className="space-y-8 font-editorial text-base leading-[1.8]" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>

      <aside
        className="rounded-2xl border p-5 text-xs leading-relaxed"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-tertiary)',
        }}
      >
        <p>
          <strong>Informational Notice:</strong> This page sets out the live policies of
          QuranNoor.com, tailored to the current technical configuration of the site. It is not
          legal counsel and should be reviewed by qualified legal advisors in the operator&apos;s
          jurisdiction.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-ui font-medium" style={{ color: 'var(--accent-text)' }}>
          <Link to="/privacy-policy" className="hover:underline underline-offset-4">
            Privacy Policy
          </Link>
          <Link to="/terms-and-conditions" className="hover:underline underline-offset-4">
            Terms & Conditions
          </Link>
          <Link to="/cookie-policy" className="hover:underline underline-offset-4">
            Cookie Policy
          </Link>
          <Link to="/disclaimer" className="hover:underline underline-offset-4">
            Disclaimer
          </Link>
          <Link to="/copyright" className="hover:underline underline-offset-4">
            Copyright & Attribution
          </Link>
          <Link to="/accessibility" className="hover:underline underline-offset-4">
            Accessibility
          </Link>
        </div>
      </aside>
    </div>
  );
}

function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-ui text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

export function PrivacyPolicyPage() {
  usePageMetadata({
    title: 'Privacy Policy – QuranNoor',
    description:
      'Learn how QuranNoor.com handles local browser storage, technical logs, and third-party services.',
    canonicalPath: '/privacy-policy',
  });

  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="Effective Date: November 15, 2026. QuranNoor is built with a local-first reading experience that does not require user accounts or login profiles."
      canonicalPath="/privacy-policy"
      breadcrumbLabel="Privacy Policy"
    >
      <LegalSection heading="1. Information We Collect">
        <p>
          QuranNoor.com does not currently offer user registration, user accounts, or personal user
          databases. We do not collect your name, address, payment card information, or reading
          bookmarks on our servers.
        </p>
        <p>
          Our <Link to="/contact" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Contact Us</Link> form is live. When you submit it, the name, email address, subject, and message you
          voluntarily provide are first sent to QuranNoor&apos;s own server-side contact endpoint
          (<code className="font-ui text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-muted)' }}>/api/contact</code>),
          which then delivers your message to us by email using FormSubmit as the delivery
          service, so we can respond to your inquiry. We use the information you submit solely
          for that purpose and retain it only as long as needed to handle your inquiry;
          FormSubmit&apos;s own handling of the submission is governed by its privacy policy.
        </p>
      </LegalSection>

      <LegalSection heading="2. Automatically Collected Technical Information">
        <p>
          When your browser accesses QuranNoor.com, our hosting infrastructure (and upstream API
          requests routed through our server proxy) processes standard HTTP request metadata such as
          IP address, browser user-agent, requested URL, timestamp, and HTTP status code in transient
          server or edge network logs for security, rate limiting, and operational diagnostics.
        </p>
      </LegalSection>

      <LegalSection heading="3. Browser Local Storage & Cookies">
        <p>
          Instead of requiring an account, QuranNoor saves your reader preferences (selected theme,
          Arabic script, font size, preferred English translation, preferred reciter), bookmarked
          Ayahs, and last-read Surah progress exclusively inside your own browser&apos;s <code className="font-ui text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-muted)' }}>localStorage</code>. You can clear this data at any time through your browser settings. Please see our <Link to="/cookie-policy" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Cookie Policy</Link> for full details.
        </p>
      </LegalSection>

      <LegalSection heading="4. Analytics & Performance Monitoring">
        <p>
          QuranNoor.com does not currently run third-party behavioral analytics scripts (such as
          Google Analytics or session replay trackers). If privacy-respecting performance monitoring or
          analytics are added later, this Privacy Policy and the Cookie Policy will be updated
          before activation.
        </p>
      </LegalSection>

      <LegalSection heading="5. Advertising">
        <p>
          QuranNoor.com currently shows no advertisements and loads no advertising scripts. If
          advertising is introduced in the future, this Privacy Policy and the Cookie Policy will
          be updated before any advertising script is activated, and advertising cookies will
          only operate as described in the Cookie Policy.
        </p>
        <p>
          A legacy <code className="font-ui text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-muted)' }}>ads.txt</code> file
          remains published on the site from a previous, now-removed advertising setup. It does
          not serve or enable any advertising, and no advertising runs on QuranNoor.com.
        </p>
      </LegalSection>

      <LegalSection heading="6. Third-Party Services">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Quran Foundation Content API &amp; Audio CDN:</strong> Quranic Arabic verses,
            translations, and recitation audio streams are retrieved through our server-side proxy
            and streamed from verified Quran Foundation media endpoints.
          </li>
          <li>
            <strong>FormSubmit:</strong> Our live contact form first sends the name, email address,
            subject, and message you submit to our own server-side contact endpoint, which then
            delivers your message to us by email using FormSubmit as the delivery service. See
            section 1 above for what is sent and how it is retained.
          </li>
          <li>
            <strong>Aladhan Prayer Times API:</strong> When you use the prayer-times feature, your
            latitude and longitude are sent to Aladhan to calculate prayer times and the Qibla
            bearing for your location.
          </li>
          <li>
            <strong>BigDataCloud and Nominatim (OpenStreetMap):</strong> When your location is
            detected for prayer times, your latitude and longitude are sent to BigDataCloud
            (with Nominatim as a fallback) for reverse geocoding, so we can display a readable
            place name such as a city and country instead of raw coordinates.
          </li>
          <li>
            <strong>IP-based location services (ipapi.co, ipwho.is, and geojs.io):</strong> If
            precise device location is unavailable, the prayer-times feature falls back to
            estimating your location from your IP address. Each of these services is queried in
            turn until one responds, and each receives your IP address when it is queried. They
            return only an approximate city-level location, which is then used to fetch prayer
            times from Aladhan.
          </li>
          <li>
            <strong>Google Fonts:</strong> Typography files (Scheherazade New, Noto Naskh Arabic,
            Lateef, Plus Jakarta Sans, and Source Serif 4) are requested by
            your browser from Google Fonts CDN.
          </li>
          <li>
            <strong>Browser Speech Synthesis:</strong> Optional spoken English translation playback
            runs locally inside your device&apos;s browser using built-in Web Speech synthesis.
          </li>
        </ul>
        <p>
          Your detected location — including its latitude and longitude — is also saved in your
          own browser&apos;s local storage (prayer preferences and prayer-times cache) so prayer
          times can be shown again without re-detecting your location. The cached prayer-times
          entry is keyed to your coordinates rounded to three decimal places (about 100&nbsp;m).
          Clearing your browser&apos;s site data removes this stored location.
        </p>
      </LegalSection>

      <LegalSection heading="7. Data Retention, Security & Privacy Rights">
        <p>
          Because reader preferences and bookmarks reside solely on your device, you hold direct
          control over retention and deletion. Where contact submissions or server logs are
          processed, data is retained only as long as operationally necessary. Depending on your
          applicable laws (such as GDPR or CCPA/CPRA), you may request access, correction, or
          deletion of any personal correspondence via our <Link to="/contact" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Contact page</Link>.
        </p>
      </LegalSection>

      <LegalSection heading="8. Policy Updates">
        <p>
          We may update this Privacy Policy whenever new technical integrations (such as analytics
          or email delivery) are enabled. Any revision will carry an updated effective date at the
          top of this page.
        </p>
      </LegalSection>

      <LegalSection heading="Advertising & Third-Party Cookies">
        <p>
          QuranNoor.com currently shows no advertisements and loads no advertising scripts, so no
          advertising cookies are placed by this website. If advertising is introduced in the
          future, this section will be updated before any advertising script is activated.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export function TermsPage() {
  usePageMetadata({
    title: 'Terms and Conditions – QuranNoor',
    description:
      'Terms and Conditions governing acceptable use, third-party Quranic content licensing, and service availability on QuranNoor.com.',
    canonicalPath: '/terms-and-conditions',
  });

  return (
    <LegalLayout
      title="Terms and Conditions"
      subtitle="Effective Date: November 15, 2026. By accessing QuranNoor.com, you agree to these Terms and Conditions."
      canonicalPath="/terms-and-conditions"
      breadcrumbLabel="Terms & Conditions"
    >
      <LegalSection heading="1. Permitted & Prohibited Use">
        <p>
          QuranNoor.com is provided free of charge for personal study, reading, listening, and
          reflection. You agree not to:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Engage in automated scraping, bulk harvesting, or abusive API proxy requests.</li>
          <li>Attempt to bypass rate limits, disrupt server availability, or probe infrastructure.</li>
          <li>Alter, misrepresent, or falsify Quranic verses retrieved through the platform.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Intellectual Property & Third-Party Quranic Content">
        <p>
          Original QuranNoor.com brand assets (including the QuranNoor name, geometric logo emblem,
          website architecture, and interface design) belong to the platform operator. Quranic
          Arabic scripts, translations, and audio recitations remain the intellectual property or
          licensed material of their respective translators, reciters, scholars, and the Quran
          Foundation API. Please review our <Link to="/copyright" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Copyright &amp; Content Attribution</Link> page for detailed attribution terms.
        </p>
      </LegalSection>

      <LegalSection heading="3. External Links">
        <p>
          QuranNoor.com may link to external documentation or upstream content providers (such as <a href="https://api-docs.quran.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Quran Foundation API Documentation</a>). We do not control or assume responsibility for the content or privacy practices of
          third-party websites.
        </p>
      </LegalSection>

      <LegalSection heading="4. Service Availability & Limitation of Liability">
        <p>
          QuranNoor.com is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
          Temporary service interruptions, upstream API limitations, or audio CDN outages may
          occur. To the maximum extent permitted by applicable law, the operator shall not be
          liable for indirect or consequential damages arising from your use of or inability to
          access the platform.
        </p>
      </LegalSection>

      <LegalSection heading="5. Governing Law & Changes to These Terms">
        <p>
          These Terms may be updated as the platform evolves. Any dispute arising from your use
          of QuranNoor.com is governed by the laws of the website operator&apos;s home
          jurisdiction, and the operator will designate the applicable venue in connection with
          any formal claim. Continued use of QuranNoor.com following updates constitutes
          acceptance of the revised Terms.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export function DisclaimerPage() {
  usePageMetadata({
    title: 'Disclaimer – QuranNoor',
    description:
      'Educational and devotional purpose disclaimer, translation guidance, and third-party licensing notice for QuranNoor.com.',
    canonicalPath: '/disclaimer',
  });

  return (
    <LegalLayout
      title="Disclaimer"
      subtitle="Important guidance regarding educational use, English translations, audio recitations, and technical availability on QuranNoor.com."
      canonicalPath="/disclaimer"
      breadcrumbLabel="Disclaimer"
    >
      <LegalSection heading="1. Educational & Devotional Purpose">
        <p>
          QuranNoor is a digital Quran reading and listening platform created for educational,
          devotional, and reflective study. It does not issue religious rulings (fatawa), legal
          opinions, or authoritative scholarly commentary.
        </p>
      </LegalSection>

      <LegalSection heading="2. Arabic Text vs. English Translations">
        <p>
          English translations displayed beneath each Ayah represent human scholarly interpretations
          of the meanings of the Noble Quran. No translation can fully capture the linguistic depth
          of the original Arabic revelation, nor should any translation be treated as a replacement
          for the Arabic Quran itself. Readers seeking detailed jurisprudence or exegesis (tafsir)
          should consult qualified Islamic scholars and established classical references.
        </p>
      </LegalSection>

      <LegalSection heading="3. Third-Party Ownership & Technical Accuracy">
        <p>
          Quranic scripts, translations, and recitations are fetched from external upstream sources
          and retain their respective ownership and usage terms. While we take care to preserve exact
          Arabic text without alteration and disable automated browser translation on Arabic verses,
          technical rendering issues or upstream service interruptions may occur. If you spot any
          error, please report it through our <Link to="/contact" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Contact page</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export function CookiePolicyPage() {
  usePageMetadata({
    title: 'Cookie Policy – QuranNoor',
    description:
      'Transparent overview of local browser storage, essential vs. non-essential cookies, and future consent controls on QuranNoor.com.',
    canonicalPath: '/cookie-policy',
  });

  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="Clear information about how QuranNoor.com uses browser storage today and how cookies would be governed if analytics are added later."
      canonicalPath="/cookie-policy"
      breadcrumbLabel="Cookie Policy"
    >
      <LegalSection heading="1. Essential & Preference Storage (Currently Active)">
        <p>
          QuranNoor.com currently sets <strong>no third-party tracking or advertising cookies</strong>.
          To make the reader usable without forcing account logins, the application uses your
          browser&apos;s <code className="font-ui text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-muted)' }}>localStorage</code> strictly on your device for essential reader state:
        </p>
        <p>
          The site stores the following kinds of information in your browser&apos;s <code className="font-ui text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-muted)' }}>localStorage</code> strictly on your device. No single list here is exhaustive, because keys may be added
          or retired as features change; the categories below describe everything the site
          currently stores:
        </p>
        <ul className="list-disc pl-6 space-y-2 font-ui text-sm">
          <li>
            <strong>Reader settings</strong> — Theme (Light, Sepia, Dark), Uthmani/IndoPak
            script, font sizes, selected translation, and reciter choice, plus one-time
            font-size migration flags.
          </li>
          <li>
            <strong>Bookmarks and reading progress</strong> — Your locally saved Ayah bookmarks,
            last-read Surah/Ayah/Juz position, and last-read Ayah.
          </li>
          <li>
            <strong>Prayer location and cache</strong> — Your detected prayer location (including
            latitude and longitude) and cached prayer times for that location and date.
          </li>
          <li>
            <strong>Tafsir and Qibla preferences</strong> — Your preferred tafsir language and
            whether the Qibla compass sound is muted.
          </li>
          <li>
            <strong>App-install and notification preferences</strong> — Whether the app has been
            installed, when an install prompt was last dismissed, and whether daily-reminder
            push notifications are enabled.
          </li>
          <li>
            <strong>Legacy keys</strong> — Older keys from the site&apos;s previous name
            (prefixed <code>bayan_</code>) are only read, where present, to carry over settings,
            bookmarks, and progress saved before the rename; no new data is written to them.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Analytics Cookies (Not Currently Active)">
        <p>
          No analytics cookies are currently placed by QuranNoor.com. If analytics are introduced in
          the future, we will document the exact provider, cookie names, and retention periods here.
        </p>
      </LegalSection>

      <LegalSection heading="3. Advertising Cookies (Not Currently Active)">
        <p>
          No advertising scripts or advertising cookies are active on QuranNoor.com. If advertising
          is introduced in the future, advertising cookies will only be placed in accordance with
          applicable privacy laws and, for visitors in the EEA, United Kingdom, and Switzerland,
          after valid consent is obtained via a Google-certified Consent Management Platform (CMP).
        </p>

        <div
          className="mt-3 overflow-hidden rounded-xl border font-ui text-sm"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div
            className="border-b px-4 py-2.5 text-xs font-semibold tracking-wide"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            Cookie Categories Overview
          </div>
          <ul className="divide-y text-xs sm:text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
            <li className="px-4 py-3 space-y-1">
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Essential &amp; Preference Storage
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                Local browser storage keys used solely on your device to remember reading settings,
                last-read Surah/Ayah progress, and bookmarks.
              </p>
            </li>
            <li className="px-4 py-3 space-y-1">
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Analytics Cookies
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                Not currently active on QuranNoor.com.
              </p>
            </li>
            <li className="px-4 py-3 space-y-1.5">
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Advertising Cookies
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                Not currently active on QuranNoor.com.
              </p>
            </li>
          </ul>
        </div>
      </LegalSection>

      <LegalSection heading="4. Managing Your Browser Storage & Cookies">
        <p>
          You can inspect, block, or clear local storage and cookies at any time through your
          browser&apos;s privacy settings. Clearing site data will reset your saved theme, reading
          progress, and bookmarks on that browser.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export function CopyrightPage() {
  usePageMetadata({
    title: 'Copyright & Content Attribution – QuranNoor',
    description:
      'Attribution of Quran Arabic text, English translations, audio reciters, and original QuranNoor.com design assets.',
    canonicalPath: '/copyright',
  });

  const { translations, reciters } = useReader();

  return (
    <LegalLayout
      title="Copyright and Content Attribution"
      subtitle="Respecting the sacred preservation of the Noble Quran and properly crediting translators, reciters, font authors, and upstream data providers."
      canonicalPath="/copyright"
      breadcrumbLabel="Copyright & Attribution"
    >
      <LegalSection heading="1. Original Website Brand & Design">
        <p>
          The QuranNoor name, domain branding (QuranNoor.com), original geometric brand symbol, UI
          layout, and custom frontend application code are original materials created for this
          platform.
        </p>
      </LegalSection>

      <LegalSection heading="2. Quran Text, Translations & Recitations">
        <p>
          QuranNoor.com does <strong>not</strong> claim copyright ownership over the Arabic text of
          the Noble Quran, scholarly English translations, or reciter audio recordings. Quranic
          content, metadata, and audio streams are retrieved from the <a href="https://api-docs.quran.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Quran Foundation Content API</a> subject to their published terms and upstream licensing.
        </p>
      </LegalSection>

      <LegalSection heading="3. Open-Source Typography Licensing">
        <p>
          Arabic Quranic fonts (Scheherazade New, Noto Naskh Arabic, and Lateef)
          and English typefaces (Plus Jakarta Sans and Source Serif 4) are served
          under open-source SIL Open Font License (OFL 1.1) terms.
        </p>
      </LegalSection>

      {translations.length > 0 && (
        <LegalSection heading="4. Active Translation Attributions">
          <ul className="space-y-2 text-sm font-ui">
            {translations.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t.author_name}
                </span>
              </li>
            ))}
          </ul>
        </LegalSection>
      )}

      {reciters.length > 0 && (
        <LegalSection heading="5. Active Reciter Attributions">
          <ul className="space-y-2 text-sm font-ui">
            {reciters.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {r.reciter_name}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {[r.style, r.qirat].filter(Boolean).join(' · ') || 'Quran Foundation Audio'}
                </span>
              </li>
            ))}
          </ul>
        </LegalSection>
      )}

      <LegalSection heading="6. Reporting Concerns or Removal Requests">
        <p>
          If you are a rights holder or scholar and believe any translation, audio file, or metadata
          requires updated attribution, correction, or removal, please notify us via the <Link to="/contact" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Contact page</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export function AccessibilityPage() {
  usePageMetadata({
    title: 'Accessibility Statement – QuranNoor',
    description:
      'Accessibility goals, keyboard navigation, adjustable Arabic and English typography, contrast themes, and screen-reader support on QuranNoor.com.',
    canonicalPath: '/accessibility',
  });

  return (
    <LegalLayout
      title="Accessibility Statement"
      subtitle="Our ongoing commitment to making Quran reading and listening comfortable, navigable, and legible for every visitor."
      canonicalPath="/accessibility"
      breadcrumbLabel="Accessibility"
    >
      <LegalSection heading="1. Accessibility Measures Implemented">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Skip-to-Content &amp; Landmarks:</strong> Keyboard users can jump directly past
            navigation to main reading content using the skip link and semantic landmarks.
          </li>
          <li>
            <strong>Keyboard Focus Visibility:</strong> High-contrast emerald focus outlines are
            applied across links, buttons, inputs, and reader controls.
          </li>
          <li>
            <strong>Reading Contrast &amp; Theme Modes:</strong> Visitors can switch between Light,
            Sepia Parchment, and Dark Forest themes designed for comfortable low-glare reading.
          </li>
          <li>
            <strong>Scalable Arabic &amp; Translation Typography:</strong> Reader Settings allow direct
            adjustment of Arabic script sizes (16px–48px, default 28px) and translation sizes
            (14px–24px, default 17px), alongside Uthmani (Hafs) and IndoPak scripts across three
            Arabic fonts (Scheherazade New, Noto Naskh Arabic, and Lateef).
          </li>
          <li>
            <strong>RTL &amp; Reduced Motion:</strong> Strict right-to-left <code className="font-ui text-xs">dir="rtl"</code> isolation preserves Arabic verse
            integrity, and motion respects <code className="font-ui text-xs">prefers-reduced-motion</code>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Conformance Status">
        <p>
          QuranNoor.com is designed following recognized WCAG accessibility best practices, though
          a formal third-party WCAG 2.1 AA certification audit has not yet been completed. We treat
          accessibility as an ongoing engineering discipline and welcome user testing feedback.
        </p>
      </LegalSection>

      <LegalSection heading="3. Reporting Accessibility Barriers">
        <p>
          If you experience difficulty using a screen reader, keyboard navigation, or audio player
          controls on any device, please report the issue and your browser/assistive technology
          details on our <Link to="/contact" className="underline underline-offset-4" style={{ color: 'var(--accent-text)' }}>Contact page</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
