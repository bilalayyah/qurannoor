import { Download, Share, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { usePWAInstall } from '../utils/pwaInstall';

const VISIBLE_DELAY_MS = 60_000;

export function InstallPrompt() {
  const { installed, ios, canInstall, dismissed, promptInstall, dismiss } = usePWAInstall();
  const { activeVerseKey, activeChapterId, isPlaying, isLoading } = useAudio();
  const hasActiveAudio = Boolean(activeVerseKey || activeChapterId || isPlaying || isLoading);

  const [hasElapsedVisibleDelay, setHasElapsedVisibleDelay] = useState(false);
  const [installing, setInstalling] = useState(false);

  const accumulatedVisibleMsRef = useRef(0);
  const visibleStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (installed || dismissed || hasElapsedVisibleDelay) return;

    const clearPendingTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const startOrResume = () => {
      clearPendingTimer();
      if (document.visibilityState !== 'visible') {
        if (visibleStartedAtRef.current !== null) {
          accumulatedVisibleMsRef.current += Date.now() - visibleStartedAtRef.current;
          visibleStartedAtRef.current = null;
        }
        return;
      }

      if (visibleStartedAtRef.current === null) {
        visibleStartedAtRef.current = Date.now();
      }

      const elapsed =
        accumulatedVisibleMsRef.current + (Date.now() - visibleStartedAtRef.current);
      const remaining = VISIBLE_DELAY_MS - elapsed;

      if (remaining <= 0) {
        setHasElapsedVisibleDelay(true);
        return;
      }

      timerRef.current = window.setTimeout(() => {
        setHasElapsedVisibleDelay(true);
      }, remaining);
    };

    startOrResume();
    document.addEventListener('visibilitychange', startOrResume);

    return () => {
      clearPendingTimer();
      if (visibleStartedAtRef.current !== null) {
        accumulatedVisibleMsRef.current += Date.now() - visibleStartedAtRef.current;
        visibleStartedAtRef.current = null;
      }
      document.removeEventListener('visibilitychange', startOrResume);
    };
  }, [installed, dismissed, hasElapsedVisibleDelay]);

  if (installed || dismissed || !hasElapsedVisibleDelay) {
    return null;
  }

  const showNativePrompt = canInstall;
  const showIOSGuide = !canInstall && ios;

  if (!showNativePrompt && !showIOSGuide) {
    return null;
  }

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'dismissed') {
        dismiss();
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <aside
      aria-label="Install QuranNoor"
      className={`fixed right-4 left-4 sm:left-auto sm:w-[360px] z-40 rounded-2xl border p-4 shadow-xl transition-all ${
        hasActiveAudio ? 'bottom-20' : 'bottom-4'
      }`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex items-start gap-3">
        <img
          src="/icons/icon-192.png"
          alt="QuranNoor"
          className="h-11 w-11 shrink-0 rounded-xl border object-cover"
          style={{ borderColor: 'var(--border-subtle)' }}
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h2
              className="text-sm font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Install QuranNoor
            </h2>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showNativePrompt ? (
            <>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Add to your home screen for quick access
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={installing}
                  onClick={handleInstall}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Install</span>
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Not now
                </button>
              </div>
            </>
          ) : (
            <>
              <p
                className="flex items-center gap-1.5 text-xs leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Share className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-text)' }} />
                <span>Tap Share, then Add to Home Screen</span>
              </p>
              <div className="flex items-center pt-2">
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Got it
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
