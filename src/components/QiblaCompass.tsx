import {
  CheckCircle2,
  Compass,
  Navigation,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCardinalDirection } from '../services/prayerApi';

interface QiblaCompassProps {
  qiblaDirection: number;
  locationLabel: string;
}

interface DeviceOrientationWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

type CompassSensorState = 'waiting' | 'prompt' | 'live' | 'denied' | 'unsupported';

const ALIGNMENT_THRESHOLD_DEG = 10;
const CHIME_REARM_THRESHOLD_DEG = 14;
const MUTED_STORAGE_KEY = 'qurannoor_qibla_muted_v1';

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function getScreenOrientationAngle(): number {
  if (typeof window === 'undefined') return 0;
  if (window.screen?.orientation && typeof window.screen.orientation.angle === 'number') {
    return window.screen.orientation.angle;
  }
  const legacyOrientation = (window as unknown as { orientation?: number }).orientation;
  return typeof legacyOrientation === 'number' && Number.isFinite(legacyOrientation)
    ? legacyOrientation
    : 0;
}

function extractCompassHeading(e: Event, isAbsoluteEvent: boolean): number | null {
  const event = e as DeviceOrientationWithWebkit;
  const screenAngle = getScreenOrientationAngle();

  if (
    typeof event.webkitCompassHeading === 'number' &&
    Number.isFinite(event.webkitCompassHeading)
  ) {
    return normalizeDeg(event.webkitCompassHeading + screenAngle);
  }

  const isAbsolute = isAbsoluteEvent ? event.absolute !== false : event.absolute === true;
  if (isAbsolute && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
    return normalizeDeg(360 - event.alpha + screenAngle);
  }

  return null;
}

async function checkMotionPermissionDenied(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return false;
  for (const name of ['accelerometer', 'magnetometer', 'gyroscope']) {
    try {
      const status = await navigator.permissions.query({ name: name as PermissionName });
      if (status.state === 'denied') return true;
    } catch {
      // Browser may not recognize this permission name; continue
    }
  }
  return false;
}

/**
 * Signed shortest angular difference in (-180, 180] from currentHeading to targetBearing.
 * Positive => target is clockwise (turn right).
 * Negative => target is counter-clockwise (turn left).
 */
export function getSignedQiblaDelta(targetBearing: number, currentHeading: number): number {
  let diff = ((targetBearing - currentHeading + 540) % 360) - 180;
  if (diff === -180) diff = 180;
  return diff;
}

/**
 * Unwraps targetDeg relative to prevDeg so rotations always take the shortest path across 0/360.
 */
function unwrapAngle(prevDeg: number | null, targetDeg: number): number {
  if (prevDeg === null || !Number.isFinite(prevDeg)) return targetDeg;
  const delta = ((((targetDeg - prevDeg) % 360) + 540) % 360) - 180;
  return prevDeg + delta;
}

export function QiblaCompass({ qiblaDirection, locationLabel }: QiblaCompassProps) {
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [sensorState, setSensorState] = useState<CompassSensorState>('waiting');
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [userActivatedSound, setUserActivatedSound] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeArmedRef = useRef<boolean>(true);
  const lastChimeAtRef = useRef<number>(0);
  const smoothDialRef = useRef<number | null>(null);
  const smoothNeedleRef = useRef<number | null>(null);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const sensorRetryRef = useRef<number>(0);

  const hasIOSRequestPermission =
    typeof window !== 'undefined' &&
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission === 'function';

  const unlockAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {
          // ignore resume failures
        });
      }
    } catch {
      // Web Audio unavailable
    }
  }, []);

  const playAlignmentChime = useCallback(() => {
    if (isMuted || !userActivatedSound) return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(60);
      }
    } catch {
      // ignore vibration errors
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const notes = [523.25, 659.25]; // Soft C5 -> E5 chime
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.11;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.11, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch {
      // ignore synthesis errors
    }
  }, [isMuted, userActivatedSound]);

  useEffect(() => {
    try {
      localStorage.setItem(MUTED_STORAGE_KEY, isMuted ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }, [isMuted]);

  const attachSensorListeners = useCallback(() => {
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorState('unsupported');
      return;
    }

    let receivedHeading = false;
    let hasAbsoluteStream = false;
    let disposed = false;

    const handleOrientation = (e: Event, isAbsoluteEvent: boolean) => {
      if (disposed) return;
      if (!isAbsoluteEvent && hasAbsoluteStream) {
        return;
      }

      const heading = extractCompassHeading(e, isAbsoluteEvent);
      if (heading === null) return;

      if (isAbsoluteEvent) {
        hasAbsoluteStream = true;
      }
      receivedHeading = true;
      sensorRetryRef.current = 0;
      setSensorState('live');
      setDeviceHeading((prev) => {
        if (prev !== null && Math.abs(getSignedQiblaDelta(heading, prev)) < 0.3) {
          return prev;
        }
        return heading;
      });
    };

    const onAbsolute = (e: Event) => handleOrientation(e, true);
    const onOrientationFallback = (e: Event) => handleOrientation(e, false);

    setSensorState('waiting');
    // Chrome on Android uses deviceorientationabsolute first; deviceorientation is fallback (iOS Safari / absolute events)
    window.addEventListener('deviceorientationabsolute', onAbsolute, true);
    window.addEventListener('deviceorientation', onOrientationFallback, true);

    const sensorCheckTimer = window.setTimeout(async () => {
      if (disposed || receivedHeading) return;
      // First loads can be slow to deliver the first heading (cold sensor):
      // re-attach a couple of times before giving up, so the compass can go
      // live on arrival without any tap.
      if (sensorRetryRef.current < 2) {
        sensorRetryRef.current += 1;
        attachSensorListeners();
        return;
      }
      const blocked = await checkMotionPermissionDenied();
      if (disposed || receivedHeading) return;
      setSensorState(blocked ? 'denied' : 'unsupported');
    }, 2500);

    cleanupListenersRef.current = () => {
      disposed = true;
      window.clearTimeout(sensorCheckTimer);
      window.removeEventListener('deviceorientationabsolute', onAbsolute, true);
      window.removeEventListener('deviceorientation', onOrientationFallback, true);
    };
  }, []);

  // Auto-attach directly on Android/non-iOS; show tap prompt only on iOS Safari where requestPermission is a function
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorState('unsupported');
      return;
    }

    if (hasIOSRequestPermission) {
      setSensorState('prompt');
      return;
    }

    attachSensorListeners();

    return () => {
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
        cleanupListenersRef.current = null;
      }
    };
  }, [hasIOSRequestPermission, attachSensorListeners]);

  useEffect(() => {
    return () => {
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
        cleanupListenersRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleEnableLiveCompass = async () => {
    unlockAudioContext();
    setUserActivatedSound(true);

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorState('unsupported');
      return;
    }

    const maybeRequestPermission = (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      }
    ).requestPermission;

    // Only call requestPermission when it is a function (iOS Safari)
    if (typeof maybeRequestPermission === 'function') {
      try {
        const result = await maybeRequestPermission();
        if (result === 'granted') {
          attachSensorListeners();
        } else {
          setSensorState('denied');
        }
      } catch {
        setSensorState('denied');
      }
      return;
    }

    // Android Chrome & other browsers: attach listeners directly without requestPermission
    attachSensorListeners();
  };

  const handleToggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      unlockAudioContext();
      setUserActivatedSound(true);
    }
  };

  const handleActivateChime = () => {
    unlockAudioContext();
    setIsMuted(false);
    setUserActivatedSound(true);
  };

  const normalizedBearing = normalizeDeg(qiblaDirection);
  const roundedBearing = Math.round(normalizedBearing);
  const cardinal = getCardinalDirection(normalizedBearing);
  const isLive = deviceHeading !== null;

  const signedDelta = isLive ? getSignedQiblaDelta(normalizedBearing, deviceHeading!) : 0;
  const absDelta = Math.abs(signedDelta);
  const roundedTurnDeg = Math.round(absDelta);
  const isAligned = isLive && absDelta <= ALIGNMENT_THRESHOLD_DEG;

  useEffect(() => {
    if (!isLive) {
      chimeArmedRef.current = true;
      return;
    }

    if (absDelta > CHIME_REARM_THRESHOLD_DEG) {
      chimeArmedRef.current = true;
      return;
    }

    if (isAligned && chimeArmedRef.current) {
      const now = Date.now();
      chimeArmedRef.current = false;
      if (now - lastChimeAtRef.current > 1200) {
        lastChimeAtRef.current = now;
        playAlignmentChime();
      }
    }
  }, [isLive, isAligned, absDelta, playAlignmentChime]);

  const targetDialRotation = isLive ? -deviceHeading! : 0;
  const targetNeedleRotation = isLive ? normalizedBearing - deviceHeading! : normalizedBearing;

  const dialRotation = isLive
    ? (smoothDialRef.current = unwrapAngle(smoothDialRef.current, targetDialRotation))
    : ((smoothDialRef.current = null), 0);

  const needleRotation = isLive
    ? (smoothNeedleRef.current = unwrapAngle(smoothNeedleRef.current, targetNeedleRotation))
    : ((smoothNeedleRef.current = null), normalizedBearing);

  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);

  const headerStatusLabel = isLive
    ? 'Live compass'
    : sensorState === 'waiting'
    ? 'Waiting for sensor…'
    : 'Static bearing';

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6 flex flex-col items-center text-center justify-between space-y-4 transition-colors duration-200"
      style={{
        backgroundColor: isAligned ? 'var(--accent-soft)' : 'var(--bg-surface)',
        borderColor: isAligned ? 'var(--accent)' : 'var(--border-subtle)',
        boxShadow: isAligned
          ? '0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent)'
          : undefined,
      }}
    >
      {/* Header Row */}
      <div className="w-full flex items-center justify-between gap-2">
        <div
          className="inline-flex items-center gap-2 text-xs font-semibold"
          style={{ color: 'var(--accent-text)' }}
        >
          <Compass className="h-4 w-4 shrink-0" />
          <span>Qibla Compass</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium"
            style={{ color: isAligned || isLive ? 'var(--accent-text)' : 'var(--text-tertiary)' }}
          >
            {headerStatusLabel}
          </span>

          <button
            type="button"
            onClick={handleToggleSound}
            aria-label={isMuted ? 'Unmute Qibla alignment sound' : 'Mute Qibla alignment sound'}
            aria-pressed={!isMuted}
            title={isMuted ? 'Alignment sound muted' : 'Alignment chime enabled'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: isMuted ? 'var(--border-subtle)' : 'var(--accent)',
              backgroundColor: isMuted ? 'transparent' : 'var(--bg-surface)',
              color: isMuted ? 'var(--text-tertiary)' : 'var(--accent-text)',
            }}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Status / Guidance Banner */}
      {isLive ? (
        isAligned ? (
          <div
            role="status"
            aria-live="polite"
            className="w-full rounded-xl px-4 py-3 text-white shadow-sm"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <p
              dir="rtl"
              lang="ar"
              className="font-quran-uthmanic text-xl leading-[1.8]"
            >
              القبلة هنا ✓
            </p>
            <div className="mt-0.5 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-base sm:text-lg font-bold tracking-tight">
                Qibla is here ✓
              </p>
            </div>
            <p className="mt-0.5 text-xs text-white/90 tabular-nums">
              Facing Qibla ({Math.round(deviceHeading!)}° · within ±{ALIGNMENT_THRESHOLD_DEG}°)
            </p>
          </div>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="w-full rounded-xl border px-4 py-3"
            style={{
              backgroundColor: 'var(--bg-muted)',
              borderColor: 'var(--border-strong)',
            }}
          >
            <div
              className="flex items-center justify-center gap-2 text-base sm:text-lg font-bold tracking-tight tabular-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {signedDelta >= 0 ? (
                <>
                  <RotateCw className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-text)' }} />
                  <span>Turn {roundedTurnDeg}° to your right →</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-text)' }} />
                  <span>← Turn {roundedTurnDeg}° to your left</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Turn until the Kaaba marker aligns with the top arrow
            </p>
          </div>
        )
      ) : (
        <div
          className="w-full rounded-xl border px-4 py-2.5"
          style={{
            backgroundColor: 'var(--bg-muted)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Point toward <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{`${roundedBearing}° ${cardinal}`}</span> from North
          </p>
        </div>
      )}

      {/* High-Clarity SVG Qibla Compass Dial */}
      <div className="relative flex items-center justify-center py-0.5">
        <svg
          width="244"
          height="252"
          viewBox="0 0 260 268"
          role="img"
          aria-label={
            isLive
              ? isAligned
                ? `Qibla is here. Aligned within ${roundedTurnDeg} degrees of ${roundedBearing} degrees from North.`
                : `Turn ${roundedTurnDeg} degrees ${signedDelta >= 0 ? 'right' : 'left'} toward Qibla at ${roundedBearing} degrees from North.`
              : `Qibla compass showing ${roundedBearing} degrees (${cardinal}) from North`
          }
          className="max-w-full h-auto"
        >
          {/* Fixed Phone-Heading Target at 12 O'Clock (when live compass is active) */}
          {isLive && (
            <g>
              <text
                x="130"
                y="12"
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                letterSpacing="0.06em"
                style={{ fill: isAligned ? 'var(--accent-text)' : 'var(--text-tertiary)' }}
              >
                YOU
              </text>
              <polygon
                points="130,24 123,15 137,15"
                style={{ fill: isAligned ? 'var(--accent)' : 'var(--text-primary)' }}
              />
            </g>
          )}

          {/* Outer Dial Circle */}
          <circle
            cx="130"
            cy="138"
            r="96"
            fill="var(--bg-surface)"
            strokeWidth={isAligned ? '3' : '1.75'}
            style={{
              stroke: isAligned ? 'var(--accent)' : 'var(--border-strong)',
            }}
          />

          {/* Inner Guide Circle */}
          <circle
            cx="130"
            cy="138"
            r="60"
            fill="none"
            strokeWidth="1"
            strokeDasharray="3 3"
            style={{ stroke: 'var(--border-subtle)' }}
          />

          {/* Rotating Compass Rose (ticks + N / E / S / W) */}
          <g transform={`rotate(${dialRotation} 130 138)`}>
            {ticks.map((deg) => {
              const isMajor = deg % 90 === 0;
              const isMed = deg % 30 === 0 && !isMajor;
              const innerR = isMajor ? 85 : isMed ? 89 : 92;
              return (
                <line
                  key={deg}
                  x1="130"
                  y1={138 - 96}
                  x2="130"
                  y2={138 - innerR}
                  strokeWidth={isMajor ? 2 : 1}
                  transform={`rotate(${deg} 130 138)`}
                  style={{
                    stroke:
                      deg === 0
                        ? 'var(--gold)'
                        : isMajor || isMed
                        ? 'var(--text-secondary)'
                        : 'var(--border-strong)',
                  }}
                />
              );
            })}

            <text
              x="130"
              y="69"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              style={{ fill: 'var(--gold)' }}
            >
              N
            </text>
            <text
              x="203"
              y="142"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              style={{ fill: 'var(--text-tertiary)' }}
            >
              E
            </text>
            <text
              x="130"
              y="215"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              style={{ fill: 'var(--text-tertiary)' }}
            >
              S
            </text>
            <text
              x="57"
              y="142"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              style={{ fill: 'var(--text-tertiary)' }}
            >
              W
            </text>
          </g>

          {/* Qibla Zone Highlight + Prominent Arrow + Kaaba Marker */}
          <g transform={`rotate(${needleRotation} 130 138)`}>
            {/* ±10° Qibla Alignment Sector & Rim Arc */}
            <path
              d="M 130 138 L 113.33 43.46 A 96 96 0 0 1 146.67 43.46 Z"
              style={{
                fill: 'var(--accent)',
                fillOpacity: isAligned ? 0.24 : 0.08,
              }}
            />
            <path
              d="M 113.33 43.46 A 96 96 0 0 1 146.67 43.46"
              fill="none"
              strokeLinecap="round"
              strokeWidth={isAligned ? 7 : 3.5}
              style={{ stroke: 'var(--accent)' }}
            />

            {/* Tail */}
            <line
              x1="130"
              y1="138"
              x2="130"
              y2="178"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ stroke: 'var(--border-strong)' }}
            />

            {/* Bold Qibla Arrow Shaft */}
            <line
              x1="130"
              y1="138"
              x2="130"
              y2="68"
              strokeWidth="4.5"
              strokeLinecap="round"
              style={{ stroke: 'var(--accent)' }}
            />

            {/* Crisp Arrowhead */}
            <polygon
              points="130,58 122,74 138,74"
              style={{ fill: 'var(--accent)' }}
            />

            {/* Prominent Kaaba Marker Badge on Rim */}
            <g>
              {isAligned && (
                <circle
                  cx="130"
                  cy="42"
                  r="19"
                  fill="none"
                  strokeWidth="2.5"
                  style={{ stroke: 'var(--accent)', opacity: 0.45 }}
                />
              )}
              <circle
                cx="130"
                cy="42"
                r="15"
                strokeWidth="2.5"
                style={{
                  fill: isAligned ? 'var(--accent)' : 'var(--bg-surface)',
                  stroke: isAligned ? '#FFFFFF' : 'var(--accent)',
                }}
              />
              {/* Kaaba Cube Symbol */}
              <rect
                x="122"
                y="34"
                width="16"
                height="16"
                rx="2"
                fill="#18181B"
                stroke="#D4AC5E"
                strokeWidth="1"
              />
              {/* Golden Kiswah Band */}
              <rect x="122.5" y="38.5" width="15" height="2.4" fill="#E5B85C" />
              {/* Kaaba Door Detail */}
              <rect x="128.5" y="43.5" width="3" height="5" rx="0.5" fill="#D4AC5E" />
            </g>
          </g>

          {/* Center Pivot */}
          <circle
            cx="130"
            cy="138"
            r="6.5"
            style={{ fill: 'var(--bg-surface)', stroke: 'var(--accent)' }}
            strokeWidth="3.5"
          />
        </svg>
      </div>

      {/* Clear Bearing Readout */}
      <div className="space-y-1">
        <p
          className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums"
          style={{ color: isAligned ? 'var(--accent-text)' : 'var(--text-primary)' }}
        >
          Qibla {roundedBearing}° from North
        </p>
        <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          Exact bearing: {normalizedBearing.toFixed(1)}° ({cardinal}) · {locationLabel}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Source: Aladhan Qibla API
        </p>
      </div>

      {/* Live Compass Activation — button only on iOS, where Apple requires a tap
          for motion permission; on Android the compass auto-enables on arrival */}
      {sensorState === 'prompt' && (
        <button
          type="button"
          onClick={handleEnableLiveCompass}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Navigation className="h-4 w-4 shrink-0" />
          <span>Enable live compass</span>
        </button>
      )}

      <p
        role="status"
        aria-live="polite"
        className="text-xs leading-relaxed"
        style={{
          color:
            sensorState === 'live'
              ? 'var(--accent-text)'
              : sensorState === 'denied'
              ? 'var(--gold)'
              : 'var(--text-tertiary)',
        }}
      >
        {isLive
          ? 'Live — move your phone to find Qibla'
          : sensorState === 'waiting'
          ? 'Waiting for sensor…'
          : sensorState === 'prompt'
          ? 'Tap "Enable live compass" above to activate live pointing'
          : sensorState === 'denied'
          ? 'Motion sensor access is blocked for this site. Tap the lock icon in your browser’s address bar → Site settings → allow Motion sensors and Location, then reload.'
          : 'Live compass is not available on this device — showing static bearing'}
      </p>

      {isLive && !userActivatedSound && !isMuted && (
        <button
          type="button"
          onClick={handleActivateChime}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--accent-text)',
          }}
        >
          <Volume2 className="h-3.5 w-3.5" />
          <span>Tap to enable alignment chime &amp; vibration</span>
        </button>
      )}
    </div>
  );
}
