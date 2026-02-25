/**
 * Master list of all Alpha portfolio usernames on eToro.
 * Short-Tech is the test account whose API key is used for all GET requests.
 */

export const ALPHA_PORTFOLIOS = [
  'Short-Tech',
  'PureMomentum',
  'PureGrowth',
  'Momentum-LS',
  'MarketPicks',
  'BalancedPicks',
  'OutSmartNSDQ',
  'ProPicks',
  'GainersQtr',
  'ActiveTraders',
  'SharpTraders',
  'SectorNeutral',
  'Pure-Value',
  'SectorGurus',
  'NasdaqAI-Inverse',
] as const;

export type AlphaPortfolioUsername = (typeof ALPHA_PORTFOLIOS)[number];
