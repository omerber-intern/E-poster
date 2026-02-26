/**
 * Portfolio Service
 *
 * - syncPortfolioData(): fetches holdings from eToro, resolves instrument names,
 *   computes weights, and writes data/portfolios.json
 * - syncBioData(): fetches bios from eToro and writes data/bios.json (only missing ones)
 * - getPortfoliosFromCache() / getBiosFromCache(): read from local JSON files
 */

import fs from 'fs';
import path from 'path';
import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getBaseHeaders,
  getPortfolioInfoUrl,
  getPortfolioGainUrl,
} from '../etoro-api-config';
import { getAlphaPortfolios } from '../config/portfolios';
import { getUsernamesWithCredentials } from './portfolio-config-service';
import { getInstrumentsByIds, getIndustryNames } from '../utils/instrument-helper';
import { resolveAllIndustries } from '../utils/taxonomy-helper';
import type {
  SmartPortfolio,
  PortfolioBio,
  PortfolioHolding,
  PortfolioGainData,
  IndustryWeight,
  CachedPortfolioData,
  CachedBioData,
} from '../models/portfolio';

const DATA_DIR = path.join(process.cwd(), 'data');
const PORTFOLIOS_FILE = path.join(DATA_DIR, 'portfolios.json');
const BIOS_FILE = path.join(DATA_DIR, 'bios.json');

function requestHeaders(): Record<string, string> {
  const h = getBaseHeaders();
  return h;
}

function computeIndustryWeights(holdings: PortfolioHolding[]): IndustryWeight[] {
  const map = new Map<string, number>();
  for (const h of holdings) {
    if (h.industries && h.industries.length > 0) {
      for (const ib of h.industries) {
        const contribution = (h.allocation * ib.weight) / 100;
        map.set(ib.topic, (map.get(ib.topic) ?? 0) + contribution);
      }
    } else {
      map.set('Other', (map.get('Other') ?? 0) + h.allocation);
    }
  }
  return [...map.entries()]
    .map(([topic, weight]) => ({ topic, weight: Math.round(weight * 100) / 100 }))
    .sort((a, b) => b.weight - a.weight);
}

// ---------------------------------------------------------------------------
// Reading cached data
// ---------------------------------------------------------------------------

export function getPortfoliosFromCache(): CachedPortfolioData {
  try {
    const raw = fs.readFileSync(PORTFOLIOS_FILE, 'utf-8');
    return JSON.parse(raw) as CachedPortfolioData;
  } catch {
    return { portfolios: [], syncedAt: '' };
  }
}

export function getBiosFromCache(): CachedBioData {
  try {
    const raw = fs.readFileSync(BIOS_FILE, 'utf-8');
    return JSON.parse(raw) as CachedBioData;
  } catch {
    return { bios: [], fetchedAt: '' };
  }
}

export function getPortfolioByUsername(username: string): SmartPortfolio | null {
  const { portfolios } = getPortfoliosFromCache();
  return portfolios.find((p) => p.username === username) ?? null;
}

export function getBioByUsername(username: string): PortfolioBio | null {
  const { bios } = getBiosFromCache();
  return bios.find((b) => b.username === username) ?? null;
}

export function getPortfoliosWithCredentials(): string[] {
  return getUsernamesWithCredentials();
}

// ---------------------------------------------------------------------------
// Fetching gain (revenue) data from eToro
// ---------------------------------------------------------------------------

async function syncGainData(username: string): Promise<PortfolioGainData | undefined> {
  try {
    const url = `${ETORO_API_BASE_URL}${getPortfolioGainUrl(username)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: requestHeaders(),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return {
      monthly: Array.isArray(data.monthly) ? data.monthly : [],
      yearly: Array.isArray(data.yearly) ? data.yearly : [],
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Syncing portfolio structure (holdings) from eToro
// ---------------------------------------------------------------------------

export async function syncPortfolioData(): Promise<{
  synced: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // Step 1: Fetch raw positions for every portfolio
  const rawByUsername: Record<string, { positions: any[] }> = {};
  const portfolioList = getAlphaPortfolios();

  for (const username of portfolioList) {
    try {
      const url = `${ETORO_API_BASE_URL}${getPortfolioInfoUrl(username)}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: requestHeaders(),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        errors.push(`${username}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const positions: any[] = data?.positions ?? [];

      if (positions.length === 0) {
        errors.push(`${username}: no positions found`);
        continue;
      }

      rawByUsername[username] = { positions };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${username}: ${msg}`);
    }
  }

  // Step 2: Collect all unique instrument IDs and resolve names + industry IDs
  const allInstrumentIds = new Set<number>();
  for (const entry of Object.values(rawByUsername)) {
    for (const pos of entry.positions) {
      allInstrumentIds.add(pos.instrumentId as number);
    }
  }

  const instrumentMap = await getInstrumentsByIds([...allInstrumentIds]);

  // Step 2b: Resolve industry names from stocksIndustryId values
  const allIndustryIds: number[] = [];
  for (const info of instrumentMap.values()) {
    if (info.stocksIndustryId != null) {
      allIndustryIds.push(info.stocksIndustryId);
    }
  }
  const industryMap = await getIndustryNames(allIndustryIds);

  // Step 3: Build portfolio objects — merge positions by (instrumentId, positionType)
  const portfolios: SmartPortfolio[] = [];

  for (const username of portfolioList) {
    const entry = rawByUsername[username];
    if (!entry) continue;

    const mergeKey = (instrumentId: number, positionType: string) =>
      `${instrumentId}:${positionType}`;

    const merged = new Map<string, PortfolioHolding>();

    for (const pos of entry.positions) {
      const info = instrumentMap.get(pos.instrumentId);
      const positionType: 'Long' | 'Short' =
        pos.isBuy === false ? 'Short' : 'Long';
      const key = mergeKey(pos.instrumentId, positionType);

      const existing = merged.get(key);
      if (existing) {
        existing.allocation += Math.round((pos.investmentPct ?? 0) * 1000) / 1000;
      } else {
        const sectorName = info?.stocksIndustryId != null
          ? industryMap.get(info.stocksIndustryId)
          : undefined;

        merged.set(key, {
          instrumentId: pos.instrumentId,
          instrumentName: info?.name ?? `Instrument ${pos.instrumentId}`,
          symbol: info?.symbol ?? '',
          assetType: 'Stock',
          allocation: Math.round((pos.investmentPct ?? 0) * 1000) / 1000,
          positionType,
          leverage: pos.leverage ?? 1,
          sector: sectorName,
        });
      }
    }

    const holdings = [...merged.values()].map((h) => ({
      ...h,
      allocation: Math.round(h.allocation * 1000) / 1000,
    }));

    const gainData = await syncGainData(username);

    portfolios.push({
      id: username,
      username,
      displayName: username,
      userId: 0,
      holdings,
      totalPositions: holdings.length,
      lastUpdated: new Date().toISOString(),
      gainData,
    });
  }

  // Step 4: Resolve industry breakdowns for all unique symbols across all portfolios
  const allUniqueHoldings = new Map<string, string>(); // symbol -> instrumentName
  for (const p of portfolios) {
    for (const h of p.holdings) {
      if (h.symbol && !allUniqueHoldings.has(h.symbol)) {
        allUniqueHoldings.set(h.symbol, h.instrumentName);
      }
    }
  }

  const holdingsList = [...allUniqueHoldings.entries()].map(([symbol, name]) => ({
    symbol,
    name,
  }));

  console.log(`[sync] Resolving industries for ${holdingsList.length} unique symbols...`);
  const industriesMap = await resolveAllIndustries(holdingsList);

  // Step 5: Enrich holdings with industry data and compute portfolio-level weights
  for (const portfolio of portfolios) {
    for (const holding of portfolio.holdings) {
      const breakdown = industriesMap.get(holding.symbol);
      if (breakdown) {
        holding.industries = breakdown;
      }
    }
    portfolio.industryWeights = computeIndustryWeights(portfolio.holdings);
  }

  const cached: CachedPortfolioData = {
    portfolios,
    syncedAt: new Date().toISOString(),
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PORTFOLIOS_FILE, JSON.stringify(cached, null, 2), 'utf-8');

  return { synced: portfolios.length, errors };
}

// ---------------------------------------------------------------------------
// Syncing bios from eToro (only fetches missing ones unless forced)
// ---------------------------------------------------------------------------

export async function syncBioData(forceAll = false): Promise<{
  fetched: number;
  errors: string[];
}> {
  const errors: string[] = [];

  const existing = getBiosFromCache();
  const existingUsernames = new Set(existing.bios.map((b) => b.username));

  const portfolioList = getAlphaPortfolios();
  const toFetch = forceAll
    ? portfolioList
    : portfolioList.filter((u) => !existingUsernames.has(u));

  if (toFetch.length === 0) {
    return { fetched: 0, errors: [] };
  }

  const newBios: PortfolioBio[] = forceAll ? [] : [...existing.bios];

  for (const username of toFetch) {
    try {
      const url = new URL(
        `${ETORO_API_BASE_URL}${API_ENDPOINTS.USER_INFO}`,
      );
      url.searchParams.append('usernames', username);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: requestHeaders(),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        errors.push(`${username}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const user = data?.users?.[0];

      if (!user) {
        errors.push(`${username}: no user data returned`);
        continue;
      }

      const bio: PortfolioBio = {
        username,
        displayName: user.username ?? username,
        userId: user.gcid ?? 0,
        bio: user.aboutMe ?? '',
        aboutMe: user.userBio?.aboutMe ?? user.aboutMe ?? '',
        strategy: user.userBio?.strategyID ?? '',
        riskScore: undefined,
        copiers: undefined,
        avatarUrl: user.avatars?.[0]?.url ?? '',
        fetchedAt: new Date().toISOString(),
      };

      const idx = newBios.findIndex((b) => b.username === username);
      if (idx >= 0) {
        newBios[idx] = bio;
      } else {
        newBios.push(bio);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${username}: ${msg}`);
    }
  }

  const cached: CachedBioData = {
    bios: newBios,
    fetchedAt: new Date().toISOString(),
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BIOS_FILE, JSON.stringify(cached, null, 2), 'utf-8');

  return { fetched: toFetch.length - errors.length, errors };
}

// ---------------------------------------------------------------------------
// Legacy / convenience exports
// ---------------------------------------------------------------------------

export async function getSmartPortfolios(
  usernames?: string[],
): Promise<SmartPortfolio[]> {
  const { portfolios } = getPortfoliosFromCache();
  if (!usernames || usernames.length === 0) return portfolios;
  return portfolios.filter((p) => usernames.includes(p.username));
}

export function getPortfolioInstrumentIds(portfolio: SmartPortfolio): number[] {
  return portfolio.holdings.map((h) => h.instrumentId);
}
