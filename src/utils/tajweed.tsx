import React from 'react';

export interface TajweedSegment {
  text: string;
  rule?: string;
}

const TAJWEED_RULE_LABELS: Record<string, string> = {
  ham_wasl: 'Hamzat Wasl',
  slnt: 'Silent',
  laam_shamsiyah: 'Lam Shamsiyah',
  madda_normal: 'Madd Normal (2)',
  madda_permissible: 'Madd Permissible (2/4/5)',
  madda_obligatory: 'Madd Obligatory (4/5)',
  madda_obligatory_monfasel: 'Madd Munfasil (4/5)',
  madda_obligatory_mottasel: 'Madd Muttasil (4/5)',
  madda_necessary: 'Madd Necessary (6)',
  qalaqah: 'Qalqalah',
  ghunnah: 'Ghunnah',
  ikhafa: 'Ikhfa',
  ikhafa_shafawi: 'Ikhfa Shafawi',
  idgham_ghunnah: 'Idgham with Ghunnah',
  idgham_wo_ghunnah: 'Idgham without Ghunnah',
  idgham_shafawi: 'Idgham Shafawi',
  idgham_mutajanisayn: 'Idgham Mutajanisayn',
  idgham_mutaqaribayn: 'Idgham Mutaqaribayn',
  iqlab: 'Iqlab',
};

const KNOWN_TAJWEED_RULES = new Set(Object.keys(TAJWEED_RULE_LABELS));

/**
 * Parses official Quran Foundation API tajweed markup
 * (using <tajweed class=...> or <rule class=...> tags) into plain segments.
 */
export function parseTajweedHtml(rawHtml: string): TajweedSegment[] {
  if (!rawHtml) return [];

  // Remove end-of-verse marker spans emitted in verse-level text_uthmani_tajweed
  const cleaned = rawHtml.replace(/<span\s+class=['"]?end['"]?[^>]*>.*?<\/span>/gi, '');

  const segments: TajweedSegment[] = [];
  const tagRegex = /<(tajweed|rule)\s+class=['"]?([a-zA-Z0-9_-]+)['"]?[^>]*>([\s\S]*?)<\/\1>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      const plainBefore = cleaned.slice(lastIndex, match.index).replace(/<[^>]+>/g, '');
      if (plainBefore) segments.push({ text: plainBefore });
    }

    const ruleName = match[2];
    const innerText = match[3].replace(/<[^>]+>/g, '');
    if (innerText) {
      segments.push({
        text: innerText,
        rule: KNOWN_TAJWEED_RULES.has(ruleName) ? ruleName : undefined,
      });
    }

    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    const trailing = cleaned.slice(lastIndex).replace(/<[^>]+>/g, '');
    if (trailing) segments.push({ text: trailing });
  }

  return segments;
}

export function renderTajweedNodes(rawHtml: string): React.ReactNode {
  const segments = parseTajweedHtml(rawHtml);
  if (segments.length === 0) return null;

  return segments.map((seg, idx) => {
    if (!seg.rule) {
      return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
    }
    const label = TAJWEED_RULE_LABELS[seg.rule];
    return (
      <span
        key={idx}
        className={`tajweed-${seg.rule}`}
        title={label}
      >
        {seg.text}
      </span>
    );
  });
}
