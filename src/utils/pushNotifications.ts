import { useCallback, useEffect, useState } from 'react';

export const PUSH_ENABLED_STORAGE_KEY = 'push-enabled';

export type PushReminderStatus =
  | 'not_enabled'
  | 'enabled'
  | 'denied'
  | 'preview_unavailable'
  | 'unsupported';

export interface PushSnapshot {
  status: PushReminderStatus;
  busy: boolean;
  message: string | null;
}

const listeners = new Set<() => void>();

let currentSnapshot: PushSnapshot = {
  status: 'not_enabled',
  busy: false,
  message: null,
};

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(next: Partial<PushSnapshot>) {
  currentSnapshot = { ...currentSnapshot, ...next };
  notifyListeners();
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function readPushEnabledFlag(): boolean {
  try {
    return localStorage.getItem(PUSH_ENABLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePushEnabledFlag(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(PUSH_ENABLED_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(PUSH_ENABLED_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing =
    (await navigator.serviceWorker.getRegistration('/sw.js')) ||
    (await navigator.serviceWorker.getRegistration());
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

export async function refreshPushStatus(): Promise<PushSnapshot> {
  if (!isPushSupported()) {
    writePushEnabledFlag(false);
    setSnapshot({
      status: 'unsupported',
      message: 'Web push notifications are not supported in this browser.',
    });
    return currentSnapshot;
  }

  if (Notification.permission === 'denied') {
    writePushEnabledFlag(false);
    setSnapshot({
      status: 'denied',
      message:
        'Notifications are blocked. You can re-enable them anytime from your browser site settings.',
    });
    return currentSnapshot;
  }

  try {
    const reg =
      (await navigator.serviceWorker.getRegistration('/sw.js')) ||
      (await navigator.serviceWorker.getRegistration());

    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        writePushEnabledFlag(true);
        setSnapshot({ status: 'enabled', message: null });
        return currentSnapshot;
      }
      if (!sub && readPushEnabledFlag()) {
        writePushEnabledFlag(false);
      }
    }
  } catch {
    // keep safe fallback
  }

  if (currentSnapshot.status !== 'preview_unavailable') {
    setSnapshot({
      status: readPushEnabledFlag() && Notification.permission === 'granted' ? 'enabled' : 'not_enabled',
    });
  }
  return currentSnapshot;
}

export async function enableDailyReminder(options?: {
  streak?: number;
  goalTarget?: number;
  goalUnit?: 'ayahs' | 'pages';
}): Promise<PushSnapshot> {
  if (!isPushSupported()) {
    setSnapshot({
      status: 'unsupported',
      busy: false,
      message: 'Web push notifications are not supported in this browser.',
    });
    return currentSnapshot;
  }

  if (Notification.permission === 'denied') {
    writePushEnabledFlag(false);
    setSnapshot({
      status: 'denied',
      busy: false,
      message:
        'Notifications are blocked. You can re-enable them anytime from your browser site settings.',
    });
    return currentSnapshot;
  }

  setSnapshot({ busy: true, message: null });

  try {
    // 1. Fetch public VAPID key from backend
    let vapidJson: { publicKey?: string | null; preview?: boolean; error?: string } = {};
    try {
      const keyRes = await fetch('/api/push/vapid-key', {
        headers: { Accept: 'application/json' },
      });
      vapidJson = (await keyRes.json()) as {
        publicKey?: string | null;
        preview?: boolean;
        error?: string;
      };
    } catch {
      vapidJson = { publicKey: null, preview: true };
    }

    // 2. Trigger notification permission prompt
    let permission: NotificationPermission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'denied') {
      writePushEnabledFlag(false);
      setSnapshot({
        status: 'denied',
        busy: false,
        message:
          'Notifications are blocked. You can re-enable them anytime from your browser site settings.',
      });
      return currentSnapshot;
    }

    if (permission !== 'granted') {
      writePushEnabledFlag(false);
      setSnapshot({
        status: 'not_enabled',
        busy: false,
        message: 'Notification permission was dismissed. Tap to try again.',
      });
      return currentSnapshot;
    }

    // 3. Handle preview / unconfigured backend gracefully
    if (!vapidJson.publicKey) {
      writePushEnabledFlag(false);
      setSnapshot({
        status: 'preview_unavailable',
        busy: false,
        message: vapidJson.error || 'Push backend not connected in preview.',
      });
      return currentSnapshot;
    }

    // 4. Register / ensure active SW and subscribe via PushManager
    const registration = await ensureServiceWorkerRegistration();
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidJson.publicKey),
      });
    }

    // 5. Persist subscription on backend KV
    const subRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        streak: options?.streak || 0,
        goalTarget: options?.goalTarget || 10,
        goalUnit: options?.goalUnit || 'ayahs',
      }),
    });

    const subJson = (await subRes.json().catch(() => ({}))) as {
      ok?: boolean;
      preview?: boolean;
      error?: string;
    };

    if (!subRes.ok || subJson.ok === false) {
      await subscription.unsubscribe().catch(() => undefined);
      writePushEnabledFlag(false);
      setSnapshot({
        status: subJson.preview ? 'preview_unavailable' : 'not_enabled',
        busy: false,
        message: subJson.error || 'Push backend not connected in preview.',
      });
      return currentSnapshot;
    }

    writePushEnabledFlag(true);
    setSnapshot({
      status: 'enabled',
      busy: false,
      message: 'Daily reminder active for 7:00 AM (Dubai time).',
    });
    return currentSnapshot;
  } catch (err) {
    writePushEnabledFlag(false);
    setSnapshot({
      status: 'not_enabled',
      busy: false,
      message: err instanceof Error ? err.message : 'Could not enable daily reminder.',
    });
    return currentSnapshot;
  }
}

export async function disableDailyReminder(): Promise<PushSnapshot> {
  if (!isPushSupported()) {
    writePushEnabledFlag(false);
    setSnapshot({ status: 'unsupported', busy: false });
    return currentSnapshot;
  }

  setSnapshot({ busy: true, message: null });

  try {
    const reg =
      (await navigator.serviceWorker.getRegistration('/sw.js')) ||
      (await navigator.serviceWorker.getRegistration());

    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);

      await sub.unsubscribe().catch(() => undefined);
    }
  } catch {
    // still clear local state cleanly
  }

  writePushEnabledFlag(false);
  setSnapshot({
    status: Notification.permission === 'denied' ? 'denied' : 'not_enabled',
    busy: false,
    message: 'Daily reminder turned off.',
  });
  return currentSnapshot;
}

export function usePushNotifications() {
  const [snapshot, setLocalSnapshot] = useState<PushSnapshot>(currentSnapshot);

  useEffect(() => {
    const update = () => setLocalSnapshot(currentSnapshot);
    listeners.add(update);
    refreshPushStatus();
    return () => {
      listeners.delete(update);
    };
  }, []);

  const enable = useCallback(
    (options?: { streak?: number; goalTarget?: number; goalUnit?: 'ayahs' | 'pages' }) =>
      enableDailyReminder(options),
    []
  );

  const disable = useCallback(() => disableDailyReminder(), []);

  return {
    ...snapshot,
    enable,
    disable,
    refresh: refreshPushStatus,
  };
}
