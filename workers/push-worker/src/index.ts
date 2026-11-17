import webpush from 'web-push';

export interface Env {
  PUSH_KV: KVNamespace;
  VAPID_SUBJECT?: string;
}

interface StoredSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  streak?: number;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;

  const rawPublic = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const jwkPrivate = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey;

  if (!jwkPrivate.d) {
    throw new Error('Failed to export P-256 private scalar for VAPID keypair.');
  }

  return {
    publicKey: toBase64Url(rawPublic),
    privateKey: jwkPrivate.d.replace(/=+$/, ''),
  };
}

async function ensureVapidKeys(kv: KVNamespace): Promise<{ publicKey: string; privateKey: string }> {
  const [existingPublic, existingPrivate] = await Promise.all([
    kv.get('vapid:public'),
    kv.get('vapid:private'),
  ]);

  if (existingPublic && existingPrivate) {
    return { publicKey: existingPublic, privateKey: existingPrivate };
  }

  const generated = await generateVapidKeys();
  await Promise.all([
    kv.put('vapid:public', generated.publicKey),
    kv.put('vapid:private', generated.privateKey),
  ]);

  return generated;
}

const TOTAL_QURAN_VERSES = 6236;

const SURAH_VERSE_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6,
];

const SURAH_NAMES: readonly string[] = [
  'Al-Fatihah', 'Al-Baqarah', "Ali 'Imran", 'An-Nisa', "Al-Ma'idah",
  "Al-An'am", "Al-A'raf", 'Al-Anfal', 'At-Tawbah', 'Yunus',
  'Hud', 'Yusuf', "Ar-Ra'd", 'Ibrahim', 'Al-Hijr',
  'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Taha',
  'Al-Anbya', 'Al-Hajj', "Al-Mu'minun", 'An-Nur', 'Al-Furqan',
  "Ash-Shu'ara", 'An-Naml', 'Al-Qasas', "Al-'Ankabut", 'Ar-Rum',
  'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir',
  'Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir',
  'Fussilat', 'Ash-Shuraa', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah',
  'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf',
  'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman',
  "Al-Waqi'ah", 'Al-Hadid', 'Al-Mujadila', 'Al-Hashr', 'Al-Mumtahanah',
  'As-Saf', "Al-Jumu'ah", 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq',
  'At-Tahrim', 'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', "Al-Ma'arij",
  'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah',
  'Al-Insan', 'Al-Mursalat', 'An-Naba', "An-Nazi'at", "'Abasa",
  'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq', 'Al-Buruj',
  'At-Tariq', "Al-A'la", 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad',
  'Ash-Shams', 'Al-Layl', 'Ad-Duhaa', 'Ash-Sharh', 'At-Tin',
  "Al-'Alaq", 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', "Al-'Adiyat",
  "Al-Qari'ah", 'At-Takathur', "Al-'Asr", 'Al-Humazah', 'Al-Fil',
  'Quraysh', "Al-Ma'un", 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr',
  'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas',
];

function getUtcDayOfYear(date: Date = new Date()): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const currentDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((currentDay - startOfYear) / 86_400_000) + 1;
}

function getAyahOfTheDayRef(date: Date = new Date()): {
  verseKey: string;
  chapterName: string;
} {
  const dayOfYear = getUtcDayOfYear(date);
  const seed = date.getUTCFullYear() * 366 + dayOfYear;
  const verseIndex = ((seed % TOTAL_QURAN_VERSES) + TOTAL_QURAN_VERSES) % TOTAL_QURAN_VERSES;

  let remaining = verseIndex;
  for (let i = 0; i < SURAH_VERSE_COUNTS.length; i += 1) {
    const count = SURAH_VERSE_COUNTS[i];
    if (remaining < count) {
      const chapterId = i + 1;
      const verseNumber = remaining + 1;
      return {
        verseKey: `${chapterId}:${verseNumber}`,
        chapterName: SURAH_NAMES[i] || `Surah ${chapterId}`,
      };
    }
    remaining -= count;
  }

  return { verseKey: '1:1', chapterName: 'Al-Fatihah' };
}

function buildReminderPayload(
  record: StoredSubscription,
  ayahRef: { verseKey: string; chapterName: string }
): string {
  const streak =
    typeof record.streak === 'number' && Number.isFinite(record.streak) && record.streak > 0
      ? Math.floor(record.streak)
      : 0;

  const baseGoal =
    streak > 0
      ? `Aaj ka Quran goal — 10 ayahs padhein (${streak}-day streak)`
      : 'Aaj ka Quran goal — 10 ayahs padhein';

  const body = `${baseGoal} · Ayah of the Day: Surah ${ayahRef.chapterName} (${ayahRef.verseKey})`;

  return JSON.stringify({
    title: 'QuranNoor',
    body,
    tag: 'daily-reminder',
    ayahKey: ayahRef.verseKey,
    url: '/',
  });
}

async function sendDailyReminders(env: Env): Promise<void> {
  const { publicKey, privateKey } = await ensureVapidKeys(env.PUSH_KV);
  const subject = env.VAPID_SUBJECT || 'mailto:support@qurannoor.com';
  const ayahRef = getAyahOfTheDayRef(new Date());

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let cursor: string | undefined;
  do {
    const page = await env.PUSH_KV.list({ prefix: 'sub:', cursor });

    for (const entry of page.keys) {
      const raw = await env.PUSH_KV.get(entry.name);
      if (!raw) continue;

      let record: StoredSubscription;
      try {
        record = JSON.parse(raw) as StoredSubscription;
      } catch {
        continue;
      }

      if (!record?.endpoint || !record?.keys?.p256dh || !record?.keys?.auth) {
        continue;
      }

      const payload = buildReminderPayload(record, ayahRef);

      try {
        await webpush.sendNotification(
          {
            endpoint: record.endpoint,
            expirationTime: record.expirationTime ?? null,
            keys: record.keys,
          },
          payload
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await env.PUSH_KV.delete(entry.name);
        }
      }
    }

    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

export default {
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(sendDailyReminders(env));
  },
};
