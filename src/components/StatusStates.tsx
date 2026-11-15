import { AlertCircle, RefreshCw } from 'lucide-react';

export function VerseListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="py-10 px-4 sm:px-6 space-y-5 animate-pulse">
          <div className="h-4 w-28 rounded" style={{ backgroundColor: 'var(--bg-muted)' }} />
          <div className="flex flex-col items-end gap-3">
            <div className="h-8 w-4/5 rounded" style={{ backgroundColor: 'var(--bg-muted)' }} />
            <div className="h-8 w-3/5 rounded" style={{ backgroundColor: 'var(--bg-muted)' }} />
          </div>
          <div className="space-y-2 max-w-2xl">
            <div className="h-4 w-full rounded" style={{ backgroundColor: 'var(--bg-muted)' }} />
            <div className="h-4 w-4/5 rounded" style={{ backgroundColor: 'var(--bg-muted)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto my-8 max-w-xl rounded-xl border p-6 text-center"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <AlertCircle className="mx-auto h-6 w-6 text-amber-600 dark:text-amber-400" />
      <h3 className="mt-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Unable to load Quranic content
      </h3>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
}
