import { Check, Download, Menu, Moon, Search, Settings, Sun, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useReader } from '../context/ReaderContext';
import {
  formatPrayerDisplayTime,
  getActiveCachedPrayerDataForToday,
  getNextPrayerCountdown,
  loadOrDetectPrayerData,
  PRAYER_UPDATED_EVENT,
  type PrayerDayData,
} from '../services/prayerApi';
import { usePWAInstall } from '../utils/pwaInstall';
import { QuranNoorLogo } from './BrandLogo';

const CENTER_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/surah/al-fatihah', label: 'Read Quran' },
  { to: '/surahs', label: 'Surahs' },
  { to: '/juz', label: 'Juz' },
  { to: '/listen', label: 'Listen' },
  { to: '/prayer-times', label: 'Prayer' },
];

export function Header() {
  const { settings, cycleTheme, setIsSettingsOpen } = useReader();
  const { installed, handleInstallClick } = usePWAInstall();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [prayerData, setPrayerData] = useState<PrayerDayData | null>(() =>
    getActiveCachedPrayerDataForToday()
  );
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastAttemptAt = 0;

    const syncFromCache = () => {
      const latest = getActiveCachedPrayerDataForToday();
      if (active) {
        setPrayerData(latest);
      }
      return latest;
    };

    const ensurePrayerData = (signal?: AbortSignal, ignoreCooldown = false) => {
      const nowMs = Date.now();
      if (inFlight) return;
      if (!ignoreCooldown && nowMs - lastAttemptAt < 60000) return;
      inFlight = true;
      lastAttemptAt = nowMs;
      loadOrDetectPrayerData({ signal })
        .then((data) => {
          if (active && data) {
            setPrayerData(data);
          }
        })
        .catch(() => {
          // Non-fatal in header; pill stays hidden until location & prayer data are available
        })
        .finally(() => {
          inFlight = false;
        });
    };

    const controller = new AbortController();
    const initialCached = syncFromCache();
    if (!initialCached) {
      ensurePrayerData(controller.signal, true);
    }

    const onUpdate = () => {
      const updated = syncFromCache();
      if (!updated) {
        ensurePrayerData(controller.signal, true);
      }
    };

    window.addEventListener(PRAYER_UPDATED_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);

    const timer = window.setInterval(() => {
      const now = new Date();
      setNowTick(now);
      const latest = getActiveCachedPrayerDataForToday();
      if (latest) {
        setPrayerData((prev) => (prev?.fetchedAt === latest.fetchedAt ? prev : latest));
      } else {
        ensurePrayerData(controller.signal, false);
      }
    }, 1000);

    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(PRAYER_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
      window.clearInterval(timer);
    };
  }, []);

  const countdown = useMemo(() => {
    if (!prayerData) return null;
    return getNextPrayerCountdown(prayerData.timings, prayerData.timezone, nowTick);
  }, [prayerData, nowTick]);

  return (
    <header
      className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 92%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between gap-1 sm:gap-3 lg:gap-5 px-2 min-[380px]:px-3 sm:px-6">
        {/* Zone 1: QuranNoor Brand Logo */}
        <Link
          to="/"
          aria-label="QuranNoor Home"
          className="inline-flex items-center whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
        >
          <span className="min-[380px]:hidden">
            <QuranNoorLogo variant="compact" size="sm" />
          </span>
          <span className="hidden min-[380px]:inline-flex sm:hidden">
            <QuranNoorLogo variant="horizontal" size="sm" />
          </span>
          <span className="hidden sm:inline-flex">
            <QuranNoorLogo variant="horizontal" size="md" />
          </span>
        </Link>

        {/* Zone 2: Clean Single-Line Navigation */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-2 lg:gap-4">
          {CENTER_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `text-xs lg:text-sm font-medium whitespace-nowrap shrink-0 transition-colors py-1 ${
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

        {/* Zone 3: Live Prayer Countdown Pill + Reader Utilities & Mobile Drawer */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {countdown && prayerData && (
            <Link
              to="/prayer-times"
              onClick={() => setMobileMenuOpen(false)}
              aria-label={`Next prayer: ${countdown.countdownWithSecondsText}. Open Prayer Times & Qibla.`}
              title={`${prayerData.location.label} · ${countdown.nextPrayer} at ${formatPrayerDisplayTime(
                countdown.nextTime24
              )}`}
              className="mr-0.5 sm:mr-1 inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-1.5 sm:px-2.5 py-1 text-[10.5px] min-[380px]:text-[11px] sm:text-xs font-medium tabular-nums whitespace-nowrap shrink-0 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'color-mix(in srgb, var(--accent) 26%, transparent)',
                color: 'var(--accent-text)',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                aria-hidden="true"
                style={{ backgroundColor: 'var(--gold)' }}
              />
              <span className="hidden sm:inline">{countdown.countdownWithSecondsText}</span>
              <span className="sm:hidden">
                {countdown.nextPrayer} · {countdown.remainingText}
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => void handleInstallClick()}
            aria-label={installed ? 'QuranNoor App Installed' : 'Install QuranNoor App'}
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border px-2 lg:px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
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
            className="inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
            style={{ color: 'var(--text-primary)' }}
          >
            <Search className="h-[16px] w-[16px] sm:h-[18px] sm:w-[18px]" />
          </Link>

          <button
            type="button"
            onClick={cycleTheme}
            aria-label={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
            style={{ color: 'var(--text-primary)' }}
          >
            {settings.theme === 'dark' ? (
              <Sun className="h-[16px] w-[16px] sm:h-[18px] sm:w-[18px]" />
            ) : (
              <Moon className="h-[16px] w-[16px] sm:h-[18px] sm:w-[18px]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Reader settings"
            className="inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B4B]"
            style={{ color: 'var(--text-primary)' }}
          >
            <Settings className="h-[16px] w-[16px] sm:h-[18px] sm:w-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="inline-flex md:hidden h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
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
          className="md:hidden max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t px-4 py-3 space-y-2.5"
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
