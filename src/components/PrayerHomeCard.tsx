import { ArrowRight, Clock, Compass } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatPrayerDisplayTime,
  getCardinalDirection,
  getLatestCachedPrayerDataForToday,
  getNextPrayerCountdown,
  type PrayerDayData,
} from '../services/prayerApi';

export function PrayerHomeCard() {
  const [cached, setCached] = useState<PrayerDayData | null>(() =>
    getLatestCachedPrayerDataForToday()
  );
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    setCached(getLatestCachedPrayerDataForToday());
    const timer = window.setInterval(() => setNowTick(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = cached
    ? getNextPrayerCountdown(cached.timings, cached.timezone, nowTick)
    : null;

  return (
    <section aria-label="Prayer Times and Qibla">
      <div
        className="rounded-2xl border p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent-text)',
            }}
          >
            <Compass className="h-5 w-5" />
          </div>

          <div className="space-y-1 min-w-0">
            <div
              className="flex flex-wrap items-center gap-2 text-xs font-medium"
              style={{ color: 'var(--accent-text)' }}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Prayer Times &amp; Qibla</span>
            </div>

            {cached && countdown ? (
              <>
                <h3
                  className="text-base sm:text-lg font-semibold tracking-tight tabular-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {countdown.countdownText} · {formatPrayerDisplayTime(countdown.nextTime24)}
                </h3>
                <p className="text-xs sm:text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {cached.location.label} · Qibla {Math.round(cached.qiblaDirection)}°{' '}
                  {getCardinalDirection(cached.qiblaDirection)} from North
                </p>
              </>
            ) : (
              <>
                <h3
                  className="text-base sm:text-lg font-semibold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Daily Prayer Times &amp; Qibla Direction
                </h3>
                <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  View today&apos;s five prayer times, live next-prayer countdown, and Qibla compass for your city.
                </p>
              </>
            )}
          </div>
        </div>

        <Link
          to="/prayer-times"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs sm:text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--accent-text)',
          }}
        >
          <span>{cached ? 'All Times & Qibla' : 'Open Prayer & Qibla'}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
