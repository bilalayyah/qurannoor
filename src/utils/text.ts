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
  font: 'amiri-quran' | 'scheherazade' | 'noto-naskh' | 'lateef'
): string {
  switch (font) {
    case 'scheherazade':
      return 'font-quran-scheherazade';
    case 'noto-naskh':
      return 'font-quran-noto-naskh';
    case 'lateef':
      return 'font-quran-lateef';
    case 'amiri-quran':
    default:
      return 'font-quran-amiri-quran';
  }
}
