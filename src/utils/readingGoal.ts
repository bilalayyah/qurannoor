import type {
  DailyActivityRecord,
  DailyGoalConfig,
  DailyGoalUnit,
  DailyReadingData,
} from '../types/quran';

export const DEFAULT_DAILY_GOAL: DailyGoalConfig = {
  unit: 'ayahs',
  target: 10,
};

export const GOAL_PRESETS: Record<DailyGoalUnit, number[]> = {
  ayahs: [5, 10, 20, 30, 50],
  pages: [1, 2, 4, 10, 20],
};

export const MAX_GOAL_TARGET: Record<DailyGoalUnit, number> = {
  ayahs: 6236,
  pages: 604,
};

export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + deltaDays);
  return toLocalDateKey(dt);
}

export function getDayProgress(
  record: DailyActivityRecord | undefined,
  unit: DailyGoalUnit
): number {
  if (!record) return 0;
  if (unit === 'pages') {
    return (record.pages?.length || 0) + (record.manualPages || 0);
  }
  return (record.ayahKeys?.length || 0) + (record.manualAyahs || 0);
}

export function normalizeDailyReadingData(raw: unknown): DailyReadingData {
  const fallback: DailyReadingData = {
    goal: { ...DEFAULT_DAILY_GOAL },
    history: {},
  };
  if (!raw || typeof raw !== 'object') return fallback;

  const obj = raw as Partial<DailyReadingData>;
  const rawUnit: DailyGoalUnit = obj.goal?.unit === 'pages' ? 'pages' : 'ayahs';
  const rawTarget = Number(obj.goal?.target);
  const clampedTarget =
    Number.isFinite(rawTarget) && rawTarget >= 1
      ? Math.min(MAX_GOAL_TARGET[rawUnit], Math.round(rawTarget))
      : DEFAULT_DAILY_GOAL.target;

  const cleanHistory: Record<string, DailyActivityRecord> = {};
  if (obj.history && typeof obj.history === 'object') {
    for (const [dateKey, rec] of Object.entries(obj.history)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !rec || typeof rec !== 'object') {
        continue;
      }
      cleanHistory[dateKey] = {
        ayahKeys: Array.isArray(rec.ayahKeys)
          ? rec.ayahKeys.filter((k): k is string => typeof k === 'string')
          : [],
        pages: Array.isArray(rec.pages)
          ? rec.pages.filter((p): p is number => typeof p === 'number' && Number.isFinite(p))
          : [],
        manualAyahs:
          typeof rec.manualAyahs === 'number' && rec.manualAyahs > 0
            ? Math.round(rec.manualAyahs)
            : 0,
        manualPages:
          typeof rec.manualPages === 'number' && rec.manualPages > 0
            ? Math.round(rec.manualPages)
            : 0,
      };
    }
  }

  return {
    goal: { unit: rawUnit, target: clampedTarget },
    history: cleanHistory,
  };
}

export function calculateStreaks(
  history: Record<string, DailyActivityRecord>,
  goal: DailyGoalConfig,
  today: Date = new Date()
): { currentStreak: number; bestStreak: number } {
  const target = Math.max(1, goal.target);
  const todayKey = toLocalDateKey(today);
  const yesterdayKey = addDaysToDateKey(todayKey, -1);

  const isDayCompleted = (dateKey: string) =>
    getDayProgress(history[dateKey], goal.unit) >= target;

  // Current streak stays alive if today is complete OR if yesterday was complete (grace until end of today)
  let currentStreak = 0;
  let cursorKey: string | null = isDayCompleted(todayKey)
    ? todayKey
    : isDayCompleted(yesterdayKey)
    ? yesterdayKey
    : null;

  while (cursorKey && isDayCompleted(cursorKey)) {
    currentStreak += 1;
    cursorKey = addDaysToDateKey(cursorKey, -1);
  }

  // Best historical streak across all recorded dates
  const completedKeys = Object.keys(history)
    .filter((k) => k <= todayKey && isDayCompleted(k))
    .sort();

  let bestStreak = currentStreak;
  let run = 0;
  let prevKey: string | null = null;

  for (const key of completedKeys) {
    if (prevKey && addDaysToDateKey(prevKey, 1) === key) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) {
      bestStreak = run;
    }
    prevKey = key;
  }

  return { currentStreak, bestStreak };
}

export interface DaySummaryItem {
  dateKey: string;
  weekdayShort: string;
  dayNumber: number;
  isToday: boolean;
  progress: number;
  target: number;
  completed: boolean;
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function getLast7DaysSummary(
  history: Record<string, DailyActivityRecord>,
  goal: DailyGoalConfig,
  today: Date = new Date()
): DaySummaryItem[] {
  const target = Math.max(1, goal.target);
  const items: DaySummaryItem[] = [];

  for (let offset = -6; offset <= 0; offset += 1) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const dateKey = toLocalDateKey(dt);
    const progress = getDayProgress(history[dateKey], goal.unit);

    items.push({
      dateKey,
      weekdayShort: WEEKDAY_INITIALS[dt.getDay()],
      dayNumber: dt.getDate(),
      isToday: offset === 0,
      progress,
      target,
      completed: progress >= target,
    });
  }

  return items;
}
