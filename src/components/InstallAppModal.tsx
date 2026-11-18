import { CheckCircle2, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { useEffect } from 'react';
import { usePWAInstall } from '../utils/pwaInstall';

export function InstallAppModal() {
  const { installed, showInstallGuide, closeInstallGuide } = usePWAInstall();

  useEffect(() => {
    if (!showInstallGuide) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInstallGuide();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showInstallGuide, closeInstallGuide]);

  if (!showInstallGuide) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-dialog-title"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
        onClick={closeInstallGuide}
      />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt="QuranNoor"
              className="h-11 w-11 shrink-0 rounded-xl border object-cover"
              style={{ borderColor: 'var(--border-subtle)' }}
            />
            <div>
              <h2
                id="install-app-dialog-title"
                className="text-base font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                Add QuranNoor to Home Screen
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Read, listen, and reflect with quick app access
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeInstallGuide}
            aria-label="Close install instructions"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {installed && (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed"
            style={{
              backgroundColor: 'var(--accent-soft)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Already installed:</strong> QuranNoor is already installed on this device.
              You can open it anytime from your Home Screen or app launcher.
            </span>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div
            className="rounded-xl border p-3.5 space-y-1.5"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              <Share className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-text)' }} />
              <span>iPhone &amp; iPad (Safari)</span>
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <li>
                Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
              </li>
            </ol>
          </div>

          <div
            className="rounded-xl border p-3.5 space-y-1.5"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              <MoreVertical className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-text)' }} />
              <span>Android (Chrome)</span>
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <li>
                Tap the <strong>⋮</strong> menu in the top-right corner of Chrome.
              </li>
              <li>
                Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </li>
            </ol>
          </div>
        </div>

        <p
          className="mt-3.5 flex items-start gap-2 text-[11px] leading-relaxed"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            In desktop Chrome or Edge, you can also click the install icon in the address bar when
            viewing QuranNoor outside an embedded preview.
          </span>
        </p>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={closeInstallGuide}
            className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-xl px-5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
