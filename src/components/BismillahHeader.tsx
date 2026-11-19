import { useReader } from '../context/ReaderContext';
import { getArabicFontClass } from '../utils/text';

export function BismillahHeader() {
  const { settings } = useReader();

  return (
    <div
      className="border-b py-5 text-center"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {/*
        Bismillah literal below is verified byte-identical to Ayah 1:1
        (text_qpc_hafs). It must never be hand-edited, retyped, or
        normalised — any change must come from the official API field.
      */}
      <p
        dir="rtl"
        lang="ar"
        translate="no"
        className={`notranslate quran-arabic-text leading-[1.7] ${getArabicFontClass(
          settings.arabicFont
        )}`}
        style={{ fontSize: `${settings.arabicFontSize}px`, color: 'var(--text-primary)' }}
      >
        بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
      </p>
      {settings.showTranslation && (
        <div className="mt-3 flex flex-col items-center gap-2.5">
          <p
            className="font-editorial text-sm italic"
            style={{ color: 'var(--text-tertiary)' }}
          >
            In the Name of God, the Lord of Mercy, the Giver of Mercy (Abdel Haleem)
          </p>
          <span className="text-[10px]" style={{ color: 'var(--gold)' }} aria-hidden="true">
            ✦
          </span>
        </div>
      )}
    </div>
  );
}
