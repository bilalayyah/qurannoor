import { useCallback, useEffect, useState } from 'react';
import type { Chapter, Juz } from '../types/quran';
import { SURAH_NAMES } from './ayahOfTheDay';
import { toLocalDateKey } from './readingGoal';

export const KHATM_STORAGE_KEY = 'qurannoor_khatm_plan_v1';
const KHATM_EVENT = 'qurannoor-khatm-updated';

export interface JuzDivisionMeta {
  day: number;
  juzNumber: number;
  arabicName: string;
  juzName: string;
  startChapterId: number;
  startVerse: number;
  endChapterId: number;
  endVerse: number;
  versesCount: number;
}

export const JUZ_DIVISIONS: readonly JuzDivisionMeta[] = [
  { day: 1, juzNumber: 1, arabicName: 'الم', juzName: 'Alif Lam Meem', startChapterId: 1, startVerse: 1, endChapterId: 2, endVerse: 141, versesCount: 148 },
  { day: 2, juzNumber: 2, arabicName: 'سيقول', juzName: 'Sayaqool', startChapterId: 2, startVerse: 142, endChapterId: 2, endVerse: 252, versesCount: 111 },
  { day: 3, juzNumber: 3, arabicName: 'تلك الرسل', juzName: 'Tilkal Rusul', startChapterId: 2, startVerse: 253, endChapterId: 3, endVerse: 92, versesCount: 126 },
  { day: 4, juzNumber: 4, arabicName: 'لن تنالوا', juzName: 'Lan Tanaloo', startChapterId: 3, startVerse: 93, endChapterId: 4, endVerse: 23, versesCount: 131 },
  { day: 5, juzNumber: 5, arabicName: 'والمحصنات', juzName: 'Wal Muhsanat', startChapterId: 4, startVerse: 24, endChapterId: 4, endVerse: 147, versesCount: 124 },
  { day: 6, juzNumber: 6, arabicName: 'لا يحب الله', juzName: 'La Yuhibbullah', startChapterId: 4, startVerse: 148, endChapterId: 5, endVerse: 81, versesCount: 110 },
  { day: 7, juzNumber: 7, arabicName: 'وإذا سمعوا', juzName: 'Wa Iza Samiu', startChapterId: 5, startVerse: 82, endChapterId: 6, endVerse: 110, versesCount: 149 },
  { day: 8, juzNumber: 8, arabicName: 'ولو أننا', juzName: 'Wa Law Annana', startChapterId: 6, startVerse: 111, endChapterId: 7, endVerse: 87, versesCount: 142 },
  { day: 9, juzNumber: 9, arabicName: 'قال الملأ', juzName: 'Qalal Malao', startChapterId: 7, startVerse: 88, endChapterId: 8, endVerse: 40, versesCount: 159 },
  { day: 10, juzNumber: 10, arabicName: 'واعلموا', juzName: 'Wa A’lamu', startChapterId: 8, startVerse: 41, endChapterId: 9, endVerse: 92, versesCount: 127 },
  { day: 11, juzNumber: 11, arabicName: 'يعتذرون', juzName: 'Ya’tadhiroon', startChapterId: 9, startVerse: 93, endChapterId: 11, endVerse: 5, versesCount: 151 },
  { day: 12, juzNumber: 12, arabicName: 'وما من دابة', juzName: 'Wa Ma Min Dabbah', startChapterId: 11, startVerse: 6, endChapterId: 12, endVerse: 52, versesCount: 170 },
  { day: 13, juzNumber: 13, arabicName: 'وما أبرئ', juzName: 'Wa Ma Ubarri’u', startChapterId: 12, startVerse: 53, endChapterId: 14, endVerse: 52, versesCount: 154 },
  { day: 14, juzNumber: 14, arabicName: 'ربما', juzName: 'Rubama', startChapterId: 15, startVerse: 1, endChapterId: 16, endVerse: 128, versesCount: 227 },
  { day: 15, juzNumber: 15, arabicName: 'سبحان الذي', juzName: 'Subhanallazi', startChapterId: 17, startVerse: 1, endChapterId: 18, endVerse: 74, versesCount: 185 },
  { day: 16, juzNumber: 16, arabicName: 'قال ألم', juzName: 'Qala Alam', startChapterId: 18, startVerse: 75, endChapterId: 20, endVerse: 135, versesCount: 269 },
  { day: 17, juzNumber: 17, arabicName: 'اقترب للناس', juzName: 'Iqtaraba', startChapterId: 21, startVerse: 1, endChapterId: 22, endVerse: 78, versesCount: 190 },
  { day: 18, juzNumber: 18, arabicName: 'قد أفلح', juzName: 'Qad Aflaha', startChapterId: 23, startVerse: 1, endChapterId: 25, endVerse: 20, versesCount: 202 },
  { day: 19, juzNumber: 19, arabicName: 'وقال الذين', juzName: 'Wa Qalallazina', startChapterId: 25, startVerse: 21, endChapterId: 27, endVerse: 55, versesCount: 339 },
  { day: 20, juzNumber: 20, arabicName: 'أمن خلق', juzName: 'Amman Khalaqa', startChapterId: 27, startVerse: 56, endChapterId: 29, endVerse: 45, versesCount: 171 },
  { day: 21, juzNumber: 21, arabicName: 'اتل ما أوحي', juzName: 'Utlu Ma Oohiya', startChapterId: 29, startVerse: 46, endChapterId: 33, endVerse: 30, versesCount: 178 },
  { day: 22, juzNumber: 22, arabicName: 'ومن يقنت', juzName: 'Wa Man Yaqnut', startChapterId: 33, startVerse: 31, endChapterId: 36, endVerse: 27, versesCount: 169 },
  { day: 23, juzNumber: 23, arabicName: 'وما لي', juzName: 'Wa Mali', startChapterId: 36, startVerse: 28, endChapterId: 39, endVerse: 31, versesCount: 357 },
  { day: 24, juzNumber: 24, arabicName: 'فمن أظلم', juzName: 'Faman Azlam', startChapterId: 39, startVerse: 32, endChapterId: 41, endVerse: 46, versesCount: 175 },
  { day: 25, juzNumber: 25, arabicName: 'إليه يرد', juzName: 'Ilaihi Yuraddu', startChapterId: 41, startVerse: 47, endChapterId: 45, endVerse: 37, versesCount: 246 },
  { day: 26, juzNumber: 26, arabicName: 'حم', juzName: 'Ha Meem', startChapterId: 46, startVerse: 1, endChapterId: 51, endVerse: 30, versesCount: 195 },
  { day: 27, juzNumber: 27, arabicName: 'قال فما خطبكم', juzName: 'Qala Fama Khatbukum', startChapterId: 51, startVerse: 31, endChapterId: 57, endVerse: 29, versesCount: 399 },
  { day: 28, juzNumber: 28, arabicName: 'قد سمع الله', juzName: 'Qad Sami’allah', startChapterId: 58, startVerse: 1, endChapterId: 66, endVerse: 12, versesCount: 137 },
  { day: 29, juzNumber: 29, arabicName: 'تبارك الذي', juzName: 'Tabarakallazi', startChapterId: 67, startVerse: 1, endChapterId: 77, endVerse: 50, versesCount: 431 },
  { day: 30, juzNumber: 30, arabicName: 'عم يتساءلون', juzName: 'Amma Yatasa’aloon', startChapterId: 78, startVerse: 1, endChapterId: 114, endVerse: 6, versesCount: 564 },
];

export interface KhatmPlanState {
  startedAt: string | null;
  completedDays: number[];
  updatedAt: number;
}

export function normalizeKhatmState(raw: unknown): KhatmPlanState {
  const empty: KhatmPlanState = {
    startedAt: null,
    completedDays: [],
    updatedAt: 0,
  };
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as Partial<KhatmPlanState>;
  const startedAt =
    typeof obj.startedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.startedAt)
      ? obj.startedAt
      : null;
  const completedDays = Array.isArray(obj.completedDays)
    ? Array.from(
        new Set(
          obj.completedDays.filter(
            (d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 30
          )
        )
      ).sort((a, b) => a - b)
    : [];
  const updatedAt = typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : 0;
  return { startedAt, completedDays, updatedAt };
}

export function loadKhatmState(): KhatmPlanState {
  try {
    const raw = localStorage.getItem(KHATM_STORAGE_KEY);
    if (!raw) return normalizeKhatmState(null);
    return normalizeKhatmState(JSON.parse(raw));
  } catch {
    return normalizeKhatmState(null);
  }
}

export function saveKhatmState(state: KhatmPlanState): void {
  try {
    localStorage.setItem(KHATM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new Event(KHATM_EVENT));
}

export function getKhatmScheduleDay(startedAt: string | null, today: Date = new Date()): number {
  if (!startedAt) return 1;
  const [y, m, d] = startedAt.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const startUtc = Date.UTC(y, m - 1, d);
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.floor((todayUtc - startUtc) / 86400000) + 1;
  return Math.max(1, Math.min(30, diffDays));
}

export function getActivePortionDay(state: KhatmPlanState, today: Date = new Date()): number {
  const completedSet = new Set(state.completedDays);
  const scheduleDay = getKhatmScheduleDay(state.startedAt, today);
  if (state.startedAt && !completedSet.has(scheduleDay)) {
    return scheduleDay;
  }
  for (let d = 1; d <= 30; d += 1) {
    if (!completedSet.has(d)) return d;
  }
  return 30;
}

export function resolveJuzPortionLabel(
  dayMeta: JuzDivisionMeta,
  juzs: Juz[],
  chapters: Chapter[]
): {
  rangeText: string;
  keyRange: string;
  versesCount: number;
} {
  const apiJuz = juzs.find((j) => j.juz_number === dayMeta.juzNumber);
  let startChapterId = dayMeta.startChapterId;
  let startVerse = dayMeta.startVerse;
  let endChapterId = dayMeta.endChapterId;
  let endVerse = dayMeta.endVerse;
  let versesCount = dayMeta.versesCount;

  if (apiJuz?.verse_mapping) {
    const entries = Object.entries(apiJuz.verse_mapping).sort(([a], [b]) => Number(a) - Number(b));
    if (entries.length > 0) {
      const first = entries[0];
      const last = entries[entries.length - 1];
      const firstStart = Number(first[1].split('-')[0]);
      const lastParts = last[1].split('-');
      const lastEnd = Number(lastParts[lastParts.length - 1]);
      if (Number.isFinite(Number(first[0])) && Number.isFinite(firstStart)) {
        startChapterId = Number(first[0]);
        startVerse = firstStart;
      }
      if (Number.isFinite(Number(last[0])) && Number.isFinite(lastEnd)) {
        endChapterId = Number(last[0]);
        endVerse = lastEnd;
      }
    }
    if (typeof apiJuz.verses_count === 'number' && apiJuz.verses_count > 0) {
      versesCount = apiJuz.verses_count;
    }
  }

  const getSurahName = (id: number) =>
    chapters.find((c) => c.id === id)?.name_simple || SURAH_NAMES[id - 1] || `Surah ${id}`;

  const startSurah = getSurahName(startChapterId);
  const endSurah = getSurahName(endChapterId);
  const keyRange = `${startChapterId}:${startVerse} – ${endChapterId}:${endVerse}`;
  const rangeText =
    startChapterId === endChapterId
      ? `${startSurah} (${startChapterId}:${startVerse}–${endVerse})`
      : `${startSurah} ${startChapterId}:${startVerse} – ${endSurah} ${endChapterId}:${endVerse}`;

  return { rangeText, keyRange, versesCount };
}

export function useKhatmPlan() {
  const [state, setState] = useState<KhatmPlanState>(() => loadKhatmState());

  useEffect(() => {
    const sync = () => setState(loadKhatmState());
    window.addEventListener(KHATM_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(KHATM_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((updater: (prev: KhatmPlanState) => KhatmPlanState) => {
    setState((prev) => {
      const next = normalizeKhatmState(updater(prev));
      saveKhatmState(next);
      return next;
    });
  }, []);

  const startPlan = useCallback(() => {
    const todayKey = toLocalDateKey();
    update((prev) => ({
      ...prev,
      startedAt: prev.startedAt || todayKey,
      updatedAt: Date.now(),
    }));
  }, [update]);

  const restartPlan = useCallback(() => {
    const todayKey = toLocalDateKey();
    update(() => ({
      startedAt: todayKey,
      completedDays: [],
      updatedAt: Date.now(),
    }));
  }, [update]);

  const toggleDayComplete = useCallback(
    (dayNumber: number) => {
      if (dayNumber < 1 || dayNumber > 30) return;
      const todayKey = toLocalDateKey();
      update((prev) => {
        const exists = prev.completedDays.includes(dayNumber);
        const completedDays = exists
          ? prev.completedDays.filter((d) => d !== dayNumber)
          : [...prev.completedDays, dayNumber].sort((a, b) => a - b);
        return {
          startedAt: prev.startedAt || todayKey,
          completedDays,
          updatedAt: Date.now(),
        };
      });
    },
    [update]
  );

  const completedCount = state.completedDays.length;
  const percent = Math.round((completedCount / 30) * 100);
  const scheduleDay = getKhatmScheduleDay(state.startedAt);
  const activeDay = getActivePortionDay(state);
  const isCompleted = completedCount === 30;
  const hasStarted = Boolean(state.startedAt || completedCount > 0);

  return {
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
  };
}
