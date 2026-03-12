/**
 * API Route: Post history
 * GET /api/posts/history — search & paginate history
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchHistory,
  getAllPortfolioNames,
} from '@/lib/services/post-history-service';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = parseInt(params.get('page') || '1');
    const pageSize = parseInt(params.get('pageSize') || '20');
    const portfolio = params.get('portfolio') || undefined;
    const fromDate = params.get('fromDate') || undefined;
    const toDate = params.get('toDate') || undefined;
    const includeDeleted = params.get('includeDeleted') === 'true';

    const result = searchHistory(
      { portfolio, fromDate, toDate, includeDeleted },
      page,
      pageSize,
    );

    const portfolioNames = getAllPortfolioNames();

    return NextResponse.json({ ...result, portfolioNames });
  } catch (error) {
    console.error('Error fetching post history:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch post history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
