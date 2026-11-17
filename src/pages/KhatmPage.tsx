import { ArrowRight, BookOpen, Check, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';
import {
  JUZ_DIVISIONS,
  resolveJuzPortionLabel,
  useKhatmPlan,
} from '../utils/khatmPlan';

export function KhatmPage() {
  usePageMetadata({
    title: '30-Day Khatm Tracker – Complete the Quran in 30 Days – QuranNoor',
    description:
      'Follow a structured 30-day Quran completion plan (one Juz per day) with ayah ranges, daily portion completion tracking, and catch-up support saved locally.',
    canonicalPath: '/khatm',
  });

  const { juzs, chapters, showToast } = useReader();
  const {
    state,
    completedCount,
    percent,
    scheduleDay,
    activeDay,
    isCompleted,
    hasStarted,
    startPlan,
    restartPlan,
    toggleDayComplete,
  } = useKhatmPlan();

  const [confirmRestart, setConfirmRestart] = useState(false);

  const completedSet = new Set(state.completedDays);
  const activeMeta = JUZ_DIVISIONS[activeDay - 1] || JUZ_DIVISIONS[0];
  const activeRange = resolveJuzPortionLabel(activeMeta, juzs, chapters);
  const isActiveDone = completedSet.has(activeDay);

  const ringRadius = 36;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - percent / 100);

  const handleToggleDay = (dayNum: number, juzName: string) => {
    const wasDone = completedSet.has(dayNum);
    toggleDayComplete(dayNum);
    showToast(
      wasDone
        ? `Day ${dayNum} marked incomplete`
        : `Day ${dayNum} · Juz ${dayNum} (${juzName}) completed`
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 space-y-8">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: '30-Day Khatm Tracker' },
        ]}
      />

      {/* Overall Plan Summary & Progress Ring */}
      <section
        aria-labelledby="khatm-heading"
        className="rounded-2xl border p-6 sm:p-8"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
            {/* SVG Progress Ring */}
            <div className="relative h-24 w-24 shrink-0">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
                <circle
                  cx="44"
                  cy="44"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="6"
                  style={{ stroke: 'var(--bg-muted)' }}
                />
                <circle
                  cx="44"
                  cy="44"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-300"
                  style={{ stroke: isCompleted ? 'var(--gold)' : 'var(--accent)' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {percent}%
                </span>
                <span
                  className="text-[11px] font-medium tabular-nums"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {completedCount}/30
                </span>
              </div>
            </div>

            <div className="space-y-2 min-w-0">
              <p className="text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
                One Juz Per Day · Per-Browser Progress
              </p>
              <h1
                id="khatm-heading"
                className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance"
                style={{ color: 'var(--text-primary)' }}
              >
                30-Day Quran Khatm Plan
              </h1>
              <p
                className="text-sm sm:text-base font-medium tabular-nums"
                style={{ color: 'var(--text-secondary)' }}
              >
                Day {completedCount} of 30 · {percent}% complete
                {state.startedAt ? ` · Started ${state.startedAt}` : ''}
              </p>

              {/* Progress Bar */}
              <div
                role="progressbar"
                aria-label="Overall 30-day Khatm progress"
                aria-valuemin={0}
                aria-valuemax={30}
                aria-valuenow={completedCount}
                className="h-2 w-full max-w-md overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--bg-muted)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(completedCount > 0 ? 3 : 0, percent)}%`,
                    backgroundColor: isCompleted ? 'var(--gold)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Start / Restart Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!hasStarted ? (
              <button
                type="button"
                onClick={() => {
                  startPlan();
                  showToast('30-Day Khatm plan started today');
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Play className="h-4 w-4 fill-current shrink-0" />
                <span>Start 30-Day Plan</span>
              </button>
            ) : confirmRestart ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    restartPlan();
                    setConfirmRestart(false);
                    showToast('Khatm plan restarted at Day 1');
                  }}
                  className="inline-flex min-h-[40px] items-center rounded-xl px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Confirm Restart
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRestart(false)}
                  className="inline-flex min-h-[40px] items-center rounded-xl border px-3.5 py-2 text-xs font-medium whitespace-nowrap"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRestart(true)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs sm:text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>Restart Plan</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Today's Portion Focus Card */}
      <section
        aria-label="Today's Khatm Portion"
        className="rounded-2xl border p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--accent)',
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-text)' }}>
              {isCompleted
                ? 'Khatm Completed — Alhamdulillah'
                : hasStarted
                ? `Today's Portion · Day ${activeDay} of 30`
                : 'Recommended Starting Portion · Day 1 of 30'}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                className="text-xl font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                Day {activeDay} — Juz {activeMeta.juzNumber}: {activeMeta.juzName}
              </h2>
              <span
                dir="rtl"
                lang="ar"
                translate="no"
                className="notranslate font-quran-scheherazade quran-arabic-text text-base leading-[1.45] !py-0"
                style={{ color: 'var(--accent-text)' }}
              >
                {activeMeta.arabicName}
              </span>
            </div>
            <p className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {activeRange.rangeText} · {activeRange.versesCount} Ayahs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              to={`/juz/${activeMeta.juzNumber}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs sm:text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>Read Juz {activeMeta.juzNumber}</span>
            </Link>

            <button
              type="button"
              onClick={() => handleToggleDay(activeDay, activeMeta.juzName)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{
                backgroundColor: isActiveDone ? 'var(--gold)' : 'var(--accent)',
              }}
            >
              <Check className="h-4 w-4 shrink-0" />
              <span>
                {isActiveDone
                  ? `Day ${activeDay} Completed`
                  : "Mark today's portion complete"}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* All 30 Days Schedule */}
      <section aria-labelledby="all-days-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="all-days-heading"
            className="text-lg sm:text-xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            All 30 Days (Juz 1 – Juz 30)
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Missed a day? Mark any portion complete whenever you finish it.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {JUZ_DIVISIONS.map((item) => {
            const done = completedSet.has(item.day);
            const isCurrent = item.day === activeDay && !isCompleted;
            const isMissed =
              hasStarted && !done && item.day < scheduleDay;
            const { rangeText, versesCount } = resolveJuzPortionLabel(
              item,
              juzs,
              chapters
            );

            return (
              <div
                key={item.day}
                className="flex flex-col justify-between gap-4 rounded-xl border p-5 transition-colors"
                style={{
                  backgroundColor: done
                    ? 'var(--accent-soft)'
                    : 'var(--bg-surface)',
                  borderColor: isCurrent
                    ? 'var(--accent)'
                    : done
                    ? 'color-mix(in srgb, var(--accent) 35%, transparent)'
                    : 'var(--border-subtle)',
                }}
              >
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex flex-wrap items-baseline gap-2 text-xs font-medium">
                      <span
                        className="tabular-nums font-semibold"
                        style={{
                          color: isCurrent
                            ? 'var(--accent-text)'
                            : 'var(--text-secondary)',
                        }}
                      >
                        Day {item.day}
                      </span>
                      <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>
                        ·
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }} className="tabular-nums">
                        {versesCount} Ayahs
                      </span>
                      {isCurrent && (
                        <>
                          <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>
                            ·
                          </span>
                          <span style={{ color: 'var(--accent-text)' }}>Today</span>
                        </>
                      )}
                      {isMissed && (
                        <>
                          <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>
                            ·
                          </span>
                          <span style={{ color: 'var(--gold)' }}>Missed</span>
                        </>
                      )}
                    </div>

                    <span
                      dir="rtl"
                      lang="ar"
                      translate="no"
                      className="notranslate font-quran-scheherazade quran-arabic-text text-base leading-[1.4] !py-0"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      {item.arabicName}
                    </span>
                  </div>

                  <h3
                    className="text-base font-semibold tracking-tight"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Juz {item.juzNumber} — {item.juzName}
                  </h3>

                  <p
                    className="text-xs sm:text-sm tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {rangeText}
                  </p>
                </div>

                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <Link
                    to={`/juz/${item.juzNumber}`}
                    className="inline-flex min-h-[38px] items-center gap-1 text-xs font-medium hover:underline underline-offset-4"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    <span>Read Juz {item.juzNumber}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleToggleDay(item.day, item.juzName)}
                    aria-pressed={done}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
                    style={{
                      backgroundColor: done ? 'var(--accent)' : 'var(--bg-canvas)',
                      borderColor: done ? 'var(--accent)' : 'var(--border-subtle)',
                      color: done ? '#FFFFFF' : 'var(--text-primary)',
                    }}
                  >
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {done
                        ? 'Completed'
                        : isCurrent
                        ? "Mark today's portion complete"
                        : 'Mark complete'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
