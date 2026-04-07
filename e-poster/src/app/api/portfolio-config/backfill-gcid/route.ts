import { NextResponse } from 'next/server';
import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getBaseHeaders,
} from '@/lib/etoro-api-config';
import {
  getPortfolioUsernames,
  getCredentials,
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
    const usernames = getPortfolioUsernames();
    const needsGcid: { username: string; creds: import('@/lib/models/portfolio').PortfolioCredentials }[] = [];

    for (const username of usernames) {
      const creds = await getCredentials(username);
      if (creds && !creds.gcid) {
        needsGcid.push({ username, creds });
      }
    }

    if (needsGcid.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All portfolios already have GCIDs',
        updated: 0,
      });
    }

    const updated: string[] = [];
    const errors: string[] = [];

    for (const { username, creds } of needsGcid) {
      try {
        const url = new URL(
          `${ETORO_API_BASE_URL}${API_ENDPOINTS.USER_INFO}`,
        );
        url.searchParams.append('usernames', username);

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: getBaseHeaders(),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          errors.push(`${username}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        const user = data?.users?.[0];

        if (!user?.gcid) {
          errors.push(`${username}: no GCID in response`);
          continue;
        }

        const gcid = String(user.gcid);
        await updateCredentials(username, { ...creds, gcid });
        updated.push(username);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${username}: ${msg}`);
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
