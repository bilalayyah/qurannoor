import { Minus, Plus, X } from 'lucide-react';
import { useEffect } from 'react';
import { useAudio } from '../context/AudioContext';
import { useReader } from '../context/ReaderContext';
import type { ArabicFontFamily, QuranScript, ThemeMode } from '../types/quran';
import { usePushNotifications } from '../utils/pushNotifications';
import { getArabicFontClass } from '../utils/text';
import { URDU_AUDIO_CREDIT } from '../utils/urduAudio';
import { ReciterSelector } from './ReciterSelector';

const FONT_OPTIONS: Array<{ id: ArabicFontFamily; label: string; scriptHint: string }> = [
  { id: 'scheherazade', label: 'Scheherazade New', scriptHint: 'Classical Naskh' },
  { id: 'noto-naskh', label: 'Noto Naskh Arabic', scriptHint: 'Clean Naskh' },
  { id: 'lateef', label: 'Lateef', scriptHint: 'IndoPak Style' },
];

export function ReaderSettings() {
  const {
    settings,
    updateSettings,
    setTheme,
    translations,
    isSettingsOpen,
    setIsSettingsOpen,
    currentStreak,
    dailyGoal,
    showToast,
  } = useReader();

  const { ttsSupported, availableVoices } = useAudio();
  const {
    status: pushStatus,
    busy: pushBusy,
    enable: enablePush,
    disable: disablePush,
  } = usePushNotifications();

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSettingsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isSettingsOpen, setIsSettingsOpen]);

  if (!isSettingsOpen) return null;

  const currentTranslation = translations.find((t) => t.id === settings.translationId);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Reader Settings"
    >
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity"
        onClick={() => setIsSettingsOpen(false)}
      />

      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h2 className="text-base font-semibold">Reader Settings</h2>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            aria-label="Close settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
          {/* Theme */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Theme
            </h3>
            <div
              className="grid grid-cols-3 gap-1.5 rounded-xl p-1"
              style={{ backgroundColor: 'var(--bg-muted)' }}
            >
              {(['light', 'sepia', 'dark'] as ThemeMode[]).map((mode) => {
                const active = settings.theme === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className="min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Script */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Quran Script
            </h3>
            <div
              className="grid grid-cols-2 gap-1.5 rounded-xl p-1"
              style={{ backgroundColor: 'var(--bg-muted)' }}
            >
              {(
                [
                  { id: 'uthmani', label: 'Uthmani (Hafs)' },
                  { id: 'indopak', label: 'IndoPak' },
                ] as Array<{ id: QuranScript; label: string }>
              ).map((opt) => {
                const active = settings.script === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ script: opt.id })}
                    className="min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
                    style={{
                      backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Tajweed colors
                </span>
                <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Color Arabic letters by Quran Foundation tajweed rules
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Tajweed colors"
                aria-checked={settings.tajweedColors}
                onClick={() =>
                  updateSettings({ tajweedColors: !settings.tajweedColors })
                }
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: settings.tajweedColors
                    ? 'var(--accent)'
                    : 'var(--border-strong)',
                }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.tajweedColors ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Hifz Mode (Memorisation)
                </span>
                <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Blur the next ayah until tapped and enable repeat controls
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Hifz Mode (Memorisation)"
                aria-checked={settings.hifzMode}
                onClick={() =>
                  updateSettings({ hifzMode: !settings.hifzMode })
                }
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: settings.hifzMode
                    ? 'var(--accent)'
                    : 'var(--border-strong)',
                }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.hifzMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Arabic Font & Size */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Arabic Typography
            </h3>

            <div
              className="rounded-xl border px-4 py-5 text-center"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <p
                dir="rtl"
                lang="ar"
                translate="no"
                className={`notranslate quran-arabic-text leading-[2] ${getArabicFontClass(
                  settings.arabicFont
                )}`}
                style={{ fontSize: `${settings.arabicFontSize}px` }}
              >
                بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {FONT_OPTIONS.map((font) => {
                const active = settings.arabicFont === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => updateSettings({ arabicFont: font.id })}
                    className="flex min-h-[44px] items-center justify-between rounded-xl border px-3.5 py-2 text-left text-sm transition-colors"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                      backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <span className="font-medium">{font.label}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {font.scriptHint}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Arabic Font Size
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({
                      arabicFontSize: Math.max(16, settings.arabicFontSize - 2),
                    })
                  }
                  aria-label="Decrease Arabic font size"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm font-medium tabular-nums">
                  {settings.arabicFontSize}px
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({
                      arabicFontSize: Math.min(48, settings.arabicFontSize + 2),
                    })
                  }
                  aria-label="Increase Arabic font size"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          {/* Translation */}
          <section className="space-y-3 border-t pt-6" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Show Translation
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showTranslation}
                onClick={() =>
                  updateSettings({ showTranslation: !settings.showTranslation })
                }
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: settings.showTranslation
                    ? 'var(--accent)'
                    : 'var(--border-strong)',
                }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.showTranslation ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.showTranslation && (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="settings-translation-select"
                    className="block text-xs font-medium"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Translation
                  </label>
                  <select
                    id="settings-translation-select"
                    value={settings.translationId}
                    onChange={(e) =>
                      updateSettings({ translationId: Number(e.target.value) })
                    }
                    className="w-full min-h-[42px] rounded-xl border px-3 text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {translations.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {currentTranslation && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Translator: {currentTranslation.author_name}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Translation Font Size
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings({
                          translationFontSize: Math.max(14, settings.translationFontSize - 1),
                        })
                      }
                      aria-label="Decrease translation font size"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-sm font-medium tabular-nums">
                      {settings.translationFontSize}px
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings({
                          translationFontSize: Math.min(24, settings.translationFontSize + 1),
                        })
                      }
                      aria-label="Increase translation font size"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Reciter & Audio */}
          <section className="space-y-4 border-t pt-6" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Default Reciter & Audio
            </h3>

            <div className="space-y-1.5">
              <label
                htmlFor="settings-reciter"
                className="block text-xs font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Default Reciter
              </label>
              <ReciterSelector id="settings-reciter" className="w-full" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Auto-play Next Ayah
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoPlayNext}
                onClick={() => updateSettings({ autoPlayNext: !settings.autoPlayNext })}
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: settings.autoPlayNext
                    ? 'var(--accent)'
                    : 'var(--border-strong)',
                }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoPlayNext ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="block text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Play Urdu translation after Arabic
                </span>
                <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {URDU_AUDIO_CREDIT}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Play Urdu translation after Arabic"
                aria-checked={settings.autoPlayUrduAfterArabic}
                onClick={() =>
                  updateSettings({
                    autoPlayUrduAfterArabic: !settings.autoPlayUrduAfterArabic,
                  })
                }
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: settings.autoPlayUrduAfterArabic
                    ? 'var(--accent)'
                    : 'var(--border-strong)',
                }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoPlayUrduAfterArabic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {ttsSupported && (
              <div className="space-y-2.5 pt-2">
                <label
                  htmlFor="settings-tts-voice"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  English Translation Voice (Browser Speech Synthesis)
                </label>
                <select
                  id="settings-tts-voice"
                  value={settings.ttsVoiceURI}
                  onChange={(e) => updateSettings({ ttsVoiceURI: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border px-3 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">System Default English Voice</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* Daily Reminder Notifications */}
          <section className="space-y-3 border-t pt-6" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Daily Reminder
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {pushStatus === 'denied'
                    ? 'Blocked — re-enable in browser site settings'
                    : pushStatus === 'preview_unavailable'
                    ? 'Push backend not connected in preview'
                    : pushStatus === 'unsupported'
                    ? 'Not supported in this browser'
                    : pushStatus === 'enabled'
                    ? 'Daily 7:00 AM Dubai time reminder active'
                    : 'Daily 7:00 AM reminder for your reading goal'}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-label="Daily Reminder notifications"
                aria-checked={pushStatus === 'enabled'}
                disabled={pushBusy || pushStatus === 'denied' || pushStatus === 'unsupported'}
                onClick={async () => {
                  if (pushStatus === 'enabled') {
                    await disablePush();
                    showToast('Daily reading reminder turned off');
                  } else {
                    const next = await enablePush({
                      streak: currentStreak,
                      goalTarget: dailyGoal.target,
                      goalUnit: dailyGoal.unit,
                    });
                    if (next.status === 'enabled') {
                      showToast('Daily reading reminder enabled');
                    } else if (next.status === 'preview_unavailable') {
                      showToast('Push backend not connected in preview');
                    }
                  }
                }}
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-45"
                style={{
                  backgroundColor:
                    pushStatus === 'enabled' ? 'var(--accent)' : 'var(--border-strong)',
                }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    pushStatus === 'enabled' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
