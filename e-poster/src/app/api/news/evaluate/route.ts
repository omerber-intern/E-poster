import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeNewsTopicImpact,
  analyzeHoldingImpact,
  type NewsEvaluationResult,
} from '@/lib/services/ai-service';
import {
  getPortfoliosFromCache,
  getPortfoliosWithCredentials,
} from '@/lib/services/portfolio-service';

/**
 * POST /api/news/evaluate
 *
 * Body: { headline, body, url? }
 *
 * Two-phase evaluation:
 *   Phase 1 — Haiku scores every topic in every portfolio (parallel batches).
 *              All portfolios run in parallel.
 *   Phase 2 — For portfolios above the relevance threshold, Haiku evaluates
 *              the ~10 most-exposed individual holdings.
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
    const news = { headline, body, url };

    // -----------------------------------------------------------------------
    // Phase 1: Topic-level impact for all portfolios in parallel
    // -----------------------------------------------------------------------
    const phase1Results = await Promise.allSettled(
      portfolios.map((portfolio) => analyzeNewsTopicImpact(news, portfolio)),
    );

    const MIN_RELEVANCE_THRESHOLD = 5;
    const errors: string[] = [];

    const phase1Successes = phase1Results
      .map((r, idx) => {
        if (r.status === 'fulfilled') return r.value;
        errors.push(`${portfolios[idx].username} (Phase 1): ${r.reason}`);
        return null;
      })
      .filter((r) => r !== null);

    const relevantPhase1 = phase1Successes.filter(
      (r) => r.relevancePercent >= MIN_RELEVANCE_THRESHOLD,
    );

    // -----------------------------------------------------------------------
    // Phase 2: Holding-level tagging for relevant portfolios (in parallel)
    // -----------------------------------------------------------------------
    const portfolioMap = new Map(portfolios.map((p) => [p.username, p]));

    const phase2Results = await Promise.allSettled(
      relevantPhase1.map((p1) => {
        const portfolio = portfolioMap.get(p1.portfolioUsername)!;
        return analyzeHoldingImpact(news, portfolio, p1);
      }),
    );

    const results: NewsEvaluationResult[] = [];

    phase2Results.forEach((r, idx) => {
      const p1 = relevantPhase1[idx];
      if (r.status === 'fulfilled') {
        results.push({
          portfolioUsername: p1.portfolioUsername,
          relevancePercent: p1.relevancePercent,
          topicImpacts: p1.topicImpacts,
          affectedHoldings: r.value.affectedHoldings,
        });
      } else {
        errors.push(`${p1.portfolioUsername} (Phase 2): ${r.reason}`);
        // Still include Phase 1 data with empty holdings
        results.push({
          portfolioUsername: p1.portfolioUsername,
          relevancePercent: p1.relevancePercent,
          topicImpacts: p1.topicImpacts,
          affectedHoldings: [],
        });
      }
    });

    results.sort((a, b) => b.relevancePercent - a.relevancePercent);

    return NextResponse.json({
      results,
      portfoliosWithCredentials: withCredentials,
      totalPortfolios: portfolios.length,
      filteredCount: phase1Successes.length - relevantPhase1.length,
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
