import { NextResponse } from 'next/server';
import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getBaseHeaders,
} from '@/lib/etoro-api-config';
import {
  readPortfolioConfig,
  updateCredentials,
} from '@/lib/services/portfolio-config-service';

/**
 * POST /api/portfolio-config/backfill-gcid
 *
 * Fetches the GCID from eToro for all portfolios that have credentials
 * but are missing a GCID value. Updates portfolio-config.json in place.
 */
export async function POST() {
  try {
    const config = readPortfolioConfig();
    const needsGcid = config.portfolios.filter(
      (p) => p.credentials && !p.credentials.gcid,
    );

    if (needsGcid.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All portfolios already have GCIDs',
        updated: 0,
      });
    }

    const updated: string[] = [];
    const errors: string[] = [];

    for (const entry of needsGcid) {
      try {
        const url = new URL(
          `${ETORO_API_BASE_URL}${API_ENDPOINTS.USER_INFO}`,
        );
        url.searchParams.append('usernames', entry.username);

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: getBaseHeaders(),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          errors.push(`${entry.username}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        const user = data?.users?.[0];

        if (!user?.gcid) {
          errors.push(`${entry.username}: no GCID in response`);
          continue;
        }

        const gcid = String(user.gcid);
        updateCredentials(entry.username, {
          ...entry.credentials!,
          gcid,
        });
        updated.push(entry.username);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${entry.username}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      updated: updated.length,
      updatedPortfolios: updated,
      errors,
    });
  } catch (error) {
    console.error('Backfill GCID error:', error);
    return NextResponse.json(
      { error: 'Failed to backfill GCIDs' },
      { status: 500 },
    );
  }
}
