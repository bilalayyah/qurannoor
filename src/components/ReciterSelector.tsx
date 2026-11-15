import { useReader } from '../context/ReaderContext';
import type { Reciter } from '../types/quran';

interface ReciterSelectorProps {
  id?: string;
  compact?: boolean;
  className?: string;
}

export function formatReciterLabel(reciter: Reciter): string {
  const details = [reciter.style, reciter.qirat].filter(Boolean);
  if (details.length === 0) return reciter.reciter_name;
  return `${reciter.reciter_name} (${details.join(' · ')})`;
}

export function ReciterSelector({
  id = 'reciter-selector',
  compact = false,
  className = '',
}: ReciterSelectorProps) {
  const { reciters, settings, updateSettings } = useReader();

  return (
    <select
      id={id}
      aria-label="Select Quran Reciter"
      value={settings.reciterId}
      onChange={(e) => updateSettings({ reciterId: Number(e.target.value) })}
      disabled={reciters.length === 0}
      className={`${
        compact ? 'min-h-[36px] px-2.5 text-xs' : 'min-h-[42px] px-3 text-sm'
      } rounded-xl border outline-none transition-colors ${className}`}
      style={{
        backgroundColor: 'var(--bg-canvas)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      {reciters.length === 0 ? (
        <option value={settings.reciterId}>Loading reciters…</option>
      ) : (
        reciters.map((r) => (
          <option key={r.id} value={r.id}>
            {formatReciterLabel(r)}
          </option>
        ))
      )}
    </select>
  );
}
