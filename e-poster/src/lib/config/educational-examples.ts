/**
 * Few-shot example posts for educational content generation.
 *
 * Educational posts explain a portfolio's strategy, investor fit, and
 * diversification value in accessible terms.
 *
 * Three length tiers — short (~150 words), medium (~200 words), long (~250 words).
 * Every example opens with a concise bottom-line summary so the model
 * learns to do the same.
 *
 * Disclaimers are stripped — they are handled separately by auto-detection.
 */

// ---------------------------------------------------------------------------
// SHORT (~150 words)
// ---------------------------------------------------------------------------

export const EDUCATIONAL_EXAMPLES_SHORT: string[] = [
  `@AI-Revolution

This portfolio gives you exposure to the companies building and deploying AI — from chip makers to cloud platforms — in a single, fully allocated strategy.

🤖 What Is AI-Revolution?

AI-Revolution is a thematic Smart Portfolio that invests in companies developing cutting-edge AI technologies — including infrastructure, semiconductors, cloud computing, and enterprise software.

👉 Top holdings include $NVDA, $META, $GOOGL, $AMZN, and $MSFT — the companies building the backbone of AI applications worldwide.

👉 The portfolio targets both pure-play AI infrastructure and large-cap tech firms integrating AI into their business models, giving investors broad exposure across the AI value chain.

✨ If you're looking to add AI exposure to a more traditional portfolio, @AI-Revolution offers a diversified, managed approach. Minimum investment: $500.`,

  `@Utilities

This portfolio invests in essential utility companies — electricity, gas, water, and waste management — offering defensive exposure to sectors that power daily life.

⚡ Why Utilities?

Utility stocks are considered defensive holdings that tend to provide steady income and lower volatility compared to growth sectors. They benefit from consistent demand regardless of economic cycles.

👉 Top holdings include $NEE, $DUK, $AEP, and $AWK.

👉 With data center power demand surging, utilities are seeing renewed growth tailwinds on top of their traditional stability.

✨ @Utilities can serve as a stabilising anchor in a growth-heavy portfolio. Minimum investment: $500.`,
];

// ---------------------------------------------------------------------------
// MEDIUM (~200 words)
// ---------------------------------------------------------------------------

export const EDUCATIONAL_EXAMPLES_MEDIUM: string[] = [
  `@AI-Revolution

This portfolio gives you exposure to the full AI value chain — from chip makers to cloud platforms to enterprise software — in a single, fully allocated thematic strategy.

🤖 What Is AI-Revolution?

AI-Revolution is a Smart Portfolio built around one thesis: artificial intelligence is reshaping every industry, and the companies building that infrastructure are positioned to benefit for years to come.

👉 The portfolio invests across the entire AI stack — semiconductor giants like $NVDA and $AVGO designing the chips, hyperscalers like $AMZN, $GOOGL, and $MSFT building the cloud, and software companies like $PLTR and $CRM applying AI at the enterprise level.

👉 By holding positions across hardware, cloud, and application layers, the portfolio reduces single-company risk while capturing broad AI-driven growth.

👉 The strategy is fully allocated — no cash drag — and rebalanced to reflect the evolving AI landscape as new leaders emerge.

❓ Who is this for?

Investors who believe in the long-term AI trend but want diversified, managed exposure rather than picking individual stocks. It pairs well alongside value or income-focused portfolios.

✨ @AI-Revolution has a minimum investment of $500 and is available on eToro's Smart Portfolio platform.`,

  `@EuropeDefense

This portfolio offers diversified exposure to European defense and aerospace companies — from aircraft and naval systems to surveillance tech and tactical equipment.

🛡️ Why European Defense?

With defense spending rising across Europe and a strategic push to reduce reliance on external suppliers, European defense companies are seeing sustained tailwinds that could last for years.

👉 The portfolio holds companies across the defense value chain: $SAF.PA for aircraft engines, $RR.L for power systems, $HAG.DE for sensor technology, and $HO.PA for electronics and cybersecurity.

👉 This isn't a bet on a single contractor — it's a broad allocation across the European defense supply chain, capturing growth from increased military budgets, NATO commitments, and domestic production initiatives.

❓ Who is this for?

Investors looking for sector-specific exposure to a structural growth theme in Europe. It can add diversification to portfolios heavy in US tech or broad index funds.

✨ @EuropeDefense has a minimum investment of $500. Holdings span firms in France, Germany, the UK, Norway, and Spain.`,
];

// ---------------------------------------------------------------------------
// LONG (~250 words)
// ---------------------------------------------------------------------------

export const EDUCATIONAL_EXAMPLES_LONG: string[] = [
  `@AI-Revolution

This portfolio gives you exposure to the full AI value chain — from chip makers to cloud platforms to enterprise software — in a single, fully allocated thematic strategy designed for long-term growth.

🤖 What Is AI-Revolution?

AI-Revolution is a Smart Portfolio built around one thesis: artificial intelligence is reshaping every industry, and the companies building that infrastructure are positioned to benefit for years to come.

👉 The portfolio invests across the entire AI stack. At the hardware layer, semiconductor giants like $NVDA, $AVGO, and $TSM are designing and fabricating the chips that power AI workloads.

👉 At the cloud layer, hyperscalers like $AMZN, $GOOGL, and $MSFT are building the data center infrastructure that makes AI accessible at scale.

👉 At the application layer, companies like $PLTR, $CRM, and $NOW are turning AI capabilities into enterprise products that drive real business outcomes.

👉 By holding positions across all three layers, the portfolio reduces single-company risk while capturing the full breadth of AI-driven growth — whether the value accrues to chipmakers, platforms, or software.

❓ Who is this for?

Investors who believe in the long-term AI trend but want diversified, managed exposure rather than picking individual stocks. The portfolio is fully allocated — no cash sitting idle — and rebalanced to reflect the evolving landscape.

It pairs well alongside value, income, or defensive portfolios as a growth-oriented satellite allocation. Minimum investment: $500.`,

  `@EuropeDefense

This portfolio offers diversified exposure to companies across the European defense and aerospace supply chain — a structural growth theme driven by rising military budgets and a continent-wide push for strategic autonomy.

🛡️ Why European Defense?

Europe is in the middle of a generational shift in defense spending. NATO commitments, geopolitical tensions, and a strategic push to build domestic manufacturing capacity are driving sustained investment in defense and aerospace across the continent.

👉 The portfolio captures this trend across the full value chain. $SAF.PA and $RR.L provide exposure to aerospace engines and power systems. $HAG.DE and $HO.PA cover sensors, electronics, and cybersecurity.

👉 Tactical equipment and shipbuilding are represented through companies like $KOG.OL and $SNR.L, which supply components and systems used across multiple platforms.

👉 This breadth means the portfolio isn't dependent on a single government contract or weapons system — it benefits from the broader trend of increased European defense investment regardless of which specific programs receive funding.

❓ Who is this for?

Investors looking for sector-specific exposure to a structural growth theme in Europe. Defense stocks tend to have lower correlation with US tech, making this portfolio a potential diversifier for investors heavily weighted in American growth names.

The portfolio spans companies in France, Germany, the UK, Norway, and Spain. Minimum investment: $500.`,
];

/** Returns the example set matching the requested length. */
export function getEducationalExamples(length: 'short' | 'medium' | 'long'): string[] {
  switch (length) {
    case 'short': return EDUCATIONAL_EXAMPLES_SHORT;
    case 'medium': return EDUCATIONAL_EXAMPLES_MEDIUM;
    case 'long': return EDUCATIONAL_EXAMPLES_LONG;
  }
}
