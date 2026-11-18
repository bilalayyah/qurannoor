export type GuideCategory = 'Daily Reading' | 'Tajweed & Hifz' | 'Quran Study';

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideRelatedLink {
  label: string;
  to: string;
}

export interface GuideArticle {
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  category: GuideCategory;
  arabicAccent?: string;
  author: string;
  publishedAt: string;
  readingTimeMinutes: number;
  summary: string;
  intro: string[];
  sections: GuideSection[];
  keyTakeaways: string[];
  faqs: GuideFaq[];
  relatedLinks: GuideRelatedLink[];
}
