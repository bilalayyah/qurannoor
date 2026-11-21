import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  chaptersCatalog,
  deduplicateJuzs,
  fetchFromQuranApi,
  filterEnglishTranslations,
  getEnvConfig,
  juzsCatalog,
  mergeReciters,
  normalizeAudioUrl,
  normalizeChapter,
  normalizeVersesAudio,
  type RawChapterReciter,
} from './server/quranClient.ts';
import { POPULAR_SECTIONS, toSurahSlug } from './src/utils/slugs.ts';
import { GUIDE_ARTICLES } from './src/data/guides.ts';
import type { Chapter, ChapterTimestamp, Juz, Reciter, TranslationResource, Verse } from './src/types/quran.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// API Environment Status
app.get('/api/env-status', (_req, res) => {
  const { clientId, clientSecret, env } = getEnvConfig();
  res.json({
    environment: env,
    appName: 'Noor Quran',
    isPrelive: env === 'prelive',
    hasCredentials: Boolean(clientId && clientSecret),
    scopes: [
      'content.quran.read',
      'content.translations.read',
      'content.audio.read',
      'content.tafsirs.read',
    ],
    supportedSurahs: env === 'prelive' ? [1, 2] : Array.from({ length: 114 }, (_, i) => i + 1),
    supportedJuzs: env === 'prelive' ? [1, 2] : Array.from({ length: 30 }, (_, i) => i + 1),
  });
});

// Preview fallbacks for Web Push endpoints (Cloudflare Pages Functions handle live KV)
app.get('/api/push/vapid-key', (_req, res) => {
  res.json({ publicKey: null, preview: true });
});

app.post('/api/push/subscribe', (_req, res) => {
  res.status(503).json({
    ok: false,
    preview: true,
    error: 'Push backend not connected in preview.',
  });
});

app.post('/api/push/unsubscribe', (_req, res) => {
  res.status(503).json({
    ok: false,
    preview: true,
    error: 'Push backend not connected in preview.',
  });
});

// GET /api/chapters & GET /api/quran/chapters
const handleChapters = async (_req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  try {
    const data = await fetchFromQuranApi<{ chapters: Chapter[] }>(
      '/chapters?language=en',
      1000 * 60 * 60
    );

    let allChapters: Chapter[] = [];
    if (env === 'prelive' && chaptersCatalog.length === 114) {
      // Merge live prelive chapters with complete 114 catalog so full directory is authentic
      const liveMap = new Map<number, Chapter>(data.chapters.map((c) => [c.id, c]));
      allChapters = chaptersCatalog.map((ch) => {
        const live = liveMap.get(ch.id);
        const resolved = normalizeChapter(live || ch);
        return {
          ...resolved,
          slug: toSurahSlug(resolved.name_simple),
          available_in_prelive: resolved.id <= 2,
        } as Chapter;
      });
    } else {
      allChapters = data.chapters.map((ch) => {
        const normalized = normalizeChapter(ch);
        return {
          ...normalized,
          slug: toSurahSlug(normalized.name_simple),
          available_in_prelive: true,
        };
      });
    }

    res.json({
      chapters: allChapters,
      environment: env,
      prelive_limited: env === 'prelive',
    });
  } catch (error) {
    // If upstream fails, fall back to authentic catalog with error status
    if (chaptersCatalog.length > 0) {
      const allChapters = chaptersCatalog.map((ch) => ({
        ...ch,
        slug: toSurahSlug(ch.name_simple),
        available_in_prelive: ch.id <= 2,
      }));
      res.json({
        chapters: allChapters,
        environment: env,
        prelive_limited: env === 'prelive',
        fallback: true,
      });
      return;
    }
    const message = error instanceof Error ? error.message : 'Failed to load chapters';
    res.status(502).json({ error: message });
  }
};
app.get('/api/chapters', handleChapters);
app.get('/api/quran/chapters', handleChapters);

// GET /api/chapters/:id & GET /api/quran/chapters/:id
const handleChapterDetails = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 114) {
    res.status(400).json({ error: 'Invalid Surah number. Must be between 1 and 114.' });
    return;
  }

  // Handle pre-live limitation gracefully
  if (env === 'prelive' && id > 2) {
    const catalogItem = chaptersCatalog.find((c) => c.id === id);
    res.status(404).json({
      error: `Surah ${id} (${catalogItem?.name_simple || 'Surah ' + id}) is not available in the Quran Foundation Pre-live sandbox. Pre-live developer credentials for 'Noor Quran' provide authenticated access to Surah 1 (Al-Fatihah) and Surah 2 (Al-Baqarah). Production API approval is required for Surahs 3 to 114.`,
      code: 'PRELIVE_LIMITED',
      chapterId: id,
      environment: 'prelive',
      chapter: catalogItem || null,
    });
    return;
  }

  try {
    const [chapterData, infoData] = await Promise.all([
      fetchFromQuranApi<{ chapter: Chapter }>(`/chapters/${id}?language=en`, 1000 * 60 * 60),
      fetchFromQuranApi<{ chapter_info?: { short_text?: string; source?: string } }>(
        `/chapters/${id}/info?language=en`,
        1000 * 60 * 60
      ).catch(() => ({ chapter_info: undefined })),
    ]);

    const normalizedChapter = normalizeChapter(chapterData.chapter);
    res.json({
      chapter: {
        ...normalizedChapter,
        slug: toSurahSlug(normalizedChapter.name_simple),
      },
      chapter_info: infoData.chapter_info ?? null,
      environment: env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Surah details';
    res.status(502).json({ error: message });
  }
};
app.get('/api/chapters/:id', handleChapterDetails);
app.get('/api/quran/chapters/:id', handleChapterDetails);

// GET /api/verses/by_chapter/:id & GET /api/quran/verses/chapter/:id
const handleVersesByChapter = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const chapterId = Number(req.params.id || req.params.chapterId);
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) {
    res.status(400).json({ error: 'Invalid Surah ID' });
    return;
  }

  if (env === 'prelive' && chapterId > 2) {
    res.status(404).json({
      error: `Surah ${chapterId} verses are not available in the Pre-live sandbox. Developer credentials for 'Noor Quran' currently grant access to Surah 1 (Al-Fatihah) and Surah 2 (Al-Baqarah). Production API access is required for Surahs 3 to 114.`,
      code: 'PRELIVE_LIMITED',
      chapterId,
      environment: 'prelive',
    });
    return;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(50, Math.max(1, Number(req.query.per_page) || 30));
  const rawTranslations = String(req.query.translations || req.query.translation || '20');
  const translationIds = rawTranslations
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n !== 234);
  const translation = translationIds.length > 0 ? translationIds.join(',') : '20';
  const reciter = Number(req.query.reciter) || 7;

  const query = new URLSearchParams({
    language: 'en',
    words: 'true',
    translations: translation,
    audio: String(reciter),
    fields: 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed',
    word_fields: 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed',
    page: String(page),
    per_page: String(perPage),
  });

  try {
    const data = await fetchFromQuranApi<{
      verses: Array<{ audio?: { url?: string } }>;
      pagination: unknown;
    }>(`/verses/by_chapter/${chapterId}?${query.toString()}`, 1000 * 60 * 10);

    res.json({
      verses: normalizeVersesAudio(data.verses),
      pagination: data.pagination,
      environment: env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Surah verses';
    res.status(502).json({ error: message });
  }
};
app.get('/api/verses/by_chapter/:id', handleVersesByChapter);
app.get('/api/quran/verses/chapter/:chapterId', handleVersesByChapter);

// GET /api/juz & GET /api/quran/juzs
const handleJuzs = async (_req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  try {
    const data = await fetchFromQuranApi<{ juzs: Juz[] }>('/juzs', 1000 * 60 * 60);
    let juzList = deduplicateJuzs(data.juzs);

    // If pre-live only returns 3 juzs, merge with authentic 30 juz catalog so user can see all 30 Juz
    if (env === 'prelive' && juzsCatalog.length === 30) {
      const liveMap = new Map<number, Juz>(juzList.map((j) => [j.juz_number, j]));
      juzList = deduplicateJuzs(juzsCatalog).map((jc) => {
        const live = liveMap.get(jc.juz_number);
        return {
          ...(live || jc),
          available_in_prelive: jc.juz_number <= 2,
        } as Juz & { available_in_prelive: boolean };
      });
    }

    res.json({ juzs: juzList, environment: env });
  } catch (error) {
    if (juzsCatalog.length === 30) {
      res.json({ juzs: deduplicateJuzs(juzsCatalog), environment: env, fallback: true });
      return;
    }
    const message = error instanceof Error ? error.message : 'Failed to load Juz list';
    res.status(502).json({ error: message });
  }
};
app.get('/api/juz', handleJuzs);
app.get('/api/juzs', handleJuzs);
app.get('/api/quran/juzs', handleJuzs);

// GET /api/verses/by_juz/:id & GET /api/quran/verses/juz/:id
const handleVersesByJuz = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const juzNumber = Number(req.params.id || req.params.juzNumber);
  if (!Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) {
    res.status(400).json({ error: 'Invalid Juz number. Must be between 1 and 30.' });
    return;
  }

  if (env === 'prelive' && juzNumber > 2) {
    res.status(404).json({
      error: `Juz ${juzNumber} is not available in the Pre-live API environment. The pre-live developer sandbox for 'Noor Quran' provides verses covering Juz 1 and Juz 2 (Surah Al-Fatihah and Al-Baqarah). Juz 3 to 30 require Production API approval.`,
      code: 'PRELIVE_LIMITED',
      juzId: juzNumber,
      environment: 'prelive',
    });
    return;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(50, Math.max(1, Number(req.query.per_page) || 30));
  const rawTranslations = String(req.query.translations || req.query.translation || '20');
  const translationIds = rawTranslations
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n !== 234);
  const translation = translationIds.length > 0 ? translationIds.join(',') : '20';
  const reciter = Number(req.query.reciter) || 7;

  const query = new URLSearchParams({
    language: 'en',
    words: 'true',
    translations: translation,
    audio: String(reciter),
    fields: 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed',
    word_fields: 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed',
    page: String(page),
    per_page: String(perPage),
  });

  try {
    const data = await fetchFromQuranApi<{
      verses: Array<{ audio?: { url?: string } }>;
      pagination: unknown;
    }>(`/verses/by_juz/${juzNumber}?${query.toString()}`, 1000 * 60 * 10);

    res.json({
      verses: normalizeVersesAudio(data.verses),
      pagination: data.pagination,
      environment: env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Juz verses';
    res.status(502).json({ error: message });
  }
};
app.get('/api/verses/by_juz/:id', handleVersesByJuz);
app.get('/api/quran/verses/juz/:juzNumber', handleVersesByJuz);

// GET /api/translations & GET /api/quran/resources/translations
const handleTranslations = async (_req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  try {
    const data = await fetchFromQuranApi<{
      translations: TranslationResource[];
    }>('/resources/translations?language=en', 1000 * 60 * 60);

    res.json({
      translations: filterEnglishTranslations(data.translations),
      environment: env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load translations';
    res.status(502).json({ error: message });
  }
};
app.get('/api/translations', handleTranslations);
app.get('/api/quran/resources/translations', handleTranslations);

// GET /api/recitations & GET /api/quran/resources/recitations
const handleRecitations = async (_req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  try {
    const [verseRes, chapterRes] = await Promise.allSettled([
      fetchFromQuranApi<{ recitations: Reciter[] }>(
        '/resources/recitations?language=en',
        1000 * 60 * 60
      ),
      fetchFromQuranApi<{ reciters: RawChapterReciter[] }>(
        '/resources/chapter_reciters?language=en',
        1000 * 60 * 60
      ),
    ]);

    const verseRecitations =
      verseRes.status === 'fulfilled' && Array.isArray(verseRes.value.recitations)
        ? verseRes.value.recitations
        : [];
    const chapterReciters =
      chapterRes.status === 'fulfilled' && Array.isArray(chapterRes.value.reciters)
        ? chapterRes.value.reciters
        : [];

    if (verseRecitations.length === 0 && chapterReciters.length === 0) {
      throw new Error('Failed to load reciters from Quran Foundation API');
    }

    const recitations = mergeReciters(verseRecitations, chapterReciters);

    res.json({
      recitations,
      total: recitations.length,
      environment: env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load reciters';
    res.status(502).json({ error: message });
  }
};
app.get('/api/recitations', handleRecitations);
app.get('/api/quran/resources/recitations', handleRecitations);

// GET /api/recitations/:reciterId/by_chapter/:chapterId
const handleRecitationByChapter = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const reciterId = Number(req.params.reciterId);
  const chapterId = Number(req.params.chapterId);

  if (!Number.isInteger(reciterId) || !Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) {
    res.status(400).json({ error: 'Invalid reciter or Surah ID' });
    return;
  }

  if (env === 'prelive' && chapterId > 2) {
    res.status(404).json({
      error: `Surah ${chapterId} recitation audio is not available in the Pre-live API environment. Pre-live sandbox provides Surah 1 and Surah 2. Production API access is required for Surahs 3 to 114.`,
      code: 'PRELIVE_LIMITED',
    });
    return;
  }

  try {
    const data = await fetchFromQuranApi<{
      audio_files: Array<{ verse_key: string; url: string }>;
    }>(`/recitations/${reciterId}/by_chapter/${chapterId}?per_page=300`, 1000 * 60 * 30);

    res.json({
      audio_files: (data.audio_files || []).map((f) => ({
        verse_key: f.verse_key,
        url: normalizeAudioUrl(f.url),
      })),
      environment: env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load chapter verse audio';
    res.status(502).json({ error: message });
  }
};
app.get('/api/recitations/:reciterId/by_chapter/:chapterId', handleRecitationByChapter);
app.get('/api/quran/recitations/:reciterId/by_chapter/:chapterId', handleRecitationByChapter);

// GET /api/audio & GET /api/quran/audio/chapter/:reciterId/:chapterId
const handleAudio = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const reciterId = Number(req.params.reciterId || req.query.reciter_id || req.query.reciterId || 7);
  const chapterId = Number(req.params.chapterId || req.query.chapter_id || req.query.chapterId || 1);
  const includeSegments = req.query.segments === 'true';

  if (!Number.isInteger(reciterId) || !Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) {
    res.status(400).json({ error: 'Invalid reciter or Surah ID' });
    return;
  }

  if (env === 'prelive' && chapterId > 2) {
    res.status(404).json({
      error: `Full Surah audio for Surah ${chapterId} is not available in the Pre-live API environment. Pre-live sandbox provides Surah 1 and Surah 2. Production API access is required for Surahs 3 to 114.`,
      code: 'PRELIVE_LIMITED',
    });
    return;
  }

  try {
    const queryStr = includeSegments ? '?segments=true' : '';
    const data = await fetchFromQuranApi<{
      audio_file: {
        audio_url?: string;
        file_size?: number;
        format?: string;
        timestamps?: ChapterTimestamp[];
      };
    }>(`/chapter_recitations/${reciterId}/${chapterId}${queryStr}`, 1000 * 60 * 30);

    res.json({
      audio_file: {
        ...data.audio_file,
        audio_url: normalizeAudioUrl(data.audio_file?.audio_url),
      },
      playback_type: 'chapter_file',
      environment: env,
    });
  } catch (chapterErr) {
    // Some official reciters (e.g. Minshawi Mujawwad ID 8, Tablawi ID 11) provide per-verse audio without a single chapter MP3.
    // Fall back to sequential verse-by-verse audio files when available.
    try {
      const verseData = await fetchFromQuranApi<{
        audio_files: Array<{ verse_key: string; url: string }>;
      }>(`/recitations/${reciterId}/by_chapter/${chapterId}?per_page=300`, 1000 * 60 * 30);

      if (Array.isArray(verseData.audio_files) && verseData.audio_files.length > 0) {
        res.json({
          audio_file: null,
          verse_audio_files: verseData.audio_files.map((f) => ({
            verse_key: f.verse_key,
            url: normalizeAudioUrl(f.url),
          })),
          playback_type: 'verse_sequence',
          environment: env,
        });
        return;
      }
    } catch {
      // ignore and throw original error
    }

    const message = chapterErr instanceof Error ? chapterErr.message : 'Failed to load chapter recitation';
    res.status(502).json({ error: message });
  }
};
app.get('/api/audio', handleAudio);
app.get('/api/audio/chapter/:reciterId/:chapterId', handleAudio);
app.get('/api/quran/audio/chapter/:reciterId/:chapterId', handleAudio);

// GET /api/search & GET /api/quran/search
const handleSearch = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.status(400).json({ error: 'Search query is required' });
    return;
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(30, Math.max(1, Number(req.query.size) || 20));
  const language = String(req.query.language || 'en');

  const query = new URLSearchParams({
    q,
    size: String(size),
    page: String(page),
    language,
  });

  try {
    const data = await fetchFromQuranApi<{ search: unknown }>(
      `/search?${query.toString()}`,
      1000 * 60 * 5
    );
    res.json(data);
  } catch (error) {
    // If upstream returns 403 insufficient scope in prelive, inform the client cleanly
    const isScopeError =
      error instanceof Error &&
      (error.message.includes('scope') || error.message.includes('insufficient_scope'));

    if (isScopeError || env === 'prelive') {
      res.json({
        search: {
          query: q,
          total_results: 0,
          current_page: page,
          total_pages: 0,
          results: [],
        },
        scope_status: {
          granted: false,
          missing_scope: 'content.search.read',
          message:
            'The upstream search scope is not active on this client; QuranNoor provides local full-text search across Arabic and English.',
        },
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Search failed';
    res.status(502).json({ error: message });
  }
};
app.get('/api/search', handleSearch);
app.get('/api/quran/search', handleSearch);

// GET /api/verses/key/:verseKey & GET /api/quran/verses/key/:verseKey
const handleVerseByKey = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const verseKey = req.params.verseKey;
  if (!/^\d{1,3}:\d{1,3}$/.test(verseKey)) {
    res.status(400).json({ error: 'Invalid verse key format. Expected Surah:Ayah (e.g. 2:255).' });
    return;
  }

  const [chIdStr] = verseKey.split(':');
  const chId = Number(chIdStr);
  if (env === 'prelive' && chId > 2) {
    res.status(404).json({
      error: `Verse ${verseKey} is in Surah ${chId}, which is not in the Pre-live sandbox. Pre-live credentials provide Surah 1 & 2. Production API approval is required for Surahs 3 to 114.`,
      code: 'PRELIVE_LIMITED',
    });
    return;
  }

  const rawTranslations = String(req.query.translations || req.query.translation || '20');
  const translationIds = rawTranslations
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n !== 234);
  const translation = translationIds.length > 0 ? translationIds.join(',') : '20';
  const reciter = Number(req.query.reciter) || 7;

  const query = new URLSearchParams({
    language: 'en',
    words: 'true',
    translations: translation,
    audio: String(reciter),
    fields: 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed',
    word_fields: 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed',
  });

  try {
    const data = await fetchFromQuranApi<{
      verse: { audio?: { url?: string } };
    }>(`/verses/by_key/${verseKey}?${query.toString()}`, 1000 * 60 * 10);

    const [normalized] = normalizeVersesAudio([data.verse]);
    res.json({ verse: normalized, environment: env });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load verse';
    res.status(502).json({ error: message });
  }
};
app.get('/api/verses/key/:verseKey', handleVerseByKey);
app.get('/api/quran/verses/key/:verseKey', handleVerseByKey);

// GET /api/verses/keys & GET /api/quran/verses/keys
const handleVersesByKeys = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const keysParam = String(req.query.keys || '');
  const keys = keysParam
    .split(',')
    .map((k) => k.trim())
    .filter((k) => /^\d{1,3}:\d{1,3}$/.test(k))
    .slice(0, 15);

  if (keys.length === 0) {
    res.status(400).json({ error: 'Provide one or more valid verse keys.' });
    return;
  }

  const rawTranslations = String(req.query.translations || req.query.translation || '20');
  const translationIds = rawTranslations
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n !== 234);
  const translation = translationIds.length > 0 ? translationIds.join(',') : '20';
  const reciter = Number(req.query.reciter) || 7;

  const query = new URLSearchParams({
    language: 'en',
    words: 'true',
    translations: translation,
    audio: String(reciter),
    fields: 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed',
    word_fields: 'text_qpc_hafs,text_uthmani,text_indopak,text_uthmani_tajweed',
  });

  try {
    const results = await Promise.all(
      keys.map(async (key) => {
        const [chIdStr] = key.split(':');
        const chId = Number(chIdStr);
        if (env === 'prelive' && chId > 2) {
          return null;
        }
        const d = await fetchFromQuranApi<{ verse: { audio?: { url?: string } } }>(
          `/verses/by_key/${key}?${query.toString()}`,
          1000 * 60 * 10
        );
        return normalizeVersesAudio([d.verse])[0];
      })
    );

    const filtered = results.filter(Boolean) as Verse[];
    if (filtered.length === 0 && keys.length > 0) {
      res.status(404).json({
        error: `Requested verses (${keys.join(', ')}) are awaiting Production API approval. The Pre-live developer sandbox provides Surahs 1 and 2.`,
        code: 'PRELIVE_LIMITED',
      });
      return;
    }

    res.json({ verses: filtered, environment: env });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load requested verses';
    res.status(502).json({ error: message });
  }
};
app.get('/api/verses/keys', handleVersesByKeys);
app.get('/api/quran/verses/keys', handleVersesByKeys);

// GET /api/tafsirs & GET /api/quran/resources/tafsirs
const handleTafsirsList = async (_req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  try {
    const data = await fetchFromQuranApi<{ tafsirs: unknown[] }>(
      '/resources/tafsirs?language=en',
      1000 * 60 * 60
    );
    res.json({ tafsirs: data.tafsirs || [], environment: env });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load tafsirs list';
    res.status(502).json({ error: message });
  }
};
app.get('/api/tafsirs', handleTafsirsList);
app.get('/api/quran/resources/tafsirs', handleTafsirsList);

// GET /api/tafsirs/:tafsirId/by_ayah/:verseKey
const handleTafsirByAyah = async (req: express.Request, res: express.Response) => {
  const { env } = getEnvConfig();
  const tafsirId = Number(req.params.tafsirId) || 169;
  const verseKey = String(req.params.verseKey || '');
  if (!Number.isInteger(tafsirId) || tafsirId < 1 || !/^\d{1,3}:\d{1,3}$/.test(verseKey)) {
    res.status(400).json({ error: 'Invalid tafsir ID or verse key format.' });
    return;
  }

  const [chIdStr] = verseKey.split(':');
  const chId = Number(chIdStr);
  if (env === 'prelive' && chId > 2) {
    res.status(404).json({
      error: `Tafsir for ${verseKey} is not in the Pre-live sandbox. Production API approval is required for Surahs 3 to 114.`,
      code: 'PRELIVE_LIMITED',
    });
    return;
  }

  try {
    const data = await fetchFromQuranApi<{
      tafsir?: Record<string, unknown>;
      tafsirs?: Array<Record<string, unknown>>;
    }>(`/tafsirs/${tafsirId}/by_ayah/${verseKey}`, 1000 * 60 * 30);
    res.json({
      tafsir: data.tafsir || (Array.isArray(data.tafsirs) ? data.tafsirs[0] : null) || null,
      environment: env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load tafsir';
    res.status(502).json({ error: message });
  }
};
app.get('/api/tafsirs/:tafsirId/by_ayah/:verseKey', handleTafsirByAyah);
app.get('/api/quran/tafsirs/:tafsirId/by_ayah/:verseKey', handleTafsirByAyah);

// AdSense & SEO: ads.txt, robots.txt & sitemap.xml
app.get('/ads.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.send('google.com, pub-5754238751997058, DIRECT, f08c47fec0942fa0\n');
});

app.get('/robots.txt', (req, res) => {
  const baseUrl =
    process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? process.env.APP_URL.replace(/\/$/, '')
      : `${req.protocol}://${req.get('host')}`;

  res.type('text/plain');
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /search',
      'Disallow: /bookmarks',
      `Sitemap: ${baseUrl}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

app.get('/sitemap.xml', async (req, res) => {
  const { env } = getEnvConfig();
  const baseUrl =
    process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? process.env.APP_URL.replace(/\/$/, '')
      : `${req.protocol}://${req.get('host')}`;

  try {
    const isPrelive = env === 'prelive';
    const chapters = chaptersCatalog.length === 114 ? chaptersCatalog : [];

    const corePaths = ['/', '/quran', '/surahs', '/juz', '/listen', '/prayer-times', '/guides'];
    const trustAndLegalPaths = [
      '/about',
      '/contact',
      '/privacy-policy',
      '/terms-and-conditions',
      '/disclaimer',
      '/cookie-policy',
      '/copyright',
      '/accessibility',
      '/quran-text-and-translation-methodology',
      '/brand',
    ];

    const surahPaths = (isPrelive ? chapters.filter((c) => c.id <= 2) : chapters).map(
      (ch) => `/surah/${toSurahSlug(ch.name_simple)}`
    );
    const juzPaths = Array.from({ length: isPrelive ? 2 : 30 }, (_, i) => `/juz/${i + 1}`);
    const popularPaths = POPULAR_SECTIONS.filter(
      (item) => item.type !== 'chapter' && (!isPrelive || item.chapterId <= 2)
    ).map((item) => `/popular/${item.slug}`);
    const featuredAyahPaths = [
      '/ayah/al-fatihah/1',
      '/ayah/al-baqarah/255',
      '/ayah/al-baqarah/285',
      '/ayah/al-baqarah/286',
    ];
    const guidePaths = GUIDE_ARTICLES.map((guide) => `/guides/${guide.slug}`);

    const allPaths = Array.from(
      new Set([
        ...corePaths,
        ...surahPaths,
        ...juzPaths,
        ...popularPaths,
        ...featuredAyahPaths,
        ...guidePaths,
        ...trustAndLegalPaths,
      ])
    );

    const lastmod = '2026-11-18';
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths
  .map((p) => {
    const priority =
      p === '/'
        ? '1.0'
        : p === '/quran' || p.startsWith('/surah/')
        ? '0.9'
        : p === '/guides' || p.startsWith('/juz/') || p.startsWith('/ayah/') || p.startsWith('/popular/')
        ? '0.8'
        : p.startsWith('/guides/')
        ? '0.7'
        : '0.6';
    const changefreq = p === '/' || p === '/quran' || p === '/guides' ? 'weekly' : 'monthly';
    return `  <url>
    <loc>${baseUrl}${p}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;

    res.type('application/xml');
    res.send(xml);
  } catch {
    res.status(500).send('Unable to generate sitemap');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quran website server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
