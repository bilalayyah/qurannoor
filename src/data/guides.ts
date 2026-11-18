import type { GuideArticle } from '../types/guides';
import { GUIDES_PART_1 } from './guidesPart1';
import { GUIDES_PART_2 } from './guidesPart2';
import { GUIDES_PART_3 } from './guidesPart3';
import { GUIDES_PART_4 } from './guidesPart4';

export const GUIDE_ARTICLES: GuideArticle[] = [
  ...GUIDES_PART_1,
  ...GUIDES_PART_2,
  ...GUIDES_PART_3,
  ...GUIDES_PART_4,
];

export function getGuideBySlug(slug: string | undefined): GuideArticle | undefined {
  if (!slug) return undefined;
  return GUIDE_ARTICLES.find((article) => article.slug === slug);
}

export function getGuideWordCount(article: GuideArticle): number {
  const blocks = [
    article.title,
    ...article.intro,
    ...article.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
    ...article.keyTakeaways,
    ...article.faqs.flatMap((f) => [f.question, f.answer]),
  ];
  return blocks
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
