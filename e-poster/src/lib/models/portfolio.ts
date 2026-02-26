/**
 * Portfolio models for e-poster
 */

export interface PortfolioGainEntry {
  timestamp: string;
  gain: number;
}

export interface PortfolioGainData {
  monthly: PortfolioGainEntry[];
  yearly: PortfolioGainEntry[];
  fetchedAt: string;
}

export interface SmartPortfolio {
  id: string;
  username: string;
  displayName: string;
  userId: number;
  description?: string;
  holdings: PortfolioHolding[];
  totalPositions: number;
  lastUpdated: string;
  gainData?: PortfolioGainData;
  /** Pre-computed topic-level industry weights, sorted descending. Set during sync. */
  industryWeights?: IndustryWeight[];
}

export interface IndustryBreakdown {
  topic: string;
  subcategory: string;
  majorCategory: string;
  /** Normalized weight (0-100, sums to 100 per holding) */
  weight: number;
}

export interface IndustryWeight {
  topic: string;
  /** Portfolio allocation percentage contributed by this topic (0-100) */
  weight: number;
}

export interface PortfolioHolding {
  instrumentId: number;
  instrumentName: string;
  symbol: string;
  assetType: string;
  allocation: number;
  positionType: 'Long' | 'Short';
  leverage: number;
  positionId?: number;
  /** Broad sector from eToro (9 categories) — kept for reference */
  sector?: string;
  /** Revenue-based industry breakdown from taxonomy, normalized to sum 100 */
  industries?: IndustryBreakdown[];
}

export interface PortfolioBio {
  username: string;
  displayName: string;
  userId: number;
  bio: string;
  aboutMe?: string;
  strategy?: string;
  riskScore?: number;
  copiers?: number;
  avatarUrl?: string;
  fetchedAt: string;
}

export interface PortfolioListResponse {
  portfolios: SmartPortfolio[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface PortfolioCredentials {
  apiKey: string;
  userKey: string;
  gcid: string;
}

export interface CachedPortfolioData {
  portfolios: SmartPortfolio[];
  syncedAt: string;
}

export interface CachedBioData {
  bios: PortfolioBio[];
  fetchedAt: string;
}
