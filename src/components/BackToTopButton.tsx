import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';

interface BackToTopButtonProps {
  onBeforeScrollTop?: () => void;
  thresholdPx?: number;
}

export function BackToTopButton({
  onBeforeScrollTop,
  thresholdPx = 480,
}: BackToTopButtonProps) {
  const { isPlaying, isLoading, activeVerseKey, activeChapterId } = useAudio();
  const hasActiveAudio = Boolean(activeVerseKey || activeChapterId || isPlaying || isLoading);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > thresholdPx);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateVisibility);
    };
  }, [thresholdPx]);

  if (!visible) return null;

  const handleClick = () => {
    onBeforeScrollTop?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      className={`fixed right-4 sm:right-6 z-40 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-md transition-all hover:shadow-lg ${
        hasActiveAudio ? 'bottom-20' : 'bottom-6'
      }`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)',
        color: 'var(--text-primary)',
      }}
    >
      <ArrowUp className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
      <span className="hidden min-[400px]:inline">Back to top</span>
    </button>
  );
}
