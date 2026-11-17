import { Check, Download, Menu, Moon, Search, Settings, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useReader } from '../context/ReaderContext';
import { usePWAInstall } from '../utils/pwaInstall';
import { QuranNoorLogo } from './BrandLogo';

const CENTER_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/surah/al-fatihah', label: 'Read Quran' },
  { to: '/surahs', label: 'Surahs' },
  { to: '/juz', label: 'Juz' },
  { to: '/listen', label: 'Listen' },
  { to: '/khatm', label: 'Khatm' },
  { to: '/prayer-times', label: 'Prayer' },
];

export function Header() {
  const { settings, cycleTheme, setIsSettingsOpen } = useReader();
  const { installed, handleInstallClick } = usePWAInstall();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 92%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between gap-3 lg:gap-6 px-4 sm:px-6">
        {/* Zone 1: QuranNoor Brand Logo */}
        <Link
          to="/"
          aria-label="QuranNoor Home"
          className="inline-flex items-center whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
        >
          <QuranNoorLogo variant="horizontal" size="md" />
        </Link>

        {/* Zone 2: Clean Single-Line Navigation */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-3 lg:gap-5">
          {CENTER_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `text-[13px] lg:text-sm font-medium whitespace-nowrap shrink-0 transition-colors py-1 ${
                  isActive
                    ? 'underline decoration-2 underline-offset-8'
                    : 'opacity-75 hover:opacity-100'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--accent-text)' : 'var(--text-primary)',
                textDecorationColor: isActive ? 'var(--accent)' : undefined,
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Reader Utilities & Mobile Drawer */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void handleInstallClick()}
            aria-label={installed ? 'QuranNoor App Installed' : 'Install QuranNoor App'}
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
            style={{
              backgroundColor: installed ? 'var(--accent-soft)' : 'var(--bg-surface)',
              borderColor: installed ? 'var(--accent)' : 'var(--border-subtle)',
              color: 'var(--accent-text)',
            }}
          >
            {installed ? (
              <>
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>Installed ✓</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>Install App</span>
              </>
            )}
          </button>

          <Link
            to="/search"
            aria-label="Search the Quran"
            className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
            style={{ color: 'var(--text-primary)' }}
          >
            <Search className="h-[18px] w-[18px]" />
          </Link>

          <button
            type="button"
            onClick={cycleTheme}
            aria-label={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
            style={{ color: 'var(--text-primary)' }}
          >
            {settings.theme === 'dark' ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Reader settings"
            className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
            style={{ color: 'var(--text-primary)' }}
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-primary)' }}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t px-4 py-3 space-y-2.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {[...CENTER_LINKS, { to: '/bookmarks', label: 'Bookmarks' }].map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium transition-colors"
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-primary)',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="border-t pt-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                void handleInstallClick();
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                backgroundColor: installed ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                borderColor: installed ? 'var(--accent)' : 'var(--border-subtle)',
                color: 'var(--accent-text)',
              }}
            >
              {installed ? (
                <>
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Installed ✓</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Install App</span>
                </>
              )}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
