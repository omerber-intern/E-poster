/**
 * Few-shot example posts for monthly update generation.
 *
 * Template A — "Stats at Bottom": structured performance stats at the end.
 * Template B — "Revenue in Opening": revenue figure in the first sentence.
 *
 * Three length tiers — short (~150 words), medium (~200 words), long (~250 words).
 * Every example opens with a concise bottom-line sentence after the greeting
 * so the model learns to do the same.
 *
 * Disclaimers are stripped — they are handled separately by auto-detection.
 */

// ===========================================================================
// Template A — Stats at Bottom
// ===========================================================================

export const MONTHLY_UPDATE_TEMPLATE_A_SHORT: string[] = [
  `Dear Investors,

Here is your monthly update for January 2026 ✨

Markets delivered broad gains in January, with European indices outperforming and defence stocks rallying on geopolitical tensions.

Semiconductor stocks surged on strong AI-driven demand, while software struggled. The US dollar weakened on rate-cut expectations, and gold posted strong gains amid risk-off positioning.

Performance Stats: @AI-Revolution -> January: 2.72%
Benchmark (IAIQ) -> January: 2.47%

Some of the assets inside the @AI-Revolution Smart Portfolio are: $BABA (Alibaba-ADR) , $AMD (Advanced Micro Devices Inc) , $PLTR (Palantir Technologies Inc.) , $LRCX (Lam Research Corp) , $AMAT (Applied Materials Inc)`,
];

export const MONTHLY_UPDATE_TEMPLATE_A_MEDIUM: string[] = [
  `Dear Investors,

Here is your monthly update for January 2026 ✨

Markets delivered broad gains in January, with European indices and US small caps outperforming while geopolitical themes drove sector rotation.

European indices and US small caps outperformed the S&P 500 and Nasdaq, while Energy led sector returns on higher oil prices. Geopolitical developments dominated sentiment, lifting defence and energy stocks amid heightened global tensions.

Corporate earnings were mixed: semiconductor stocks surged on strong AI-driven demand, while software continued to struggle. Outside equities, the US dollar weakened on rate-cut expectations, while gold, silver, and oil posted strong gains amid geopolitical risk.

💭 Find out more about what happened in January with eToro's Smart Portfolios Monthly summary here: etoro.turtl.co/story/etoros-investment-office-performance-report-jan26

Performance Stats: @AI-Revolution -> January: 2.72%
Benchmark (IAIQ - Indxx Artificial Intelligence and Big Data Index) -> January: 2.47%
Best Performer: $MU (Micron Technology, Inc.) 45.36%
Worst Performer: $TEAM (Atlassian Corp PLC A) -27.11%

Some of the assets inside the @AI-Revolution Smart Portfolio are: $BABA (Alibaba-ADR) , $AMD (Advanced Micro Devices Inc) , $PLTR (Palantir Technologies Inc.) , $LRCX (Lam Research Corp) , $AMAT (Applied Materials Inc) , $INTC (Intel)`,
];

export const MONTHLY_UPDATE_TEMPLATE_A_EXAMPLES: string[] = [
  `Dear Investors,

Here is your monthly update for January 2026 ✨

Markets delivered broad gains in January, with European indices and US small caps leading the way while geopolitical and AI themes drove meaningful sector rotation.

January saw broad gains across equity markets, though performance varied by region and sector. European indices and US small caps outperformed the S&P 500 and Nasdaq, while Energy led sector returns on higher oil prices.

Geopolitical developments dominated sentiment, lifting defence and energy stocks amid heightened global tensions. Corporate earnings were mixed: semiconductor stocks surged on strong AI-driven demand, while software continued to struggle.

Outside equities, the US dollar weakened on rate-cut expectations and Fed leadership uncertainty, while gold, silver, and oil posted strong gains amid geopolitical risk. Cryptoassets declined as investors reduced exposure to higher-risk assets.

💭 Find out more about what happened in January with eToro's Smart Portfolios Monthly summary here: etoro.turtl.co/story/etoros-investment-office-performance-report-jan26

Performance Stats: @AI-Revolution -> January: 2.72%
Benchmark (IAIQ - Indxx Artificial Intelligence and Big Data Index) -> January: 2.47%
Best Performer: $MU (Micron Technology, Inc.) 45.36%
Worst Performer: $TEAM (Atlassian Corp PLC A) -27.11%

Some of the assets inside the @AI-Revolution Smart Portfolio are: $BABA (Alibaba-ADR) , $AMD (Advanced Micro Devices Inc) , $PLTR (Palantir Technologies Inc.) , $LRCX (Lam Research Corp) , $AMAT (Applied Materials Inc) , $INTC (Intel) , $TXN (Texas Instruments Inc) , $CRM (Salesforce Inc) , $PANW (Palo Alto Networks) , $NOW (ServiceNow Inc)`,
];

// ===========================================================================
// Template B — Revenue in Opening
// ===========================================================================

export const MONTHLY_UPDATE_TEMPLATE_B_SHORT: string[] = [
  `Dear Investors 🤝,

Here is your monthly update for January 2026
📊 @Momentum-LS — January 2026 pulse
January 2026: +10.03 % 🚀

Momentum-LS had a standout start to 2026, benefiting from cyclical strength and renewed interest in resource and industrial sectors.

The strategy's long/short discipline kept drawdowns modest even as headline indices traded near record highs 💪. Diversified momentum exposures contributed to strong near-term performance 🎯.

@Momentum-LS
$IAG.US (Iamgold Corp) , $KGC (Kinross Gold Corp) , $GFI.US (Gold Fields Ltd-ADR), $MU (Micron Technology, Inc.)`,

  `Dear Investors 🤝,

Here is your monthly update for January 2026
📈 @PureMomentum — January 2026 Pulse
January 2026: +11.09 %

PureMomentum continued to outperform in early 2026 🚀, with strong participation from cyclicals and tech names showing consistent trend strength.

The systematic selection process captured upside 📈 in sectors with intact price momentum, keeping the strategy ahead of fading names 🏆.

@PureMomentum, $TEVA (Teva Pharmaceutical Industries ADR) $HSBC (HSBC-ADR) $GOOG (Alphabet)`,
];

export const MONTHLY_UPDATE_TEMPLATE_B_MEDIUM: string[] = [
  `Dear Investors 🤝,

Here is your monthly update for January 2026
📊 @Momentum-LS — January 2026 pulse
January 2026: +10.03 % 🚀

Momentum-LS had a standout start to 2026, benefiting from broad cyclical strength and renewed investor interest in resource and industrial sectors.

With markets digesting mixed employment and growth signals, cyclical components like Non-Energy Minerals and Financials 🏦 provided rotational support, while selective short positions in rate-sensitive defensives helped cushion volatility 🛡️. The strategy's long/short discipline kept drawdowns modest even as headline indices traded at or near record levels 💪.

Tech remains a leadership theme overall, but diversified momentum exposures are contributing to solid near-term performance. As markets brace for further guidance from upcoming Fed commentary 🏛️ and earnings, Momentum-LS remains positioned to capture both trend continuation and rotational gains 🎯.

@Momentum-LS
$IAG.US (Iamgold Corp) , $KGC (Kinross Gold Corp) , $GFI.US (Gold Fields Ltd-ADR), $MU (Micron Technology, Inc.) , $WDC (Western Digital Corporation)`,

  `Dear Investors 🤝,

Here is your monthly update for January 2026
📈 @PureMomentum — January 2026 Pulse
January 2026: +11.09 %

PureMomentum continued to outperform in early 2026, riding strong participation from cyclicals and tech names with consistent trend strength.

The systematic selection process captured upside 📈 in sectors where price momentum remains intact, particularly amid strong earnings and carry-over gains from late 2025. Markets digested macro crosscurrents 🌊 — soft inflation reads, speculation on rate policy, and mixed earnings reactions — and PureMomentum's focus on trends allowed the strategy to stay ahead of fading names and rotate into emerging winners 🏆.

For investors seeking straightforward exposure to trending stocks without short positions or leverage, this remains a compelling momentum play 🔥.

@PureMomentum, $TEVA (Teva Pharmaceutical Industries ADR) $HSBC (HSBC-ADR) $GOOG (Alphabet), $STX.US (Seagate Technology PLC), $CIEN (Ciena Corp)`,
];

export const MONTHLY_UPDATE_TEMPLATE_B_EXAMPLES: string[] = [
  `Dear Investors 🤝,

Here is your monthly update for January 2026
📊 @Momentum-LS — January 2026 pulse
January 2026: +10.03 % 🚀

Momentum-LS had a standout start to 2026, benefiting from broad cyclical strength and renewed investor interest in resource and industrial sectors after moderating inflation data.

With markets continuing to digest mixed employment and growth signals, cyclical components like Non-Energy Minerals and Financials 🏦 provided rotational support, while selective short positions in rate-sensitive defensives helped cushion volatility 🛡️.
The strategy's long/short discipline has helped keep drawdowns modest even as headline indices trade at or near record levels. Tech remains a leadership theme overall, but diversified momentum exposures are contributing to solid near-term performance. As markets brace for further guidance from upcoming Fed commentary 🏛️ and earnings, Momentum-LS remains positioned to capture both trend continuation and rotational gains 🎯.

The strong January result underscores the value of combining momentum signals with tactical short positioning, particularly in a market where rotational dynamics continue to create alpha opportunities across sectors and asset classes.

@Momentum-LS
$IAG.US (Iamgold Corp) , $KGC (Kinross Gold Corp) , $GFI.US (Gold Fields Ltd-ADR), $MU (Micron Technology, Inc.) , $WDC (Western Digital Corporation) , $KTOS (Kratos Defense & Security Solutions Inc), $AU (AngloGold Ashanti Ltd-ADR)`,

  `Dear Investors 🤝,

Here is your monthly update for January 2026
📈 @PureMomentum — January 2026 Pulse
January 2026: +11.09 %

PureMomentum continued to outperform in early 2026, riding strong participation from cyclicals and tech names that have shown consistent trend strength over recent months.

The systematic selection process captured upside 📈 in sectors where price momentum remains intact, particularly amid the broader backdrop of strong earnings and carry-over gains from late 2025.
Markets have been digesting macro crosscurrents 🌊 — soft inflation reads, speculation on rate policy, and mixed earnings reactions — and PureMomentum's focus on trends allowed the strategy to stay ahead of fading names and rotate into emerging winners 🏆. For investors seeking straightforward exposure to trending stocks without short positions or leverage, this remains a compelling momentum play 🔥.

The disciplined monthly rebalance continues to refresh exposure toward sectors with the strongest price action, making PureMomentum an attractive option for growth-oriented investors looking to complement more defensive or value-tilted holdings.

@PureMomentum, $TEVA (Teva Pharmaceutical Industries ADR) $HSBC (HSBC-ADR) $GOOG (Alphabet), $STX.US (Seagate Technology PLC), $CIEN (Ciena Corp)`,
];

// ---------------------------------------------------------------------------
// Helper — pick examples by template style + length
// ---------------------------------------------------------------------------

export function getMonthlyUpdateExamples(
  templateStyle: 'stats-bottom' | 'revenue-opening',
  length: 'short' | 'medium' | 'long',
): string[] {
  if (templateStyle === 'stats-bottom') {
    switch (length) {
      case 'short': return MONTHLY_UPDATE_TEMPLATE_A_SHORT;
      case 'medium': return MONTHLY_UPDATE_TEMPLATE_A_MEDIUM;
      case 'long': return MONTHLY_UPDATE_TEMPLATE_A_EXAMPLES;
    }
  } else {
    switch (length) {
      case 'short': return MONTHLY_UPDATE_TEMPLATE_B_SHORT;
      case 'medium': return MONTHLY_UPDATE_TEMPLATE_B_MEDIUM;
      case 'long': return MONTHLY_UPDATE_TEMPLATE_B_EXAMPLES;
    }
  }
}
