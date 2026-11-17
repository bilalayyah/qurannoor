import { useCallback, useEffect, useState } from 'react';

export const INSTALLED_STORAGE_KEY = 'qurannoor_installed';
export const INSTALL_DISMISSED_AT_KEY = 'qurannoor_install_dismissed_at';
export const INSTALL_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
let installGuideOpen = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function openInstallGuide(): void {
  installGuideOpen = true;
  notifyListeners();
}

export function closeInstallGuide(): void {
  if (!installGuideOpen) return;
  installGuideOpen = false;
  notifyListeners();
}

export function initPWAInstallListeners(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    notifyListeners();
  });
}

if (typeof window !== 'undefined') {
  initPWAInstallListeners();
}

export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  const standaloneMedia =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  let recordedInstalled = false;
  try {
    recordedInstalled = localStorage.getItem(INSTALLED_STORAGE_KEY) === 'true';
  } catch {
    recordedInstalled = false;
  }

  return standaloneMedia || navigatorStandalone || recordedInstalled;
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const winWithMSStream = window as Window & { MSStream?: unknown };
  const isAppleDevice = /iPad|iPhone|iPod/.test(ua) && !winWithMSStream.MSStream;
  const isIPadOS =
    window.navigator.platform === 'MacIntel' &&
    typeof window.navigator.maxTouchPoints === 'number' &&
    window.navigator.maxTouchPoints > 1;
  return isAppleDevice || isIPadOS;
}

export function canInstall(): boolean {
  return !isInstalled() && deferredPrompt !== null;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  if (!deferredPrompt) return null;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notifyListeners();

  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      try {
        localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
      } catch {
        // ignore storage errors
      }
    }
    notifyListeners();
    return outcome;
  } catch {
    notifyListeners();
    return null;
  }
}

export function isInstallDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(INSTALL_DISMISSED_AT_KEY);
    if (!raw) return false;
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
    return Date.now() - timestamp < INSTALL_DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_AT_KEY, String(Date.now()));
  } catch {
    // ignore storage errors
  }
  notifyListeners();
}

export function usePWAInstall() {
  const [, setTick] = useState(0);

  useEffect(() => {
    initPWAInstallListeners();
    const update = () => setTick((t) => t + 1);
    listeners.add(update);

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    mediaQuery?.addEventListener?.('change', update);

    return () => {
      listeners.delete(update);
      mediaQuery?.removeEventListener?.('change', update);
    };
  }, []);

  const installed = isInstalled();
  const ios = isIOS();
  const installReady = canInstall();
  const dismissed = isInstallDismissed();

  const triggerInstall = useCallback(() => promptInstall(), []);
  const dismiss = useCallback(() => dismissInstallPrompt(), []);
  const openGuide = useCallback(() => openInstallGuide(), []);
  const closeGuide = useCallback(() => closeInstallGuide(), []);

  const handleInstallClick = useCallback(async () => {
    if (canInstall()) {
      const outcome = await promptInstall();
      if (outcome === 'accepted' || outcome === 'dismissed') {
        return outcome;
      }
    }
    openInstallGuide();
    return null;
  }, []);

  return {
    installed,
    ios,
    canInstall: installReady,
    dismissed,
    showInstallGuide: installGuideOpen,
    promptInstall: triggerInstall,
    dismiss,
    openInstallGuide: openGuide,
    closeInstallGuide: closeGuide,
    handleInstallClick,
  };
}
