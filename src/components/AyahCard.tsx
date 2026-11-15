import {
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Share2,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAudio, type PlayableAyah } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import type { Verse } from '../types/quran';
import { toSurahSlug } from '../utils/slugs';
import {
  getArabicFontClass,
  stripHtmlTags,
  toArabicIndicDigits,
} from '../utils/text';

interface AyahCardProps {
  verse: Verse;
  chapterName: string;
  chapterArabicName: string;
  queue: PlayableAyah[];
  isHighlighted?: boolean;
  showChapterLink?: boolean;
}

export function AyahCard({
  verse,
  chapterName,
  chapterArabicName,
  queue,
  isHighlighted = false,
  showChapterLink = false,
}: AyahCardProps) {
  const { settings, updateSettings, isBookmarked, toggleBookmark, showToast } = useReader();
  const {
    isPlaying,
    audioMode,
    activeVerseKey,
    playAyah,
    playEnglishTranslation,
    togglePlayPause,
    ttsSupported,
  } = useAudio();

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [chapterIdStr] = verse.verse_key.split(':');
  const chapterId = Number(chapterIdStr);

  const isThisPlaying = activeVerseKey === verse.verse_key && isPlaying;
  const isThisArabicActive =
    activeVerseKey === verse.verse_key && audioMode === 'arabic' && isPlaying;
  const isThisEnglishActive =
    activeVerseKey === verse.verse_key && audioMode === 'english' && isPlaying;

  const bookmarked = isBookmarked(verse.verse_key);

  const arabicText =
    settings.script === 'indopak' && verse.text_indopak
      ? verse.text_indopak
      : verse.text_uthmani;

  const translationRaw = verse.translations?.[0]?.text ?? '';
  const cleanTranslation = stripHtmlTags(translationRaw);

  const playableItem: PlayableAyah = {
    verseKey: verse.verse_key,
    chapterId,
    verseNumber: verse.verse_number,
    chapterName,
    audioUrl: verse.audio?.url,
    translationText: cleanTranslation,
  };

  useEffect(() => {
    if (activeVerseKey === verse.verse_key && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeVerseKey, verse.verse_key]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const handleCopyAyah = async () => {
    const content = `${arabicText}\n\n"${cleanTranslation}"\n— Quran ${verse.verse_key} (${chapterName})`;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      showToast(`Copied ${verse.verse_key}`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Unable to copy to clipboard');
    }
    setMenuOpen(false);
  };

  const handleShareAyah = async () => {
    const shareUrl = `${window.location.origin}/ayah/${toSurahSlug(
      chapterName
    )}/${verse.verse_number}`;
    const shareText = `${arabicText}\n\n${cleanTranslation}\n— Quran ${verse.verse_key}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Quran ${verse.verse_key} · ${chapterName}`,
          text: shareText,
          url: shareUrl,
        });
        setMenuOpen(false);
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Ayah link copied to clipboard');
    } catch {
      showToast('Unable to share link');
    }
    setMenuOpen(false);
  };

  const handleRepeatThisAyah = () => {
    updateSettings({ repeatAyah: true });
    playAyah(playableItem, queue);
    setMenuOpen(false);
    showToast(`Repeating Ayah ${verse.verse_key}`);
  };

  const handleToggleArabicPlay = () => {
    if (activeVerseKey === verse.verse_key && audioMode === 'arabic') {
      togglePlayPause();
    } else {
      playAyah(playableItem, queue);
    }
  };

  return (
    <article
      ref={cardRef}
      id={`ayah-${verse.verse_key}`}
      className="border-b px-3 py-8 sm:px-6 sm:py-10 transition-colors rounded-2xl"
      style={{
        borderColor: 'var(--border-subtle)',
        backgroundColor:
          isThisPlaying || isHighlighted ? 'var(--highlight-ayah)' : 'transparent',
      }}
    >
      {/* Top Bar: Ayah Number (left) + Bookmark icon, Play icon, More options (right) */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          <Link
            to={`/ayah/${toSurahSlug(chapterName)}/${verse.verse_number}`}
            aria-label={`Open dedicated page for Ayah ${verse.verse_key}`}
            className="text-sm font-semibold tabular-nums hover:underline underline-offset-4"
            style={{ color: 'var(--accent-text)' }}
          >
            {verse.verse_key}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            to={`/juz/${verse.juz_number}`}
            className="tabular-nums hover:underline underline-offset-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            Juz {verse.juz_number}
          </Link>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">Page {verse.page_number}</span>
          {showChapterLink && (
            <>
              <span aria-hidden="true">·</span>
              <Link
                to={`/surah/${toSurahSlug(chapterName)}?ayah=${verse.verse_number}`}
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent-text)' }}
              >
                <span>Open Surah</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              toggleBookmark({
                verseKey: verse.verse_key,
                chapterId,
                verseNumber: verse.verse_number,
                chapterName,
                chapterArabicName,
                textArabic: arabicText,
                translationSnippet: cleanTranslation,
              })
            }
            aria-label={bookmarked ? `Remove bookmark ${verse.verse_key}` : `Bookmark ${verse.verse_key}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              color: bookmarked ? 'var(--accent-text)' : 'var(--text-tertiary)',
            }}
          >
            <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleToggleArabicPlay}
            aria-label={isThisArabicActive ? `Pause Ayah ${verse.verse_key}` : `Play Ayah ${verse.verse_key}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              color: isThisArabicActive ? 'var(--accent-text)' : 'var(--text-tertiary)',
            }}
          >
            {isThisArabicActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`More options for ${verse.verse_key}`}
              aria-expanded={menuOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-10 z-20 w-48 rounded-xl border p-1.5 shadow-lg"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={handleCopyAyah}
                  className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Copy Ayah</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareAyah}
                  className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share Ayah</span>
                </button>

                <button
                  type="button"
                  onClick={handleRepeatThisAyah}
                  className="flex w-full min-h-[38px] items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  <span>Repeat Ayah</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center: Large Authentic Arabic Quran Text */}
      <div className="mb-6">
        <p
          dir="rtl"
          lang="ar"
          translate="no"
          className={`notranslate quran-arabic-text leading-[2.25] tracking-normal ${getArabicFontClass(
            settings.arabicFont
          )}`}
          style={{
            fontSize: `${settings.arabicFontSize}px`,
            color: 'var(--text-primary)',
          }}
        >
          {arabicText}{' '}
          <span
            className="inline-block select-none px-1.5 text-[0.74em] font-normal"
            style={{ color: 'var(--gold)' }}
            aria-label={`Ayah ${verse.verse_number}`}
          >
            ﴿{toArabicIndicDigits(verse.verse_number)}﴾
          </span>
        </p>
      </div>

      {/* Below Arabic: English Translation */}
      {settings.showTranslation && cleanTranslation && (
        <div className="mb-6 max-w-3xl">
          <p
            className="font-editorial leading-[1.78]"
            style={{
              fontSize: `${settings.translationFontSize}px`,
              color: 'var(--text-secondary)',
            }}
          >
            {cleanTranslation}
          </p>
        </div>
      )}

      {/* Clean Distraction-Free Ayah Action Row */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        <button
          type="button"
          onClick={handleToggleArabicPlay}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            color: isThisArabicActive ? 'var(--accent-text)' : 'var(--text-secondary)',
            backgroundColor: isThisArabicActive ? 'var(--accent-soft)' : 'transparent',
          }}
        >
          {isThisArabicActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span>{isThisArabicActive ? 'Pause' : 'Play Ayah'}</span>
        </button>

        {ttsSupported && cleanTranslation && (
          <button
            type="button"
            onClick={() => {
              if (activeVerseKey === verse.verse_key && audioMode === 'english') {
                togglePlayPause();
              } else {
                playEnglishTranslation(playableItem, queue);
              }
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              color: isThisEnglishActive ? 'var(--accent-text)' : 'var(--text-secondary)',
              backgroundColor: isThisEnglishActive ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>{isThisEnglishActive ? 'Pause English' : 'Listen English'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleCopyAyah}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>Copy</span>
        </button>

        <button
          type="button"
          onClick={handleShareAyah}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Share</span>
        </button>

        <button
          type="button"
          onClick={handleRepeatThisAyah}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Repeat className="h-3.5 w-3.5" />
          <span>Repeat</span>
        </button>
      </div>
    </article>
  );
}
