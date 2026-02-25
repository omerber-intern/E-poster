import { NextRequest, NextResponse } from 'next/server';
import {
  syncPortfolioData,
  syncBioData,
  getPortfoliosFromCache,
} from '@/lib/services/portfolio-service';

/**
 * GET /api/sync
 *
 * Returns the last sync timestamp from cached portfolio data.
 */
export async function GET() {
  const { syncedAt } = getPortfoliosFromCache();
  return NextResponse.json({ syncedAt: syncedAt || null });
}

/**
 * POST /api/sync
 *
 * Query params:
 *   ?type=portfolios  (default) — sync portfolio holdings
 *   ?type=bios        — sync bios (only missing; add &force=true for all)
 *   ?type=all         — sync both
 */
export async function POST(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type') || 'all';
    const force = request.nextUrl.searchParams.get('force') === 'true';

    const result: Record<string, unknown> = {};

    if (type === 'portfolios' || type === 'all') {
      const portfolioResult = await syncPortfolioData();
      result.portfolios = portfolioResult;
    }

    if (type === 'bios' || type === 'all') {
      const bioResult = await syncBioData(force);
      result.bios = bioResult;
    }

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
