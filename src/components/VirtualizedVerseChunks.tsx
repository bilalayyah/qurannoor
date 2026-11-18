import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Verse } from '../types/quran';

export interface LoadedVerseChunk {
  page: number;
  verses: Verse[];
}

interface VirtualizedVerseChunksProps {
  chunks: LoadedVerseChunk[];
  activeVerseKey: string | null;
  highlightedVerseKey?: string | null;
  forcedMountPage?: number | null;
  mountRadius?: number;
  /** Changes when a display setting that affects chunk heights changes; cached heights are invalidated. */
  layoutKey?: string;
  renderVerse: (verse: Verse, flatIndex: number) => React.ReactNode;
}

/**
 * Renders loaded verse chunks while unloading far off-screen chunk subtrees into
 * measured height spacers so very long Surahs (e.g. Al-Baqarah, 286 ayahs) stay
 * responsive without scroll-position jumps.
 */
export function VirtualizedVerseChunks({
  chunks,
  activeVerseKey,
  highlightedVerseKey = null,
  forcedMountPage = null,
  mountRadius = 2,
  layoutKey,
  renderVerse,
}: VirtualizedVerseChunksProps) {
  const [anchorPage, setAnchorPage] = useState<number>(() => chunks[0]?.page ?? 1);
  const wrapperRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const measuredHeightsRef = useRef<Map<number, number>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  const pageKeyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const chunk of chunks) {
      for (const v of chunk.verses) {
        map.set(v.verse_key, chunk.page);
      }
    }
    return map;
  }, [chunks]);

  const prevForcedRef = useRef<number | null>(null);

  // Keep anchorPage within loaded chunk bounds whenever chunks reset or jump
  useEffect(() => {
    if (chunks.length === 0) return;
    if (forcedMountPage && forcedMountPage !== prevForcedRef.current && chunks.some((c) => c.page === forcedMountPage)) {
      prevForcedRef.current = forcedMountPage;
      setAnchorPage(forcedMountPage);
      return;
    }
    if (!forcedMountPage) {
      prevForcedRef.current = null;
    }
    if (!chunks.some((c) => c.page === anchorPage)) {
      setAnchorPage(chunks[0].page);
    }
  }, [chunks, anchorPage, forcedMountPage]);

  // Prune stale measurements for chunks that were reset/unloaded from memory
  useEffect(() => {
    const activePages = new Set(chunks.map((c) => c.page));
    for (const key of measuredHeightsRef.current.keys()) {
      if (!activePages.has(key)) {
        measuredHeightsRef.current.delete(key);
      }
    }
  }, [chunks]);

  // Invalidate cached chunk heights when display settings change (Arabic font
  // size, translations, Tajweed, script) — unmounted chunk spacers would
  // otherwise keep stale heights and scrolling back can jump. Chunks with no
  // measured height simply re-mount and re-measure, so clearing is safe.
  const prevLayoutKeyRef = useRef<string | undefined>(layoutKey);
  useEffect(() => {
    if (prevLayoutKeyRef.current !== layoutKey) {
      prevLayoutKeyRef.current = layoutKey;
      measuredHeightsRef.current.clear();
    }
  }, [layoutKey]);

  const updateAnchorFromScroll = useCallback(() => {
    if (chunks.length <= 1) return;
    const viewportMid = window.innerHeight * 0.42;
    let bestPage = anchorPage;
    let bestDistance = Infinity;

    for (const chunk of chunks) {
      const el = wrapperRefs.current.get(chunk.page);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= viewportMid && rect.bottom >= viewportMid) {
        bestPage = chunk.page;
        bestDistance = 0;
        break;
      }
      const dist =
        rect.top > viewportMid
          ? rect.top - viewportMid
          : viewportMid - rect.bottom;
      if (dist < bestDistance) {
        bestDistance = dist;
        bestPage = chunk.page;
      }
    }

    if (bestPage !== anchorPage) {
      setAnchorPage(bestPage);
    }
  }, [chunks, anchorPage]);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        updateAnchorFromScroll();
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [updateAnchorFromScroll]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const page = Number(el.dataset.chunkPage);
        if (!Number.isInteger(page)) continue;
        // Only overwrite stored height when children are actually mounted
        if (el.dataset.mounted === 'true') {
          const nextHeight = Math.round(el.getBoundingClientRect().height);
          if (nextHeight > 0) {
            measuredHeightsRef.current.set(page, nextHeight);
          }
        }
      }
    });
    resizeObserverRef.current = observer;

    for (const [, el] of wrapperRefs.current) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  const setWrapperRef = useCallback(
    (page: number) => (el: HTMLDivElement | null) => {
      const prev = wrapperRefs.current.get(page);
      if (prev && prev !== el) {
        resizeObserverRef.current?.unobserve(prev);
      }
      if (el) {
        wrapperRefs.current.set(page, el);
        resizeObserverRef.current?.observe(el);
        if (el.dataset.mounted === 'true') {
          const h = Math.round(el.getBoundingClientRect().height);
          if (h > 0) {
            measuredHeightsRef.current.set(page, h);
          }
        }
      } else {
        wrapperRefs.current.delete(page);
      }
    },
    []
  );

  const activeAudioPage = activeVerseKey ? pageKeyMap.get(activeVerseKey) ?? null : null;
  const highlightedPage = highlightedVerseKey ? pageKeyMap.get(highlightedVerseKey) ?? null : null;

  let runningFlatIndex = 0;

  return (
    <div>
      {chunks.map((chunk) => {
        const chunkStartIndex = runningFlatIndex;
        runningFlatIndex += chunk.verses.length;

        const measuredHeight = measuredHeightsRef.current.get(chunk.page) || 0;
        const nearViewport = Math.abs(chunk.page - anchorPage) <= mountRadius;
        const pinnedChunk =
          chunk.page === activeAudioPage ||
          chunk.page === highlightedPage ||
          chunk.page === forcedMountPage;

        // Only allow unloading once we have a real measured pixel height
        const shouldMount = nearViewport || pinnedChunk || measuredHeight === 0;

        return (
          <div
            key={chunk.page}
            ref={setWrapperRef(chunk.page)}
            data-chunk-page={chunk.page}
            data-mounted={shouldMount ? 'true' : 'false'}
          >
            {shouldMount ? (
              chunk.verses.map((verse, idxInChunk) =>
                renderVerse(verse, chunkStartIndex + idxInChunk)
              )
            ) : (
              <div
                aria-hidden="true"
                style={{ height: `${measuredHeight}px` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
