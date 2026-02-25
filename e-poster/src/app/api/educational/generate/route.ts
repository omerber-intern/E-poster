import { NextRequest, NextResponse } from 'next/server';
import { generateEducationalContent } from '@/lib/services/ai-service';
import {
  getPortfolioByUsername,
  getBioByUsername,
} from '@/lib/services/portfolio-service';

/**
 * POST /api/educational/generate
 *
 * Body: { portfolioUsernames: string[], additionalContext?: string }
 *
 * Generates educational content for each requested portfolio.
 */
export async function POST(request: NextRequest) {
  try {
    const { portfolioUsernames, additionalContext } = (await request.json()) as {
      portfolioUsernames: string[];
      additionalContext?: string;
    };

    if (!portfolioUsernames || portfolioUsernames.length === 0) {
      return NextResponse.json(
        { error: 'portfolioUsernames is required' },
        { status: 400 },
      );
    }

    const results: Array<{
      portfolioUsername: string;
      content: string;
      topTickers: string[];
    }> = [];
    const errors: string[] = [];

    // Process in batches of 3 to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < portfolioUsernames.length; i += batchSize) {
      const batch = portfolioUsernames.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (username) => {
          const portfolio = getPortfolioByUsername(username);
          if (!portfolio) throw new Error(`Portfolio ${username} not found`);
          const bio = getBioByUsername(username);
          const result = await generateEducationalContent(
            portfolio,
            bio,
            additionalContext,
          );
          return { portfolioUsername: username, ...result };
        }),
      );

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push(`${batch[idx]}: ${result.reason}`);
        }
      });
    }

    return NextResponse.json({
      results,
      generatedAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Educational generate error:', error);
    return NextResponse.json(
      {
        error: 'Educational content generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
