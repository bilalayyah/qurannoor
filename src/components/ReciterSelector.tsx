import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReader } from '../context/ReaderContext';
import type { Reciter } from '../types/quran';
import {
  formatReciterCombinedName,
  getReciterArabicName,
  getReciterStyleTags,
  matchesReciterQuery,
} from '../utils/reciters';

interface ReciterSelectorProps {
  id?: string;
  compact?: boolean;
  placement?: 'bottom' | 'top';
  align?: 'left' | 'right' | 'auto';
  className?: string;
}

export function formatReciterLabel(reciter: Reciter): string {
  const combined = formatReciterCombinedName(reciter);
  const tags = getReciterStyleTags(reciter);
  const details = [...tags, reciter.qirat].filter(Boolean);
  if (details.length === 0) return combined;
  return `${combined} (${details.join(' · ')})`;
}

export function ReciterSelector({
  id = 'reciter-selector',
  compact = false,
  placement = 'bottom',
  align = 'auto',
  className = '',
}: ReciterSelectorProps) {
  const { reciters, settings, updateSettings } = useReader();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [horizontalAlign, setHorizontalAlign] = useState<'left' | 'right'>(
    align === 'right' ? 'right' : 'left'
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const selectedReciter = useMemo(
    () => reciters.find((r) => r.id === settings.reciterId) ?? null,
    [reciters, settings.reciterId]
  );

  const filteredReciters = useMemo(
    () => reciters.filter((r) => matchesReciterQuery(r, query)),
    [reciters, query]
  );

  const selectedArabic = selectedReciter ? getReciterArabicName(selectedReciter) : '';
  const selectedTags = selectedReciter ? getReciterStyleTags(selectedReciter) : [];

  // Recompute horizontal anchoring against viewport edges on open
  useEffect(() => {
    if (!isOpen) return;
    if (align === 'left' || align === 'right') {
      setHorizontalAlign(align);
      return;
    }
    const triggerEl = containerRef.current;
    if (triggerEl && typeof window !== 'undefined') {
      const rect = triggerEl.getBoundingClientRect();
      const estimatedPanelWidth = Math.max(rect.width, 330);
      const overflowsRight = rect.left + estimatedPanelWidth > window.innerWidth - 16;
      const fitsOnLeft = rect.right - estimatedPanelWidth >= 16;
      setHorizontalAlign(overflowsRight && fitsOnLeft ? 'right' : 'left');
    }
  }, [isOpen, align]);

  // Outside click / tap + capture Escape handler (so parent drawers like ReaderSettings stay open)
  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  // Smoothly scroll inline dropdown into view and focus search on fine-pointer desktop
  useEffect(() => {
    if (!isOpen) return;
    const raf = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (
        typeof window !== 'undefined' &&
        window.matchMedia?.('(pointer: fine)').matches
      ) {
        searchInputRef.current?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen]);

  const handleSelect = (reciterId: number) => {
    updateSettings({ reciterId });
    setIsOpen(false);
    setQuery('');
  };

  const isDisabled = reciters.length === 0;
  const fullWidthPanel = className.includes('w-full') && !compact;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={
          selectedReciter
            ? `Select Quran Reciter: ${formatReciterCombinedName(selectedReciter)}`
            : 'Select Quran Reciter'
        }
        onClick={() => {
          if (isDisabled) return;
          setIsOpen((prev) => {
            if (prev) setQuery('');
            return !prev;
          });
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border text-left outline-none transition-all duration-150 disabled:opacity-60 ${
          compact ? 'min-h-[38px] px-3 py-1.5 text-xs' : 'min-h-[44px] px-3.5 py-2 text-sm'
        }`}
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border-subtle)',
          color: 'var(--text-primary)',
          boxShadow: isOpen ? '0 0 0 3px var(--accent-soft)' : undefined,
        }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {selectedReciter ? (
            <>
              <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                {selectedReciter.reciter_name}
              </span>
              {selectedArabic && (
                <>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xs"
                    style={{ color: 'var(--gold)' }}
                  >
                    —
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className="notranslate shrink-0 max-w-[46%] truncate font-quran-noto-naskh text-[13px] sm:text-[14px] leading-none pt-0.5"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {selectedArabic}
                  </span>
                </>
              )}
              {!compact && selectedTags[0] && (
                <span
                  className="hidden sm:inline-block shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
                  style={{
                    backgroundColor: 'var(--gold-soft)',
                    color: 'var(--gold)',
                  }}
                >
                  {selectedTags[0]}
                </span>
              )}
            </>
          ) : (
            <span className="truncate" style={{ color: 'var(--text-tertiary)' }}>
              Loading reciters…
            </span>
          )}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          style={{ color: isOpen ? 'var(--accent-text)' : 'var(--text-tertiary)' }}
        />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className={`absolute z-50 overflow-hidden rounded-2xl border transition-all duration-150 ${
            placement === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-1.5 origin-top'
          } ${
            fullWidthPanel
              ? 'left-0 right-0 w-full'
              : `${
                  horizontalAlign === 'right' ? 'right-0' : 'left-0'
                } w-[min(360px,calc(100vw-2rem))]`
          }`}
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-strong)',
            boxShadow:
              '0 18px 40px -12px rgba(14, 107, 75, 0.18), 0 6px 16px -4px rgba(26, 31, 28, 0.10)',
          }}
        >
          {/* Search / Filter Input */}
          <div
            className="border-b p-2"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              className="flex min-h-[38px] items-center gap-2 rounded-xl border px-2.5 transition-colors focus-within:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-text)' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reciter (English or Arabic)..."
                aria-label="Filter reciters"
                className="w-full bg-transparent text-xs sm:text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear reciter search"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Reciter List */}
          <div
            id={listboxId}
            role="listbox"
            aria-label="Available Reciters"
            className="max-h-72 overflow-y-auto p-1.5 space-y-0.5"
          >
            {filteredReciters.length === 0 ? (
              <div className="px-3 py-6 text-center space-y-2">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  No reciters match &ldquo;{query.trim()}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-xs font-medium hover:underline underline-offset-4"
                  style={{ color: 'var(--accent-text)' }}
                >
                  Show all {reciters.length} reciters
                </button>
              </div>
            ) : (
              filteredReciters.map((r) => {
                const isSelected = r.id === settings.reciterId;
                const arabicName = getReciterArabicName(r);
                const tags = getReciterStyleTags(r);

                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(r.id)}
                    className="group flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--bg-muted)]"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-soft)' : undefined,
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="text-xs sm:text-[13px] leading-snug"
                          style={{
                            color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)',
                            fontWeight: isSelected ? 600 : 500,
                          }}
                        >
                          {r.reciter_name}
                        </span>
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide"
                            style={{
                              backgroundColor: isSelected
                                ? 'var(--bg-surface)'
                                : 'var(--gold-soft)',
                              color: 'var(--gold)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      {r.qirat && r.qirat.toLowerCase() !== 'hafs' && (
                        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                          {r.qirat}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {arabicName && (
                        <span
                          dir="rtl"
                          lang="ar"
                          translate="no"
                          className="notranslate font-quran-noto-naskh text-[14px] sm:text-[15px] leading-none"
                          style={{
                            color: isSelected ? 'var(--accent-text)' : 'var(--text-secondary)',
                          }}
                        >
                          {arabicName}
                        </span>
                      )}
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                        {isSelected && (
                          <Check
                            className="h-4 w-4"
                            strokeWidth={2.5}
                            style={{ color: 'var(--accent-text)' }}
                          />
                        )}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
