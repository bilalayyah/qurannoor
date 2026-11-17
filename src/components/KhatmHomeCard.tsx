import { ArrowRight, BookOpen, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useReader } from '../context/ReaderContext';
import {
  JUZ_DIVISIONS,
  resolveJuzPortionLabel,
  useKhatmPlan,
} from '../utils/khatmPlan';

export function KhatmHomeCard() {
  const { juzs, chapters, showToast } = useReader();
  const {
    state,
    completedCount,
    percent,
    activeDay,
    isCompleted,
    hasStarted,
    toggleDayComplete,
  } = useKhatmPlan();

  const portionMeta = JUZ_DIVISIONS[activeDay - 1] || JUZ_DIVISIONS[0];
  const { rangeText, versesCount } = resolveJuzPortionLabel(portionMeta, juzs, chapters);
  const isTodayDone = state.completedDays.includes(activeDay);

  const handleToggleToday = () => {
    toggleDayComplete(activeDay);
    if (!isTodayDone) {
      showToast(`Day ${activeDay} (Juz ${portionMeta.juzNumber}) marked complete`);
    } else {
      showToast(`Day ${activeDay} marked incomplete`);
    }
  };

  return (
    <section aria-labelledby="khatm-home-heading">
      <div
        className="rounded-2xl border p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className="inline-flex items-center gap-2 text-xs font-medium"
                style={{ color: 'var(--accent-text)' }}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>30-Day Khatm Plan</span>
              </div>

              <span
                className="text-xs font-medium tabular-nums"
                style={{ color: 'var(--text-secondary)' }}
              >
                Day {completedCount} of 30 · {percent}% complete
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                id="khatm-home-heading"
                className="text-xl font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {isCompleted
                  ? '30-Day Khatm Complete'
                  : `Today's Portion: Day ${activeDay} — Juz ${portionMeta.juzNumber} (${portionMeta.juzName})`}
              </h2>
              <span
                dir="rtl"
                lang="ar"
                translate="no"
                className="notranslate font-quran-scheherazade quran-arabic-text text-base leading-[1.45] !py-0"
                style={{ color: 'var(--accent-text)' }}
              >
                {portionMeta.arabicName}
              </span>
            </div>

            <p className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {rangeText} · {versesCount} Ayahs
              {hasStarted && !isCompleted ? ` · Day ${activeDay} of 30` : ''}
            </p>

            {/* Overall Progress Bar */}
            <div className="flex items-center gap-3 max-w-lg pt-0.5">
              <div
                role="progressbar"
                aria-label="30-day Khatm completion progress"
                aria-valuemin={0}
                aria-valuemax={30}
                aria-valuenow={completedCount}
                className="h-2 flex-1 overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--bg-muted)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(completedCount > 0 ? 4 : 0, percent)}%`,
                    backgroundColor: isCompleted ? 'var(--gold)' : 'var(--accent)',
                  }}
                />
              </div>
              <span
                className="text-xs font-semibold tabular-nums shrink-0"
                style={{ color: 'var(--text-secondary)' }}
              >
                {percent}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!isCompleted && (
              <button
                type="button"
                onClick={handleToggleToday}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {isTodayDone ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {isTodayDone
                    ? `Day ${activeDay} Completed`
                    : "Mark today's portion complete"}
                </span>
              </button>
            )}

            <Link
              to="/khatm"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs sm:text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <span>{hasStarted ? 'View All 30 Days' : 'Start 30-Day Plan'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
