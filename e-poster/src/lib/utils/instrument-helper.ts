/**
 * Instrument Helper - Fetches instrument metadata (name, symbol) from eToro.
 */

import { ETORO_API_BASE_URL, API_ENDPOINTS, getBaseHeaders } from '../etoro-api-config';

export interface InstrumentInfo {
  instrumentId: number;
  name: string;
  symbol: string;
  stocksIndustryId?: number;
}

const BATCH_SIZE = 50;

export async function getInstrumentsByIds(
  instrumentIds: number[],
): Promise<Map<number, InstrumentInfo>> {
  const instrumentMap = new Map<number, InstrumentInfo>();

  if (instrumentIds.length === 0) return instrumentMap;

  const baseUrl = `${ETORO_API_BASE_URL}${API_ENDPOINTS.INSTRUMENTS}`;
  const headers = getBaseHeaders();

  for (let i = 0; i < instrumentIds.length; i += BATCH_SIZE) {
    const batch = instrumentIds.slice(i, i + BATCH_SIZE);

    try {
      const fullUrl = `${baseUrl}?instrumentIds=${batch.join(',')}`;

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        const instruments: any[] = data.instrumentDisplayDatas || [];

        instruments.forEach((inst: any) => {
          const id = inst.instrumentID ?? inst.instrumentId;
          if (id != null) {
            instrumentMap.set(id, {
              instrumentId: id,
              name: inst.instrumentDisplayName || `Instrument ${id}`,
              symbol: inst.symbolFull || '',
              stocksIndustryId: inst.stocksIndustryId ?? inst.StocksIndustryId ?? inst.stocksIndustryID ?? undefined,
            });
          }
        });
      } else {
        console.error(`Instrument batch fetch failed: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching instrument batch:', error);
    }
  }

  for (const id of instrumentIds) {
    if (!instrumentMap.has(id)) {
      instrumentMap.set(id, {
        instrumentId: id,
        name: `Instrument ${id}`,
        symbol: '',
      });
    }
  }

  return instrumentMap;
}

/**
 * Resolve stocksIndustryId values to human-readable industry names.
 */
export async function getIndustryNames(
  industryIds: number[],
): Promise<Map<number, string>> {
  const industryMap = new Map<number, string>();
  const unique = [...new Set(industryIds)].filter((id) => id != null);

  if (unique.length === 0) return industryMap;

  const baseUrl = `${ETORO_API_BASE_URL}${API_ENDPOINTS.STOCKS_INDUSTRIES}`;
  const headers = getBaseHeaders();

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);

    try {
      const fullUrl = `${baseUrl}?stocksIndustryIds=${batch.join(',')}`;

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        const industries: any[] = data.stocksIndustries ?? data.StocksIndustries ?? [];

        for (const entry of industries) {
          const id = entry.industryID ?? entry.stocksIndustryId ?? entry.StocksIndustryId;
          const name = entry.industryName ?? entry.IndustryName;
          if (id != null && name) {
            industryMap.set(id, name);
          }
        }
      } else {
        console.error(`Industry batch fetch failed: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching industry batch:', error);
    }
  }

  return industryMap;
}
