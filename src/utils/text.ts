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

export function getUrduTranslation<
  T extends { resource_id: number; text: string }
>(translations?: T[] | null): T | undefined {
  if (!translations || translations.length === 0) return undefined;
  return translations.find((t) => t.resource_id === URDU_RESOURCE_ID);
}
