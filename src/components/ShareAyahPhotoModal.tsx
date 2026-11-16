import { toPng } from 'html-to-image';
import { Download, Loader2, Share2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReader } from '../context/ReaderContext';
import type { Verse } from '../types/quran';
import { toArabicIndicDigits } from '../utils/text';
import { QuranNoorMark } from './BrandLogo';

export type SharePhotoMode = 'arabic-only' | 'arabic-english';

interface ShareAyahPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  verse: Verse;
  chapterName: string;
  arabicText: string;
  translationText: string;
}

interface FittedLayout {
  arabicSize: number;
  englishSize: number;
  englishLineHeight: number;
  cardHeight: number;
}

const CARD_WIDTH = 1080;
const CARD_MIN_HEIGHT = 1920;
const MIN_ARABIC_FONT_SIZE = 34;

const NOTABLE_AYAH_TITLES: Record<string, string> = {
  '2:255': 'Ayatul Kursi',
};

function formatSurahReference(chapterName: string): string {
  const trimmed = chapterName.trim();
  return /^surah\s+/i.test(trimmed) ? trimmed : `Surah ${trimmed}`;
}

function getInitialFittedLayout(mode: SharePhotoMode): FittedLayout {
  return {
    arabicSize: mode === 'arabic-only' ? 84 : 68,
    englishSize: 34,
    englishLineHeight: 1.62,
    cardHeight: CARD_MIN_HEIGHT,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

interface AyahPhotoCardCanvasProps {
  mode: SharePhotoMode;
  arabicText: string;
  translationText: string;
  verseNumber: number;
  referenceLine: string;
  fitted: FittedLayout;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  slotRef?: React.RefObject<HTMLDivElement | null>;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  arabicRef?: React.RefObject<HTMLParagraphElement | null>;
  englishRef?: React.RefObject<HTMLParagraphElement | null>;
  isLongException: boolean;
}

function AyahPhotoCardCanvas({
  mode,
  arabicText,
  translationText,
  verseNumber,
  referenceLine,
  fitted,
  cardRef,
  slotRef,
  contentRef,
  arabicRef,
  englishRef,
  isLongException,
}: AyahPhotoCardCanvasProps) {
  const showEnglish = mode === 'arabic-english' && Boolean(translationText);

  return (
    <div
      ref={cardRef}
      style={{
        width: `${CARD_WIDTH}px`,
        height: isLongException && fitted.cardHeight > CARD_MIN_HEIGHT ? `${fitted.cardHeight}px` : `${CARD_MIN_HEIGHT}px`,
        minHeight: `${CARD_MIN_HEIGHT}px`,
        backgroundColor: '#FAF8F3',
        color: '#1A1F1C',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '44px',
        boxSizing: 'border-box',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Subtle warm radial glow accents */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 18%, rgba(184, 139, 58, 0.08) 0%, rgba(250, 248, 243, 0) 58%), radial-gradient(circle at 50% 85%, rgba(14, 107, 75, 0.06) 0%, rgba(250, 248, 243, 0) 55%)',
          pointerEvents: 'none',
        }}
      />

      {/* Outer deep emerald frame & inner antique gold hairline frame */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '32px',
          border: '3px solid #0E6B4B',
          borderRadius: '28px',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '46px',
          border: '1.5px solid rgba(184, 139, 58, 0.65)',
          borderRadius: '20px',
          pointerEvents: 'none',
        }}
      />

      {/* Top QuranNoor brand header */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          paddingTop: '46px',
          paddingBottom: '26px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          <QuranNoorMark size={56} tone="light" />
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: '40px',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              color: '#1A1F1C',
              lineHeight: 1,
            }}
          >
            Quran<span style={{ color: '#0E6B4B' }}>Noor</span>
          </span>
        </div>

        {/* Ornamental gold & emerald rule */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            width: '300px',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '1.5px',
              background: 'linear-gradient(90deg, rgba(184,139,58,0) 0%, #B88B3A 100%)',
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              transform: 'rotate(45deg)',
              border: '2px solid #B88B3A',
              backgroundColor: '#0E6B4B',
            }}
          />
          <div
            style={{
              flex: 1,
              height: '1.5px',
              background: 'linear-gradient(90deg, #B88B3A 0%, rgba(184,139,58,0) 100%)',
            }}
          />
        </div>
      </div>

      {/* Center verse content slot (auto-fitted to stay inside 9:16 frame) */}
      <div
        ref={slotRef}
        style={{
          position: 'relative',
          zIndex: 1,
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px 64px',
          overflow: isLongException ? 'visible' : 'hidden',
        }}
      >
        <div
          ref={contentRef}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: showEnglish ? '42px' : '0px',
          }}
        >
          <p
            ref={arabicRef}
            dir="rtl"
            lang="ar"
            translate="no"
            className="notranslate quran-arabic-text"
            style={{
              fontFamily: "'Scheherazade New', 'Noto Naskh Arabic', serif",
              fontSize: `${fitted.arabicSize}px`,
              lineHeight: 1.98,
              color: '#1A1F1C',
              textAlign: 'center',
              margin: 0,
              width: '100%',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
            }}
          >
            {arabicText}{' '}
            <span
              style={{
                color: '#B88B3A',
                display: 'inline-block',
                paddingInline: '8px',
                fontSize: '0.76em',
                fontWeight: 400,
              }}
            >
              ﴿{toArabicIndicDigits(verseNumber)}﴾
            </span>
          </p>

          {showEnglish && (
            <>
              <div
                aria-hidden="true"
                style={{
                  width: '150px',
                  height: '2px',
                  backgroundColor: 'rgba(184, 139, 58, 0.55)',
                  borderRadius: '999px',
                  flexShrink: 0,
                }}
              />
              <p
                ref={englishRef}
                style={{
                  fontFamily: "'Source Serif 4', Georgia, serif",
                  fontSize: `${fitted.englishSize}px`,
                  lineHeight: fitted.englishLineHeight,
                  color: '#3E4741',
                  textAlign: 'center',
                  margin: 0,
                  width: '100%',
                  maxWidth: '860px',
                  fontWeight: 400,
                }}
              >
                “{translationText}”
              </p>
            </>
          )}
        </div>
      </div>

      {/* Bottom reference & domain attribution */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          paddingTop: '28px',
          paddingBottom: '48px',
          paddingInline: '48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          flexShrink: 0,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '220px',
            height: '1.5px',
            backgroundColor: 'rgba(14, 107, 75, 0.25)',
            marginBottom: '6px',
          }}
        />
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: '28px',
            fontWeight: 600,
            color: '#0E6B4B',
            letterSpacing: '-0.01em',
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          {referenceLine}
        </p>
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: '23px',
            fontWeight: 500,
            color: '#B88B3A',
            letterSpacing: '0.08em',
            textAlign: 'center',
            margin: 0,
          }}
        >
          QuranNoor.com
        </p>
      </div>
    </div>
  );
}

export function ShareAyahPhotoModal({
  isOpen,
  onClose,
  verse,
  chapterName,
  arabicText,
  translationText,
}: ShareAyahPhotoModalProps) {
  const { showToast } = useReader();
  const hasTranslation = Boolean(translationText.trim());
  const [mode, setMode] = useState<SharePhotoMode>(
    hasTranslation ? 'arabic-english' : 'arabic-only'
  );
  const [fitted, setFitted] = useState<FittedLayout>(() =>
    getInitialFittedLayout(hasTranslation ? 'arabic-english' : 'arabic-only')
  );
  const [isFitting, setIsFitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const exportCardRef = useRef<HTMLDivElement | null>(null);
  const exportSlotRef = useRef<HTMLDivElement | null>(null);
  const exportContentRef = useRef<HTMLDivElement | null>(null);
  const exportArabicRef = useRef<HTMLParagraphElement | null>(null);
  const exportEnglishRef = useRef<HTMLParagraphElement | null>(null);

  const isLongException = verse.verse_key === '2:282';

  const referenceLine = useMemo(() => {
    const specialTitle = NOTABLE_AYAH_TITLES[verse.verse_key];
    const resolvedChapterName =
      verse.verse_key === '2:255' && /^ayatul\s+kursi$/i.test(chapterName.trim())
        ? 'Al-Baqarah'
        : chapterName;
    const base = `${formatSurahReference(resolvedChapterName)} • Ayah ${verse.verse_number}`;
    return specialTitle ? `${base} (${specialTitle})` : base;
  }, [chapterName, verse.verse_key, verse.verse_number]);

  const fileName = useMemo(() => {
    const [chapterId] = verse.verse_key.split(':');
    const suffix = mode === 'arabic-only' ? '-arabic' : '';
    return `qurannoor-${chapterId}-${verse.verse_number}${suffix}.png`;
  }, [mode, verse.verse_key]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (!hasTranslation && mode === 'arabic-english') {
      setMode('arabic-only');
    }
  }, [hasTranslation, isOpen, mode]);

  // Measure and auto-fit typography into the 1080x1920 9:16 canvas after fonts settle
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const runAutoFit = async () => {
      setIsFitting(true);
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (cancelled) return;

        const cardEl = exportCardRef.current;
        const slotEl = exportSlotRef.current;
        const contentEl = exportContentRef.current;
        const arabicEl = exportArabicRef.current;
        const englishEl = exportEnglishRef.current;

        if (!cardEl || !slotEl || !contentEl || !arabicEl) {
          if (!cancelled) {
            setFitted(getInitialFittedLayout(mode));
            setIsFitting(false);
          }
          return;
        }

        // Reset card height to strict 1920px before measuring
        cardEl.style.height = `${CARD_MIN_HEIGHT}px`;

        let arabicSize = mode === 'arabic-only' ? 84 : 68;
        let englishSize = 34;
        let englishLineHeight = 1.62;
        let cardHeight = CARD_MIN_HEIGHT;

        const applyStyles = () => {
          arabicEl.style.fontSize = `${arabicSize}px`;
          if (englishEl) {
            englishEl.style.fontSize = `${englishSize}px`;
            englishEl.style.lineHeight = String(englishLineHeight);
          }
          void contentEl.offsetHeight;
        };

        applyStyles();

        // Step down Arabic font size first (never below 34px) until content fits the 9:16 slot
        while (contentEl.scrollHeight > slotEl.clientHeight && arabicSize > MIN_ARABIC_FONT_SIZE) {
          arabicSize -= 2;
          if (mode === 'arabic-english' && englishEl) {
            englishSize = Math.max(24, Math.min(34, Math.round(arabicSize * 0.56)));
          }
          applyStyles();
        }

        // If Arabic + English still overflows at 34px Arabic:
        // - For standard ayahs, tighten English slightly (staying readable) so 9:16 stays exact.
        // - For 2:282 only, expand card height so long text never clips or shrinks below 34px.
        if (contentEl.scrollHeight > slotEl.clientHeight) {
          if (isLongException) {
            const overflowPx = contentEl.scrollHeight - slotEl.clientHeight;
            cardHeight = Math.ceil(CARD_MIN_HEIGHT + overflowPx + 36);
            cardEl.style.height = `${cardHeight}px`;
          } else if (mode === 'arabic-english' && englishEl) {
            while (contentEl.scrollHeight > slotEl.clientHeight && englishSize > 19) {
              englishSize -= 1;
              englishLineHeight = Math.max(1.44, Number((englishLineHeight - 0.03).toFixed(2)));
              applyStyles();
            }
          }
        }

        if (!cancelled) {
          setFitted({
            arabicSize,
            englishSize,
            englishLineHeight,
            cardHeight,
          });
        }
      } finally {
        if (!cancelled) {
          setIsFitting(false);
        }
      }
    };

    void runAutoFit();

    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, arabicText, translationText, isLongException]);

  if (!isOpen) return null;

  const generatePngFile = async (): Promise<{ dataUrl: string; file: File }> => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const target = exportCardRef.current;
    if (!target) {
      throw new Error('Card container is not ready');
    }

    const dataUrl = await toPng(target, {
      width: CARD_WIDTH,
      height: fitted.cardHeight,
      pixelRatio: 2,
      cacheBust: false,
      backgroundColor: '#FAF8F3',
    });

    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], fileName, { type: 'image/png' });
    return { dataUrl, file };
  };

  const triggerDownload = (dataUrl: string) => {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSharePhoto = async () => {
    if (isGenerating || isFitting) return;
    setIsGenerating(true);
    try {
      const { dataUrl, file } = await generatePngFile();
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: referenceLine,
            text: `${referenceLine} — QuranNoor.com`,
          });
          showToast('Shared Ayah photo');
          onClose();
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          // Fall through to PNG download if share sheet fails
        }
      }

      triggerDownload(dataUrl);
      showToast('Ayah photo downloaded (1080×1920 PNG)');
    } catch (err) {
      console.error('Share Ayah as Photo error:', err);
      showToast('Unable to generate Ayah photo');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadOnly = async () => {
    if (isGenerating || isFitting) return;
    setIsGenerating(true);
    try {
      const { dataUrl } = await generatePngFile();
      triggerDownload(dataUrl);
      showToast('Ayah photo downloaded (1080×1920 PNG)');
    } catch (err) {
      console.error('Download Ayah photo error:', err);
      showToast('Unable to download Ayah photo');
    } finally {
      setIsGenerating(false);
    }
  };

  // Preview scale fits cleanly in viewport without horizontal overflow
  const previewMaxWidth = 240;
  const previewScale = previewMaxWidth / CARD_WIDTH;
  const previewHeight = Math.round(fitted.cardHeight * previewScale);

  return createPortal(
    <>
      {/* Offscreen 1080px-wide node used for exact measurement & 2x PNG capture */}
      <div
        aria-hidden="true"
        data-ayah-photo-export="true"
        style={{
          position: 'fixed',
          left: '-12000px',
          top: 0,
          width: `${CARD_WIDTH}px`,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <AyahPhotoCardCanvas
          mode={mode}
          arabicText={arabicText}
          translationText={translationText}
          verseNumber={verse.verse_number}
          referenceLine={referenceLine}
          fitted={fitted}
          cardRef={exportCardRef}
          slotRef={exportSlotRef}
          contentRef={exportContentRef}
          arabicRef={exportArabicRef}
          englishRef={exportEnglishRef}
          isLongException={isLongException}
        />
      </div>

      {/* Modal Overlay */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${referenceLine} as Photo`}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div>
              <h2 className="text-base font-semibold tracking-tight">Share Ayah as Photo</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                9:16 WhatsApp Status ({CARD_WIDTH}×{fitted.cardHeight})
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Share as Photo dialog"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: 2 Options + Live 9:16 Preview */}
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Two required options */}
            <div
              role="radiogroup"
              aria-label="Photo content option"
              className="grid grid-cols-2 gap-2 p-1 rounded-xl border"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'arabic-only'}
                onClick={() => setMode('arabic-only')}
                className="min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: mode === 'arabic-only' ? 'var(--accent)' : 'transparent',
                  color: mode === 'arabic-only' ? '#FFFFFF' : 'var(--text-secondary)',
                }}
              >
                Arabic only
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={mode === 'arabic-english'}
                disabled={!hasTranslation}
                onClick={() => setMode('arabic-english')}
                className="min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: mode === 'arabic-english' ? 'var(--accent)' : 'transparent',
                  color: mode === 'arabic-english' ? '#FFFFFF' : 'var(--text-secondary)',
                }}
              >
                Arabic + English
              </button>
            </div>

            {/* Scaled Live Preview */}
            <div className="flex justify-center">
              <div
                className="relative rounded-xl overflow-hidden border shadow-md"
                style={{
                  width: `${previewMaxWidth}px`,
                  height: `${Math.min(previewHeight, 440)}px`,
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: '#FAF8F3',
                  overflowY: previewHeight > 440 ? 'auto' : 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${CARD_WIDTH}px`,
                    height: `${fitted.cardHeight}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <AyahPhotoCardCanvas
                    mode={mode}
                    arabicText={arabicText}
                    translationText={translationText}
                    verseNumber={verse.verse_number}
                    referenceLine={referenceLine}
                    fitted={fitted}
                    isLongException={isLongException}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            className="flex items-center gap-2.5 px-5 py-4 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <button
              type="button"
              onClick={handleSharePhoto}
              disabled={isGenerating || isFitting}
              className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {isGenerating || isFitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              <span>{isGenerating ? 'Preparing...' : 'Share Photo'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadOnly}
              disabled={isGenerating || isFitting}
              aria-label="Download PNG photo"
              title="Download PNG"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-60"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <Download className="h-4 w-4" />
              <span>Save PNG</span>
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
