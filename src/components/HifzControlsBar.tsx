import { EyeOff, Play, Repeat, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAudio, type PlayableAyah } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import type { RepeatMode } from '../types/quran';
import { ThemedSelect } from './ThemedSelect';

interface HifzControlsBarProps {
  queue: PlayableAyah[];
}

const REPEAT_OPTIONS: Array<{ value: RepeatMode; label: string }> = [
  { value: 1, label: '1x' },
  { value: 3, label: '3x' },
  { value: 5, label: '5x' },
  { value: 'loop', label: 'Loop' },
];

export function HifzControlsBar({ queue }: HifzControlsBarProps) {
  const { settings } = useReader();
  const {
    repeatMode,
    repeatIteration,
    repeatRange,
    setRepeatMode,
    setRepeatRange,
    playAyahRange,
  } = useAudio();

  const [startKey, setStartKey] = useState<string>(queue[0]?.verseKey || '');
  const [endKey, setEndKey] = useState<string>(
    queue[Math.min(queue.length - 1, 2)]?.verseKey || queue[0]?.verseKey || ''
  );

  useEffect(() => {
    if (queue.length === 0) return;
    if (!queue.some((q) => q.verseKey === startKey)) {
      setStartKey(queue[0].verseKey);
    }
    if (!queue.some((q) => q.verseKey === endKey)) {
      setEndKey(queue[Math.min(queue.length - 1, 2)].verseKey);
    }
  }, [queue, startKey, endKey]);

  if (!settings.hifzMode) return null;

  return (
    <section
      aria-label="Hifz Memorisation Repeat Controls"
      className="mb-6 rounded-2xl border p-4 sm:p-5 space-y-3"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent-text)' }}>
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hifz Mode Active</span>
          {typeof repeatMode === 'number' && repeatMode > 1 && (
            <span className="font-normal tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
              · Pass {Math.min(repeatIteration, repeatMode)}/{repeatMode}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            <Repeat className="h-3.5 w-3.5" />
            <span>Repeat Ayah:</span>
          </span>
          {REPEAT_OPTIONS.map((opt) => {
            const active = repeatMode === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setRepeatMode(opt.value)}
                aria-pressed={active}
                className="min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent)' : 'var(--bg-canvas)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                  color: active ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {queue.length > 1 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              Repeat Range:
            </span>
            <ThemedSelect
              ariaLabel="Repeat range start ayah"
              value={startKey}
              options={queue.map((item) => ({
                value: item.verseKey,
                label: `Ayah ${item.verseKey}`,
              }))}
              onChange={setStartKey}
              searchPlaceholder="Search ayah (e.g. 2:255)..."
              compact
              className="w-[126px]"
            />

            <span style={{ color: 'var(--text-tertiary)' }}>to</span>

            <ThemedSelect
              ariaLabel="Repeat range end ayah"
              value={endKey}
              options={queue.map((item) => ({
                value: item.verseKey,
                label: `Ayah ${item.verseKey}`,
              }))}
              onChange={setEndKey}
              searchPlaceholder="Search ayah (e.g. 2:255)..."
              compact
              className="w-[126px]"
            />

            <button
              type="button"
              onClick={() => playAyahRange(startKey, endKey, queue)}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Loop Range</span>
            </button>

            {repeatRange && (
              <button
                type="button"
                onClick={() => setRepeatRange(null)}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 text-xs font-medium"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                }}
              >
                <span className="tabular-nums">
                  {repeatRange.startKey}–{repeatRange.endKey}
                </span>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
