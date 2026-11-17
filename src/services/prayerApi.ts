import { toLocalDateKey } from '../utils/readingGoal';

export interface CalculationMethodOption {
  id: number;
  name: string;
  shortName: string;
}

export const DEFAULT_CALCULATION_METHOD = 1; // University of Islamic Sciences, Karachi

export const CALCULATION_METHODS: readonly CalculationMethodOption[] = [
  { id: 1, name: 'University of Islamic Sciences, Karachi', shortName: 'Karachi' },
  { id: 2, name: 'Islamic Society of North America (ISNA)', shortName: 'ISNA' },
  { id: 3, name: 'Muslim World League', shortName: 'MWL' },
  { id: 4, name: 'Umm Al-Qura University, Makkah', shortName: 'Makkah' },
  { id: 5, name: 'Egyptian General Authority of Survey', shortName: 'Egypt' },
  { id: 8, name: 'Gulf Region', shortName: 'Gulf' },
  { id: 9, name: 'Kuwait', shortName: 'Kuwait' },
  { id: 10, name: 'Qatar', shortName: 'Qatar' },
  { id: 11, name: 'Majlis Ugama Islam Singapura, Singapore', shortName: 'Singapore' },
  { id: 12, name: 'Union Organization Islamic de France', shortName: 'UOIF France' },
  { id: 13, name: 'Diyanet İşleri Başkanlığı, Turkey', shortName: 'Diyanet Turkey' },
  { id: 15, name: 'Moonsighting Committee Worldwide', shortName: 'Moonsighting' },
  { id: 16, name: 'Dubai', shortName: 'Dubai' },
];

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export interface FivePrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  Sunrise?: string;
}

export interface PrayerLocation {
  label: string;
  latitude: number;
  longitude: number;
  source: 'geolocation' | 'city';
}

export interface CitySearchResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface PrayerDayData {
  dateKey: string;
  readableDate: string;
  hijriDateText: string;
  timezone: string;
  methodId: number;
  methodName: string;
  location: PrayerLocation;
  timings: FivePrayerTimes;
  qiblaDirection: number;
  fetchedAt: number;
}

export interface PrayerPreferences {
  method: number;
  location: PrayerLocation | null;
}

const PREFS_KEY = 'qurannoor_prayer_prefs_v1';
const CACHE_KEY = 'qurannoor_prayer_cache_v1';

function buildCacheKey(dateKey: string, lat: number, lng: number, method: number): string {
  return `${dateKey}:${lat.toFixed(3)}:${lng.toFixed(3)}:m${method}`;
}

export function loadPrayerPreferences(): PrayerPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { method: DEFAULT_CALCULATION_METHOD, location: null };
    const parsed = JSON.parse(raw) as Partial<PrayerPreferences>;
    const methodValid = CALCULATION_METHODS.some((m) => m.id === parsed.method);
    const loc = parsed.location;
    const validLoc =
      loc &&
      typeof loc.label === 'string' &&
      typeof loc.latitude === 'number' &&
      Number.isFinite(loc.latitude) &&
      typeof loc.longitude === 'number' &&
      Number.isFinite(loc.longitude)
        ? {
            label: loc.label,
            latitude: loc.latitude,
            longitude: loc.longitude,
            source: loc.source === 'geolocation' ? ('geolocation' as const) : ('city' as const),
          }
        : null;
    return {
      method: methodValid && typeof parsed.method === 'number' ? parsed.method : DEFAULT_CALCULATION_METHOD,
      location: validLoc,
    };
  } catch {
    return { method: DEFAULT_CALCULATION_METHOD, location: null };
  }
}

export function savePrayerPreferences(prefs: PrayerPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

export function getCachedPrayerData(
  location: PrayerLocation,
  method: number,
  dateKey: string = toLocalDateKey()
): PrayerDayData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, PrayerDayData>;
    const key = buildCacheKey(dateKey, location.latitude, location.longitude, method);
    const entry = store[key];
    if (!entry || entry.dateKey !== dateKey) return null;
    return entry;
  } catch {
    return null;
  }
}

export function getLatestCachedPrayerDataForToday(dateKey: string = toLocalDateKey()): PrayerDayData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, PrayerDayData>;
    const entries = Object.values(store).filter((item) => item?.dateKey === dateKey);
    if (entries.length === 0) return null;
    entries.sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0));
    return entries[0];
  } catch {
    return null;
  }
}

function saveCachedPrayerData(data: PrayerDayData): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, PrayerDayData>) : {};
    // Keep only entries for today to keep storage bounded
    const next: Record<string, PrayerDayData> = {};
    for (const [k, v] of Object.entries(existing)) {
      if (v?.dateKey === data.dateKey) {
        next[k] = v;
      }
    }
    const key = buildCacheKey(data.dateKey, data.location.latitude, data.location.longitude, data.methodId);
    next[key] = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function stripTimezoneTag(timeStr: unknown): string {
  if (typeof timeStr !== 'string') return '';
  return timeStr.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function formatAladhanDateParam(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export async function fetchPrayerAndQiblaData({
  location,
  method,
  signal,
}: {
  location: PrayerLocation;
  method: number;
  signal?: AbortSignal;
}): Promise<PrayerDayData> {
  const now = new Date();
  const dateParam = formatAladhanDateParam(now);
  const dateKey = toLocalDateKey(now);

  const timingsUrl = `https://api.aladhan.com/v1/timings/${dateParam}?latitude=${encodeURIComponent(
    location.latitude
  )}&longitude=${encodeURIComponent(location.longitude)}&method=${encodeURIComponent(method)}`;
  const qiblaUrl = `https://api.aladhan.com/v1/qibla/${encodeURIComponent(
    location.latitude
  )}/${encodeURIComponent(location.longitude)}`;

  const [timingsRes, qiblaRes] = await Promise.all([
    fetch(timingsUrl, { signal }),
    fetch(qiblaUrl, { signal }),
  ]);

  if (!timingsRes.ok) {
    throw new Error(`Aladhan Prayer Times API returned HTTP ${timingsRes.status}`);
  }
  if (!qiblaRes.ok) {
    throw new Error(`Aladhan Qibla API returned HTTP ${qiblaRes.status}`);
  }

  const timingsJson = await timingsRes.json();
  const qiblaJson = await qiblaRes.json();

  const rawTimings = timingsJson?.data?.timings;
  if (
    !rawTimings?.Fajr ||
    !rawTimings?.Dhuhr ||
    !rawTimings?.Asr ||
    !rawTimings?.Maghrib ||
    !rawTimings?.Isha
  ) {
    throw new Error('Incomplete prayer times received from Aladhan API.');
  }

  const qiblaRaw = Number(qiblaJson?.data?.direction);
  if (!Number.isFinite(qiblaRaw)) {
    throw new Error('Invalid Qibla bearing received from Aladhan API.');
  }

  const hijri = timingsJson?.data?.date?.hijri;
  const hijriDateText =
    hijri?.day && hijri?.month?.en && hijri?.year
      ? `${hijri.day} ${hijri.month.en} ${hijri.year} AH`
      : '';

  const methodOption = CALCULATION_METHODS.find((m) => m.id === method);
  const methodName =
    timingsJson?.data?.meta?.method?.name || methodOption?.name || `Method ${method}`;

  const data: PrayerDayData = {
    dateKey,
    readableDate: timingsJson?.data?.date?.readable || dateParam,
    hijriDateText,
    timezone:
      timingsJson?.data?.meta?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    methodId: method,
    methodName,
    location,
    timings: {
      Fajr: stripTimezoneTag(rawTimings.Fajr),
      Sunrise: stripTimezoneTag(rawTimings.Sunrise),
      Dhuhr: stripTimezoneTag(rawTimings.Dhuhr),
      Asr: stripTimezoneTag(rawTimings.Asr),
      Maghrib: stripTimezoneTag(rawTimings.Maghrib),
      Isha: stripTimezoneTag(rawTimings.Isha),
    },
    qiblaDirection: ((qiblaRaw % 360) + 360) % 360,
    fetchedAt: Date.now(),
  };

  saveCachedPrayerData(data);
  return data;
}

export async function searchCitiesFree(
  query: string,
  signal?: AbortSignal
): Promise<CitySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    trimmed
  )}&count=6&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`City search returned HTTP ${res.status}`);
  }
  const json = await res.json();
  if (!Array.isArray(json?.results)) return [];
  return json.results
    .filter(
      (item: Record<string, unknown>) =>
        typeof item?.name === 'string' &&
        typeof item?.latitude === 'number' &&
        typeof item?.longitude === 'number'
    )
    .map((item: Record<string, unknown>) => ({
      id: Number(item.id) || Math.round(Number(item.latitude) * 10000 + Number(item.longitude)),
      name: String(item.name),
      admin1: typeof item.admin1 === 'string' ? item.admin1 : undefined,
      country: typeof item.country === 'string' ? item.country : undefined,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      timezone: typeof item.timezone === 'string' ? item.timezone : undefined,
    }));
}

export async function reverseGeocodeFree(latitude: number, longitude: number): Promise<string> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      latitude
    )}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Reverse geocode unavailable');
    const data = await res.json();
    const city = data?.city || data?.locality || data?.principalSubdivision;
    const country = data?.countryName;
    if (city && country) return `${city}, ${country}`;
    if (city) return String(city);
    if (country) return String(country);
  } catch {
    // Fallback to clean coordinates
  }
  return `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
}

function parseTimeToSeconds(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 3600 + m * 60;
}

function getCurrentSecondsInTimezone(timezone: string, now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getHours()) % 24;
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? now.getMinutes());
    const s = Number(parts.find((p) => p.type === 'second')?.value ?? now.getSeconds());
    return h * 3600 + m * 60 + s;
  } catch {
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  }
}

export function formatPrayerDisplayTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function getNextPrayerCountdown(
  timings: FivePrayerTimes,
  timezone: string,
  now: Date = new Date()
): {
  nextPrayer: PrayerName;
  nextTime24: string;
  countdownText: string;
  secondsRemaining: number;
} {
  const order: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const nowSec = getCurrentSecondsInTimezone(timezone, now);

  let nextPrayer: PrayerName = 'Fajr';
  let secondsRemaining = 0;

  let found = false;
  for (const name of order) {
    const sec = parseTimeToSeconds(timings[name]);
    if (sec > nowSec) {
      nextPrayer = name;
      secondsRemaining = sec - nowSec;
      found = true;
      break;
    }
  }

  if (!found) {
    nextPrayer = 'Fajr';
    const fajrSec = parseTimeToSeconds(timings.Fajr);
    secondsRemaining = Math.max(0, 86400 - nowSec + fajrSec);
  }

  const totalMins = Math.ceil(secondsRemaining / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  let countdownText: string;
  if (hours > 0) {
    countdownText = `${nextPrayer} in ${hours}h ${mins}m`;
  } else if (mins > 1) {
    countdownText = `${nextPrayer} in ${mins}m`;
  } else {
    countdownText = `${nextPrayer} in ${Math.max(1, secondsRemaining)}s`;
  }

  return {
    nextPrayer,
    nextTime24: timings[nextPrayer],
    countdownText,
    secondsRemaining,
  };
}

export function getCardinalDirection(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(normalized / 45) % 8;
  return dirs[idx];
}
