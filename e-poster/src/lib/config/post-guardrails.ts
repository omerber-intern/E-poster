/**
 * Post Guardrails
 *
 * Contains formatting rules and structure instructions injected into every
 * AI content-generation prompt to ensure consistent, compliant posts.
 *
 * - UNIVERSAL_GUARDRAILS   → applies to ALL content types
 * - NEWS_POST_FORMAT_INSTRUCTIONS → news-post specific structure (5 sections)
 * - buildSmartPortfolioHighlight  → builds the ✨ SP Highlight block from live portfolio data
 */

import type { SmartPortfolio, PortfolioBio } from '../models/portfolio';

// ---------------------------------------------------------------------------
// Universal guardrails (all content types)
// ---------------------------------------------------------------------------

export const UNIVERSAL_GUARDRAILS = `
UNIVERSAL FORMATTING RULES (apply to every post):
- Always use $TICKER format for stock and ETF symbols (e.g. $NVDA, $AAPL, $MSFT).
- If a $TICKER appears at the end of a sentence, insert a space before the period: "$NVDA ." not "$NVDA."
- The @SmartPortfolio name must always appear as a hyperlink (rendered in green on eToro).
- Never use hashtags (#).
- Keep paragraphs short and scannable — prefer multiple short paragraphs over long blocks of text.
- Use emojis purposefully; do not overuse them.
- Maintain a professional yet accessible tone — clear, confident, and easy to understand for retail investors.
- The standard disclaimer for news posts is exactly: "Your capital is at risk. Past performance is not an indication of future results."
`.trim();

// ---------------------------------------------------------------------------
// News post format instructions
// ---------------------------------------------------------------------------

export const NEWS_POST_FORMAT_INSTRUCTIONS = `
NEWS POST STRUCTURE — You MUST follow this exact 5-section format:

1. HEADLINE
   - A single line: relevant emoji + concise, informative title
   - Aim for ~5–12 words
   - Highlight the key theme or takeaway of the news

2. QUESTION FOR ENGAGEMENT
   - A single line starting with ❓
   - One question that invites discussion — introduce a trade-off, uncertainty, or debate
   - Must relate specifically to the news (not generic like "What do you think?")

3. NEWS TEXT
   - 3–8 bullet points, each starting with 👉
   - Each bullet: 1–2 sentences
   - Include relevant tickers in $TICKER format where appropriate
   - Focus on key facts, developments, and market implications

4. SOURCE
   - A single line: 🔗 Read more: <URL>
   - Use the news URL provided; if none, omit this section

5. SMART PORTFOLIO HIGHLIGHT
   - Insert the provided SP_HIGHLIGHT_BLOCK verbatim — do NOT alter it in any way
   - Place it exactly as the final section of the post

Do NOT add any other sections, preamble, or closing remarks outside these five sections.
`.trim();

// ---------------------------------------------------------------------------
// Smart Portfolio Highlight builder
// ---------------------------------------------------------------------------

/**
 * Formats a list of ticker symbols into natural English.
 * e.g. ["AAPL","MSFT","NVDA"] → "$AAPL, $MSFT, and $NVDA"
 */
function formatTickerList(tickers: string[]): string {
  if (tickers.length === 0) return '';
  const formatted = tickers.map((t) => `$${t}`);
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
}

/**
 * Builds the ✨ Smart Portfolio Highlight block from live portfolio data.
 *
 * @param portfolio        The SmartPortfolio object (from portfolios.json / Refresh Portfolios Data)
 * @param bio              The PortfolioBio for this portfolio (from bios.json)
 * @param mentionedTickers Ticker symbols from the news that belong to this portfolio
 *                         (derived from impact.affectedHoldings)
 */
export function buildSmartPortfolioHighlight(
  portfolio: SmartPortfolio,
  bio: PortfolioBio | null,
  mentionedTickers: string[],
): string {
  const portfolioHandle = `@${portfolio.username}`;

  // Use the first sentence of the bio as the portfolio description, falling back gracefully
  const description = bio?.bio?.trim() || bio?.aboutMe?.trim() || '';

  // Top 6 holdings by allocation for the "holdings include" list
  const topHoldings = portfolio.holdings
    .filter((h) => h.symbol)
    .sort((a, b) => b.allocation - a.allocation)
    .slice(0, 6)
    .map((h) => `$${h.symbol}`);

  // Format the holdings list with a trailing space before any implied period
  const holdingsList = topHoldings.join(', ');

  const tickerSubject =
    mentionedTickers.length > 0
      ? formatTickerList(mentionedTickers)
      : 'These holdings';

  const areIs = mentionedTickers.length === 1 ? 'is' : 'are';

  const descriptionSuffix = description
    ? `, ${description.endsWith('.') ? description.slice(0, -1) : description}.`
    : '.';

  const lines: string[] = [
    `✨ ${tickerSubject} ${areIs} part of eToro's ${portfolioHandle} Smart Portfolio${descriptionSuffix}`,
    '',
    `The minimum investment for the ${portfolioHandle} Smart Portfolio is $500. Some of the portfolio's holdings include ${holdingsList} .`,
    '',
    'Your capital is at risk. Past performance is not an indication of future results.',
  ];

  return lines.join('\n');
}
