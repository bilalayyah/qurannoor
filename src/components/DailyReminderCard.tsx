import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import { useReader } from '../context/ReaderContext';
import { usePushNotifications } from '../utils/pushNotifications';

export function DailyReminderCard() {
  const { currentStreak, dailyGoal, showToast } = useReader();
  const { status, busy, message, enable, disable } = usePushNotifications();

  const handleEnable = async () => {
    const next = await enable({
      streak: currentStreak,
      goalTarget: dailyGoal.target,
      goalUnit: dailyGoal.unit,
    });
    if (next.status === 'enabled') {
      showToast('Daily reading reminder enabled');
    } else if (next.status === 'preview_unavailable') {
      showToast('Push backend not connected in preview');
    }
  };

  const handleDisable = async () => {
    await disable();
    showToast('Daily reading reminder turned off');
  };

  return (
    <section aria-labelledby="daily-reminder-heading">
      <div
        className="rounded-2xl border p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor:
                status === 'enabled' ? 'var(--accent-soft)' : 'var(--bg-muted)',
              color:
                status === 'enabled'
                  ? 'var(--accent-text)'
                  : 'var(--text-secondary)',
            }}
          >
            {status === 'denied' ? (
              <BellOff className="h-4.5 w-4.5" />
            ) : (
              <Bell className="h-4.5 w-4.5" />
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="daily-reminder-heading"
                className="text-base font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                Daily Reminder
              </h3>
              {status === 'enabled' && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: 'var(--accent-text)' }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Enabled</span>
                </span>
              )}
            </div>

            {status === 'denied' ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Notifications are blocked in this browser. You can re-enable them from your browser&apos;s site settings.
              </p>
            ) : status === 'preview_unavailable' ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Push backend not connected in preview. Daily push reminders activate when deployed with Cloudflare KV.
              </p>
            ) : status === 'unsupported' ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Daily push reminders require a browser with Service Worker and Web Push support.
              </p>
            ) : status === 'enabled' ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                You&apos;ll receive a gentle reminder every day at 7:00 AM (Dubai time) with your reading goal and streak.
              </p>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {message ||
                  'Receive one gentle daily notification at 7:00 AM (Dubai time) to stay on track with your Quran reading goal.'}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {status === 'enabled' ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleDisable}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>Turn off</span>
            </button>
          ) : status === 'denied' || status === 'unsupported' ? null : (
            <button
              type="button"
              disabled={busy}
              onClick={handleEnable}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
              <span>{status === 'preview_unavailable' ? 'Retry Reminder' : 'Enable Reminder'}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
