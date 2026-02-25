/**
 * Template models for e-poster
 *
 * Templates define the structure of posts with variable placeholders.
 * The AI-generated content is placed into these templates.
 */

export interface PostTemplate {
  id: string;
  name: string;
  type: 'news' | 'educational';
  content: string;
  variables: TemplateVariable[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

export const NEWS_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: 'PORTFOLIO_USERNAME', description: 'Portfolio username', example: 'PureMomentum' },
  { name: 'AI_CONTENT', description: 'AI-generated post content', example: 'Market analysis...' },
  { name: 'TOP_TICKERS', description: 'Top 6 affected tickers', example: '$NVDA $AAPL $MSFT' },
  { name: 'NEWS_URL', description: 'URL of the news article', example: 'https://...' },
  { name: 'DISCLAIMER', description: 'Asset-type disclaimer (TBD)', example: '' },
];

export const EDUCATIONAL_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: 'PORTFOLIO_USERNAME', description: 'Portfolio username', example: 'PureMomentum' },
  { name: 'AI_CONTENT', description: 'AI-generated educational content', example: 'Learn about...' },
  { name: 'TOP_TICKERS', description: 'Top 6 holdings', example: '$NVDA $AAPL $MSFT' },
  { name: 'DISCLAIMER', description: 'Asset-type disclaimer (TBD)', example: '' },
];

export const NEWS_POST_TEMPLATE = `@{PORTFOLIO_USERNAME}

{AI_CONTENT}

{TOP_TICKERS}

{NEWS_URL}

{DISCLAIMER}`;

export const EDUCATIONAL_POST_TEMPLATE = `@{PORTFOLIO_USERNAME}

{AI_CONTENT}

{TOP_TICKERS}

{DISCLAIMER}`;
