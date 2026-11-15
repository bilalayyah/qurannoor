import React from 'react';

export interface BrandMarkProps {
  size?: number;
  tone?: 'auto' | 'light' | 'dark' | 'emerald';
  className?: string;
}

/**
 * Original QuranNoor geometric emblem:
 * An open Mushaf balanced beneath an 8-point Rub el Hizb star of light (Noor).
 */
export function QuranNoorMark({
  size = 28,
  tone = 'auto',
  className = '',
}: BrandMarkProps) {
  const primaryStroke =
    tone === 'light'
      ? '#0E6B4B'
      : tone === 'dark'
      ? '#FAF8F3'
      : tone === 'emerald'
      ? '#FAF8F3'
      : 'var(--accent)';

  const goldStroke =
    tone === 'light'
      ? '#B88B3A'
      : tone === 'dark'
      ? '#D4AC5E'
      : tone === 'emerald'
      ? '#D4AC5E'
      : 'var(--gold)';

  const starDotFill =
    tone === 'light'
      ? '#0E6B4B'
      : tone === 'dark'
      ? '#FAF8F3'
      : tone === 'emerald'
      ? '#FAF8F3'
      : 'var(--accent)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* 8-point geometric Noor star */}
      <g transform="translate(32 15.5)">
        <rect
          x="-5.2"
          y="-5.2"
          width="10.4"
          height="10.4"
          rx="1"
          stroke={goldStroke}
          strokeWidth="2.1"
        />
        <rect
          x="-5.2"
          y="-5.2"
          width="10.4"
          height="10.4"
          rx="1"
          transform="rotate(45)"
          stroke={goldStroke}
          strokeWidth="2.1"
        />
        <circle cx="0" cy="0" r="2.1" fill={starDotFill} />
      </g>

      {/* Open Mushaf Pages */}
      <path
        d="M11 27.5C17.8 25.8 25.6 27.8 32 32.2V50.5C25.6 46.4 17.8 45 11 46.5V27.5Z"
        stroke={primaryStroke}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M53 27.5C46.2 25.8 38.4 27.8 32 32.2V50.5C38.4 46.4 46.2 45 53 46.5V27.5Z"
        stroke={primaryStroke}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* Subtle architectural book cradle */}
      <path
        d="M9 51C17 49.4 25.2 50.6 32 54.5C38.8 50.6 47 49.4 55 51"
        stroke={goldStroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface QuranNoorLogoProps {
  variant?: 'horizontal' | 'compact' | 'stacked';
  tone?: 'auto' | 'light' | 'dark' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export function QuranNoorLogo({
  variant = 'horizontal',
  tone = 'auto',
  size = 'md',
  showTagline = false,
  className = '',
}: QuranNoorLogoProps) {
  const markSize = size === 'sm' ? 24 : size === 'lg' ? 38 : 28;

  const textColor =
    tone === 'light'
      ? '#1A1F1C'
      : tone === 'dark' || tone === 'emerald'
      ? '#FAF8F3'
      : 'var(--text-primary)';

  const accentWordColor =
    tone === 'light'
      ? '#0E6B4B'
      : tone === 'dark'
      ? '#3FD09A'
      : tone === 'emerald'
      ? '#D4AC5E'
      : 'var(--accent-text)';

  const subColor =
    tone === 'light'
      ? '#525B55'
      : tone === 'dark' || tone === 'emerald'
      ? '#B0BAB3'
      : 'var(--text-tertiary)';

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl ${className}`}
        style={{
          width: markSize + 12,
          height: markSize + 12,
          backgroundColor: tone === 'emerald' ? '#0E6B4B' : undefined,
        }}
      >
        <QuranNoorMark size={markSize} tone={tone} />
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`inline-flex flex-col items-center text-center gap-2.5 ${className}`}>
        <QuranNoorMark size={markSize + 10} tone={tone} />
        <div className="leading-none">
          <span
            className="font-ui text-xl sm:text-2xl font-semibold tracking-[-0.025em]"
            style={{ color: textColor }}
          >
            Quran<span style={{ color: accentWordColor }}>Noor</span>
          </span>
          {showTagline && (
            <p className="mt-1.5 text-xs tracking-wide" style={{ color: subColor }}>
              Read. Listen. Reflect.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <QuranNoorMark size={markSize} tone={tone} />
      <div className="flex flex-col leading-none">
        <span
          className={`font-ui font-semibold tracking-[-0.025em] whitespace-nowrap shrink-0 ${
            size === 'sm'
              ? 'text-base'
              : size === 'lg'
              ? 'text-xl sm:text-2xl'
              : 'text-[17px] sm:text-[18px]'
          }`}
          style={{ color: textColor }}
        >
          Quran<span style={{ color: accentWordColor }}>Noor</span>
        </span>
        {showTagline && (
          <span className="mt-1 text-[11px] font-medium tracking-wide" style={{ color: subColor }}>
            Read. Listen. Reflect.
          </span>
        )}
      </div>
    </div>
  );
}
