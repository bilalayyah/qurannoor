import { Clock, LocateFixed, MapPin, RotateCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QiblaCompass } from '../components/QiblaCompass';
import { ErrorBanner } from '../components/StatusStates';
import { usePageMetadata } from '../hooks/usePageMetadata';
import {
  CALCULATION_METHODS,
  fetchPrayerAndQiblaData,
  formatPrayerDisplayTime,
  getCachedPrayerData,
  getNextPrayerCountdown,
  loadPrayerPreferences,
  reverseGeocodeFree,
  savePrayerPreferences,
  searchCitiesFree,
  type CitySearchResult,
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
  const [method, setMethod] = useState<number>(initialPrefs.method);
  const [location, setLocation] = useState<PrayerLocation | null>(initialPrefs.location);

  const [prayerData, setPrayerData] = useState<PrayerDayData | null>(() =>
    initialPrefs.location ? getCachedPrayerData(initialPrefs.location, initialPrefs.method) : null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingOfflineCache, setUsingOfflineCache] = useState<boolean>(false);

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());

  const geoAttemptedRef = useRef(false);

  // Update next prayer countdown every second
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Persist method + location preferences
  useEffect(() => {
    savePrayerPreferences({ method, location });
  }, [method, location]);

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
          // Offline or API temporarily unreachable, but today's cache is valid
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

  const requestBrowserLocation = useCallback(async (isAutomatic = false) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      if (!isAutomatic) {
        setGeoStatus('Browser geolocation is unavailable. Please search your city below.');
      }
      return;
    }

    if (!isAutomatic) {
      setGeoStatus('Detecting your location...');
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const label = await reverseGeocodeFree(lat, lng);
        const loc: PrayerLocation = {
          label,
          latitude: lat,
          longitude: lng,
          source: 'geolocation',
        };
        setGeoStatus(null);
        setLocation(loc);
      },
      () => {
        if (!isAutomatic) {
          setGeoStatus('Location permission was declined or unavailable. Search your city instead.');
        }
      },
      { enableHighAccuracy: false, timeout: 6500, maximumAge: 600000 }
    );
  }, []);

  // On initial mount with no saved location, request geolocation once if browser allows
  useEffect(() => {
    if (location || geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;
    requestBrowserLocation(true);
  }, [location, requestBrowserLocation]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cityQuery.trim();
    if (trimmed.length < 2) {
      setCityError('Enter at least 2 characters to search a city.');
      return;
    }

    setSearchingCity(true);
    setCityError(null);
    try {
      const results = await searchCitiesFree(trimmed);
      setCityResults(results);
      if (results.length === 0) {
        setCityError(`No matching cities found for "${trimmed}".`);
      }
    } catch (err) {
      setCityError(err instanceof Error ? err.message : 'Unable to search cities.');
    } finally {
      setSearchingCity(false);
    }
  };

  const handleSelectCity = (city: CitySearchResult) => {
    const parts = [city.name, city.admin1, city.country].filter(Boolean);
    const loc: PrayerLocation = {
      label: parts.join(', '),
      latitude: city.latitude,
      longitude: city.longitude,
      source: 'city',
    };
    setCityResults([]);
    setCityQuery('');
    setCityError(null);
    setGeoStatus(null);
    setLocation(loc);
  };

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

      {/* Location & Calculation Method Controls */}
      <section
        aria-label="Location and Calculation Method Settings"
        className="rounded-2xl border p-5 sm:p-6 space-y-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
          {/* City Search Fallback */}
          <form onSubmit={handleCitySearch} className="lg:col-span-6 space-y-1.5">
            <label
              htmlFor="city-search-input"
              className="block text-xs font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Search City Manually
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex flex-1 items-center gap-2 rounded-xl border px-3"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  id="city-search-input"
                  type="search"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="Enter city (e.g. Karachi, London, Makkah)..."
                  className="w-full min-h-[40px] bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <button
                type="submit"
                disabled={searchingCity}
                className="min-h-[42px] shrink-0 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {searchingCity ? 'Searching...' : 'Find City'}
              </button>
            </div>
          </form>

          {/* Calculation Method Picker */}
          <div className="lg:col-span-4 space-y-1.5">
            <label
              htmlFor="calculation-method-select"
              className="block text-xs font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Calculation Method
            </label>
            <select
              id="calculation-method-select"
              value={method}
              onChange={(e) => setMethod(Number(e.target.value))}
              className="w-full min-h-[42px] rounded-xl border px-3 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {CALCULATION_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Browser Geolocation Button */}
          <div className="lg:col-span-2">
            <button
              type="button"
              onClick={() => requestBrowserLocation(false)}
              className="w-full inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--accent-text)',
              }}
            >
              <LocateFixed className="h-4 w-4 shrink-0" />
              <span>Use Location</span>
            </button>
          </div>
        </div>

        {geoStatus && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {geoStatus}
          </p>
        )}

        {cityError && (
          <p className="text-xs text-red-700 dark:text-red-400" role="alert">
            {cityError}
          </p>
        )}

        {cityResults.length > 0 && (
          <div
            className="border-t pt-3 space-y-1.5"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Select a location:
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cityResults.map((city) => {
                const sub = [city.admin1, city.country].filter(Boolean).join(', ');
                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className="flex items-start gap-2 rounded-xl border p-3 text-left text-xs transition-colors hover:border-[#0E6B4B]/50"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <MapPin
                      className="h-3.5 w-3.5 mt-0.5 shrink-0"
                      style={{ color: 'var(--accent-text)' }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {city.name}
                      </p>
                      {sub && (
                        <p className="truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {sub}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Main Content */}
      {!location && !loading && !error ? (
        <section
          className="rounded-2xl border p-8 sm:p-10 text-center space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <MapPin
            className="mx-auto h-7 w-7"
            style={{ color: 'var(--accent-text)' }}
          />
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Choose Your Location
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Click &ldquo;Use Location&rdquo; to detect your coordinates automatically or search for your city above to fetch live prayer times and your exact Qibla bearing.
            </p>
          </div>
        </section>
      ) : error ? (
        <ErrorBanner
          message={error}
          onRetry={() => {
            if (location) loadForLocation(location, method);
          }}
        />
      ) : loading && !prayerData ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 animate-pulse" aria-busy="true">
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

            {/* Secondary Reference Row */}
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-tertiary)',
              }}
            >
              <span>
                {prayerData.timings.Sunrise
                  ? `Sunrise: ${formatPrayerDisplayTime(prayerData.timings.Sunrise)}`
                  : ''}
              </span>
              <span>Method: {prayerData.methodName} · Aladhan API</span>
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
