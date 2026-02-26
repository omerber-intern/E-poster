/**
 * AI Service - Powered by Anthropic Claude
 *
 * Four core functions:
 *   1. analyzeNewsImpact  — per-portfolio impact analysis of a news article
 *   2. generatePostContent — LLM-authored post for a portfolio + news combo
 *   3. generateEducationalContent — educational post about a portfolio's strategy
 *   4. generateMonthlyUpdateContent — monthly performance update post
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SmartPortfolio, PortfolioBio, PortfolioHolding } from '../models/portfolio';
import { NEWS_EXAMPLE_POSTS } from '../config/example-posts';
import {
  MONTHLY_UPDATE_TEMPLATE_A_EXAMPLES,
  MONTHLY_UPDATE_TEMPLATE_B_EXAMPLES,
} from '../config/monthly-update-examples';

const MODEL = 'claude-sonnet-4-6';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function holdingsCompactSummary(holdings: PortfolioHolding[]): string {
  const sorted = [...holdings].sort((a, b) => b.allocation - a.allocation);

  const sectorTotals = new Map<string, { allocation: number; count: number }>();
  for (const h of sorted) {
    const sector = h.sector || 'Other';
    const entry = sectorTotals.get(sector);
    if (entry) {
      entry.allocation += h.allocation;
      entry.count += 1;
    } else {
      sectorTotals.set(sector, { allocation: h.allocation, count: 1 });
    }
  }

  const sectorLines = [...sectorTotals.entries()]
    .sort((a, b) => b[1].allocation - a[1].allocation)
    .map(
      ([name, { allocation, count }]) =>
        `${name}: ${Math.round(allocation * 100) / 100}% (${count} holdings)`,
    );

  const topLines = sorted.slice(0, 10).map(
    (h) =>
      `$${h.symbol || h.instrumentName} — ${h.allocation}% ${h.positionType}${h.sector ? ` (${h.sector})` : ''}`,
  );

  return `SECTOR ALLOCATION:\n${sectorLines.join('\n')}\n\nTOP 10 HOLDINGS:\n${topLines.join('\n')}\n\nTotal holdings: ${sorted.length}`;
}

// ---------------------------------------------------------------------------
// 1. Analyze News Impact
// ---------------------------------------------------------------------------

export type ImpactLevel = 'low' | 'medium' | 'high';

const IMPACT_LEVEL_WEIGHTS: Record<ImpactLevel, number> = {
  low: 0.3,
  medium: 0.65,
  high: 1.0,
};

export interface AssetImpact {
  symbol: string;
  instrumentName: string;
  impactLevel: ImpactLevel;
  direction: 'positive' | 'negative' | 'neutral';
  reasoning: string;
  /** The asset's allocation weight in the portfolio (passed through for display) */
  allocation: number;
  /** Contribution to overall relevance: allocation * impactLevelWeight */
  relevanceContribution: number;
}

export interface NewsImpactResult {
  portfolioUsername: string;
  /** Percentage of portfolio affected by the news (0–100), weighted by impact level */
  relevancePercent: number;
  affectedAssets: AssetImpact[];
  reasoning: string;
}

export async function analyzeNewsImpact(
  news: { headline: string; body: string; url?: string },
  portfolio: SmartPortfolio,
  bio?: PortfolioBio | null,
): Promise<NewsImpactResult> {
  const client = getClient();

  const systemPrompt = `You are a financial analyst evaluating whether a news article is relevant to an investment portfolio.
You will be given:
- The news headline and body
- The portfolio's sector allocation breakdown (sector name, weight, holding count)
- The portfolio's top 10 individual holdings by weight
- Optionally the portfolio bio/strategy

Your task:
1. Evaluate which sectors and top holdings are affected by the news.
2. For each affected asset from the top holdings, classify the impact level as "low", "medium", or "high":
   - "low": indirect or tangential relevance (e.g., same sector but not directly mentioned)
   - "medium": moderate relevance (e.g., competitor, supply chain partner, or sector-wide impact)
   - "high": directly mentioned or very strongly affected by the news
3. For affected holdings, note the direction: "positive", "negative", or "neutral".
4. Only include affected assets in the response (skip unaffected ones).
5. Provide a short overall reasoning about the news relevance to this portfolio, referencing sector exposure where appropriate.

Respond ONLY with valid JSON matching this schema:
{
  "affectedAssets": [
    {
      "symbol": "<ticker>",
      "instrumentName": "<name>",
      "impactLevel": "low" | "medium" | "high",
      "direction": "positive" | "negative" | "neutral",
      "reasoning": "<short reason>"
    }
  ],
  "reasoning": "<overall reasoning>"
}

If no assets are affected, return an empty affectedAssets array.`;

  const userPrompt = `NEWS:
Headline: ${news.headline}
Body: ${news.body}
${news.url ? `URL: ${news.url}` : ''}

PORTFOLIO: ${portfolio.username}
${bio?.bio ? `Strategy: ${bio.bio}` : ''}

${holdingsCompactSummary(portfolio.holdings)}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');

  const parsed = JSON.parse(jsonMatch[0]);
  const rawAssets: Array<{
    symbol: string;
    instrumentName: string;
    impactLevel: string;
    direction: string;
    reasoning: string;
  }> = parsed.affectedAssets ?? [];

  const holdingsMap = new Map(
    portfolio.holdings.map((h) => [h.symbol?.toUpperCase(), h]),
  );

  const affectedAssets: AssetImpact[] = rawAssets.map((a) => {
    const level = (['low', 'medium', 'high'].includes(a.impactLevel)
      ? a.impactLevel
      : 'low') as ImpactLevel;
    const holding = holdingsMap.get(a.symbol?.toUpperCase());
    const allocation = holding?.allocation ?? 0;
    const relevanceContribution =
      Math.round(allocation * IMPACT_LEVEL_WEIGHTS[level] * 100) / 100;

    return {
      symbol: a.symbol,
      instrumentName: a.instrumentName,
      impactLevel: level,
      direction: (['positive', 'negative', 'neutral'].includes(a.direction)
        ? a.direction
        : 'neutral') as 'positive' | 'negative' | 'neutral',
      reasoning: a.reasoning ?? '',
      allocation,
      relevanceContribution,
    };
  });

  const relevancePercent =
    Math.round(
      affectedAssets.reduce((sum, a) => sum + a.relevanceContribution, 0) * 100,
    ) / 100;

  return {
    portfolioUsername: portfolio.username,
    relevancePercent,
    affectedAssets,
    reasoning: parsed.reasoning ?? '',
  };
}

// ---------------------------------------------------------------------------
// 2. Generate Post Content
// ---------------------------------------------------------------------------

export interface GeneratePostResult {
  content: string;
  topTickers: string[];
}

export async function generatePostContent(
  news: { headline: string; body: string; url?: string },
  portfolio: SmartPortfolio,
  bio: PortfolioBio | null,
  impact: NewsImpactResult,
  examplePosts?: string[],
): Promise<GeneratePostResult> {
  const client = getClient();

  const topTickers = impact.affectedAssets
    .slice(0, 6)
    .map((a) => a.symbol)
    .filter(Boolean);

  const systemPrompt = `You are a professional financial content writer for the eToro social trading platform.
Create a short, engaging post about a news event and how it relates to a portfolio.

Rules:
- Start the post with @${portfolio.username}
- Include the top affected tickers in $TICKER format (e.g., $NVDA, $AAPL)
- Reference the portfolio strategy/bio when relevant
- Keep the tone professional but accessible
- Maximum 280 words
- Do NOT include disclaimers (they will be added separately)
- Do NOT use hashtags
- Include the news URL if provided`;

  const userPrompt = `NEWS:
Headline: ${news.headline}
Body: ${news.body}
${news.url ? `URL: ${news.url}` : ''}

PORTFOLIO: ${portfolio.username}
${bio?.bio ? `Bio: ${bio.bio.substring(0, 500)}` : ''}

IMPACT ANALYSIS:
Relevance to portfolio: ${impact.relevancePercent}%
Affected assets:
${impact.affectedAssets.map((a) => `- $${a.symbol}: ${a.impactLevel} impact, ${a.direction} — ${a.reasoning}`).join('\n')}

${(() => { const examples = examplePosts?.length ? examplePosts : NEWS_EXAMPLE_POSTS; return `EXAMPLE POSTS FOR REFERENCE (match this style, structure, and tone):\n${examples.join('\n---\n')}`; })()}

Write the post now:`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content: content.trim(),
    topTickers,
  };
}

// ---------------------------------------------------------------------------
// 3. Generate Educational Content
// ---------------------------------------------------------------------------

export interface EducationalContentResult {
  content: string;
  topTickers: string[];
}

export async function generateEducationalContent(
  portfolio: SmartPortfolio,
  bio: PortfolioBio | null,
  additionalContext?: string,
): Promise<EducationalContentResult> {
  const client = getClient();

  const topTickers = portfolio.holdings
    .sort((a, b) => b.allocation - a.allocation)
    .slice(0, 6)
    .map((h) => h.symbol)
    .filter(Boolean);

  const systemPrompt = `You are a financial educator writing content for the eToro social trading platform.
Create educational content about an investment portfolio and its strategy.

Rules:
- Start the post with @${portfolio.username}
- Include the top holdings in $TICKER format
- Explain the investment strategy/logic in accessible terms
- Mention what type of investor could benefit from this portfolio
- Explain how it could add diversification to existing holdings
- Keep the tone educational, professional, and engaging
- Maximum 350 words
- Do NOT include disclaimers (they will be added separately)
- Do NOT use hashtags`;

  const userPrompt = `PORTFOLIO: ${portfolio.username}

BIO/STRATEGY:
${bio?.bio || 'No bio available.'}
${bio?.aboutMe && bio.aboutMe !== bio.bio ? `\nAdditional: ${bio.aboutMe}` : ''}

CURRENT HOLDINGS:
${holdingsCompactSummary(portfolio.holdings)}

${additionalContext ? `ADDITIONAL CONTEXT FROM USER:\n${additionalContext}` : ''}

Write the educational content now:`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content: content.trim(),
    topTickers,
  };
}

// ---------------------------------------------------------------------------
// 4. Generate Monthly Update Content
// ---------------------------------------------------------------------------

export type MonthlyUpdateTemplateStyle = 'stats-bottom' | 'revenue-opening';

export interface MonthlyUpdateRevenueData {
  monthlyGain: number;
  ytdGain?: number;
}

export interface MonthlyUpdateResult {
  content: string;
  topTickers: string[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function generateMonthlyUpdateContent(
  portfolio: SmartPortfolio,
  bio: PortfolioBio | null,
  revenueData: MonthlyUpdateRevenueData,
  templateStyle: MonthlyUpdateTemplateStyle,
  month: number,
  year: number,
): Promise<MonthlyUpdateResult> {
  const client = getClient();

  const topTickers = portfolio.holdings
    .sort((a, b) => b.allocation - a.allocation)
    .slice(0, 8)
    .map((h) => h.symbol)
    .filter(Boolean);

  const topHoldingsText = portfolio.holdings
    .sort((a, b) => b.allocation - a.allocation)
    .slice(0, 8)
    .map((h) => `$${h.symbol} (${h.instrumentName})`)
    .join(' , ');

  const monthName = MONTH_NAMES[month] ?? MONTH_NAMES[0];
  const isJanuary = month === 0;

  const monthlyGainStr = `${revenueData.monthlyGain >= 0 ? '+' : ''}${revenueData.monthlyGain.toFixed(2)}%`;
  const ytdGainStr =
    revenueData.ytdGain !== undefined
      ? `${revenueData.ytdGain >= 0 ? '+' : ''}${revenueData.ytdGain.toFixed(2)}%`
      : null;

  const performanceLines =
    templateStyle === 'stats-bottom'
      ? `Performance Stats: @${portfolio.username} -> ${monthName}: ${monthlyGainStr}${ytdGainStr ? ` , YTD: ${ytdGainStr}` : ''}`
      : `${monthName} ${year}: ${monthlyGainStr}`;

  const examples =
    templateStyle === 'stats-bottom'
      ? MONTHLY_UPDATE_TEMPLATE_A_EXAMPLES
      : MONTHLY_UPDATE_TEMPLATE_B_EXAMPLES;

  const systemPrompt = templateStyle === 'stats-bottom'
    ? `You are a professional financial content writer for the eToro social trading platform.
Write a monthly portfolio performance update post.

Rules:
- Open with "Dear Investors," followed by a greeting line: "Here is your monthly update for ${monthName} ${year} ✨"
- Write 2–3 paragraphs of AI-generated market commentary relevant to the portfolio's sector and strategy
- End with a performance stats block using EXACTLY this format:
  Performance Stats: @${portfolio.username} -> ${monthName}: ${monthlyGainStr}${ytdGainStr ? ` , YTD: ${ytdGainStr}` : ''}
- After the stats block, list some top holdings using $TICKER (Name) format
- Use emojis sparingly (1–2 per post)
- Maximum 350 words
- Do NOT include any disclaimers (they will be added separately)
- Do NOT use hashtags
${isJanuary ? '- This is January — do NOT include any YTD figure' : ''}`
    : `You are a professional financial content writer for the eToro social trading platform.
Write a monthly portfolio performance update post.

Rules:
- Open with "Dear Investors 🤝,"
- Second line: "Here is your monthly update for ${monthName} ${year}"
- Third line: an emoji + "@${portfolio.username} — ${monthName} ${year} Pulse" or similar heading
- Fourth line: the revenue prominently: "${monthName} ${year}: ${monthlyGainStr}" with a rocket or chart emoji${ytdGainStr ? `\n- If you reference YTD, use: YTD: ${ytdGainStr}` : ''}
- Write 2 paragraphs of narrative market commentary tailored to the portfolio's strategy and sectors
- End by listing @${portfolio.username} and top holdings in $TICKER (Name) format
- Use emojis frequently to match the energetic style of the examples
- Maximum 350 words
- Do NOT include any disclaimers (they will be added separately)
- Do NOT use hashtags
${isJanuary ? '- This is January — do NOT include any YTD figure' : ''}`;

  const userPrompt = `PORTFOLIO: @${portfolio.username}
BIO/STRATEGY:
${bio?.bio || 'No bio available.'}

CURRENT HOLDINGS (top by allocation):
${holdingsCompactSummary(portfolio.holdings)}

PERFORMANCE DATA:
${monthName} ${year}: ${monthlyGainStr}${ytdGainStr ? `\nYTD: ${ytdGainStr}` : ''}

EXAMPLE POSTS (match this style, tone, and structure closely):
${examples.join('\n---\n')}

The performance stats line to include verbatim:
${performanceLines}

Top holdings to mention at the end:
${topHoldingsText}

Write the monthly update post now:`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const eduContent =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content: eduContent.trim(),
    topTickers,
  };
}
