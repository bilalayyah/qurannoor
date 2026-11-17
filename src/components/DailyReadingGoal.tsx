import { Check, Flame, Plus, SlidersHorizontal, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useReader } from '../context/ReaderContext';
import type { DailyGoalUnit } from '../types/quran';
import { GOAL_PRESETS, MAX_GOAL_TARGET } from '../utils/readingGoal';

function formatUnitLabel(unit: DailyGoalUnit, count: number): string {
  if (unit === 'pages') {
    return count === 1 ? 'page' : 'pages';
  }
  return count === 1 ? 'ayah' : 'ayahs';
}

export function DailyReadingGoal() {
  const {
    dailyGoal,
    todayProgress,
    currentStreak,
    bestStreak,
    last7Days,
    updateDailyGoal,
    logManualReading,
  } = useReader();

  const [isEditing, setIsEditing] = useState(false);
  const [draftUnit, setDraftUnit] = useState<DailyGoalUnit>(dailyGoal.unit);
  const [draftTarget, setDraftTarget] = useState<string>(String(dailyGoal.target));

  useEffect(() => {
    setDraftUnit(dailyGoal.unit);
    setDraftTarget(String(dailyGoal.target));
  }, [dailyGoal.unit, dailyGoal.target]);

  const target = Math.max(1, dailyGoal.target);
  const pct = Math.min(100, Math.round((todayProgress / target) * 100));
  const goalMet = todayProgress >= target;

  const handleUnitChange = (nextUnit: DailyGoalUnit) => {
    setDraftUnit(nextUnit);
    if (nextUnit !== dailyGoal.unit) {
      setDraftTarget(nextUnit === 'pages' ? '2' : '10');
    } else {
      setDraftTarget(String(dailyGoal.target));
    }
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(draftTarget);
    if (!Number.isFinite(numeric) || numeric < 1) return;
    const clamped = Math.min(MAX_GOAL_TARGET[draftUnit], Math.round(numeric));
    updateDailyGoal({ unit: draftUnit, target: clamped });
    setIsEditing(false);
  };

  return (
    <section aria-labelledby="daily-goal-heading">
      <div
        className="rounded-2xl border p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Goal Progress & Streak Summary */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className="inline-flex items-center gap-2 text-xs font-medium"
                style={{ color: 'var(--accent-text)' }}
              >
                <Target className="h-3.5 w-3.5" />
                <span>Daily Reading Goal</span>
              </div>

              <div
                className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums"
                style={{ color: currentStreak > 0 ? 'var(--gold)' : 'var(--text-tertiary)' }}
              >
                <Flame className="h-3.5 w-3.5" />
                <span>
                  {currentStreak} {currentStreak === 1 ? 'day' : 'days'} streak
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>
                  ·
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>
                  Best: {bestStreak} {bestStreak === 1 ? 'day' : 'days'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                id="daily-goal-heading"
                className="text-xl font-semibold tracking-tight tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {todayProgress} of {target} {formatUnitLabel(dailyGoal.unit, target)} read today
              </h2>
              {goalMet && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: 'var(--accent-text)' }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Goal completed</span>
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-3 max-w-lg">
              <div
                role="progressbar"
                aria-label="Daily reading goal progress"
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.min(todayProgress, target)}
                className="h-2 flex-1 overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--bg-muted)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(todayProgress > 0 ? 4 : 0, pct)}%`,
                    backgroundColor: goalMet ? 'var(--gold)' : 'var(--accent)',
                  }}
                />
              </div>
              <span
                className="text-xs font-semibold tabular-nums shrink-0"
                style={{ color: 'var(--text-secondary)' }}
              >
                {pct}%
              </span>
            </div>

            {/* 7-Day Streak Consistency Calendar Strip */}
            <div className="pt-1">
              <div
                className="grid grid-cols-7 gap-2 max-w-md"
                aria-label="Last 7 days reading consistency"
              >
                {last7Days.map((day) => {
                  const hasAnyReading = day.progress > 0;
                  return (
                    <div
                      key={day.dateKey}
                      title={`${day.isToday ? 'Today' : day.dateKey}: ${day.progress}/${day.target} ${formatUnitLabel(dailyGoal.unit, day.target)}`}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className="text-[11px] font-medium"
                        style={{
                          color: day.isToday ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        }}
                      >
                        {day.weekdayShort}
                      </span>
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors"
                        style={{
                          backgroundColor: day.completed
                            ? 'var(--accent)'
                            : hasAnyReading
                            ? 'var(--accent-soft)'
                            : 'transparent',
                          borderColor: day.completed
                            ? 'var(--accent)'
                            : day.isToday
                            ? 'var(--border-strong)'
                            : 'var(--border-subtle)',
                          color: day.completed
                            ? '#FFFFFF'
                            : hasAnyReading
                            ? 'var(--accent-text)'
                            : 'var(--text-tertiary)',
                        }}
                        aria-label={`${day.isToday ? 'Today' : day.dateKey}: ${
                          day.completed
                            ? 'Goal completed'
                            : `${day.progress} of ${day.target} ${formatUnitLabel(dailyGoal.unit, day.target)}`
                        }`}
                      >
                        {day.completed ? <Check className="h-3.5 w-3.5" /> : day.dayNumber}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => logManualReading(1)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Log +1 {dailyGoal.unit === 'pages' ? 'Page' : 'Ayah'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              aria-expanded={isEditing}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
              style={{
                backgroundColor: isEditing ? 'var(--accent-soft)' : 'transparent',
                borderColor: isEditing ? 'var(--accent)' : 'var(--border-subtle)',
                color: isEditing ? 'var(--accent-text)' : 'var(--text-secondary)',
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{isEditing ? 'Close' : 'Set Goal'}</span>
            </button>
          </div>
        </div>

        {/* Inline Goal Configuration Panel */}
        {isEditing && (
          <form
            onSubmit={handleSaveGoal}
            className="mt-6 border-t pt-5 space-y-4"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3">
                {/* Unit Segmented Control */}
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Measure by:
                  </span>
                  <div
                    role="group"
                    aria-label="Daily goal unit"
                    className="inline-flex rounded-xl p-1"
                    style={{ backgroundColor: 'var(--bg-muted)' }}
                  >
                    {(['ayahs', 'pages'] as const).map((unitOption) => {
                      const active = draftUnit === unitOption;
                      return (
                        <button
                          key={unitOption}
                          type="button"
                          onClick={() => handleUnitChange(unitOption)}
                          className="min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
                          style={{
                            backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {unitOption === 'ayahs' ? 'Ayahs / day' : 'Pages / day'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preset Targets + Custom Input */}
                <div className="flex flex-wrap items-center gap-2">
                  {GOAL_PRESETS[draftUnit].map((preset) => {
                    const selected = Number(draftTarget) === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDraftTarget(String(preset))}
                        className="min-h-[38px] rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors whitespace-nowrap"
                        style={{
                          backgroundColor: selected ? 'var(--accent-soft)' : 'transparent',
                          borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)',
                          color: selected ? 'var(--accent-text)' : 'var(--text-secondary)',
                        }}
                      >
                        {preset} {formatUnitLabel(draftUnit, preset)}
                      </button>
                    );
                  })}

                  <label className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <span>Custom:</span>
                    <input
                      type="number"
                      min={1}
                      max={MAX_GOAL_TARGET[draftUnit]}
                      value={draftTarget}
                      onChange={(e) => setDraftTarget(e.target.value)}
                      aria-label={`Custom daily ${draftUnit} target`}
                      className="h-[38px] w-20 rounded-lg border px-2.5 text-xs font-semibold tabular-nums outline-none"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl px-5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Save Goal
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Progress updates automatically as you read or listen in the Quran reader, and you can also log offline Mushaf reading above.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
