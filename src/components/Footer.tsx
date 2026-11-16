import { Link } from 'react-router-dom';
import { QuranNoorLogo } from './BrandLogo';

const EXPLORE_LINKS = [
  { to: '/quran', label: 'Explore Quran' },
  { to: '/surahs', label: 'All 114 Surahs' },
  { to: '/juz', label: 'All 30 Juz' },
  { to: '/listen', label: 'Listen Quran' },
  { to: '/popular/ayatul-kursi', label: 'Ayatul Kursi (2:255)' },
  { to: '/quran-text-and-translation-methodology', label: 'Text & Translation Methodology' },
  { to: '/brand', label: 'Brand Identity' },
  { to: '/bookmarks', label: 'Bookmarks' },
];

const LEGAL_TRUST_LINKS = [
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms-and-conditions', label: 'Terms & Conditions' },
  { to: '/disclaimer', label: 'Disclaimer' },
  { to: '/cookie-policy', label: 'Cookie Policy' },
  { to: '/copyright', label: 'Copyright & Attribution' },
  { to: '/accessibility', label: 'Accessibility Statement' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t py-14"
      style={{
        borderColor: 'var(--border-subtle)',
        backgroundColor: 'var(--bg-canvas)',
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-5 space-y-3">
            <Link to="/" className="inline-flex items-center">
              <QuranNoorLogo variant="horizontal" size="sm" />
            </Link>
            <p className="text-xs leading-relaxed max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              Read. Listen. Reflect. A calm, distraction-free sanctuary for reading and listening to
              the Noble Quran on{' '}
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                QuranNoor.com
              </span>
              .
            </p>
          </div>

          <nav
            aria-label="Explore Quran Links"
            className="md:col-span-3 space-y-3"
          >
            <h2 className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
              Explore Quran
            </h2>
            <ul className="space-y-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {EXPLORE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:underline underline-offset-4">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav
            aria-label="Trust and Legal Links"
            className="md:col-span-4 space-y-3"
          >
            <h2 className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
              Trust, Attribution &amp; Legal
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {LEGAL_TRUST_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:underline underline-offset-4">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div
          className="mt-10 border-t pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-tertiary)',
          }}
        >
          <p>© {year} QuranNoor.com. Original design &amp; interface. Sacred Quran text attributed to upstream sources.</p>
          <p>Read. Listen. Reflect.</p>
        </div>
      </div>
    </footer>
  );
}
