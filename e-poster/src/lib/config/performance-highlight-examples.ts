/**
 * Few-shot example posts for performance highlight generation.
 *
 * Promotional/advertising posts that compliment a portfolio's strong
 * performance.
 *
 * Three length tiers — short (~150 words), medium (~200 words), long (~250 words).
 * Every example opens with a concise bottom-line sentence so the model
 * learns to do the same.
 *
 * Disclaimers are stripped — they are handled separately by auto-detection.
 */

// ---------------------------------------------------------------------------
// SHORT (~150 words)
// ---------------------------------------------------------------------------

export const PERFORMANCE_HIGHLIGHT_EXAMPLES_SHORT: string[] = [
  `@PureMomentum

PureMomentum is delivering strong returns by systematically riding the market's top-performing stocks across materials, tech, and industrials.

📈 Momentum Is Having Its Moment

❓ What happens when you let data pick the market's strongest performers?

👉 @PureMomentum is up **+7.09% this month** and **+18.97% year to date** — driven by disciplined, rules-based momentum investing.

👉 The strategy screens U.S. equities monthly, selecting top-ranked names using eToro's proprietary momentum score. Up to 49 stocks are held in equal weight.

👉 Top movers include $EQX, $AU, $AG, and $GFI — riding tailwinds across precious metals, tech, and industrials.

✨ @PureMomentum is a systematic U.S.-equity Smart Portfolio built for investors who want structured exposure to market leadership. Minimum investment: **$2,000**.`,
];

// ---------------------------------------------------------------------------
// MEDIUM (~200 words)
// ---------------------------------------------------------------------------

export const PERFORMANCE_HIGHLIGHT_EXAMPLES_MEDIUM: string[] = [
  `@PureMomentum

PureMomentum is delivering strong returns by systematically riding the market's top-performing stocks, proving that disciplined momentum investing works when conditions align.

📈 Momentum Is Having Its Moment — And This Portfolio Is Delivering

❓ What happens when you systematically chase the market's strongest performers and let the data do the work?

👉 The momentum factor — the tendency for stocks already rising to keep rising — is back in the spotlight. As markets reward clear sector leadership, momentum strategies are capturing real, measurable gains.

👉 @PureMomentum is up **+7.09% this month** and **+18.97% year to date** — a strong reflection of disciplined, rules-based momentum investing.

👉 The strategy screens the entire U.S. equity universe on eToro monthly, filters for large- and mid-cap stocks with market caps above $2.5B and strong liquidity, then selects top-ranked names using eToro's proprietary momentum score. Up to 49 stocks are held in equal weight, keeping concentration risk low.

👉 Top movers include $EQX, $AU, $AG, and $GFI — riding strong tailwinds across precious metals, technology, and industrials.

👉 With over 34% in Basic Materials, the portfolio is positioned to benefit from commodity cycles and resource demand.

✨ @PureMomentum is a systematic Smart Portfolio for investors who want structured exposure to market leadership — without leverage or short selling. It rebalances monthly, keeping the portfolio aligned with where strength actually lives. Minimum investment: **$2,000**.`,
];

// ---------------------------------------------------------------------------
// LONG (~250 words)
// ---------------------------------------------------------------------------

export const PERFORMANCE_HIGHLIGHT_EXAMPLES_LONG: string[] = [
  `@PureMomentum

PureMomentum is delivering strong returns by systematically riding the market's top-performing stocks, proving that disciplined momentum investing works when market conditions align.

📈 Momentum Is Having Its Moment — And This Portfolio Is Delivering

❓ What happens when you systematically chase the market's strongest performers and let the data do the work?

👉 The momentum factor — the tendency for stocks already rising to keep rising — is back in the spotlight. As markets reward clear sector leadership and investors rotate into high-conviction themes like materials, technology, and industrials, momentum strategies are capturing real, measurable gains.

👉 The numbers speak for themselves: @PureMomentum is up **+7.09% this month** and **+18.97% year to date** — a strong reflection of what disciplined, rules-based momentum investing can deliver when market conditions align.

👉 The strategy is straightforward: every month, it screens the entire U.S. equity universe on eToro, filters for large- and mid-cap stocks with market caps above $2.5B and strong daily liquidity, then selects the top-ranked names using eToro's proprietary momentum score — combining price action with anonymised client-flow data. Up to 49 stocks are held in equal weight, keeping concentration risk low.

👉 Today's top movers inside the portfolio include $EQX, $AU, $AG, and $GFI — names riding strong sector tailwinds across technology, energy transition, consumer growth, and precious metals.

👉 With over 34% in Basic Materials, the portfolio is well-positioned to benefit from commodity cycles and resource demand. Complementary exposure across $TER, $COHR, $RYAAY, and $CIB adds breadth across tech, industrials, services, and financials.

✨ @PureMomentum is a systematic U.S.-equity Smart Portfolio built for investors who want structured exposure to market leadership — without leverage or short selling. It rebalances monthly, keeping the portfolio fresh and aligned with where strength actually lives.

This strategy could suit growth-oriented investors looking to complement value or dividend-focused holdings with a dynamic, factor-driven approach. The minimum investment is **$2,000**.

Current top holdings include $AG, $CIEN, $AU, $EQX, $TER and $AEM.`,
];

/** Backward-compatible default export (long examples). */
export const PERFORMANCE_HIGHLIGHT_EXAMPLES = PERFORMANCE_HIGHLIGHT_EXAMPLES_LONG;

/** Returns the example set matching the requested length. */
export function getPerformanceHighlightExamples(length: 'short' | 'medium' | 'long'): string[] {
  switch (length) {
    case 'short': return PERFORMANCE_HIGHLIGHT_EXAMPLES_SHORT;
    case 'medium': return PERFORMANCE_HIGHLIGHT_EXAMPLES_MEDIUM;
    case 'long': return PERFORMANCE_HIGHLIGHT_EXAMPLES_LONG;
  }
}
