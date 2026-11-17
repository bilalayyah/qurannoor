import { SURAH_VERSE_COUNTS } from './ayahOfTheDay';

const URDU_AUDIO_BASE_URL = 'https://cdn.islamic.network/quran/audio/64/ur.khan';
export const URDU_AUDIO_CREDIT = 'Urdu · Shamshad Ali Khan (Jalandhari)';

export function getGlobalAyahNumber(chapterId: number, verseNumber: number): number | null {
  if (
    !Number.isInteger(chapterId) ||
    chapterId < 1 ||
    chapterId > SURAH_VERSE_COUNTS.length ||
    !Number.isInteger(verseNumber) ||
    verseNumber < 1 ||
    verseNumber > SURAH_VERSE_COUNTS[chapterId - 1]
  ) {
    return null;
  }

  let offset = 0;
  for (let i = 0; i < chapterId - 1; i += 1) {
    offset += SURAH_VERSE_COUNTS[i];
  }
  return offset + verseNumber;
}

export function getUrduAyahAudioUrl(chapterId: number, verseNumber: number): string | null {
  const globalNumber = getGlobalAyahNumber(chapterId, verseNumber);
  if (!globalNumber) return null;
  return `${URDU_AUDIO_BASE_URL}/${globalNumber}.mp3`;
}
