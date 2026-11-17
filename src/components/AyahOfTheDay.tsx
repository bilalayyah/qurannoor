import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReader } from '../context/ReaderContext';
import { fetchVerseByKey } from '../services/quranApi';
import type { Verse } from '../types/quran';
import { getAyahOfTheDayRef } from '../utils/ayahOfTheDay';
import {
  getArabicFontClass,
  getEnglishTranslation,
  getUrduTranslation,
  stripHtmlTags,
  toArabicIndicDigits,
} from '../utils/text';

export function AyahOfTheDay() {
  const { settings, chapters } = useReader();
  const [ayahRef] = useState(() => getAyahOfTheDayRef());
  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const chapter = chapters.find((c) => c.id === ayahRef.chapterId);
  const chapterName = chapter?.name_simple || ayahRef.chapterName;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchVerseByKey({
      verseKey: ayahRef.verseKey,
      translationId: settings.translationId,
      reciterId: settings.reciterId,
    })
      .then((data) => {
        if (!cancelled) {
          setVerse(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ayahRef.verseKey, settings.translationId, settings.reciterId]);

  const arabicText = verse
    ? settings.script === 'indopak' && verse.text_indopak
      ? verse.text_indopak
      : verse.text_uthmani
    : '';

  const englishText = verse
    ? stripHtmlTags(getEnglishTranslation(verse.translations, settings.translationId)?.text || '')
    : '';

  const urduText = verse
    ? stripHtmlTags(getUrduTranslation(verse.translations)?.text || '')
    : '';

  const ayahUrl = `/ayah/${ayahRef.chapterSlug}/${ayahRef.verseNumber}`;

  return (
    <section aria-label="Ayah of the Day">
      <div
        className="rounded-2xl border p-6 sm:p-7"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: 'var(--accent-text)' }}
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--gold)' }} />
              <span>Ayah of the Day</span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>
              ·
            </span>
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: 'var(--text-secondary)' }}
            >
              Surah {chapterName} · {ayahRef.verseKey}
            </span>
          </div>

          <Link
            to={ayahUrl}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Read</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading && !verse ? (
          <div className="space-y-3 animate-pulse" aria-busy="true">
            <div
              className="h-9 w-3/4 ml-auto rounded-lg"
              style={{ backgroundColor: 'var(--bg-muted)' }}
            />
            <div
              className="h-4 w-5/6 rounded-lg"
              style={{ backgroundColor: 'var(--bg-muted)' }}
            />
            <div
              className="h-6 w-2/3 ml-auto rounded-lg"
              style={{ backgroundColor: 'var(--bg-muted)' }}
            />
          </div>
        ) : error && !verse ? (
          <div className="flex items-center justify-between gap-4 py-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Today’s featured verse is Surah {chapterName}, Ayah {ayahRef.verseNumber} ({ayahRef.verseKey}).
            </p>
            <Link
              to={ayahUrl}
              className="text-sm font-medium hover:underline underline-offset-4 shrink-0"
              style={{ color: 'var(--accent-text)' }}
            >
              Open Ayah →
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {arabicText && (
              <p
                dir="rtl"
                lang="ar"
                translate="no"
                className={`notranslate quran-arabic-text w-full text-right leading-[1.9] [word-spacing:0.02em] ${getArabicFontClass(
                  settings.arabicFont
                )}`}
                style={{
                  color: 'var(--text-primary)',
                  fontSize: `${settings.arabicFontSize}px`,
                }}
              >
                {arabicText}{' '}
                <span
                  className="inline-block select-none px-1 text-[0.76em] font-normal"
                  style={{ color: 'var(--gold)' }}
                  aria-label={`Ayah ${ayahRef.verseNumber}`}
                >
                  ﴿{toArabicIndicDigits(ayahRef.verseNumber)}﴾
                </span>
              </p>
            )}

            {englishText && (
              <p
                dir="ltr"
                className="font-editorial text-base sm:text-[17px] text-left leading-[1.78] max-w-3xl"
                style={{ color: 'var(--text-secondary)' }}
              >
                {englishText}
              </p>
            )}

            {urduText && (
              <p
                dir="rtl"
                lang="ur"
                className={`font-urdu w-full text-right text-[15px] leading-[2.1] [word-spacing:0.08em] ${
                  englishText ? 'border-t pt-3' : ''
                }`}
                style={{
                  color: 'var(--text-secondary)',
                  borderColor: englishText ? 'var(--border-subtle)' : undefined,
                }}
              >
                {urduText}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
