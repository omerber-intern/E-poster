/**
 * Template Service - Renders post templates with variable substitution.
 */

import {
  NEWS_POST_TEMPLATE,
  EDUCATIONAL_POST_TEMPLATE,
} from '../models/template';

/**
 * Render a news post template.
 */
export function renderNewsPost(vars: {
  portfolioUsername: string;
  aiContent: string;
  topTickers: string[];
  newsUrl?: string;
  disclaimer?: string;
}): string {
  return render(NEWS_POST_TEMPLATE, {
    PORTFOLIO_USERNAME: vars.portfolioUsername,
    AI_CONTENT: vars.aiContent,
    TOP_TICKERS: vars.topTickers.map((t) => `$${t}`).join(' '),
    NEWS_URL: vars.newsUrl ?? '',
    DISCLAIMER: vars.disclaimer ?? '',
  });
}

/**
 * Render an educational post template.
 */
export function renderEducationalPost(vars: {
  portfolioUsername: string;
  aiContent: string;
  topTickers: string[];
  disclaimer?: string;
}): string {
  return render(EDUCATIONAL_POST_TEMPLATE, {
    PORTFOLIO_USERNAME: vars.portfolioUsername,
    AI_CONTENT: vars.aiContent,
    TOP_TICKERS: vars.topTickers.map((t) => `$${t}`).join(' '),
    DISCLAIMER: vars.disclaimer ?? '',
  });
}

function render(
  template: string,
  variables: Record<string, string>,
): string {
  let content = template;
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  // Remove consecutive blank lines left by empty variables
  return content.replace(/\n{3,}/g, '\n\n').trim();
}
