import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QuranNoorLogo, QuranNoorMark } from '../components/BrandLogo';
import { useReader } from '../context/ReaderContext';
import { usePageMetadata } from '../hooks/usePageMetadata';

interface ColorSwatch {
  name: string;
  hex: string;
  role: string;
  textDark?: boolean;
}

const LIGHT_SWATCHES: ColorSwatch[] = [
  { name: 'Deep Emerald', hex: '#0E6B4B', role: 'Primary brand accent & CTAs' },
  { name: 'Antique Gold', hex: '#B88B3A', role: 'Ayah markers & subtle ornaments' },
  { name: 'Warm Ivory', hex: '#FAF8F3', role: 'Primary canvas background', textDark: true },
  { name: 'Alabaster Surface', hex: '#FFFFFF', role: 'Elevated reading cards', textDark: true },
  { name: 'Limestone Muted', hex: '#F1EFE8', role: 'Subtle controls & dividers', textDark: true },
  { name: 'Obsidian Olive', hex: '#1A1F1C', role: 'Primary Arabic & English text' },
  { name: 'Slate Sage', hex: '#525B55', role: 'Secondary translation prose' },
  { name: 'Hairline Stone', hex: '#E7E4DC', role: 'Card & section borders', textDark: true },
];

const DARK_SWATCHES: ColorSwatch[] = [
  { name: 'Night Forest', hex: '#0F1411', role: 'Dark mode canvas background' },
  { name: 'Elevated Pine', hex: '#161D19', role: 'Dark mode surface cards' },
  { name: 'Illuminated Emerald', hex: '#1F9D70', role: 'Primary button & active state' },
  { name: 'Emerald Highlight', hex: '#3FD09A', role: 'Active navigation & links', textDark: true },
  { name: 'Luminous Gold', hex: '#D4AC5E', role: 'Dark mode Ayah markers', textDark: true },
  { name: 'Soft Pearl', hex: '#F2F4F1', role: 'Primary dark mode text', textDark: true },
];

export function BrandPage() {
  usePageMetadata({
    title: 'Brand Identity System – QuranNoor',
    description:
      'Official QuranNoor (QuranNoor.com) brand identity system: geometric symbol, light and dark logo variations, app icons, exact HEX palette, and Arabic/English typography.',
    canonicalPath: '/brand',
  });

  const { showToast } = useReader();
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const handleCopyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      showToast(`Copied ${hex}`);
      setTimeout(() => setCopiedHex(null), 1600);
    } catch {
      showToast(hex);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 space-y-16">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Brand Identity' }]} />

      {/* Intro Header */}
      <header className="space-y-3 border-b pb-10" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--gold)' }}>
          QuranNoor.com · Read. Listen. Reflect.
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Brand Identity System
        </h1>
        <p className="max-w-2xl text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          An Apple-minimalist Islamic digital visual system pairing warm archival ivory, deep emerald
          green, and restrained antique gold accents with authentic Uthmani Quranic calligraphy.
        </p>
      </header>

      {/* 1. Logo & Wordmark Variations */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            01. Logo & Wordmark System
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Original geometric symbol uniting an open Mushaf cradle with an 8-point Rub el Hizb star of light (Noor).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Light Canvas Horizontal */}
          <div
            className="flex flex-col justify-between rounded-2xl border p-8 min-h-[180px]"
            style={{ backgroundColor: '#FAF8F3', borderColor: '#E7E4DC' }}
          >
            <span className="text-xs font-medium" style={{ color: '#707A73' }}>
              Horizontal · Light Background
            </span>
            <div className="py-4">
              <QuranNoorLogo variant="horizontal" tone="light" size="lg" showTagline />
            </div>
            <span className="text-[11px]" style={{ color: '#707A73' }}>
              Primary website header lockup
            </span>
          </div>

          {/* Dark Canvas Horizontal */}
          <div
            className="flex flex-col justify-between rounded-2xl border p-8 min-h-[180px]"
            style={{ backgroundColor: '#0F1411', borderColor: '#232D27' }}
          >
            <span className="text-xs font-medium" style={{ color: '#818D85' }}>
              Horizontal · Dark Background
            </span>
            <div className="py-4">
              <QuranNoorLogo variant="horizontal" tone="dark" size="lg" showTagline />
            </div>
            <span className="text-[11px]" style={{ color: '#818D85' }}>
              Dark mode header & night reading lockup
            </span>
          </div>

          {/* Emerald Canvas Stacked */}
          <div
            className="flex flex-col justify-between rounded-2xl border p-8 min-h-[190px]"
            style={{ backgroundColor: '#0E6B4B', borderColor: '#0A543B' }}
          >
            <span className="text-xs font-medium text-white/75">
              Stacked · Brand Emerald
            </span>
            <div className="py-4 flex justify-center">
              <QuranNoorLogo variant="stacked" tone="emerald" size="lg" showTagline />
            </div>
            <span className="text-[11px] text-white/75">
              Splash screens & editorial covers
            </span>
          </div>

          {/* Compact Symbols */}
          <div
            className="flex flex-col justify-between rounded-2xl border p-8 min-h-[190px]"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Compact Mark & Icons
            </span>
            <div className="flex flex-wrap items-center gap-6 py-4">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border"
                  style={{ backgroundColor: '#FAF8F3', borderColor: '#E7E4DC' }}
                >
                  <QuranNoorMark size={30} tone="light" />
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  Light Mark
                </span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border"
                  style={{ backgroundColor: '#0F1411', borderColor: '#232D27' }}
                >
                  <QuranNoorMark size={30} tone="dark" />
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  Dark Mark
                </span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <img
                  src="/favicon.svg"
                  alt="QuranNoor browser favicon"
                  className="h-14 w-14 rounded-2xl shadow-sm"
                />
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  Favicon
                </span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <img
                  src="/icon-app.svg"
                  alt="QuranNoor app icon"
                  className="h-14 w-14 rounded-2xl shadow-sm"
                />
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  App Icon
                </span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <img
                  src="/icon-social.svg"
                  alt="QuranNoor social profile icon"
                  className="h-14 w-14 rounded-full border shadow-sm"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  Social Avatar
                </span>
              </div>
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              Vector assets: /favicon.svg · /icon-app.svg · /icon-social.svg
            </span>
          </div>
        </div>
      </section>

      {/* 2. Color Palette */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            02. Color Palette & Contrast System
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Click any swatch to copy its exact HEX code. Designed for 60% neutral canvas, 30% structural surfaces, and 10% emerald & gold accents.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
            Light Theme & Core Brand Palette
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LIGHT_SWATCHES.map((swatch) => (
              <button
                key={swatch.hex + swatch.name}
                type="button"
                onClick={() => handleCopyHex(swatch.hex)}
                className="group flex flex-col overflow-hidden rounded-xl border text-left transition-colors hover:border-[#0E6B4B]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div
                  className="flex h-20 w-full items-end justify-between p-3"
                  style={{ backgroundColor: swatch.hex }}
                >
                  <span
                    className={`font-mono text-xs font-semibold ${
                      swatch.textDark ? 'text-[#1A1F1C]' : 'text-white'
                    }`}
                  >
                    {swatch.hex}
                  </span>
                  {copiedHex === swatch.hex ? (
                    <Check className={`h-3.5 w-3.5 ${swatch.textDark ? 'text-[#1A1F1C]' : 'text-white'}`} />
                  ) : (
                    <Copy
                      className={`h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-80 ${
                        swatch.textDark ? 'text-[#1A1F1C]' : 'text-white'
                      }`}
                    />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {swatch.name}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {swatch.role}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
            Dark Reading Mode Palette
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {DARK_SWATCHES.map((swatch) => (
              <button
                key={swatch.hex + swatch.name}
                type="button"
                onClick={() => handleCopyHex(swatch.hex)}
                className="group flex flex-col overflow-hidden rounded-xl border text-left transition-colors hover:border-[#0E6B4B]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div
                  className="flex h-16 w-full items-end justify-between p-2.5"
                  style={{ backgroundColor: swatch.hex }}
                >
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      swatch.textDark ? 'text-[#0F1411]' : 'text-white'
                    }`}
                  >
                    {swatch.hex}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {swatch.name}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {swatch.role}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Typography System */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            03. Arabic & English Typography
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Classical Quranic script legibility paired with crisp Plus Jakarta Sans UI and Source Serif 4 translations.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            className="rounded-2xl border p-6 space-y-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--gold)' }}>
              Arabic Quran Script · Scheherazade New (Default)
            </p>
            <p
              dir="rtl"
              lang="ar"
              translate="no"
              className="notranslate font-quran-scheherazade quran-arabic-text text-xl leading-[1.85]"
              style={{ color: 'var(--text-primary)' }}
            >
              ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ <span style={{ color: 'var(--gold)' }}>﴿٢﴾</span>
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              Additional Arabic options in Reader Settings: Noto Naskh Arabic and Lateef (IndoPak).
            </p>
          </div>

          <div
            className="rounded-2xl border p-6 space-y-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--gold)' }}>
              English Pairing · Plus Jakarta Sans & Source Serif 4
            </p>
            <p className="font-ui text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Plus Jakarta Sans — UI Headings & Navigation
            </p>
            <p className="font-editorial text-base leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
              “All praise belongs to God, Lord of all the worlds.” — Source Serif 4 provides serene,
              book-grade readability beneath every Arabic Ayah.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
