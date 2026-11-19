import type { Reciter } from '../types/quran';
import { normalizeArabicForSearch, normalizeLatinForSearch } from './localSearch';

const RECITER_ARABIC_BY_ID: Record<number, string> = {
  1: 'عبد الباسط عبد الصمد',
  2: 'عبد الباسط عبد الصمد',
  3: 'عبد الرحمن السديس',
  4: 'أبو بكر الشاطري',
  5: 'هاني الرفاعي',
  6: 'محمود خليل الحصري',
  7: 'مشاري راشد العفاسي',
  8: 'محمد صديق المنشاوي',
  9: 'محمد صديق المنشاوي',
  10: 'سعود الشريم',
  11: 'محمد الطبلاوي',
  12: 'محمود خليل الحصري',
  13: 'سعد الغامدي',
  19: 'أحمد بن علي العجمي',
  158: 'عبد الله علي جابر',
  159: 'ماهر المعيقلي',
  160: 'بندر بليلة',
  161: 'خليفة الطنيجي',
  168: 'محمد صديق المنشاوي',
  173: 'مشاري راشد العفاسي',
  174: 'ياسر الدوسري',
  175: 'عبد الله حمد أبو شريدة',
  176: 'أحمد عبد الحميد طاحون',
};

const RECITER_ARABIC_BY_KEY: Array<[string, string]> = [
  ['afasy', 'مشاري راشد العفاسي'],
  ['husary', 'محمود خليل الحصري'],
  ['abdulbaset', 'عبد الباسط عبد الصمد'],
  ['abdulbasit', 'عبد الباسط عبد الصمد'],
  ['sudais', 'عبد الرحمن السديس'],
  ['minshawi', 'محمد صديق المنشاوي'],
  ['shuraym', 'سعود الشريم'],
  ['shuraim', 'سعود الشريم'],
  ['shatri', 'أبو بكر الشاطري'],
  ['rifai', 'هاني الرفاعي'],
  ['tablawi', 'محمد الطبلاوي'],
  ['tunaiji', 'خليفة الطنيجي'],
  ['taniji', 'خليفة الطنيجي'],
  ['ghamdi', 'سعد الغامدي'],
  ['ajmy', 'أحمد بن علي العجمي'],
  ['ajmi', 'أحمد بن علي العجمي'],
  ['jabir', 'عبد الله علي جابر'],
  ['jaber', 'عبد الله علي جابر'],
  ['muaiqly', 'ماهر المعيقلي'],
  ['baleela', 'بندر بليلة'],
  ['balila', 'بندر بليلة'],
  ['dussary', 'ياسر الدوسري'],
  ['dosari', 'ياسر الدوسري'],
  ['sharida', 'عبد الله حمد أبو شريدة'],
  ['tahoun', 'أحمد عبد الحميد طاحون'],
  ['mustafaismail', 'مصطفى إسماعيل'],
];

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

export function getReciterArabicName(reciter: Reciter): string {
  const byId = RECITER_ARABIC_BY_ID[reciter.id];
  if (byId) return byId;

  if (reciter.translated_name?.name && ARABIC_CHAR_REGEX.test(reciter.translated_name.name)) {
    return reciter.translated_name.name;
  }

  // Shared normaliser (localSearch.ts) lowercases and strips diacritics;
  // spaces/colons are stripped here because the lookup keys are
  // concatenated ('abdulbaset', not 'abdul baset').
  const normalized = normalizeLatinForSearch(reciter.reciter_name).replace(/[\s:]/g, '');
  for (const [needle, arabicName] of RECITER_ARABIC_BY_KEY) {
    if (normalized.includes(needle)) {
      return arabicName;
    }
  }

  return '';
}

export function getReciterStyleTags(reciter: Reciter): string[] {
  const tags: string[] = [];
  const rawStyle = reciter.style?.trim();
  const lowerName = reciter.reciter_name.toLowerCase();

  if (rawStyle) {
    if (/kids/i.test(rawStyle)) {
      tags.push('Kids');
    } else {
      tags.push(rawStyle);
    }
  } else if (lowerName.includes('with kids')) {
    tags.push('Kids');
  }

  if (lowerName.includes('streaming') && !tags.some((t) => /streaming/i.test(t))) {
    tags.push('Streaming');
  }

  return tags;
}

export function formatReciterCombinedName(reciter: Reciter): string {
  const arabic = getReciterArabicName(reciter);
  return arabic ? `${reciter.reciter_name} — ${arabic}` : reciter.reciter_name;
}

export function matchesReciterQuery(reciter: Reciter, rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return true;

  const lowerQ = q.toLowerCase();
  if (reciter.reciter_name.toLowerCase().includes(lowerQ)) return true;
  if (reciter.translated_name?.name?.toLowerCase().includes(lowerQ)) return true;

  const tags = getReciterStyleTags(reciter);
  if (tags.some((tag) => tag.toLowerCase().includes(lowerQ))) return true;
  if (reciter.qirat && reciter.qirat.toLowerCase().includes(lowerQ)) return true;

  const arabicName = getReciterArabicName(reciter);
  if (arabicName) {
    const normArabic = normalizeArabicForSearch(arabicName);
    const normQuery = normalizeArabicForSearch(q);
    if (normArabic.includes(normQuery) || arabicName.includes(q)) return true;
  }

  return false;
}
