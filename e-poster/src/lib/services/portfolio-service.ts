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
  getPortfolioCredentials,
  getPortfolioInfoUrl,
} from '../etoro-api-config';
import { ALPHA_PORTFOLIOS } from '../config/portfolios';
import { getInstrumentsByIds, getIndustryNames } from '../utils/instrument-helper';
import type {
  SmartPortfolio,
  PortfolioBio,
  PortfolioHolding,
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
  return ALPHA_PORTFOLIOS.filter(
    (u) => getPortfolioCredentials(u) !== null,
  ) as string[];
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

  for (const username of ALPHA_PORTFOLIOS) {
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

  for (const username of ALPHA_PORTFOLIOS) {
    const entry = rawByUsername[username as string];
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

    portfolios.push({
      id: username,
      username,
      displayName: username,
      userId: 0,
      holdings,
      totalPositions: holdings.length,
      lastUpdated: new Date().toISOString(),
    });
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

  const toFetch = forceAll
    ? ([...ALPHA_PORTFOLIOS] as string[])
    : (ALPHA_PORTFOLIOS.filter((u) => !existingUsernames.has(u)) as string[]);

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
