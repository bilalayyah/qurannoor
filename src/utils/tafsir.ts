export interface TafsirBlock {
  type: 'heading' | 'paragraph' | 'arabic';
  text: string;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—');
}

function stripTagsClean(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts HTML returned by Quran Foundation Tafsir API into structured blocks
 * without using dangerouslySetInnerHTML or inventing any text.
 */
export function parseTafsirBlocks(rawHtml: string): TafsirBlock[] {
  if (!rawHtml) return [];

  const blocks: TafsirBlock[] = [];
  const blockRegex =
    /<(h[1-4]|p|div)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(rawHtml)) !== null) {
    if (match.index > lastIndex) {
      const loose = stripTagsClean(rawHtml.slice(lastIndex, match.index));
      if (loose) {
        blocks.push({ type: 'paragraph', text: loose });
      }
    }

    const fullOpenTag = match[0].slice(0, match[0].indexOf('>') + 1);
    const tag = match[1].toLowerCase();
    const inner = stripTagsClean(match[2]);

    if (inner) {
      if (tag.startsWith('h')) {
        blocks.push({ type: 'heading', text: inner });
      } else if (tag === 'div' && /class=['"]?[^'">]*arabic/i.test(fullOpenTag)) {
        blocks.push({ type: 'arabic', text: inner });
      } else if (tag === 'div' && /<(?:h[1-4]|p|div)\b/i.test(match[2])) {
        blocks.push(...parseTafsirBlocks(match[2]));
      } else {
        blocks.push({ type: 'paragraph', text: inner });
      }
    }

    lastIndex = blockRegex.lastIndex;
  }

  if (lastIndex < rawHtml.length) {
    const trailing = stripTagsClean(rawHtml.slice(lastIndex));
    if (trailing) {
      blocks.push({ type: 'paragraph', text: trailing });
    }
  }

  if (blocks.length === 0) {
    const plain = stripTagsClean(rawHtml);
    if (plain) blocks.push({ type: 'paragraph', text: plain });
  }

  return blocks;
}

export function getShortTafsirSlice(
  blocks: TafsirBlock[],
  maxChars = 750
): { visible: TafsirBlock[]; hasMore: boolean } {
  if (blocks.length === 0) return { visible: [], hasMore: false };

  const visible: TafsirBlock[] = [];
  let chars = 0;

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (
      visible.length >= 3 ||
      (chars >= 120 && chars + block.text.length > maxChars)
    ) {
      return { visible, hasMore: true };
    }
    visible.push(block);
    chars += block.text.length;
  }

  return { visible, hasMore: false };
}
