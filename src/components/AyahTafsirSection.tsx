import { AlertCircle, BookText, ChevronDown, ChevronUp, Loader2, RotateCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_TAFSIR_ID, fetchVerseTafsir } from '../services/quranApi';
import type { TafsirContent } from '../types/quran';
import { getEmbeddedTafsir } from '../utils/prerenderData';
import { getShortTafsirSlice, parseTafsirBlocks } from '../utils/tafsir';

export type TafsirLanguage = 'arabic' | 'english' | 'urdu';

export const TAFSIR_LANG_STORAGE_KEY = 'qurannoor_tafsir_language_v1';
const TAFSIR_LANG_EVENT = 'qurannoor:tafsir-language-change';

export const TAFSIR_LANGUAGE_OPTIONS: ReadonlyArray<{
  id: TafsirLanguage;
  label: string;
  resourceId: number;
  title: string;
  defaultSourceName: string;
}> = [
  {
    id: 'arabic',
    label: 'Arabic',
    resourceId: 14,
    title: 'Tafsir Ibn Kathir · Arabic',
    defaultSourceName: 'Tafsir Ibn Kathir (Arabic)',
  },
  {
    id: 'english',
    label: 'English',
    resourceId: 169,
    title: 'Tafsir Ibn Kathir (Abridged) · English',
    defaultSourceName: 'Tafsir Ibn Kathir (Abridged)',
  },
  {
    id: 'urdu',
    label: 'Urdu',
    resourceId: 160,
    title: 'Tafsir Ibn Kathir · Urdu',
    defaultSourceName: 'Tafsir Ibn Kathir (Urdu)',
  },
];

function getStoredTafsirLanguage(): TafsirLanguage {
  try {
    const saved = localStorage.getItem(TAFSIR_LANG_STORAGE_KEY);
    if (saved === 'arabic' || saved === 'english' || saved === 'urdu') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'arabic';
}

interface AyahTafsirSectionProps {
  verseKey: string;
  isExpanded: boolean;
  standaloneCard?: boolean;
}

export function AyahTafsirSection({
  verseKey,
  isExpanded,
  standaloneCard = false,
}: AyahTafsirSectionProps) {
  // H-1: default language on first render (= the prerendered HTML); the
  // stored language is applied by the mount effect below, after hydration,
  // so a returning user with a non-default tafsir language still hydrates
  // against the default-Arabic snapshot.
  const [language, setLanguage] = useState<TafsirLanguage>('arabic');
  // H-1: seed the tafsir from the embedded prerender data (the same
  // /api/tafsirs response the snapshot was rendered from), so the first
  // client render shows the loaded tafsir instead of the "No tafsir"
  // empty state. Falls back to fetching when the data is absent.
  const [tafsir, setTafsir] = useState<TafsirContent | null>(() =>
    getEmbeddedTafsir(DEFAULT_TAFSIR_ID, verseKey)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  // H-1: when the tafsir was seeded, mark its request as already fetched so
  // the mount fetch effect skips it (no redundant fetch, no loading flicker).
  const fetchedRequestKeyRef = useRef<string | null>(
    tafsir ? `${verseKey}:${DEFAULT_TAFSIR_ID}:0` : null
  );

  // H-1: apply the stored tafsir language AFTER the first render
  // (post-hydration). Changing the language clears the seeded tafsir via
  // the reset effect below and fetches the stored language's tafsir.
  useEffect(() => {
    setLanguage(getStoredTafsirLanguage());
  }, []);

  const activeOption = useMemo(
    () =>
      TAFSIR_LANGUAGE_OPTIONS.find((opt) => opt.id === language) ??
      TAFSIR_LANGUAGE_OPTIONS[0],
    [language]
  );

  // Sync chosen language across multiple expanded Tafsir sections
  useEffect(() => {
    const handleSync = (ev: Event) => {
      const next = (ev as CustomEvent<TafsirLanguage>).detail;
      if (next === 'arabic' || next === 'english' || next === 'urdu') {
        setLanguage(next);
      }
    };
    window.addEventListener(TAFSIR_LANG_EVENT, handleSync);
    return () => window.removeEventListener(TAFSIR_LANG_EVENT, handleSync);
  }, []);

  const handleLanguageChange = (nextLang: TafsirLanguage) => {
    if (nextLang === language) return;
    try {
      localStorage.setItem(TAFSIR_LANG_STORAGE_KEY, nextLang);
    } catch {
      // ignore storage errors
    }
    setLanguage(nextLang);
    window.dispatchEvent(new CustomEvent<TafsirLanguage>(TAFSIR_LANG_EVENT, { detail: nextLang }));
  };

  useEffect(() => {
    setTafsir(null);
    setError(null);
    setShowFull(false);
    setLoading(false);
    setRetryCount(0);
    fetchedRequestKeyRef.current = null;
  }, [verseKey, activeOption.resourceId]);

  useEffect(() => {
    if (!isExpanded) return;

    const requestKey = `${verseKey}:${activeOption.resourceId}:${retryCount}`;
    if (fetchedRequestKeyRef.current === requestKey) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchVerseTafsir(verseKey, activeOption.resourceId)
      .then((data) => {
        if (!cancelled) {
          fetchedRequestKeyRef.current = requestKey;
          setTafsir(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load tafsir.');
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
  }, [isExpanded, verseKey, activeOption.resourceId, retryCount]);

  const blocks = useMemo(
    () => (tafsir?.text ? parseTafsirBlocks(tafsir.text) : []),
    [tafsir?.text]
  );

  const { visible, hasMore } = useMemo(() => {
    if (showFull) return { visible: blocks, hasMore: blocks.length > 3 };
    return getShortTafsirSlice(blocks, 750);
  }, [blocks, showFull]);

  if (!isExpanded) return null;

  const apiSourceName =
    tafsir?.resource_name || tafsir?.translated_name?.name || activeOption.defaultSourceName;

  const containerClasses = standaloneCard
    ? 'rounded-2xl border p-6 sm:p-8'
    : 'mt-5 rounded-xl border p-4 sm:p-5';

  return (
    <div
      className={containerClasses}
      style={{
        backgroundColor: standaloneCard ? 'var(--bg-surface)' : 'var(--bg-canvas)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label={`Tafsir for Ayah ${verseKey}`}
    >
      <div
        className="mb-3 flex flex-wrap items-center justify-between gap-2.5 border-b pb-2.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <BookText className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
          <div className="min-w-0">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--accent-text)' }}
            >
              {activeOption.title}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
              {`Source: Quran Foundation API · ${apiSourceName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Tafsir language"
            className="inline-flex rounded-lg p-0.5"
            style={{ backgroundColor: 'var(--bg-muted)' }}
          >
            {TAFSIR_LANGUAGE_OPTIONS.map((opt) => {
              const active = language === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleLanguageChange(opt.id)}
                  aria-pressed={active}
                  className="min-h-[44px] rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? 'var(--accent-text)' : 'var(--text-tertiary)',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            {verseKey}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading {activeOption.title}…</span>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs"
          style={{
            borderColor: 'color-mix(in srgb, #dc2626 35%, var(--border-subtle))',
            backgroundColor: 'color-mix(in srgb, #dc2626 6%, var(--bg-surface))',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--accent-text)',
            }}
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          No tafsir commentary is available for Ayah {verseKey}.
        </p>
      ) : (
        <div
          dir={language === 'english' ? 'ltr' : 'rtl'}
          lang={language === 'arabic' ? 'ar' : language === 'urdu' ? 'ur' : 'en'}
          className="space-y-3"
        >
          {visible.map((block, idx) => {
            if (block.type === 'arabic') {
              return (
                <p
                  key={idx}
                  dir="rtl"
                  lang="ar"
                  translate="no"
                  className="notranslate font-quran-scheherazade quran-arabic-text text-base sm:text-lg leading-[1.85] !py-0"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {block.text}
                </p>
              );
            }

            if (language === 'arabic') {
              if (block.type === 'heading') {
                return (
                  <h4
                    key={idx}
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className="notranslate font-quran-scheherazade quran-arabic-text text-base sm:text-lg font-semibold pt-1 leading-[1.8] !py-0"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {block.text}
                  </h4>
                );
              }
              return (
                <p
                  key={idx}
                  dir="rtl"
                  lang="ar"
                  translate="no"
                  className="notranslate font-quran-scheherazade quran-arabic-text text-base sm:text-lg leading-[1.85] !py-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {block.text}
                </p>
              );
            }

            if (language === 'urdu') {
              if (block.type === 'heading') {
                return (
                  <h4
                    key={idx}
                    dir="rtl"
                    lang="ur"
                    className="font-urdu text-base sm:text-lg font-semibold pt-1 leading-[2.2]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {block.text}
                  </h4>
                );
              }
              return (
                <p
                  key={idx}
                  dir="rtl"
                  lang="ur"
                  className="font-urdu text-base sm:text-[18px] leading-[2.3]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {block.text}
                </p>
              );
            }

            if (block.type === 'heading') {
              return (
                <h4
                  key={idx}
                  className="text-sm font-semibold pt-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {block.text}
                </h4>
              );
            }

            return (
              <p
                key={idx}
                className="font-editorial text-sm sm:text-[15px] leading-[1.75]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {block.text}
              </p>
            );
          })}

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowFull((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-1 text-xs font-medium hover:underline underline-offset-4"
              style={{ color: 'var(--accent-text)' }}
            >
              <span>{showFull ? 'Show shorter summary' : 'Read full tafsir'}</span>
              {showFull ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
