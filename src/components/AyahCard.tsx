import {
  Bookmark,
  BookText,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Share2,
  Square,
  Volume2,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAudio, type PlayableAyah } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import type { Verse, VerseWord } from '../types/quran';
import { toSurahSlug } from '../utils/slugs';
import { renderTajweedNodes } from '../utils/tajweed';
import { URDU_AUDIO_CREDIT } from '../utils/urduAudio';
import {
  getArabicFontClass,
  getEnglishTranslation,
  getUrduTranslation,
  getVerseArabicText,
  getWordArabicText,
  stripHtmlTags,
  toArabicIndicDigits,
} from '../utils/text';
import { AyahTafsirSection } from './AyahTafsirSection';
import { ShareAyahPhotoModal } from './ShareAyahPhotoModal';

interface AyahCardProps {
  verse: Verse;
  chapterName: string;
  chapterArabicName: string;
  queue: PlayableAyah[];
  isHighlighted?: boolean;
  showChapterLink?: boolean;
  isHifzBlurred?: boolean;
  onRevealHifz?: () => void;
  showTafsirToggle?: boolean;
}

export function AyahCard({
  verse,
  chapterName,
  chapterArabicName,
  queue,
  isHighlighted = false,
  showChapterLink = false,
  isHifzBlurred = false,
  onRevealHifz,
  showTafsirToggle = true,
}: AyahCardProps) {
  const {
    settings,
    updateSettings,
    isBookmarked,
    toggleBookmark,
    recordAyahRead,
    showToast,
  } = useReader();
  const {
    isPlaying,
    isLoading,
    audioMode,
    activeVerseKey,
    playAyah,
    playEnglishTranslation,
    playUrduTranslation,
    togglePlayPause,
    stopAudio,
    ttsSupported,
  } = useAudio();

  const [menuOpen, setMenuOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{
    word: VerseWord;
    x: number;
    y: number;
  } | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const arabicContainerRef = useRef<HTMLDivElement | null>(null);
  const wordPopupRef = useRef<HTMLDivElement | null>(null);

  const [chapterIdStr] = verse.verse_key.split(':');
  const chapterId = Number(chapterIdStr);

  const isThisPlaying = activeVerseKey === verse.verse_key && isPlaying;
  const isThisArabicActive =
    activeVerseKey === verse.verse_key && audioMode === 'arabic' && isPlaying;
  const isThisUrduActive =
    activeVerseKey === verse.verse_key && audioMode === 'urdu' && (isPlaying || isLoading);
  const isThisEnglishActive =
    activeVerseKey === verse.verse_key && audioMode === 'english' && isPlaying;

  const bookmarked = isBookmarked(verse.verse_key);

  const arabicText = getVerseArabicText(verse, settings.script);

  const englishTranslation = getEnglishTranslation(verse.translations, settings.translationId);
  const cleanTranslation = stripHtmlTags(englishTranslation?.text ?? '');
  const urduTranslation = getUrduTranslation(verse.translations);
  const cleanUrdu = stripHtmlTags(urduTranslation?.text ?? '');

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
    if (activeVerseKey === verse.verse_key && isPlaying) {
      recordAyahRead(verse.verse_key);
    }
  }, [activeVerseKey, isPlaying, verse.verse_key, recordAyahRead]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    let timerId: number | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          if (timerId === null) {
            timerId = window.setTimeout(() => {
              recordAyahRead(verse.verse_key);
              timerId = null;
            }, 1200);
          }
        } else if (timerId !== null) {
          window.clearTimeout(timerId);
          timerId = null;
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
      observer.disconnect();
    };
  }, [verse.verse_key, recordAyahRead]);

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

  useEffect(() => {
    if (!selectedWord) return;
    const handleOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (wordPopupRef.current && target && wordPopupRef.current.contains(target)) {
        return;
      }
      if (target?.closest('[data-wbw-word="true"]')) {
        return;
      }
      setSelectedWord(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedWord(null);
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selectedWord]);

  useEffect(() => {
    if (isHifzBlurred) {
      setSelectedWord(null);
    }
  }, [isHifzBlurred]);

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

  const handleToggleUrduPlay = () => {
    if (isThisUrduActive) {
      stopAudio();
    } else {
      playUrduTranslation(playableItem, queue);
    }
  };

  return (
    <article
      ref={cardRef}
      id={`ayah-${verse.verse_key}`}
      className="border-b px-2.5 py-5 sm:px-5 sm:py-7 transition-colors rounded-2xl"
      style={{
        borderColor: 'var(--border-subtle)',
        backgroundColor:
          isThisPlaying || isHighlighted ? 'var(--highlight-ayah)' : 'transparent',
      }}
    >
      {/* Top Bar: Ayah Number & Metadata (left) + Prominent Action Buttons (right) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
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
            {`Juz ${verse.juz_number}`}
          </Link>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{`Page ${verse.page_number}`}</span>
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleArabicPlay}
            aria-label={isThisArabicActive ? `Pause Ayah ${verse.verse_key}` : `Play Ayah ${verse.verse_key}`}
            aria-pressed={isThisArabicActive}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-[0.98] whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent)',
            }}
          >
            {isThisArabicActive ? (
              <Pause className="h-4 w-4 fill-current shrink-0" />
            ) : (
              <Play className="h-4 w-4 fill-current shrink-0" />
            )}
            <span>{isThisArabicActive ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleUrduPlay}
            aria-label={
              isThisUrduActive
                ? `Stop Urdu audio for Ayah ${verse.verse_key} (${URDU_AUDIO_CREDIT})`
                : `Listen Urdu audio for Ayah ${verse.verse_key} (${URDU_AUDIO_CREDIT})`
            }
            aria-pressed={isThisUrduActive}
            title={URDU_AUDIO_CREDIT}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors hover:opacity-90 active:scale-[0.98] whitespace-nowrap"
            style={{
              backgroundColor: isThisUrduActive ? 'var(--accent)' : 'var(--accent-soft)',
              borderColor: isThisUrduActive
                ? 'var(--accent)'
                : 'color-mix(in srgb, var(--accent) 30%, transparent)',
              color: isThisUrduActive ? '#FFFFFF' : 'var(--accent-text)',
            }}
          >
            {isThisUrduActive ? (
              <Square className="h-3.5 w-3.5 fill-current shrink-0" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0" />
            )}
            <span>{isThisUrduActive ? 'Stop Urdu' : 'Urdu'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPhotoModalOpen(true)}
            aria-label={`Save Ayah ${verse.verse_key} as Photo`}
            title="Save as Photo"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors hover:opacity-90 active:scale-[0.98] whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent-soft)',
              borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
              color: 'var(--accent-text)',
            }}
          >
            <ImageIcon className="h-4 w-4 shrink-0" />
            <span>Photo</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAyah}
            aria-label={`Copy Ayah ${verse.verse_key}`}
            title="Copy Ayah"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: copied ? 'var(--accent)' : 'var(--border-subtle)',
              color: copied ? 'var(--accent-text)' : 'var(--text-primary)',
            }}
          >
            {copied ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <Copy className="h-4 w-4 shrink-0" />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

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
            aria-pressed={bookmarked}
            title={bookmarked ? 'Bookmarked' : 'Bookmark Ayah'}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: bookmarked ? 'var(--accent)' : 'var(--border-subtle)',
              backgroundColor: bookmarked ? 'var(--accent-soft)' : 'transparent',
              color: bookmarked ? 'var(--accent-text)' : 'var(--text-tertiary)',
            }}
          >
            <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`More options for ${verse.verse_key}`}
              aria-expanded={menuOpen}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-tertiary)',
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute left-0 sm:left-auto sm:right-0 top-12 z-20 w-48 rounded-xl border p-1.5 shadow-lg"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={handleRepeatThisAyah}
                  className="flex w-full min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  <span>Repeat Ayah</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareAyah}
                  className="flex w-full min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share Link</span>
                </button>

                {ttsSupported && cleanTranslation && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (activeVerseKey === verse.verse_key && audioMode === 'english') {
                        togglePlayPause();
                      } else {
                        playEnglishTranslation(playableItem, queue);
                      }
                    }}
                    className="flex w-full min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>{isThisEnglishActive ? 'Pause English' : 'Listen English'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center: Balanced Authentic Arabic Quran Text */}
      <div ref={arabicContainerRef} className="relative mb-1.5">
        <div
          className={
            isHifzBlurred
              ? 'blur-[8px] opacity-65 select-none pointer-events-none transition-all duration-200'
              : 'transition-all duration-200'
          }
          aria-hidden={isHifzBlurred}
        >
          <p
            dir="rtl"
            lang="ar"
            translate="no"
            className={`notranslate quran-arabic-text w-full text-right leading-[1.9] tracking-normal [word-spacing:0.02em] ${getArabicFontClass(
              settings.arabicFont
            )}`}
            style={{
              fontSize: `${settings.arabicFontSize}px`,
              color: 'var(--text-primary)',
            }}
          >
            {verse.words && verse.words.some((w) => w.char_type_name === 'word') ? (
              verse.words
                .filter((w) => w.char_type_name === 'word')
                .map((word) => {
                  const isWordSelected = selectedWord?.word.id === word.id;
                  const useTajweed =
                    settings.tajweedColors && Boolean(word.text_uthmani_tajweed);
                  const qpcWordText = getWordArabicText(word, 'uthmani');
                  const displayWord = getWordArabicText(
                    word,
                    settings.tajweedColors ? 'uthmani' : settings.script
                  );

                  return (
                    <Fragment key={word.id}>
                      <button
                        type="button"
                        data-wbw-word="true"
                        onClick={(e) => {
                          if (isHifzBlurred) return;
                          if (isWordSelected) {
                            setSelectedWord(null);
                            return;
                          }
                          const containerRect =
                            arabicContainerRef.current?.getBoundingClientRect();
                          const btnRect = e.currentTarget.getBoundingClientRect();
                          if (containerRect) {
                            const centerX =
                              btnRect.left - containerRect.left + btnRect.width / 2;
                            const clampedX = Math.max(
                              115,
                              Math.min(containerRect.width - 115, centerX)
                            );
                            const topY = btnRect.bottom - containerRect.top + 6;
                            setSelectedWord({ word, x: clampedX, y: topY });
                          } else {
                            setSelectedWord({ word, x: 140, y: 48 });
                          }
                        }}
                        aria-label={`Word: ${qpcWordText} (${word.translation?.text || ''})`}
                        className="inline cursor-pointer rounded border-0 p-0 m-0 transition-colors hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none"
                        style={{
                          backgroundColor: isWordSelected
                            ? 'var(--accent-soft)'
                            : undefined,
                        }}
                      >
                        {useTajweed
                          ? renderTajweedNodes(word.text_uthmani_tajweed!, qpcWordText)
                          : displayWord}
                      </button>{' '}
                    </Fragment>
                  );
                })
            ) : settings.tajweedColors && verse.text_uthmani_tajweed ? (
              renderTajweedNodes(
                verse.text_uthmani_tajweed,
                getVerseArabicText(verse, 'uthmani')
              )
            ) : (
              arabicText
            )}
            <span
              className="inline-block select-none px-1 text-[0.76em] font-normal"
              style={{ color: 'var(--gold)' }}
              aria-label={`Ayah ${verse.verse_number}`}
            >
              {` ﴿${toArabicIndicDigits(verse.verse_number)}﴾`}
            </span>
          </p>
        </div>

        {isHifzBlurred && onRevealHifz && (
          <button
            type="button"
            onClick={onRevealHifz}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-transparent cursor-pointer focus:outline-none"
            aria-label={`Reveal Ayah ${verse.verse_key} Arabic text`}
          >
            <span
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold shadow-sm"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--accent-text)',
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Tap to reveal Ayah {verse.verse_key}</span>
            </span>
          </button>
        )}

        {selectedWord && !isHifzBlurred && (
          <div
            ref={wordPopupRef}
            role="dialog"
            aria-label="Word meaning"
            className="absolute z-30 w-56 -translate-x-1/2 rounded-xl border p-3 shadow-lg"
            style={{
              left: `${selectedWord.x}px`,
              top: `${selectedWord.y}px`,
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <p
              dir="rtl"
              lang="ar"
              translate="no"
              className={`notranslate text-center leading-[1.8] ${getArabicFontClass(
                settings.arabicFont
              )}`}
              style={{ fontSize: `${settings.arabicFontSize}px`, color: 'var(--text-primary)' }}
            >
              {getWordArabicText(selectedWord.word, settings.script)}
            </p>
            {selectedWord.word.transliteration?.text && (
              <p
                className="mt-1 text-center text-xs italic"
                style={{ color: 'var(--accent-text)' }}
              >
                {selectedWord.word.transliteration.text}
              </p>
            )}
            {selectedWord.word.translation?.text && (
              <p
                className="mt-1 text-center text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {selectedWord.word.translation.text}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Below Arabic: English & Urdu Translations */}
      {settings.showTranslation && (cleanTranslation || cleanUrdu) && (
        <div className="mb-4 space-y-1.5">
          {cleanTranslation && (
            <p
              dir="ltr"
              className="font-editorial max-w-3xl text-left leading-[1.72]"
              style={{
                fontSize: `${settings.translationFontSize}px`,
                color: 'var(--text-secondary)',
              }}
            >
              {cleanTranslation}
            </p>
          )}
          {cleanUrdu && (
            <p
              dir="rtl"
              lang="ur"
              className={`font-urdu w-full text-right leading-[2.0] [word-spacing:0.08em] ${
                cleanTranslation ? 'border-t pt-1.5' : ''
              }`}
              style={{
                fontSize: `${Math.max(13, settings.translationFontSize - 2)}px`,
                color: 'var(--text-secondary)',
                borderColor: cleanTranslation ? 'var(--border-subtle)' : undefined,
              }}
            >
              {cleanUrdu}
            </p>
          )}
        </div>
      )}

      {/* Translation unavailable note */}
      {settings.showTranslation && !cleanTranslation && !cleanUrdu && (
        <p
          className="mb-4 text-xs italic"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Translation unavailable for this Ayah.
        </p>
      )}

      {/* Subtle Secondary Action Strip */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
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
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
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
          onClick={handleShareAyah}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Share</span>
        </button>

        <button
          type="button"
          onClick={handleRepeatThisAyah}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Repeat className="h-3.5 w-3.5" />
          <span>Repeat</span>
        </button>

        {showTafsirToggle && (
          <button
            type="button"
            onClick={() => setTafsirOpen((v) => !v)}
            aria-expanded={tafsirOpen}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              color: tafsirOpen ? 'var(--accent-text)' : 'var(--text-secondary)',
              backgroundColor: tafsirOpen ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <BookText className="h-3.5 w-3.5" />
            <span>Tafsir</span>
          </button>
        )}
      </div>

      {showTafsirToggle && (
        <AyahTafsirSection verseKey={verse.verse_key} isExpanded={tafsirOpen} />
      )}
      {photoModalOpen && (
        <ShareAyahPhotoModal
          isOpen={photoModalOpen}
          onClose={() => setPhotoModalOpen(false)}
          verse={verse}
          chapterName={chapterName}
          arabicText={arabicText}
          translationText={cleanTranslation}
        />
      )}
    </article>
  );
}
