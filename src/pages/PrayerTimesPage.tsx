import { Clock, LocateFixed, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QiblaCompass } from '../components/QiblaCompass';
import { ErrorBanner } from '../components/StatusStates';
import { usePageMetadata } from '../hooks/usePageMetadata';
import {
  detectPrayerLocationAuto,
  fetchPrayerAndQiblaData,
  formatPrayerDisplayTime,
  getCachedPrayerData,
  getNextPrayerCountdown,
  loadPrayerPreferences,
  savePrayerPreferences,
  type PrayerDayData,
  type PrayerLocation,
  type PrayerName,
} from '../services/prayerApi';

const PRAYER_LIST: Array<{ name: PrayerName; arabic: string }> = [
  { name: 'Fajr', arabic: 'الفجر' },
  { name: 'Dhuhr', arabic: 'الظهر' },
  { name: 'Asr', arabic: 'العصر' },
  { name: 'Maghrib', arabic: 'المغرب' },
  { name: 'Isha', arabic: 'العشاء' },
];

export function PrayerTimesPage() {
  usePageMetadata({
    title: 'Prayer Times & Qibla Direction – QuranNoor',
    description:
      'Accurate daily prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha), live next-prayer countdown, calculation method selector, and Qibla compass bearing from the Aladhan API.',
    canonicalPath: '/prayer-times',
  });

  const initialPrefs = useMemo(() => loadPrayerPreferences(), []);
  const [method] = useState<number>(initialPrefs.method);
  const [location, setLocation] = useState<PrayerLocation | null>(initialPrefs.location);

  const [prayerData, setPrayerData] = useState<PrayerDayData | null>(() =>
    initialPrefs.location ? getCachedPrayerData(initialPrefs.location, initialPrefs.method) : null
  );
  const [loading, setLoading] = useState<boolean>(() =>
    !(initialPrefs.location && getCachedPrayerData(initialPrefs.location, initialPrefs.method))
  );
  const [detectingLocation, setDetectingLocation] = useState<boolean>(() => !initialPrefs.location);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [usingOfflineCache, setUsingOfflineCache] = useState<boolean>(false);

  const [nowTick, setNowTick] = useState(() => new Date());

  const geoAttemptedRef = useRef(false);

  // Update next prayer countdown every second
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Persist method + location preferences whenever either is set/changed
  useEffect(() => {
    if (!location && method === initialPrefs.method) return;
    savePrayerPreferences({ method, location });
  }, [method, location, initialPrefs.method]);

  const loadForLocation = useCallback(
    async (loc: PrayerLocation, calcMethod: number, signal?: AbortSignal) => {
      const cached = getCachedPrayerData(loc, calcMethod);
      if (cached) {
        setPrayerData(cached);
        setError(null);
        setUsingOfflineCache(typeof navigator !== 'undefined' && navigator.onLine === false);
      } else {
        setLoading(true);
        setError(null);
        setUsingOfflineCache(false);
      }

      try {
        const fresh = await fetchPrayerAndQiblaData({
          location: loc,
          method: calcMethod,
          signal,
        });
        setPrayerData(fresh);
        setError(null);
        setUsingOfflineCache(false);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        if (cached) {
          setPrayerData(cached);
          setUsingOfflineCache(true);
          setError(null);
        } else {
          setPrayerData(null);
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to fetch today’s prayer times from Aladhan API.'
          );
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Trigger fetch whenever location or calculation method changes
  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();
    loadForLocation(location, method, controller.signal);
    return () => controller.abort();
  }, [location, method, loadForLocation]);

  // Automatic location detection on initial mount if no saved location (or when retrying permission)
  const runAutoDetection = useCallback(async (forceRefresh = false) => {
    setDetectingLocation(true);
    setLoading(true);
    setError(null);
    setLocationError(null);
    try {
      const detected = await detectPrayerLocationAuto({ forceRefresh });
      if (detected) {
        setLocation(detected);
        setLocationError(null);
      } else {
        setLoading(false);
        setLocationError(
          'Location permission is required to detect your area automatically and show accurate prayer times. Please allow location access in your browser settings and try again.'
        );
      }
    } finally {
      setDetectingLocation(false);
    }
  }, []);

  useEffect(() => {
    if (location || geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;
    runAutoDetection(false);
  }, [location, runAutoDetection]);

  const countdown = useMemo(() => {
    if (!prayerData) return null;
    return getNextPrayerCountdown(prayerData.timings, prayerData.timezone, nowTick);
  }, [prayerData, nowTick]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 space-y-8">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Prayer Times & Qibla' },
        ]}
      />

      {/* Page Header */}
      <div className="space-y-2">
        <h1
          className="text-2xl sm:text-3xl font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Prayer Times &amp; Qibla
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Today&apos;s five daily prayer times, live next-prayer countdown, and Qibla compass bearing powered by the free Aladhan API.
        </p>
      </div>

      {/* Main Content */}
      {locationError && !location ? (
        <div
          role="alert"
          className="mx-auto my-8 max-w-xl rounded-2xl border p-6 text-center"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <LocateFixed
            className="mx-auto h-6 w-6"
            style={{ color: 'var(--accent-text)' }}
          />
          <h3
            className="mt-3 text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Enable location permission
          </h3>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {locationError}
          </p>
          <button
            type="button"
            onClick={() => runAutoDetection(true)}
            className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <LocateFixed className="h-4 w-4" />
            <span>Try again</span>
          </button>
        </div>
      ) : error ? (
        <ErrorBanner
          message={error}
          onRetry={() => {
            if (location) {
              loadForLocation(location, method);
            } else {
              runAutoDetection(true);
            }
          }}
        />
      ) : (loading || detectingLocation) && !prayerData ? (
        <div className="space-y-3" aria-busy="true">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {detectingLocation
              ? 'Detecting your location and fetching today’s prayer times…'
              : 'Loading today’s prayer times and Qibla bearing…'}
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 animate-pulse">
            <div
              className="lg:col-span-7 h-96 rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            />
            <div
              className="lg:col-span-5 h-96 rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            />
          </div>
        </div>
      ) : prayerData ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Prayer Times + Countdown */}
          <section
            aria-label="Today's Prayer Times"
            className="lg:col-span-7 rounded-2xl border p-6 space-y-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {/* Next Prayer Countdown Banner */}
            {countdown && (
              <div
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 sm:p-5"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                }}
              >
                <div className="space-y-1">
                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Next Prayer</span>
                  </div>
                  <p
                    className="text-2xl font-semibold tracking-tight tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {countdown.countdownText}
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-0.5">
                  <p
                    className="text-lg font-semibold tabular-nums"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {formatPrayerDisplayTime(countdown.nextTime24)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {prayerData.timezone}
                  </p>
                </div>
              </div>
            )}

            {/* Location & Date Metadata */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {prayerData.location.label}
                </span>
                <span aria-hidden="true">·</span>
                <span>{prayerData.timezone}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{prayerData.readableDate}</span>
                {prayerData.hijriDateText && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{prayerData.hijriDateText}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => loadForLocation(prayerData.location, method)}
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline underline-offset-4"
                style={{ color: 'var(--accent-text)' }}
              >
                <RotateCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {usingOfflineCache && (
              <p className="text-xs" style={{ color: 'var(--gold)' }}>
                Showing cached times for today (offline fallback).
              </p>
            )}

            {prayerData.timings.Sunrise && (
              <p
                className="px-3 text-xs tabular-nums"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Sunrise: {formatPrayerDisplayTime(prayerData.timings.Sunrise)}
              </p>
            )}

            {/* 5 Daily Prayers Table/List */}
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {PRAYER_LIST.map((p) => {
                const time24 = prayerData.timings[p.name];
                const isNext = countdown?.nextPrayer === p.name;
                return (
                  <div
                    key={p.name}
                    className={`flex items-center justify-between gap-4 py-3.5 px-3 rounded-lg transition-colors ${
                      isNext ? 'my-0.5' : ''
                    }`}
                    style={{
                      backgroundColor: isNext ? 'var(--highlight-ayah)' : 'transparent',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-base font-semibold"
                        style={{ color: isNext ? 'var(--accent-text)' : 'var(--text-primary)' }}
                      >
                        {p.name}
                      </span>
                      <span
                        dir="rtl"
                        lang="ar"
                        translate="no"
                        className="notranslate font-quran-scheherazade text-base"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {p.arabic}
                      </span>
                      {isNext && (
                        <span className="text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
                          · Up next
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2.5 tabular-nums">
                      <span
                        className="text-base font-semibold"
                        style={{ color: isNext ? 'var(--accent-text)' : 'var(--text-primary)' }}
                      >
                        {formatPrayerDisplayTime(time24)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {time24}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Qibla Compass Dial */}
          <div className="lg:col-span-5">
            <QiblaCompass
              qiblaDirection={prayerData.qiblaDirection}
              locationLabel={prayerData.location.label}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
