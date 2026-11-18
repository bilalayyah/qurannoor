import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface ThemedSelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  keywords?: string;
}

interface ThemedSelectProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  options: readonly ThemedSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  compact?: boolean;
  placement?: 'bottom' | 'top' | 'auto';
  align?: 'left' | 'right' | 'auto';
  disabled?: boolean;
  className?: string;
  emptyText?: string;
}

export function ThemedSelect({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  placeholder = 'Select an option…',
  searchPlaceholder = 'Search options…',
  searchable,
  compact = false,
  placement = 'auto',
  align = 'auto',
  disabled = false,
  className = 'w-full',
  emptyText = 'No options match your search',
}: ThemedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resolvedPlacement, setResolvedPlacement] = useState<'bottom' | 'top'>(
    placement === 'top' ? 'top' : 'bottom'
  );
  const [horizontalAlign, setHorizontalAlign] = useState<'left' | 'right'>(
    align === 'right' ? 'right' : 'left'
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const shouldShowSearch = searchable ?? options.length > 8;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.description || ''} ${opt.badge || ''} ${opt.keywords || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  // Compute optimal inline placement & horizontal alignment against viewport edges on open
  useEffect(() => {
    if (!isOpen) return;
    const triggerEl = containerRef.current;

    if (placement === 'top' || placement === 'bottom') {
      setResolvedPlacement(placement);
    } else if (triggerEl && typeof window !== 'undefined') {
      const rect = triggerEl.getBoundingClientRect();
      const estimatedHeight = shouldShowSearch ? 340 : Math.min(options.length * 46 + 16, 300);
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      setResolvedPlacement(spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');
    }

    if (align === 'left' || align === 'right') {
      setHorizontalAlign(align);
      return;
    }
    if (triggerEl && typeof window !== 'undefined') {
      const rect = triggerEl.getBoundingClientRect();
      const estimatedPanelWidth = Math.max(rect.width, compact ? 240 : 320);
      const overflowsRight = rect.left + estimatedPanelWidth > window.innerWidth - 16;
      const fitsOnLeft = rect.right - estimatedPanelWidth >= 16;
      setHorizontalAlign(overflowsRight && fitsOnLeft ? 'right' : 'left');
    }
  }, [isOpen, placement, align, compact, shouldShowSearch, options.length]);

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
        shouldShowSearch &&
        typeof window !== 'undefined' &&
        window.matchMedia?.('(pointer: fine)').matches
      ) {
        searchInputRef.current?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, shouldShowSearch]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setQuery('');
  };

  const isDisabled = disabled || options.length === 0;
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
        aria-label={ariaLabel || (selectedOption ? selectedOption.label : placeholder)}
        onClick={() => {
          if (isDisabled) return;
          setIsOpen((prev) => {
            if (prev) setQuery('');
            return !prev;
          });
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border text-left outline-none transition-all duration-150 disabled:opacity-60 ${
          compact ? 'min-h-[44px] px-3 py-1.5 text-xs' : 'min-h-[44px] px-3.5 py-2 text-sm'
        }`}
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border-subtle)',
          color: 'var(--text-primary)',
          boxShadow: isOpen ? '0 0 0 3px var(--accent-soft)' : undefined,
        }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {selectedOption ? (
            <>
              <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                {selectedOption.label}
              </span>
              {!compact && selectedOption.badge && (
                <span
                  className="hidden sm:inline-block shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
                  style={{
                    backgroundColor: 'var(--gold-soft)',
                    color: 'var(--gold)',
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="truncate" style={{ color: 'var(--text-tertiary)' }}>
              {placeholder}
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
            resolvedPlacement === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-1.5 origin-top'
          } ${
            fullWidthPanel
              ? 'left-0 right-0 w-full'
              : `${
                  horizontalAlign === 'right' ? 'right-0' : 'left-0'
                } ${compact ? 'w-[min(250px,calc(100vw-2rem))]' : 'w-[min(360px,calc(100vw-2rem))]'}`
          }`}
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-strong)',
            boxShadow:
              '0 18px 40px -12px rgba(14, 107, 75, 0.18), 0 6px 16px -4px rgba(26, 31, 28, 0.10)',
          }}
        >
          {shouldShowSearch && (
            <div
              className="border-b p-2"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div
                className="flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5 transition-colors focus-within:border-[var(--accent)]"
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
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
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
                    aria-label="Clear search"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel || placeholder}
            className="max-h-72 overflow-y-auto p-1.5 space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center space-y-2">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {emptyText}
                </p>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-xs font-medium hover:underline underline-offset-4"
                  style={{ color: 'var(--accent-text)' }}
                >
                  Show all {options.length} options
                </button>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className="group flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--bg-muted)]"
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
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span
                            className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide"
                            style={{
                              backgroundColor: isSelected
                                ? 'var(--bg-surface)'
                                : 'var(--gold-soft)',
                              color: 'var(--gold)',
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {opt.description}
                        </p>
                      )}
                    </div>

                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      {isSelected && (
                        <Check
                          className="h-4 w-4"
                          strokeWidth={2.5}
                          style={{ color: 'var(--accent-text)' }}
                        />
                      )}
                    </span>
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
