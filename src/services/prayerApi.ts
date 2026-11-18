function toDatePartsInTimezone(
  timezone: string,
  date: Date = new Date()
): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const getPart = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value);
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { year, month, day };
    }
  } catch {
    // fall through to device-local date below
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function toDateKeyInTimezone(timezone: string, date: Date = new Date()): string {
  const { year, month, day } = toDatePartsInTimezone(timezone, date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DEFAULT_CALCULATION_METHOD = 1; // University of Islamic Sciences, Karachi

// NOTE: the calculation method is intentionally NOT user-changeable (no picker UI).
// It is hard-coded to Karachi (method 1) for the Aladhan API call.

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
  timezone?: string;
  source: 'geolocation' | 'ip';
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
export const PRAYER_UPDATED_EVENT = 'qurannoor:prayer-updated';

function notifyPrayerUpdated(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(PRAYER_UPDATED_EVENT));
  } catch {
    // ignore event dispatch issues
  }
}

function buildCacheKey(dateKey: string, lat: number, lng: number, method: number): string {
  return `${dateKey}:${lat.toFixed(3)}:${lng.toFixed(3)}:m${method}`;
}

export function loadPrayerPreferences(): PrayerPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { method: DEFAULT_CALCULATION_METHOD, location: null };
    const parsed = JSON.parse(raw) as Partial<PrayerPreferences>;
    const methodValid =
      typeof parsed.method === 'number' &&
      Number.isInteger(parsed.method) &&
      parsed.method > 0;
    const loc = parsed.location;
    const validSource = loc?.source === 'geolocation' || loc?.source === 'ip';
    const validLoc: PrayerLocation | null =
      loc &&
      validSource &&
      typeof loc.label === 'string' &&
      typeof loc.latitude === 'number' &&
      Number.isFinite(loc.latitude) &&
      typeof loc.longitude === 'number' &&
      Number.isFinite(loc.longitude)
        ? {
            label: loc.label,
            latitude: loc.latitude,
            longitude: loc.longitude,
            timezone: typeof loc.timezone === 'string' && loc.timezone ? loc.timezone : undefined,
            source: loc.source === 'geolocation' ? 'geolocation' : 'ip',
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
    notifyPrayerUpdated();
  } catch {
    // ignore storage errors
  }
}

export function getCachedPrayerData(
  location: PrayerLocation,
  method: number,
  dateKey: string = toDateKeyInTimezone(
    location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  )
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

export function getActiveCachedPrayerDataForToday(dateKey: string = toLocalDateKey()): PrayerDayData | null {
  const prefs = loadPrayerPreferences();
  if (prefs.location) {
    const exact = getCachedPrayerData(prefs.location, prefs.method, dateKey);
    if (exact) return exact;
  }
  return getLatestCachedPrayerDataForToday(dateKey);
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
    notifyPrayerUpdated();
  } catch {
    // ignore storage errors
  }
}

function stripTimezoneTag(timeStr: unknown): string {
  if (typeof timeStr !== 'string') return '';
  return timeStr.replace(/\s*\([^)]*\)\s*$/, '').trim();
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
  // Request the date as it falls in the prayer's timezone (not the device's),
  // so a midnight boundary between the two zones cannot fetch the wrong day.
  const requestTimezone =
    location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const requestParts = toDatePartsInTimezone(requestTimezone, now);
  const dateParam = `${String(requestParts.day).padStart(2, '0')}-${String(
    requestParts.month
  ).padStart(2, '0')}-${requestParts.year}`;

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

  const methodName =
    timingsJson?.data?.meta?.method?.name || `Method ${method}`;

  const resolvedTimezone =
    location.timezone ||
    timingsJson?.data?.meta?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC';

  // Derive dateKey from the resolved prayer timezone (authoritative: Aladhan's
  // own Gregorian date for the returned timings), never from the device-local
  // date, so the cache label cannot land on yesterday/tomorrow at a midnight
  // boundary when the two timezones differ.
  let dateKey = toDateKeyInTimezone(resolvedTimezone, now);
  const gregorianDate = timingsJson?.data?.date?.gregorian?.date;
  if (typeof gregorianDate === 'string') {
    const match = gregorianDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      dateKey = `${match[3]}-${match[2]}-${match[1]}`;
    }
  }

  const data: PrayerDayData = {
    dateKey,
    readableDate: timingsJson?.data?.date?.readable || dateParam,
    hijriDateText,
    timezone: resolvedTimezone,
    methodId: method,
    methodName,
    location: {
      ...location,
      timezone: location.timezone || resolvedTimezone,
    },
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

function formatPlaceParts(parts: Array<unknown>): string {
  const cleaned = parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  return cleaned.join(', ');
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function reverseGeocodeFree(latitude: number, longitude: number): Promise<string> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      latitude
    )}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`;
    const data = await fetchJsonWithTimeout<{
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      countryName?: string;
    }>(url, 4500);
    const area = data?.locality || data?.city;
    const region =
      data?.principalSubdivision && data.principalSubdivision !== area
        ? data.principalSubdivision
        : data?.city && data.city !== area
        ? data.city
        : data?.principalSubdivision;
    const label = formatPlaceParts([area, region, data?.countryName]);
    if (label) return label;
  } catch {
    // Try secondary free reverse geocode below
  }

  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      latitude
    )}&lon=${encodeURIComponent(longitude)}&accept-language=en`;
    const nom = await fetchJsonWithTimeout<{
      address?: {
        suburb?: string;
        neighbourhood?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
      };
    }>(nomUrl, 4500);
    const addr = nom?.address;
    if (addr) {
      const area = addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.village;
      const cityOrState = addr.city || addr.state;
      const label = formatPlaceParts([
        area,
        cityOrState && cityOrState !== area ? cityOrState : addr.state,
        addr.country,
      ]);
      if (label) return label;
    }
  } catch {
    // Fallback to clean coordinates
  }

  return `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
}

export async function fetchIpLocationFree(): Promise<PrayerLocation | null> {
  // Primary: ipapi.co/json
  try {
    const data = await fetchJsonWithTimeout<{
      error?: boolean;
      city?: string;
      region?: string;
      country_name?: string;
      latitude?: number | string;
      longitude?: number | string;
      timezone?: string;
    }>('https://ipapi.co/json/', 4500);
    const lat = Number(data?.latitude);
    const lng = Number(data?.longitude);
    if (!data?.error && Number.isFinite(lat) && Number.isFinite(lng)) {
      const label =
        formatPlaceParts([data.city, data.region, data.country_name]) ||
        `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
      return {
        label,
        latitude: lat,
        longitude: lng,
        timezone:
          typeof data.timezone === 'string' && data.timezone
            ? data.timezone
            : Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        source: 'ip',
      };
    }
  } catch {
    // Fall through to secondary IP provider
  }

  // Secondary: ipwho.is
  try {
    const data = await fetchJsonWithTimeout<{
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
      latitude?: number | string;
      longitude?: number | string;
      timezone?: { id?: string };
    }>('https://ipwho.is/', 4500);
    const lat = Number(data?.latitude);
    const lng = Number(data?.longitude);
    if (data?.success !== false && Number.isFinite(lat) && Number.isFinite(lng)) {
      const label =
        formatPlaceParts([data.city, data.region, data.country]) ||
        `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
      return {
        label,
        latitude: lat,
        longitude: lng,
        timezone:
          typeof data.timezone?.id === 'string' && data.timezone.id
            ? data.timezone.id
            : Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        source: 'ip',
      };
    }
  } catch {
    // Fall through to tertiary IP provider
  }

  // Tertiary: get.geojs.io
  try {
    const data = await fetchJsonWithTimeout<{
      city?: string;
      region?: string;
      country?: string;
      latitude?: number | string;
      longitude?: number | string;
      timezone?: string;
    }>('https://get.geojs.io/v1/ip/geo.json', 4500);
    const lat = Number(data?.latitude);
    const lng = Number(data?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const label =
        formatPlaceParts([data.city, data.region, data.country]) ||
        `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
      return {
        label,
        latitude: lat,
        longitude: lng,
        timezone:
          typeof data.timezone === 'string' && data.timezone
            ? data.timezone
            : Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        source: 'ip',
      };
    }
  } catch {
    // All IP services unavailable
  }

  return null;
}

function getBrowserPositionAsync(timeoutMs = 5000): Promise<GeolocationPosition | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const guardTimer = globalThis.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs + 500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(guardTimer);
          resolve(pos);
        },
        () => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(guardTimer);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600000 }
      );
    } catch {
      if (!settled) {
        settled = true;
        globalThis.clearTimeout(guardTimer);
        resolve(null);
      }
    }
  });
}

let inFlightAutoDetect: Promise<PrayerLocation | null> | null = null;

export async function detectPrayerLocationAuto(options?: {
  forceRefresh?: boolean;
}): Promise<PrayerLocation | null> {
  const prefs = loadPrayerPreferences();
  if (!options?.forceRefresh && prefs.location) {
    return prefs.location;
  }

  if (inFlightAutoDetect) {
    return inFlightAutoDetect;
  }

  inFlightAutoDetect = (async () => {
    try {
      const deviceTz =
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
          : undefined;

      // 1. Try browser geolocation automatically (no tap required)
      const pos = await getBrowserPositionAsync(5000);
      if (pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const label = await reverseGeocodeFree(lat, lng);
        const loc: PrayerLocation = {
          label,
          latitude: lat,
          longitude: lng,
          timezone: deviceTz,
          source: 'geolocation',
        };
        const latestPrefs = loadPrayerPreferences();
        savePrayerPreferences({ method: latestPrefs.method, location: loc });
        return loc;
      }

      // 2. Fallback automatically to free IP geolocation
      const ipLoc = await fetchIpLocationFree();
      if (ipLoc) {
        const latestPrefs = loadPrayerPreferences();
        savePrayerPreferences({ method: latestPrefs.method, location: ipLoc });
        return ipLoc;
      }

      return null;
    } finally {
      inFlightAutoDetect = null;
    }
  })();

  return inFlightAutoDetect;
}

export async function loadOrDetectPrayerData(options?: {
  signal?: AbortSignal;
}): Promise<PrayerDayData | null> {
  const prefs = loadPrayerPreferences();
  const loc = prefs.location || (await detectPrayerLocationAuto());
  if (!loc) return null;

  const cached = getCachedPrayerData(loc, prefs.method);
  if (cached) return cached;

  return fetchPrayerAndQiblaData({
    location: loc,
    method: prefs.method,
    signal: options?.signal,
  });
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
  remainingText: string;
  countdownText: string;
  remainingWithSecondsText: string;
  countdownWithSecondsText: string;
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

  let remainingText: string;
  if (hours > 0) {
    remainingText = `${hours}h ${mins}m`;
  } else if (mins > 1) {
    remainingText = `${mins}m`;
  } else {
    remainingText = `${Math.max(1, secondsRemaining)}s`;
  }

  const countdownText = `${nextPrayer} in ${remainingText}`;

  const totalSec = Math.max(1, Math.floor(secondsRemaining));
  const exactHours = Math.floor(totalSec / 3600);
  const exactMins = Math.floor((totalSec % 3600) / 60);
  const exactSecs = totalSec % 60;
  const secsPadded = String(exactSecs).padStart(2, '0');

  let remainingWithSecondsText: string;
  if (exactHours > 0) {
    remainingWithSecondsText = `${exactHours}h ${exactMins}m ${secsPadded}s`;
  } else if (exactMins > 0) {
    remainingWithSecondsText = `${exactMins}m ${secsPadded}s`;
  } else {
    remainingWithSecondsText = `${exactSecs}s`;
  }

  const countdownWithSecondsText = `${nextPrayer} in ${remainingWithSecondsText}`;

  return {
    nextPrayer,
    nextTime24: timings[nextPrayer],
    remainingText,
    countdownText,
    remainingWithSecondsText,
    countdownWithSecondsText,
    secondsRemaining,
  };
}

export function getCardinalDirection(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(normalized / 45) % 8;
  return dirs[idx];
}
