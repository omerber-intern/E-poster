import { NextRequest, NextResponse } from 'next/server';
import { analyzeNewsImpact, type NewsImpactResult } from '@/lib/services/ai-service';
import {
  getPortfoliosFromCache,
  getBioByUsername,
  getPortfoliosWithCredentials,
} from '@/lib/services/portfolio-service';

/**
 * POST /api/news/evaluate
 *
 * Body: { headline, body, url? }
 *
 * Runs Claude impact analysis against every cached portfolio
 * and returns per-portfolio impact results sorted by absolute impact.
 */
export async function POST(request: NextRequest) {
  try {
    const { headline, body, url } = await request.json();

    if (!headline || !body) {
      return NextResponse.json(
        { error: 'headline and body are required' },
        { status: 400 },
      );
    }

    const { portfolios } = getPortfoliosFromCache();
    if (portfolios.length === 0) {
      return NextResponse.json(
        { error: 'No portfolio data cached. Run /api/sync first.' },
        { status: 400 },
      );
    }

    const withCredentials = getPortfoliosWithCredentials();

    const results: NewsImpactResult[] = [];
    const errors: string[] = [];

    // Run impact analysis for each portfolio (in parallel, batches of 5)
    const batchSize = 5;
    for (let i = 0; i < portfolios.length; i += batchSize) {
      const batch = portfolios.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (portfolio) => {
          const bio = getBioByUsername(portfolio.username);
          return analyzeNewsImpact({ headline, body, url }, portfolio, bio);
        }),
      );

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push(`${batch[idx].username}: ${result.reason}`);
        }
      });
    }

    const MIN_RELEVANCE_THRESHOLD = 5;

    const filtered = results.filter(
      (r) => r.relevancePercent >= MIN_RELEVANCE_THRESHOLD,
    );

    filtered.sort((a, b) => b.relevancePercent - a.relevancePercent);

    return NextResponse.json({
      results: filtered,
      portfoliosWithCredentials: withCredentials,
      totalPortfolios: portfolios.length,
      filteredCount: results.length - filtered.length,
      evaluatedAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Evaluate error:', error);
    return NextResponse.json(
      {
        error: 'Evaluation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
