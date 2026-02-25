/**
 * News Service - Processes news content
 */

import type { NewsContent } from '../models/news';

/**
 * Create news content from input
 */
export function createNewsContent(
  headline: string,
  body: string,
  source?: string,
  url?: string
): NewsContent {
  return {
    headline: headline.trim(),
    body: body.trim(),
    source: source?.trim(),
    url: url?.trim(),
    createdAt: new Date(),
    publishedAt: new Date(),
  };
}

/**
 * Extract text content from news (headline + body)
 */
export function extractNewsText(news: NewsContent): string {
  return `${news.headline}\n\n${news.body}`.trim();
}

/**
 * Validate news content
 */
export function validateNewsContent(news: NewsContent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!news.headline || news.headline.trim().length === 0) {
    errors.push('Headline is required');
  }

  if (!news.body || news.body.trim().length === 0) {
    errors.push('Body content is required');
  }

  if (news.headline && news.headline.length > 500) {
    errors.push('Headline is too long (max 500 characters)');
  }

  if (news.body && news.body.length > 5000) {
    errors.push('Body content is too long (max 5000 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

