import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  type ChapterAudioResponse,
  fetchChapterAudioData,
  fetchVerseByKey,
  fetchVersesByKeys,
} from '../services/quranApi';
import type { Verse } from '../types/quran';
import { stripHtmlTags } from '../utils/text';
import { useReader } from './ReaderContext';

export type AudioMode = 'arabic' | 'english';
export type PlaybackKind = 'ayah' | 'surah' | 'translation';

export interface PlayableAyah {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  chapterName: string;
  audioUrl?: string;
  translationText?: string;
}

interface ActiveSegment {
  verseKey: string;
  startSec: number;
  endSec: number;
  indexInQueue: number;
}

interface SurahSequenceState {
  chapterId: number;
  chapterName: string;
  files: Array<{ verse_key: string; url: string }>;
  index: number;
}

interface AudioContextValue {
  isPlaying: boolean;
  isLoading: boolean;
  audioMode: AudioMode;
  playbackKind: PlaybackKind | null;
  activeVerseKey: string | null;
  activeChapterId: number | null;
  activeChapterName: string;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  error: string | null;
  ttsSupported: boolean;
  availableVoices: SpeechSynthesisVoice[];
  playAyah: (ayah: PlayableAyah, queue?: PlayableAyah[]) => void;
  playVerseKeys: (keys: string[], title: string) => void;
  playFullSurah: (chapterId: number, chapterName: string) => void;
  playEnglishTranslation: (ayah: PlayableAyah, queue?: PlayableAyah[]) => void;
  togglePlayPause: () => void;
  stopAudio: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setAudioMode: (mode: AudioMode) => void;
  updateQueue: (queue: PlayableAyah[]) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { settings, showToast } = useReader();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioMode, setAudioModeState] = useState<AudioMode>('arabic');
  const [playbackKind, setPlaybackKind] = useState<PlaybackKind | null>(null);
  const [activeVerseKey, setActiveVerseKey] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [activeChapterName, setActiveChapterName] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const queueRef = useRef<PlayableAyah[]>([]);
  const activeIndexRef = useRef<number>(-1);
  const playbackKindRef = useRef<PlaybackKind | null>(null);
  playbackKindRef.current = playbackKind;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const playbackRequestIdRef = useRef(0);
  const activeSegmentRef = useRef<ActiveSegment | null>(null);
  const segmentAdvancingRef = useRef(false);
  const surahSequenceRef = useRef<SurahSequenceState | null>(null);
  const segmentCacheRef = useRef<Map<string, ChapterAudioResponse>>(new Map());

  const ttsSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  useEffect(() => {
    if (!ttsSupported) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis
        .getVoices()
        .filter((v) => v.lang.toLowerCase().startsWith('en'));
      setAvailableVoices(voices);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [ttsSupported]);

  const stopSpeech = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
  }, [ttsSupported]);

  const clearAudioElement = useCallback(() => {
    activeSegmentRef.current = null;
    segmentAdvancingRef.current = false;
    surahSequenceRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const stopAudio = useCallback(() => {
    playbackRequestIdRef.current += 1;
    clearAudioElement();
    stopSpeech();
    setIsPlaying(false);
    setIsLoading(false);
    setPlaybackKind(null);
    setActiveVerseKey(null);
    setActiveChapterId(null);
    setError(null);
  }, [clearAudioElement, stopSpeech]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      audioRef.current.muted = clamped === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  const getCachedChapterSegments = useCallback(
    async (reciterId: number, chapterId: number): Promise<ChapterAudioResponse> => {
      const cacheKey = `${reciterId}:${chapterId}`;
      const existing = segmentCacheRef.current.get(cacheKey);
      if (existing) return existing;
      const fetched = await fetchChapterAudioData(reciterId, chapterId, true);
      segmentCacheRef.current.set(cacheKey, fetched);
      return fetched;
    },
    []
  );

  const playUrlFromOffset = useCallback(
    async (url: string, startSec: number | null, reqId: number) => {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;
      audio.volume = volumeRef.current;
      audio.muted = isMutedRef.current;

      const isSameSource =
        audio.src === url && audio.readyState >= 1 && !audio.error;

      if (!isSameSource) {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error('Audio stream unavailable.'));
          };
          const cleanup = () => {
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('error', onErr);
          };
          audio.addEventListener('loadedmetadata', onLoaded, { once: true });
          audio.addEventListener('error', onErr, { once: true });
          audio.src = url;
          audio.load();
        });
      }

      if (reqId !== playbackRequestIdRef.current) return;

      if (startSec !== null && startSec >= 0) {
        audio.currentTime = startSec;
      } else if (!isSameSource) {
        audio.currentTime = 0;
      }

      await audio.play();
    },
    []
  );

  const speakAyahTranslation = useCallback(
    (ayah: PlayableAyah, indexInQueue: number) => {
      if (!ttsSupported) {
        setError('English Speech Synthesis is not supported in this browser.');
        return;
      }

      clearAudioElement();
      window.speechSynthesis.cancel();

      const text = stripHtmlTags(ayah.translationText || '');
      if (!text) {
        setError('No English translation text available for this Ayah.');
        setIsPlaying(false);
        return;
      }

      setAudioModeState('english');
      setPlaybackKind('translation');
      setActiveVerseKey(ayah.verseKey);
      setActiveChapterId(ayah.chapterId);
      setActiveChapterName(ayah.chapterName);
      activeIndexRef.current = indexInQueue;
      setError(null);
      setIsLoading(false);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settingsRef.current.ttsRate || 1.0;
      utterance.volume = isMutedRef.current ? 0 : volumeRef.current;
      utterance.lang = 'en-US';

      if (settingsRef.current.ttsVoiceURI) {
        const chosen = window.speechSynthesis
          .getVoices()
          .find((v) => v.voiceURI === settingsRef.current.ttsVoiceURI);
        if (chosen) utterance.voice = chosen;
      }

      utterance.onstart = () => {
        setIsPlaying(true);
      };

      utterance.onend = () => {
        if (settingsRef.current.repeatAyah) {
          speakAyahTranslation(ayah, indexInQueue);
          return;
        }
        const nextIdx = indexInQueue + 1;
        if (settingsRef.current.autoPlayNext && nextIdx < queueRef.current.length) {
          speakAyahTranslation(queueRef.current[nextIdx], nextIdx);
        } else {
          setIsPlaying(false);
        }
      };

      utterance.onerror = (ev) => {
        if (ev.error === 'interrupted' || ev.error === 'canceled') return;
        setIsPlaying(false);
        setError('Unable to play English translation speech.');
      };

      window.speechSynthesis.speak(utterance);
    },
    [clearAudioElement, ttsSupported]
  );

  const startArabicAyahPlayback = useCallback(
    async (ayah: PlayableAyah, indexInQueue: number) => {
      const reqId = ++playbackRequestIdRef.current;
      const reciterId = settingsRef.current.reciterId;

      stopSpeech();
      surahSequenceRef.current = null;
      segmentAdvancingRef.current = false;
      setAudioModeState('arabic');
      setPlaybackKind('ayah');
      setActiveVerseKey(ayah.verseKey);
      setActiveChapterId(ayah.chapterId);
      setActiveChapterName(ayah.chapterName);
      activeIndexRef.current = indexInQueue;
      setError(null);
      setIsLoading(true);

      let audioUrl = ayah.audioUrl;
      if (!audioUrl) {
        try {
          const freshVerse: Verse = await fetchVerseByKey({
            verseKey: ayah.verseKey,
            translationId: settingsRef.current.translationId,
            reciterId,
          });
          if (reqId !== playbackRequestIdRef.current) return;
          audioUrl = freshVerse.audio?.url;
          if (audioUrl && queueRef.current[indexInQueue]) {
            queueRef.current[indexInQueue] = {
              ...queueRef.current[indexInQueue],
              audioUrl,
              translationText:
                queueRef.current[indexInQueue].translationText ||
                stripHtmlTags(freshVerse.translations?.[0]?.text || ''),
            };
          }
        } catch {
          if (reqId !== playbackRequestIdRef.current) return;
          setIsLoading(false);
          setIsPlaying(false);
          setError('Could not load audio for this Ayah.');
          return;
        }
      }

      if (audioUrl) {
        activeSegmentRef.current = null;
        try {
          await playUrlFromOffset(audioUrl, null, reqId);
          if (reqId !== playbackRequestIdRef.current) return;
          setIsPlaying(true);
          setIsLoading(false);
        } catch {
          if (reqId !== playbackRequestIdRef.current) return;
          setIsPlaying(false);
          setIsLoading(false);
          setError('Audio playback could not start. Click play to retry.');
        }
        return;
      }

      // Fallback for chapter-only reciters (e.g. Yasser ad-Dussary, Khalifah Al Tunaiji, Minshawi Kids, Afasy Streaming):
      // seek cleanly within the Surah audio file using official Quran Foundation segment timestamps.
      try {
        const chapterAudio = await getCachedChapterSegments(reciterId, ayah.chapterId);
        if (reqId !== playbackRequestIdRef.current) return;

        const chapterUrl = chapterAudio.audio_file?.audio_url;
        const ts = chapterAudio.audio_file?.timestamps?.find(
          (item) => item.verse_key === ayah.verseKey
        );

        if (chapterUrl && ts && ts.timestamp_to > ts.timestamp_from) {
          const startSec = ts.timestamp_from / 1000;
          const endSec = ts.timestamp_to / 1000;
          activeSegmentRef.current = {
            verseKey: ayah.verseKey,
            startSec,
            endSec,
            indexInQueue,
          };
          setCurrentTime(0);
          setDuration(Math.max(0, endSec - startSec));

          await playUrlFromOffset(chapterUrl, startSec, reqId);
          if (reqId !== playbackRequestIdRef.current) return;
          setIsPlaying(true);
          setIsLoading(false);
          return;
        }

        if (chapterUrl) {
          setIsLoading(false);
          setIsPlaying(false);
          setError(
            `Per-Ayah timing is unavailable for ${ayah.verseKey} on this reciter; use Play Full Surah.`
          );
          return;
        }
      } catch {
        if (reqId !== playbackRequestIdRef.current) return;
      }

      setIsLoading(false);
      setIsPlaying(false);
      setError('Audio unavailable for the selected reciter.');
    },
    [getCachedChapterSegments, playUrlFromOffset, stopSpeech]
  );

  const playAyah = useCallback(
    (ayah: PlayableAyah, queue?: PlayableAyah[]) => {
      if (queue && queue.length > 0) {
        queueRef.current = queue;
      } else if (
        queueRef.current.length === 0 ||
        !queueRef.current.some((item) => item.verseKey === ayah.verseKey)
      ) {
        queueRef.current = [ayah];
      }

      const idx = queueRef.current.findIndex((item) => item.verseKey === ayah.verseKey);
      const resolvedIdx = idx >= 0 ? idx : 0;
      startArabicAyahPlayback(queueRef.current[resolvedIdx], resolvedIdx);
    },
    [startArabicAyahPlayback]
  );

  const playVerseKeys = useCallback(
    async (keys: string[], title: string) => {
      if (keys.length === 0) return;
      setIsLoading(true);
      setActiveChapterName(title);
      setActiveVerseKey(keys[0]);
      try {
        const verses = await fetchVersesByKeys({
          keys,
          translationId: settingsRef.current.translationId,
          reciterId: settingsRef.current.reciterId,
        });
        const items: PlayableAyah[] = verses.map((v) => {
          const [chIdStr] = v.verse_key.split(':');
          return {
            verseKey: v.verse_key,
            chapterId: Number(chIdStr),
            verseNumber: v.verse_number,
            chapterName: title,
            audioUrl: v.audio?.url,
            translationText: stripHtmlTags(v.translations?.[0]?.text || ''),
          };
        });
        if (items.length > 0) {
          queueRef.current = items;
          startArabicAyahPlayback(items[0], 0);
        }
      } catch {
        setIsLoading(false);
        showToast('Unable to load passage audio.');
      }
    },
    [showToast, startArabicAyahPlayback]
  );

  const playEnglishTranslation = useCallback(
    (ayah: PlayableAyah, queue?: PlayableAyah[]) => {
      if (queue && queue.length > 0) {
        queueRef.current = queue;
      } else if (
        queueRef.current.length === 0 ||
        !queueRef.current.some((item) => item.verseKey === ayah.verseKey)
      ) {
        queueRef.current = [ayah];
      }
      const idx = queueRef.current.findIndex((item) => item.verseKey === ayah.verseKey);
      const resolvedIdx = idx >= 0 ? idx : 0;
      speakAyahTranslation(queueRef.current[resolvedIdx], resolvedIdx);
    },
    [speakAyahTranslation]
  );

  const playFullSurah = useCallback(
    async (chapterId: number, chapterName: string) => {
      const reqId = ++playbackRequestIdRef.current;
      stopSpeech();
      activeSegmentRef.current = null;
      segmentAdvancingRef.current = false;
      surahSequenceRef.current = null;
      setAudioModeState('arabic');
      setPlaybackKind('surah');
      setActiveVerseKey(null);
      setActiveChapterId(chapterId);
      setActiveChapterName(chapterName);
      setError(null);
      setIsLoading(true);

      try {
        const data = await fetchChapterAudioData(settingsRef.current.reciterId, chapterId, false);
        if (reqId !== playbackRequestIdRef.current) return;

        if (data.audio_file?.audio_url) {
          await playUrlFromOffset(data.audio_file.audio_url, 0, reqId);
          if (reqId !== playbackRequestIdRef.current) return;
          setIsPlaying(true);
          setIsLoading(false);
          return;
        }

        if (Array.isArray(data.verse_audio_files) && data.verse_audio_files.length > 0) {
          const files = data.verse_audio_files;
          surahSequenceRef.current = {
            chapterId,
            chapterName,
            files,
            index: 0,
          };
          setActiveVerseKey(files[0].verse_key);
          await playUrlFromOffset(files[0].url, 0, reqId);
          if (reqId !== playbackRequestIdRef.current) return;
          setIsPlaying(true);
          setIsLoading(false);
          return;
        }

        throw new Error('Full Surah recitation unavailable for this reciter.');
      } catch (err) {
        if (reqId !== playbackRequestIdRef.current) return;
        setIsPlaying(false);
        setIsLoading(false);
        const msg = err instanceof Error ? err.message : 'Unable to stream Surah recitation.';
        setError(msg);
        showToast(msg);
      }
    },
    [playUrlFromOffset, showToast, stopSpeech]
  );

  const playNext = useCallback(() => {
    if (playbackKindRef.current === 'surah' && surahSequenceRef.current) {
      const seq = surahSequenceRef.current;
      const nextIdx = seq.index + 1;
      if (nextIdx < seq.files.length) {
        const reqId = ++playbackRequestIdRef.current;
        seq.index = nextIdx;
        setActiveVerseKey(seq.files[nextIdx].verse_key);
        setIsLoading(true);
        playUrlFromOffset(seq.files[nextIdx].url, 0, reqId)
          .then(() => {
            if (reqId !== playbackRequestIdRef.current) return;
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch(() => {
            if (reqId !== playbackRequestIdRef.current) return;
            setIsPlaying(false);
            setIsLoading(false);
          });
      }
      return;
    }

    const nextIdx = activeIndexRef.current + 1;
    if (nextIdx >= 0 && nextIdx < queueRef.current.length) {
      if (audioMode === 'english') {
        speakAyahTranslation(queueRef.current[nextIdx], nextIdx);
      } else {
        startArabicAyahPlayback(queueRef.current[nextIdx], nextIdx);
      }
    }
  }, [audioMode, playUrlFromOffset, speakAyahTranslation, startArabicAyahPlayback]);

  const playPrevious = useCallback(() => {
    if (playbackKindRef.current === 'surah' && surahSequenceRef.current) {
      const seq = surahSequenceRef.current;
      const prevIdx = seq.index - 1;
      if (prevIdx >= 0) {
        const reqId = ++playbackRequestIdRef.current;
        seq.index = prevIdx;
        setActiveVerseKey(seq.files[prevIdx].verse_key);
        setIsLoading(true);
        playUrlFromOffset(seq.files[prevIdx].url, 0, reqId)
          .then(() => {
            if (reqId !== playbackRequestIdRef.current) return;
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch(() => {
            if (reqId !== playbackRequestIdRef.current) return;
            setIsPlaying(false);
            setIsLoading(false);
          });
      }
      return;
    }

    const prevIdx = activeIndexRef.current - 1;
    if (prevIdx >= 0 && prevIdx < queueRef.current.length) {
      if (audioMode === 'english') {
        speakAyahTranslation(queueRef.current[prevIdx], prevIdx);
      } else {
        startArabicAyahPlayback(queueRef.current[prevIdx], prevIdx);
      }
    }
  }, [audioMode, playUrlFromOffset, speakAyahTranslation, startArabicAyahPlayback]);

  const togglePlayPause = useCallback(async () => {
    if (audioMode === 'english') {
      if (!ttsSupported) return;
      if (isPlaying) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      } else if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else if (activeIndexRef.current >= 0 && queueRef.current[activeIndexRef.current]) {
        speakAyahTranslation(queueRef.current[activeIndexRef.current], activeIndexRef.current);
      }
      return;
    }

    const audio = audioRef.current;
    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // If source was cleared (e.g. after switching reciter while paused), reload with the current reciter
    if (!audio || !audio.currentSrc) {
      if (playbackKindRef.current === 'surah' && activeChapterId) {
        await playFullSurah(activeChapterId, activeChapterName);
      } else if (activeIndexRef.current >= 0 && queueRef.current[activeIndexRef.current]) {
        await startArabicAyahPlayback(queueRef.current[activeIndexRef.current], activeIndexRef.current);
      }
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setError('Unable to resume playback.');
    }
  }, [
    activeChapterId,
    activeChapterName,
    audioMode,
    isPlaying,
    playFullSurah,
    speakAyahTranslation,
    startArabicAyahPlayback,
    ttsSupported,
  ]);

  const seekTo = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    const seg = activeSegmentRef.current;
    if (seg) {
      const clamped = Math.max(0, Math.min(seg.endSec - seg.startSec, seconds));
      audioRef.current.currentTime = seg.startSec + clamped;
      setCurrentTime(clamped);
    } else {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  }, []);

  const setAudioMode = useCallback(
    (mode: AudioMode) => {
      setAudioModeState(mode);
      const currentItem =
        activeIndexRef.current >= 0 ? queueRef.current[activeIndexRef.current] : null;
      if (!currentItem) return;
      if (mode === 'english') {
        speakAyahTranslation(currentItem, activeIndexRef.current);
      } else {
        startArabicAyahPlayback(currentItem, activeIndexRef.current);
      }
    },
    [speakAyahTranslation, startArabicAyahPlayback]
  );

  const updateQueue = useCallback(
    (queue: PlayableAyah[]) => {
      queueRef.current = queue;
      if (activeVerseKey) {
        const idx = queue.findIndex((q) => q.verseKey === activeVerseKey);
        if (idx >= 0) activeIndexRef.current = idx;
      }
    },
    [activeVerseKey]
  );

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      const seg = activeSegmentRef.current;
      if (seg) {
        const segDuration = Math.max(0, seg.endSec - seg.startSec);
        const relTime = Math.max(0, Math.min(segDuration, audio.currentTime - seg.startSec));
        setCurrentTime(relTime);
        setDuration(segDuration);

        if (audio.currentTime >= seg.endSec - 0.05 && !segmentAdvancingRef.current) {
          segmentAdvancingRef.current = true;
          if (settingsRef.current.repeatAyah) {
            audio.currentTime = seg.startSec;
            segmentAdvancingRef.current = false;
            return;
          }
          const nextIdx = seg.indexInQueue + 1;
          if (settingsRef.current.autoPlayNext && nextIdx < queueRef.current.length) {
            startArabicAyahPlayback(queueRef.current[nextIdx], nextIdx);
          } else {
            audio.pause();
            setIsPlaying(false);
            segmentAdvancingRef.current = false;
          }
        }
        return;
      }

      setCurrentTime(audio.currentTime || 0);
    };

    const handleLoadedMetadata = () => {
      if (activeSegmentRef.current) {
        const seg = activeSegmentRef.current;
        setDuration(Math.max(0, seg.endSec - seg.startSec));
      } else {
        setDuration(audio.duration || 0);
      }
    };

    const handleEnded = () => {
      if (activeSegmentRef.current) {
        const seg = activeSegmentRef.current;
        if (settingsRef.current.repeatAyah) {
          audio.currentTime = seg.startSec;
          audio.play().catch(() => setIsPlaying(false));
          return;
        }
        const nextIdx = seg.indexInQueue + 1;
        if (settingsRef.current.autoPlayNext && nextIdx < queueRef.current.length) {
          startArabicAyahPlayback(queueRef.current[nextIdx], nextIdx);
        } else {
          setIsPlaying(false);
        }
        return;
      }

      if (playbackKindRef.current === 'surah') {
        const seq = surahSequenceRef.current;
        if (seq) {
          const nextFileIdx = seq.index + 1;
          if (nextFileIdx < seq.files.length) {
            const reqId = ++playbackRequestIdRef.current;
            seq.index = nextFileIdx;
            setActiveVerseKey(seq.files[nextFileIdx].verse_key);
            playUrlFromOffset(seq.files[nextFileIdx].url, 0, reqId).catch(() =>
              setIsPlaying(false)
            );
            return;
          }
          if (settingsRef.current.repeatAyah && seq.files.length > 0) {
            const reqId = ++playbackRequestIdRef.current;
            seq.index = 0;
            setActiveVerseKey(seq.files[0].verse_key);
            playUrlFromOffset(seq.files[0].url, 0, reqId).catch(() => setIsPlaying(false));
            return;
          }
          setIsPlaying(false);
          return;
        }

        if (settingsRef.current.repeatAyah) {
          audio.currentTime = 0;
          audio.play().catch(() => setIsPlaying(false));
          return;
        }
        setIsPlaying(false);
        return;
      }

      if (settingsRef.current.repeatAyah) {
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
        return;
      }

      const nextIdx = activeIndexRef.current + 1;
      if (settingsRef.current.autoPlayNext && nextIdx < queueRef.current.length) {
        startArabicAyahPlayback(queueRef.current[nextIdx], nextIdx);
      } else {
        setIsPlaying(false);
      }
    };

    const handleError = () => {
      if (!audio.currentSrc) return;
      setIsLoading(false);
      setIsPlaying(false);
      setError('Audio stream unavailable.');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [playUrlFromOffset, startArabicAyahPlayback]);

  // Whenever reciter changes: immediately stop stale audio, clear all queued verse URLs,
  // and restart active Arabic playback with the newly selected reciter.
  const prevReciterIdRef = useRef(settings.reciterId);
  useEffect(() => {
    if (prevReciterIdRef.current === settings.reciterId) return;
    prevReciterIdRef.current = settings.reciterId;

    const wasPlaying = isPlaying;
    const currentMode = audioMode;
    const currentKind = playbackKind;
    const chapterId = activeChapterId;
    const chapterName = activeChapterName;

    playbackRequestIdRef.current += 1;
    clearAudioElement();
    setError(null);
    queueRef.current = queueRef.current.map((item) => ({
      ...item,
      audioUrl: undefined,
    }));

    if (currentMode === 'arabic' && wasPlaying) {
      if (currentKind === 'surah' && chapterId) {
        playFullSurah(chapterId, chapterName);
      } else if (currentKind === 'ayah' && activeIndexRef.current >= 0) {
        const item = queueRef.current[activeIndexRef.current];
        if (item) {
          startArabicAyahPlayback(item, activeIndexRef.current);
        }
      }
    }
  }, [
    settings.reciterId,
    audioMode,
    isPlaying,
    playbackKind,
    activeChapterId,
    activeChapterName,
    clearAudioElement,
    playFullSurah,
    startArabicAyahPlayback,
  ]);

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        isLoading,
        audioMode,
        playbackKind,
        activeVerseKey,
        activeChapterId,
        activeChapterName,
        currentTime,
        duration,
        volume,
        isMuted,
        error,
        ttsSupported,
        availableVoices,
        playAyah,
        playVerseKeys,
        playFullSurah,
        playEnglishTranslation,
        togglePlayPause,
        stopAudio,
        playNext,
        playPrevious,
        seekTo,
        setVolume,
        toggleMute,
        setAudioMode,
        updateQueue,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
