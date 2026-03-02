/**
 * AI Service - Powered by Anthropic Claude
 *
 * Core functions:
 *   1. analyzeNewsTopicImpact  — Phase 1: topic-level impact using Haiku parallel batches
 *   2. analyzeHoldingImpact    — Phase 2: holding-level tagging using Haiku
 *   3. generatePostContent     — LLM-authored post for a portfolio + news combo
 *   4. generateEducationalContent — educational post about a portfolio's strategy
 *   5. generateMonthlyUpdateContent — monthly performance update post
 *   6. generatePerformanceHighlightContent — promotional post complimenting strong performance
 *   7. classifyContentDisclaimers — AI-powered disclaimer classification
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SmartPortfolio, PortfolioBio, PortfolioHolding, IndustryWeight } from '../models/portfolio';
import type { DisclaimerRule } from '../config/disclaimers';
import { getNewsExamples } from '../config/example-posts';
import { getEducationalExamples } from '../config/educational-examples';
import { getMonthlyUpdateExamples } from '../config/monthly-update-examples';
import { getPerformanceHighlightExamples } from '../config/performance-highlight-examples';

const MODEL = 'claude-sonnet-4-6';
const HAIKU_MODEL = 'claude-haiku-4-5';
const TOPIC_BATCH_SIZE = 25;
const TOPIC_MIN_WEIGHT = 0.5;

export type PostLength = 'short' | 'medium' | 'long';

const NEWS_LENGTH_CONFIG: Record<PostLength, { words: number; maxTokens: number }> = {
  short: { words: 150, maxTokens: 400 },
  medium: { words: 200, maxTokens: 520 },
  long: { words: 250, maxTokens: 650 },
};

const EDU_LENGTH_CONFIG: Record<PostLength, { words: number; maxTokens: number }> = {
  short: { words: 150, maxTokens: 400 },
  medium: { words: 200, maxTokens: 520 },
  long: { words: 250, maxTokens: 650 },
};

const MONTHLY_LENGTH_CONFIG: Record<PostLength, { words: number; maxTokens: number }> = {
  short: { words: 150, maxTokens: 400 },
  medium: { words: 200, maxTokens: 520 },
  long: { words: 250, maxTokens: 650 },
};

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

  const topLines = sorted.slice(0, 10).map(
    (h) =>
      `$${h.symbol || h.instrumentName} — ${h.allocation}% ${h.positionType}${h.sector ? ` (${h.sector})` : ''}`,
  );

  return `TOP 10 HOLDINGS:\n${topLines.join('\n')}\n\nTotal holdings: ${sorted.length}`;
}

// ---------------------------------------------------------------------------
// 1. Phase 1: Topic-level news impact analysis (Haiku, parallel batches)
// ---------------------------------------------------------------------------

export interface TopicImpact {
  topic: string;
  impactScore: number;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface Phase1Result {
  portfolioUsername: string;
  relevancePercent: number;
  topicImpacts: TopicImpact[];
}

async function evaluateTopicBatch(
  client: Anthropic,
  news: { headline: string; body: string; url?: string },
  batchTopics: IndustryWeight[],
): Promise<TopicImpact[]> {
  const topicLines = batchTopics
    .map((t, i) => `${i + 1}. ${t.topic} (${t.weight.toFixed(2)}% of portfolio)`)
    .join('\n');

  const prompt = `NEWS:
Headline: ${news.headline}
Body: ${news.body}${news.url ? `\nURL: ${news.url}` : ''}

For each topic below, score the impact of this news (0-100) and the direction.
- 0 = no impact at all
- 50 = moderate relevance
- 100 = directly and significantly affected

TOPICS:
${topicLines}

Respond ONLY with valid JSON array — one entry per topic in the same order:
[{ "topic": "<exact topic name>", "impactScore": <0-100>, "direction": "positive" | "negative" | "neutral" }]`;

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1500,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed: Array<{
    topic: string;
    impactScore: number;
    direction: string;
  }> = JSON.parse(jsonMatch[0]);

  return parsed.map((item) => ({
    topic: item.topic,
    impactScore: Math.min(100, Math.max(0, Math.round(item.impactScore ?? 0))),
    direction: (['positive', 'negative', 'neutral'].includes(item.direction)
      ? item.direction
      : 'neutral') as 'positive' | 'negative' | 'neutral',
  }));
}

export async function analyzeNewsTopicImpact(
  news: { headline: string; body: string; url?: string },
  portfolio: SmartPortfolio,
): Promise<Phase1Result> {
  const client = getClient();

  const industryWeights = portfolio.industryWeights ?? [];

  // Filter to topics with meaningful weight; aggregate the rest into "Other"
  const significant = industryWeights.filter((t) => t.weight >= TOPIC_MIN_WEIGHT);
  const otherWeight = industryWeights
    .filter((t) => t.weight < TOPIC_MIN_WEIGHT)
    .reduce((sum, t) => sum + t.weight, 0);

  const topicsToEvaluate: IndustryWeight[] = [...significant];
  if (otherWeight > 0) {
    topicsToEvaluate.push({ topic: 'Other', weight: Math.round(otherWeight * 100) / 100 });
  }

  if (topicsToEvaluate.length === 0) {
    return { portfolioUsername: portfolio.username, relevancePercent: 0, topicImpacts: [] };
  }

  // Split into dynamic batches of TOPIC_BATCH_SIZE and fire all in parallel
  const batches: IndustryWeight[][] = [];
  for (let i = 0; i < topicsToEvaluate.length; i += TOPIC_BATCH_SIZE) {
    batches.push(topicsToEvaluate.slice(i, i + TOPIC_BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map((batch) => evaluateTopicBatch(client, news, batch)),
  );

  const topicImpacts: TopicImpact[] = batchResults.flat();

  // Weighted relevance: sum(impactScore * topicWeight) / sum(topicWeights * 100)
  const topicsWeightMap = new Map(topicsToEvaluate.map((t) => [t.topic, t.weight]));
  let weightedSum = 0;
  let totalWeight = 0;
  for (const ti of topicImpacts) {
    const w = topicsWeightMap.get(ti.topic) ?? 0;
    weightedSum += (ti.impactScore / 100) * w;
    totalWeight += w;
  }
  const relevancePercent = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10000) / 100
    : 0;

  // Return only topics with non-zero impact, sorted by impact
  const filtered = topicImpacts
    .filter((t) => t.impactScore > 0)
    .sort((a, b) => b.impactScore - a.impactScore);

  return {
    portfolioUsername: portfolio.username,
    relevancePercent,
    topicImpacts: filtered,
  };
}

// ---------------------------------------------------------------------------
// 2. Phase 2: Holding-level impact tagging (Haiku)
// ---------------------------------------------------------------------------

export interface HoldingImpact {
  symbol: string;
  instrumentName: string;
  impactLevel: 'low' | 'medium' | 'high';
  direction: 'positive' | 'negative' | 'neutral';
  reasoning: string;
  allocation: number;
}

export interface Phase2Result {
  portfolioUsername: string;
  affectedHoldings: HoldingImpact[];
}

/** Combined result returned from the evaluate API */
export interface NewsEvaluationResult {
  portfolioUsername: string;
  relevancePercent: number;
  topicImpacts: TopicImpact[];
  affectedHoldings: HoldingImpact[];
}

export async function analyzeHoldingImpact(
  news: { headline: string; body: string; url?: string },
  portfolio: SmartPortfolio,
  phase1: Phase1Result,
): Promise<Phase2Result> {
  const client = getClient();

  // Select the ~10 holdings that are most exposed to the affected topics
  const affectedTopics = new Set(phase1.topicImpacts.map((t) => t.topic));

  const scoredHoldings = portfolio.holdings.map((h) => {
    let relevanceScore = 0;
    if (h.industries) {
      for (const ib of h.industries) {
        if (affectedTopics.has(ib.topic)) {
          const topicImpact = phase1.topicImpacts.find((t) => t.topic === ib.topic);
          if (topicImpact) {
            relevanceScore += (ib.weight / 100) * topicImpact.impactScore;
          }
        }
      }
    }
    return { holding: h, relevanceScore };
  });

  const topHoldings = scoredHoldings
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10)
    .filter((s) => s.relevanceScore > 0)
    .map((s) => s.holding);

  if (topHoldings.length === 0) {
    return { portfolioUsername: portfolio.username, affectedHoldings: [] };
  }

  const holdingLines = topHoldings
    .map(
      (h) =>
        `$${h.symbol} (${h.instrumentName}) — ${h.allocation}% allocation` +
        (h.industries?.length
          ? `, industries: ${h.industries.slice(0, 3).map((i) => i.topic).join(', ')}`
          : ''),
    )
    .join('\n');

  const topicSummary = phase1.topicImpacts
    .slice(0, 15)
    .map((t) => `${t.topic}: score ${t.impactScore}, ${t.direction}`)
    .join('\n');

  const prompt = `NEWS:
Headline: ${news.headline}
Body: ${news.body}${news.url ? `\nURL: ${news.url}` : ''}

TOPIC IMPACT CONTEXT (from Phase 1 analysis):
${topicSummary}

HOLDINGS TO EVALUATE:
${holdingLines}

For each holding, evaluate the specific impact of this news on that company/asset.

Respond ONLY with valid JSON array:
[{
  "symbol": "<TICKER>",
  "instrumentName": "<name>",
  "impactLevel": "low" | "medium" | "high",
  "direction": "positive" | "negative" | "neutral",
  "reasoning": "<1-2 sentence explanation>"
}]

Only include holdings that are actually affected (impactLevel medium or high, or notable low impact). Skip truly unaffected holdings.`;

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2000,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { portfolioUsername: portfolio.username, affectedHoldings: [] };

  const parsed: Array<{
    symbol: string;
    instrumentName: string;
    impactLevel: string;
    direction: string;
    reasoning: string;
  }> = JSON.parse(jsonMatch[0]);

  const holdingsMap = new Map(
    portfolio.holdings.map((h) => [h.symbol?.toUpperCase(), h]),
  );

  const affectedHoldings: HoldingImpact[] = parsed.map((item) => {
    const h = holdingsMap.get(item.symbol?.toUpperCase());
    return {
      symbol: item.symbol,
      instrumentName: item.instrumentName,
      impactLevel: (['low', 'medium', 'high'].includes(item.impactLevel)
        ? item.impactLevel
        : 'low') as 'low' | 'medium' | 'high',
      direction: (['positive', 'negative', 'neutral'].includes(item.direction)
        ? item.direction
        : 'neutral') as 'positive' | 'negative' | 'neutral',
      reasoning: item.reasoning ?? '',
      allocation: h?.allocation ?? 0,
    };
  });

  return {
    portfolioUsername: portfolio.username,
    affectedHoldings,
  };
}

// ---------------------------------------------------------------------------
// 3. Generate Post Content
// ---------------------------------------------------------------------------

export interface GeneratePostResult {
  content: string;
  topTickers: string[];
}

export async function generatePostContent(
  news: { headline: string; body: string; url?: string },
  portfolio: SmartPortfolio,
  bio: PortfolioBio | null,
  impact: NewsEvaluationResult,
  examplePosts?: string[],
  postLength: PostLength = 'medium',
): Promise<GeneratePostResult> {
  const client = getClient();

  const { words, maxTokens } = NEWS_LENGTH_CONFIG[postLength];

  const topTickers = impact.affectedHoldings
    .slice(0, 6)
    .map((a) => a.symbol)
    .filter(Boolean);

  const systemPrompt = `You are a professional financial content writer for the eToro social trading platform.
Create a short, engaging post about a news event and how it relates to a portfolio.

Rules:
- Start the post with @${portfolio.username}
- Immediately after @${portfolio.username}, open with a "bottom line" of 1–3 sentences that tells the reader what this post is about: summarize the news event AND its impact on the portfolio. No small details — just enough so the reader instantly understands what they are reading and why it matters for the portfolio.
- Include the top affected tickers in $TICKER format (e.g., $NVDA, $AAPL)
- Reference the portfolio strategy/bio when relevant
- Keep the tone professional but accessible
- Keep paragraphs short and scannable — break the text into multiple small paragraphs rather than a few long ones
- IMPORTANT — LENGTH: You MUST write approximately ${words} words (excluding the @username line). Do NOT exceed ${words + 30} words and do NOT write fewer than ${Math.max(words - 30, 50)} words. This is a strict requirement — count carefully.
- Do NOT include disclaimers (they will be added separately)
- Do NOT use hashtags
- Include the news URL if provided`;

  const topicsSummary = impact.topicImpacts
    .slice(0, 8)
    .map((t) => `${t.topic} (${t.direction}, score ${t.impactScore})`)
    .join(', ');

  const userPrompt = `NEWS:
Headline: ${news.headline}
Body: ${news.body}
${news.url ? `URL: ${news.url}` : ''}

PORTFOLIO: ${portfolio.username}
${bio?.bio ? `Bio: ${bio.bio.substring(0, 500)}` : ''}

IMPACT ANALYSIS:
Relevance to portfolio: ${impact.relevancePercent}%
Affected industry topics: ${topicsSummary}
Key affected holdings:
${impact.affectedHoldings.map((a) => `- $${a.symbol}: ${a.impactLevel} impact, ${a.direction} — ${a.reasoning}`).join('\n')}

${(() => {
  const examples = examplePosts?.length ? examplePosts : getNewsExamples(postLength);
  return `EXAMPLE POSTS FOR REFERENCE (match this style, structure, tone, and especially length — aim for ~${words} words):\n${examples.join('\n---\n')}`;
})()}

Write the post now:`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
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
// 4. Generate Educational Content
// ---------------------------------------------------------------------------

export interface EducationalContentResult {
  content: string;
  topTickers: string[];
}

export async function generateEducationalContent(
  portfolio: SmartPortfolio,
  bio: PortfolioBio | null,
  additionalContext?: string,
  postLength: PostLength = 'medium',
): Promise<EducationalContentResult> {
  const client = getClient();

  const { words, maxTokens } = EDU_LENGTH_CONFIG[postLength];

  const topTickers = portfolio.holdings
    .sort((a, b) => b.allocation - a.allocation)
    .slice(0, 6)
    .map((h) => h.symbol)
    .filter(Boolean);

  const systemPrompt = `You are a financial educator writing content for the eToro social trading platform.
Create educational content about an investment portfolio and its strategy.

Rules:
- Start the post with @${portfolio.username}
- Immediately after @${portfolio.username}, open with a "bottom line" of 1–3 sentences that tells the reader what this post is about: what they will learn about this portfolio and its strategy. No small details — just enough so the reader instantly understands the content of the post.
- Include the top holdings in $TICKER format
- Explain the investment strategy/logic in accessible terms
- Mention what type of investor could benefit from this portfolio
- Explain how it could add diversification to existing holdings
- Keep the tone educational, professional, and engaging
- Keep paragraphs short and scannable — break the text into multiple small paragraphs rather than a few long ones
- IMPORTANT — LENGTH: You MUST write approximately ${words} words (excluding the @username line). Do NOT exceed ${words + 30} words and do NOT write fewer than ${Math.max(words - 30, 50)} words. This is a strict requirement — count carefully.
- Do NOT include disclaimers (they will be added separately)
- Do NOT use hashtags`;

  const userPrompt = `PORTFOLIO: ${portfolio.username}

BIO/STRATEGY:
${bio?.bio || 'No bio available.'}
${bio?.aboutMe && bio.aboutMe !== bio.bio ? `\nAdditional: ${bio.aboutMe}` : ''}

CURRENT HOLDINGS:
${holdingsCompactSummary(portfolio.holdings)}

${additionalContext ? `ADDITIONAL CONTEXT FROM USER:\n${additionalContext}` : ''}

EXAMPLE POSTS (match this style, structure, tone, and especially length — aim for ~${words} words):
${getEducationalExamples(postLength).join('\n---\n')}

Write the educational content now:`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
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
// 5. Generate Monthly Update Content
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
  postLength: PostLength = 'medium',
): Promise<MonthlyUpdateResult> {
  const client = getClient();

  const { words, maxTokens } = MONTHLY_LENGTH_CONFIG[postLength];

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
      : `Monthly: ${monthlyGainStr}${ytdGainStr ? `\nYTD: ${ytdGainStr}` : ''}`;

  const examples = getMonthlyUpdateExamples(templateStyle, postLength);

  const systemPrompt = templateStyle === 'stats-bottom'
    ? `You are a professional financial content writer for the eToro social trading platform.
Write a monthly portfolio performance update post.

Rules:
- Open with "Dear Investors," followed by a greeting line: "Here is your monthly update for ${monthName} ${year} ✨"
- Right after the greeting, open with a "bottom line" of 1–3 sentences that tells the reader what this update is about: the key market themes and how the portfolio performed this month. No small details — just enough so the reader instantly understands the content of the post.
- Write 2–3 paragraphs of AI-generated market commentary relevant to the portfolio's sector and strategy
- End with a performance stats block using EXACTLY this format:
  Performance Stats: @${portfolio.username} -> ${monthName}: ${monthlyGainStr}${ytdGainStr ? ` , YTD: ${ytdGainStr}` : ''}
- After the stats block, list some top holdings using $TICKER (Name) format
- Use emojis sparingly (1–2 per post)
- Keep paragraphs short and scannable — break the text into multiple small paragraphs rather than a few long ones
- IMPORTANT — LENGTH: You MUST write approximately ${words} words. Do NOT exceed ${words + 30} words and do NOT write fewer than ${Math.max(words - 30, 50)} words. This is a strict requirement — count carefully.
- Do NOT include any disclaimers (they will be added separately)
- Do NOT use hashtags
${isJanuary ? '- This is January — do NOT include any YTD figure' : ''}`
    : `You are a professional financial content writer for the eToro social trading platform.
Write a monthly portfolio performance update post.

Rules:
- Open with "Dear Investors 🤝,"
- Second line: "Here is your monthly update for ${monthName} ${year}"
- Third line: an emoji + "@${portfolio.username} — ${monthName} ${year} Pulse" or similar heading
- Fourth and fifth lines: the performance figures stacked EXACTLY like this (no other placement):
  Monthly: ${monthlyGainStr}${ytdGainStr ? `\n  YTD: ${ytdGainStr}` : ''}
- Add an emoji (🚀 or 📈) on the same line as Monthly
- Right after the performance figures, open with a "bottom line" of 1–3 sentences that tells the reader what this update is about: the key market themes and how the portfolio performed this month. No small details — just enough so the reader instantly understands the content of the post.
- Write 2 paragraphs of narrative market commentary tailored to the portfolio's strategy and sectors
- Do NOT mention the revenue figures again anywhere else in the post
- End by listing @${portfolio.username} and top holdings in $TICKER (Name) format
- Use emojis frequently to match the energetic style of the examples
- Keep paragraphs short and scannable — break the text into multiple small paragraphs rather than a few long ones
- IMPORTANT — LENGTH: You MUST write approximately ${words} words. Do NOT exceed ${words + 30} words and do NOT write fewer than ${Math.max(words - 30, 50)} words. This is a strict requirement — count carefully.
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

EXAMPLE POSTS (match this style, tone, structure, and especially length — aim for ~${words} words):
${examples.join('\n---\n')}

The performance figures to include verbatim (stacked, one per line, right after the heading):
${performanceLines}

Top holdings to mention at the end:
${topHoldingsText}

Write the monthly update post now:`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
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

// ---------------------------------------------------------------------------
// 6. Generate Performance Highlight Content
// ---------------------------------------------------------------------------

export type PerformanceHighlightLength = PostLength;

export interface PerformanceHighlightRevenueData {
  monthlyGain: number;
  ytdGain?: number;
  /** Which month the monthlyGain refers to (e.g. "February"). Defaults to "this month". */
  gainMonthName?: string;
}

export interface PerformanceHighlightResult {
  content: string;
  topTickers: string[];
}

const LENGTH_CONFIG: Record<PerformanceHighlightLength, { words: number; maxTokens: number }> = {
  short: { words: 150, maxTokens: 400 },
  medium: { words: 200, maxTokens: 520 },
  long: { words: 250, maxTokens: 650 },
};

export async function generatePerformanceHighlightContent(
  portfolio: SmartPortfolio,
  bio: PortfolioBio | null,
  revenueData: PerformanceHighlightRevenueData,
  postLength: PerformanceHighlightLength,
): Promise<PerformanceHighlightResult> {
  const client = getClient();

  const topTickers = portfolio.holdings
    .sort((a, b) => b.allocation - a.allocation)
    .slice(0, 10)
    .map((h) => h.symbol)
    .filter(Boolean);

  const { words, maxTokens } = LENGTH_CONFIG[postLength];

  const monthlyGainStr = `${revenueData.monthlyGain >= 0 ? '+' : ''}${revenueData.monthlyGain.toFixed(2)}%`;
  const ytdGainStr =
    revenueData.ytdGain !== undefined
      ? `${revenueData.ytdGain >= 0 ? '+' : ''}${revenueData.ytdGain.toFixed(2)}%`
      : null;

  const systemPrompt = `You are a professional financial content writer for the eToro social trading platform.
Write a promotional post that highlights and compliments a portfolio's strong performance. The post should feel like an advertisement that would make investors want to explore this portfolio.

Rules:
- Start the post with @${portfolio.username}
- Immediately after @${portfolio.username}, open with a "bottom line" of 1–3 sentences that tells the reader what this post is about: why this portfolio stands out and what performance it has achieved. No small details — just enough so the reader instantly understands the content of the post.
- Open with an engaging headline using an emoji (📈, 🚀, etc.)
- Include a compelling question hook
- Highlight the portfolio's strategy based on its bio/description
- Include the exact performance numbers: **${monthlyGainStr} ${revenueData.gainMonthName ? `in ${revenueData.gainMonthName}` : 'this month'}**${ytdGainStr ? ` and **${ytdGainStr} year to date**` : ''}
- Reference top holdings using ONLY $TICKER format (e.g. $AAPL, $NVDA) — do NOT include full company names next to tickers
- Highlight sector allocation strengths and what they mean for the investor
- If the bio mentions minimum investment, investor suitability, or other relevant details, include them naturally
- Use emojis throughout to match an energetic, promotional tone
- Use 👉 bullets for key points
- Keep paragraphs short and scannable — break the text into multiple small paragraphs rather than a few long ones
- IMPORTANT — LENGTH: You MUST write approximately ${words} words (excluding disclaimers and the @username line). Do NOT exceed ${words + 30} words and do NOT write fewer than ${Math.max(words - 30, 50)} words. This is a strict requirement — count carefully.
- Do NOT include disclaimers (they will be added separately)
- Do NOT use hashtags
- Use **bold** for key figures`;

  const userPrompt = `PORTFOLIO: @${portfolio.username}

BIO/STRATEGY:
${bio?.bio || 'No bio available.'}
${bio?.aboutMe && bio.aboutMe !== bio.bio ? `\nAdditional: ${bio.aboutMe}` : ''}

CURRENT HOLDINGS:
${holdingsCompactSummary(portfolio.holdings)}

PERFORMANCE DATA:
${revenueData.gainMonthName ? `${revenueData.gainMonthName} gain` : 'Monthly gain'}: ${monthlyGainStr}${ytdGainStr ? `\nYTD gain: ${ytdGainStr}` : ''}

EXAMPLE POSTS (match this promotional style, structure, and especially length — aim for ~${words} words):
${getPerformanceHighlightExamples(postLength).join('\n---\n')}

Write the performance highlight post now:`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const perfContent =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content: perfContent.trim(),
    topTickers,
  };
}

// ---------------------------------------------------------------------------
// 7. Classify Content-Based Disclaimers (AI-powered)
// ---------------------------------------------------------------------------

export interface ContentDisclaimerMatch {
  ruleId: string;
  reason: string;
}

/**
 * Uses Claude to semantically classify which content-based disclaimer rules
 * apply to a given post. Replaces brittle regex matching.
 */
export async function classifyContentDisclaimers(
  postContent: string,
  contentRules: DisclaimerRule[],
): Promise<ContentDisclaimerMatch[]> {
  if (!postContent.trim() || contentRules.length === 0) return [];

  const client = getClient();

  const rulesDescription = contentRules
    .map(
      (r) =>
        `- id: "${r.id}" | category: ${r.category} | applies when: ${r.useCase} | disclaimer text: "${r.text}"`,
    )
    .join('\n');

  const systemPrompt = `You are a compliance classifier for financial social media posts on the eToro platform.

Your task: given a post and a list of disclaimer rules, determine which rules should apply based on the post content.

RULES:
${rulesDescription}

Classification guidance:
- "past-performance": Apply when the post references ANY historical returns, gains, losses, or performance figures — regardless of formatting (bold, percentages, plus/minus signs). Phrases like "up +7%", "gained 5%", "returned 12% this month", "year to date", "+18.97% YTD", or any mention of what a portfolio or asset HAS done performance-wise should trigger this.
- "future-performance": Apply when the post contains forecasts, predictions, price targets, forward-looking statements, or language like "expected to", "could reach", "will likely".
- For any other rules: use the "applies when" description to judge.

Respond ONLY with valid JSON — an array of objects:
[{ "ruleId": "<id>", "reason": "<short explanation of what in the post triggered this>" }]

If no rules apply, return an empty array: []`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: 'user', content: `POST CONTENT:\n${postContent}` }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      ruleId: string;
      reason: string;
    }>;

    const validIds = new Set(contentRules.map((r) => r.id));
    return parsed
      .filter((m) => validIds.has(m.ruleId))
      .map((m) => ({ ruleId: m.ruleId, reason: m.reason }));
  } catch {
    return [];
  }
}
