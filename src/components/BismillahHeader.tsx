import { useReader } from '../context/ReaderContext';
import { getArabicFontClass } from '../utils/text';

export function BismillahHeader() {
  const { settings } = useReader();

  return (
    <div
      className="border-b py-9 text-center"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <p
        dir="rtl"
        lang="ar"
        translate="no"
        className={`notranslate quran-arabic-text text-3xl sm:text-4xl leading-[2.1] ${getArabicFontClass(
          settings.arabicFont
        )}`}
        style={{ color: 'var(--text-primary)' }}
      >
        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
      </p>
      {settings.showTranslation && (
        <div className="mt-3 flex flex-col items-center gap-2.5">
          <p
            className="font-editorial text-sm italic"
            style={{ color: 'var(--text-tertiary)' }}
          >
            In the Name of God, the Lord of Mercy, the Giver of Mercy
          </p>
          <span className="text-[10px]" style={{ color: 'var(--gold)' }} aria-hidden="true">
            ✦
          </span>
        </div>
      )}
    </div>
  );
}
