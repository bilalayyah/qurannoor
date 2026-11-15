import {
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import { ReciterSelector } from './ReciterSelector';

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function AudioPlayer() {
  const {
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
    playNext,
    playPrevious,
    togglePlayPause,
    stopAudio,
    seekTo,
    setVolume,
    toggleMute,
    setAudioMode,
  } = useAudio();

  const { settings, updateSettings, reciters } = useReader();

  const hasActiveTrack = Boolean(activeVerseKey || activeChapterId || isPlaying || isLoading);
  if (!hasActiveTrack) return null;

  const activeReciter = reciters.find((r) => r.id === settings.reciterId);
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      role="region"
      aria-label="Quran Audio Player"
      className="fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-md"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 95%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Playback Progress Bar */}
      {audioMode === 'arabic' && duration > 0 && (
        <div
          className="group relative h-1 w-full cursor-pointer"
          style={{ backgroundColor: 'var(--bg-muted)' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            seekTo(ratio * duration);
          }}
        >
          <div
            className="h-full transition-[width] duration-150"
            style={{ width: `${progressPct}%`, backgroundColor: 'var(--accent)' }}
          />
        </div>
      )}

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Track & Mode Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate">
            <span className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {activeChapterName || 'QuranNoor'}
            </span>
            {activeVerseKey && (
              <span
                className="shrink-0 text-xs font-medium tabular-nums"
                style={{ color: 'var(--gold)' }}
              >
                Ayah {activeVerseKey.split(':')[1]}
              </span>
            )}
          </div>
          <p className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {error
              ? error
              : audioMode === 'english'
              ? 'English Translation · Speech Synthesis'
              : `Arabic Recitation · ${activeReciter?.reciter_name || 'Reciter'}${
                  activeReciter?.style ? ` (${activeReciter.style})` : ''
                }`}
          </p>
        </div>

        {/* Center Transport Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {playbackKind !== 'surah' && (
            <button
              type="button"
              onClick={playPrevious}
              aria-label="Previous Ayah"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-primary)' }}
            >
              <SkipBack className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 translate-x-0.5" />
            )}
          </button>

          {playbackKind !== 'surah' && (
            <button
              type="button"
              onClick={playNext}
              aria-label="Next Ayah"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-primary)' }}
            >
              <SkipForward className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Right: Mode Switch, Reciter Selector, Volume, Repeat, Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {audioMode === 'arabic' && duration > 0 && (
            <span
              className="hidden lg:inline-block text-xs tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>
          )}

          {/* Mode Toggle: Arabic Recitation vs English Translation */}
          {playbackKind !== 'surah' && (
            <div
              className="hidden md:inline-flex rounded-lg p-0.5"
              style={{ backgroundColor: 'var(--bg-muted)' }}
              role="group"
              aria-label="Audio Mode"
            >
              <button
                type="button"
                onClick={() => setAudioMode('arabic')}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: audioMode === 'arabic' ? 'var(--bg-surface)' : 'transparent',
                  color: audioMode === 'arabic' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                Arabic
              </button>
              <button
                type="button"
                onClick={() => setAudioMode('english')}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: audioMode === 'english' ? 'var(--bg-surface)' : 'transparent',
                  color: audioMode === 'english' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                English
              </button>
            </div>
          )}

          {/* Quick Reciter Selector on Desktop */}
          {audioMode === 'arabic' && (
            <div className="hidden xl:block">
              <ReciterSelector id="player-reciter-select" compact className="max-w-[175px]" />
            </div>
          )}

          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="hidden md:block w-16 accent-[#0E6B4B] cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => updateSettings({ repeatAyah: !settings.repeatAyah })}
            aria-label="Repeat Ayah"
            aria-pressed={settings.repeatAyah}
            title="Repeat Ayah"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{
              backgroundColor: settings.repeatAyah ? 'var(--accent-soft)' : 'transparent',
              color: settings.repeatAyah ? 'var(--accent-text)' : 'var(--text-tertiary)',
            }}
          >
            <Repeat className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={stopAudio}
            aria-label="Close audio player"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
