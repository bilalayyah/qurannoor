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

interface TaggedChar {
  ch: string;
  rule?: string;
}

function parseTajweedChars(rawHtml: string): TaggedChar[] {
  if (!rawHtml) return [];

  // Remove end-of-verse marker spans emitted in verse-level text_uthmani_tajweed
  const cleaned = rawHtml.replace(/<span\s+class=['"]?end['"]?[^>]*>.*?<\/span>/gi, '');

  const chars: TaggedChar[] = [];
  const stack: Array<string | null> = [];
  let i = 0;

  while (i < cleaned.length) {
    if (cleaned[i] === '<') {
      const closeIdx = cleaned.indexOf('>', i);
      if (closeIdx === -1) break;
      const tag = cleaned.slice(i + 1, closeIdx).trim();
      if (tag.startsWith('/')) {
        stack.pop();
      } else {
        const m = tag.match(/^(?:tajweed|rule)\s+class=['"]?([a-zA-Z0-9_-]+)['"]?/i);
        const cls = m?.[1];
        stack.push(cls && KNOWN_TAJWEED_RULES.has(cls) ? cls : null);
      }
      i = closeIdx + 1;
    } else {
      let activeRule: string | undefined;
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s]) {
          activeRule = stack[s]!;
          break;
        }
      }
      chars.push({ ch: cleaned[i], rule: activeRule });
      i++;
    }
  }

  return chars;
}

/**
 * Parses official Quran Foundation API tajweed markup
 * (using <tajweed class=...> or <rule class=...> tags, including nested rules)
 * into plain segments.
 */
export function parseTajweedHtml(rawHtml: string): TajweedSegment[] {
  const chars = parseTajweedChars(rawHtml);
  if (chars.length === 0) return [];

  const segments: TajweedSegment[] = [];
  for (const { ch, rule } of chars) {
    const last = segments[segments.length - 1];
    if (last && last.rule === rule) {
      last.text += ch;
    } else {
      segments.push({ text: ch, rule });
    }
  }
  return segments;
}

function isArabicCombiningOrMark(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (
    (c >= 0x0610 && c <= 0x061a) ||
    (c >= 0x064b && c <= 0x065f) ||
    c === 0x0670 ||
    c === 0x0672 ||
    (c >= 0x06d6 && c <= 0x06ed) ||
    c === 0x200c
  );
}

function normalizeBaseLetter(ch: string): string {
  if (ch === 'ى' || ch === 'ٮ') return 'ي';
  if (ch === 'ٱ' || ch === 'أ' || ch === 'إ' || ch === 'آ') return 'ا';
  return ch;
}

interface QpcCluster {
  text: string;
  base: string;
  hasMaddaMark: boolean;
}

interface TajCluster {
  base: string;
  rule?: string;
  tatweelRule?: string;
  expectTatweel: boolean;
}

function groupQpcClusters(text: string): QpcCluster[] {
  const clusters: QpcCluster[] = [];
  for (const ch of text) {
    if (isArabicCombiningOrMark(ch) && clusters.length > 0) {
      const prev = clusters[clusters.length - 1];
      prev.text += ch;
      if (ch === '\u0670' || ch === '\u0653') {
        prev.hasMaddaMark = true;
      }
    } else {
      clusters.push({
        text: ch,
        base: normalizeBaseLetter(ch),
        hasMaddaMark: ch === '\u0670' || ch === '\u0653',
      });
    }
  }
  return clusters;
}

function groupTajClusters(chars: TaggedChar[]): TajCluster[] {
  const clusters: TajCluster[] = [];
  for (const { ch, rule } of chars) {
    if (ch === '\u0640') {
      if (clusters.length > 0) {
        clusters[clusters.length - 1].expectTatweel = true;
      }
      continue;
    }
    if (isArabicCombiningOrMark(ch) && clusters.length > 0) {
      const prev = clusters[clusters.length - 1];
      if (prev.expectTatweel && rule) {
        prev.tatweelRule = rule;
      } else if (!prev.rule && rule) {
        prev.rule = rule;
      }
    } else {
      clusters.push({
        base: normalizeBaseLetter(ch),
        rule,
        tatweelRule: undefined,
        expectTatweel: false,
      });
    }
  }
  return clusters;
}

/**
 * Projects official Tajweed rule colors from text_uthmani_tajweed onto
 * byte-identical text_qpc_hafs grapheme clusters so rendered Arabic text
 * never contains U+06DF or non-QPC characters and never splits combining marks.
 */
export function projectTajweedOntoQpcHafs(
  qpcText: string,
  rawTajweedHtml: string
): TajweedSegment[] {
  if (!qpcText) return [];
  const tajChars = parseTajweedChars(rawTajweedHtml);
  if (tajChars.length === 0) return [{ text: qpcText }];

  const qClusters = groupQpcClusters(qpcText);
  const tClusters = groupTajClusters(tajChars);
  const n = qClusters.length;
  const m = tClusters.length;

  const dp: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (qClusters[i].base === tClusters[j].base) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const assigned: Array<string | undefined> = new Array(n).fill(undefined);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (qClusters[i].base === tClusters[j].base) {
      const tc = tClusters[j];
      assigned[i] = tc.rule || (qClusters[i].hasMaddaMark ? tc.tatweelRule : undefined);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const segments: TajweedSegment[] = [];
  for (let k = 0; k < n; k++) {
    const rule = assigned[k];
    const last = segments[segments.length - 1];
    if (last && last.rule === rule) {
      last.text += qClusters[k].text;
    } else {
      segments.push({ text: qClusters[k].text, rule });
    }
  }

  return segments;
}

export function renderTajweedNodes(rawHtml: string, qpcText?: string): React.ReactNode {
  const segments = qpcText
    ? projectTajweedOntoQpcHafs(qpcText, rawHtml)
    : parseTajweedHtml(rawHtml);
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
