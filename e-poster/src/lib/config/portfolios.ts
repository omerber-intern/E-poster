/**
 * Portfolio list — reads dynamically from data/portfolio-config.json.
 * Falls back to the hardcoded default list when the config file doesn't exist yet.
 *
 * Short-Tech is the test account whose API key is used for all GET requests.
 */

import { getPortfolioUsernames } from '../services/portfolio-config-service';

export const ALPHA_PORTFOLIOS_DEFAULT = [
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

export type AlphaPortfolioUsername = (typeof ALPHA_PORTFOLIOS_DEFAULT)[number];

/**
 * Dynamic list of all portfolio usernames.
 * Read from portfolio-config.json, falling back to ALPHA_PORTFOLIOS_DEFAULT.
 */
export function getAlphaPortfolios(): string[] {
  return getPortfolioUsernames();
}

/** @deprecated Use getAlphaPortfolios() instead for dynamic list */
export const ALPHA_PORTFOLIOS = ALPHA_PORTFOLIOS_DEFAULT;
