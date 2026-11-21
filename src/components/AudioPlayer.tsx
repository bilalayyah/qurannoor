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
import { getReciterArabicName } from '../utils/reciters';
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
    repeatMode,
    repeatIteration,
    setRepeatMode,
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
  const activeReciterArabic = activeReciter ? getReciterArabicName(activeReciter) : '';
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
      {audioMode !== 'english' && duration > 0 && (
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
          <p
            className="truncate text-xs"
            style={{ color: error ? '#B45309' : 'var(--text-tertiary)' }}
            title={error || undefined}
          >
            {error
              ? error
              : audioMode === 'english'
              ? 'English Translation · Speech Synthesis'
              : `Arabic Recitation · ${activeReciter?.reciter_name || 'Reciter'}${
                  activeReciterArabic ? ` — ${activeReciterArabic}` : ''
                }${activeReciter?.style ? ` (${activeReciter.style})` : ''}`}
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
          {audioMode !== 'english' && duration > 0 && (
            <span
              className="hidden lg:inline-block text-xs tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>
          )}

          {/* Mode Toggle: Arabic Recitation, English Translation */}
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
              <ReciterSelector
                id="player-reciter-select"
                compact
                placement="top"
                align="right"
                className="w-[240px]"
              />
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

          {settings.hifzMode && playbackKind !== 'surah' ? (
            <div
              className="inline-flex items-center rounded-lg p-0.5"
              style={{ backgroundColor: 'var(--bg-muted)' }}
              role="group"
              aria-label="Repeat Ayah Count"
            >
              {([1, 3, 5, 'loop'] as const).map((mode) => {
                const active = repeatMode === mode;
                const label =
                  mode === 'loop'
                    ? '∞'
                    : active && typeof mode === 'number' && mode > 1
                    ? `${repeatIteration}/${mode}`
                    : `${mode}x`;
                return (
                  <button
                    key={String(mode)}
                    type="button"
                    onClick={() => setRepeatMode(mode)}
                    aria-label={`Repeat ${mode === 'loop' ? 'Loop' : `${mode}x`}`}
                    aria-pressed={active}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#FFFFFF' : 'var(--text-secondary)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
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
          )}

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
