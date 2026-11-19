export function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTranslationHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<\/?em>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toArabicIndicDigits(num: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((ch) => (ch >= '0' && ch <= '9' ? digits[Number(ch)] : ch))
    .join('');
}

export function getArabicFontClass(
  font: 'scheherazade' | 'noto-naskh' | 'lateef' | string
): string {
  switch (font) {
    case 'noto-naskh':
      return 'font-quran-noto-naskh';
    case 'lateef':
      return 'font-quran-lateef';
    case 'scheherazade':
    default:
      return 'font-quran-scheherazade';
  }
}

export const URDU_RESOURCE_ID = 234;

export function getEnglishTranslation<
  T extends { resource_id: number; text: string }
>(translations?: T[] | null, preferredId?: number): T | undefined {
  if (!translations || translations.length === 0) return undefined;
  if (preferredId && preferredId !== URDU_RESOURCE_ID) {
    const exact = translations.find((t) => t.resource_id === preferredId);
    if (exact) return exact;
  }
  return (
    translations.find((t) => t.resource_id !== URDU_RESOURCE_ID) ||
    translations[0]
  );
}

// Strips only the trailing ayah-end marker (whitespace/NBSP + Arabic-Indic
// digits) from QPC Hafs text. Verse text itself is never altered.
export function stripQpcHafsEndMarker(text?: string | null): string {
  if (!text) return '';
  return text.replace(/[\s\u00A0]+[\u0660-\u0669]+$/, '');
}

// Removes U+06DF (۟) — the character the UthmanicHafs font renders as a
// black dot. Used only as a safeguard on the text_uthmani fallback path.
function stripBlackDotChar(text: string): string {
  return text.replace(/\u06DF/g, '');
}

export function getVerseArabicText(
  verse: {
    text_qpc_hafs?: string;
    text_uthmani?: string;
    text_indopak?: string;
  },
  script: 'uthmani' | 'indopak' | string
): string {
  if (script === 'indopak' && verse.text_indopak) {
    return verse.text_indopak;
  }
  return (
    stripQpcHafsEndMarker(verse.text_qpc_hafs) ||
    (verse.text_uthmani ? stripBlackDotChar(verse.text_uthmani) : '') ||
    ''
  );
}

export function getWordArabicText(
  word: {
    text_qpc_hafs?: string;
    text_uthmani?: string;
    text_indopak?: string;
    text?: string;
  },
  script: 'uthmani' | 'indopak' | string
): string {
  if (script === 'indopak' && word.text_indopak) {
    return word.text_indopak;
  }
  return word.text_qpc_hafs || word.text_uthmani || word.text || '';
}

export function getUrduTranslation<
  T extends { resource_id: number; text: string }
>(translations?: T[] | null): T | undefined {
  if (!translations || translations.length === 0) return undefined;
  return translations.find((t) => t.resource_id === URDU_RESOURCE_ID);
}
