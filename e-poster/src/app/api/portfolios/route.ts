import { NextRequest, NextResponse } from 'next/server';
import { getSmartPortfolios, getPortfoliosWithCredentials } from '@/lib/services/portfolio-service';
import { getAlphaPortfolios } from '@/lib/config/portfolios';

/**
 * GET /api/portfolios
 *
 * Returns cached portfolio data. Optionally filter with ?usernames=A,B,C
 * Also returns which portfolios have posting credentials.
 */
export async function GET(request: NextRequest) {
  try {
    const usernamesParam = request.nextUrl.searchParams.get('usernames');
    const usernames = usernamesParam
      ? usernamesParam.split(',').map((u) => u.trim())
      : undefined;

    const portfolios = await getSmartPortfolios(usernames);
    const withCredentials = await getPortfoliosWithCredentials();

    return NextResponse.json({
      portfolios,
      total: portfolios.length,
      allUsernames: getAlphaPortfolios(),
      portfoliosWithCredentials: withCredentials,
    });
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch portfolios',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
