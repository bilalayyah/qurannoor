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

// L-7 (re-audit): the old generateVapidKeys()/toBase64Url() helpers were
// removed with first-run auto-generation — keypairs are now created once
// manually (see docs/vapid-rotation.md, "First-time setup") and the worker
// only reads them from KV.

async function ensureVapidKeys(kv: KVNamespace): Promise<{ publicKey: string; privateKey: string }> {
  const [existingPublic, existingPrivate] = await Promise.all([
    kv.get('vapid:public'),
    kv.get('vapid:private'),
  ]);

  if (existingPublic && existingPrivate) {
    return { publicKey: existingPublic, privateKey: existingPrivate };
  }

  // L-7 (re-audit): NEVER silently regenerate a pair when the stored one is
  // incomplete or missing.
  //
  // Only one half present: regenerating a brand-new pair would discard the
  // surviving half and invalidate every live subscription signed with it.
  // Fail loudly instead — an operator must restore the missing half
  // (see docs/vapid-rotation.md, "Incomplete keypair").
  if (existingPublic || existingPrivate) {
    throw new Error(
      'VAPID keypair is incomplete in KV: only one of vapid:public / vapid:private ' +
        'is present. Refusing to regenerate a mismatched pair — restore the ' +
        'missing half manually (see docs/vapid-rotation.md).'
    );
  }

  // Both halves missing: KV has no atomic compare-and-set, so a lease/lock
  // built on kv.put cannot prevent two concurrent first runs from each
  // generating a pair (last write wins, and subscriptions created against
  // the losing pair break). Fail loudly instead — generate the pair once
  // manually and write both halves to KV (see docs/vapid-rotation.md,
  // "First-time setup"). First-run auto-generation is intentionally gone.
  throw new Error(
    'No VAPID keypair in KV (vapid:public / vapid:private both missing). ' +
      'Generate a pair once and write both halves to KV ' +
      '(see docs/vapid-rotation.md, "First-time setup").'
  );
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

// NOTE (audit I-12, decision: KEEP): this daily-ayah payload is intentional
// daily-reminder behaviour, not the removed "Ayah of the Day" UI feature.
// The Ayah-of-the-Day section was removed from the site UI, but the daily
// push reminder deliberately still includes one ayah reference (verse key +
// link) so subscribers get a concrete daily reminder. Do not remove this
// function as part of the removed-feature cleanup.
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

function toSurahSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['`’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildReminderPayload(
  _record: StoredSubscription,
  ayahRef: { verseKey: string; chapterName: string }
): string {
  const verseNumber = ayahRef.verseKey.split(':')[1] || '1';
  const ayahUrl = `/ayah/${toSurahSlug(ayahRef.chapterName)}/${verseNumber}`;
  const body = `Your daily Quran reminder — Surah ${ayahRef.chapterName} (${ayahRef.verseKey})`;

  return JSON.stringify({
    title: 'QuranNoor',
    body,
    tag: 'daily-reminder',
    ayahKey: ayahRef.verseKey,
    url: ayahUrl,
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
