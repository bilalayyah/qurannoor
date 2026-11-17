import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Verse } from '../types/quran';

export function useHifzReader(
  verses: Verse[],
  activeVerseKey: string | null,
  hifzMode: boolean
) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(() => new Set());
  const [cursorKey, setCursorKey] = useState<string | null>(null);

  const firstKey = verses[0]?.verse_key || '';
  const verseCount = verses.length;

  useEffect(() => {
    setRevealedKeys(new Set());
    setCursorKey(null);
  }, [firstKey, verseCount, hifzMode]);

  const currentIdx = useMemo(() => {
    if (verses.length === 0) return -1;
    if (activeVerseKey) {
      const playingIdx = verses.findIndex((v) => v.verse_key === activeVerseKey);
      if (playingIdx !== -1) return playingIdx;
    }
    if (cursorKey) {
      const cIdx = verses.findIndex((v) => v.verse_key === cursorKey);
      if (cIdx !== -1) return cIdx;
    }
    return 0;
  }, [verses, activeVerseKey, cursorKey]);

  const nextBlurredKey = useMemo(() => {
    if (!hifzMode || currentIdx < 0 || currentIdx + 1 >= verses.length) {
      return null;
    }
    const nextVerseKey = verses[currentIdx + 1].verse_key;
    if (revealedKeys.has(nextVerseKey)) {
      return null;
    }
    return nextVerseKey;
  }, [hifzMode, currentIdx, verses, revealedKeys]);

  const revealVerse = useCallback((verseKey: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      next.add(verseKey);
      return next;
    });
    setCursorKey(verseKey);
  }, []);

  const isVerseBlurred = useCallback(
    (verseKey: string) => nextBlurredKey === verseKey,
    [nextBlurredKey]
  );

  return { isVerseBlurred, revealVerse };
}
