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
  sector?: string;
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
