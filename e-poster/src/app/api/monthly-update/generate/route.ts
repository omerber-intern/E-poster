import { NextRequest, NextResponse } from 'next/server';
import {
  generateMonthlyUpdateContent,
  type MonthlyUpdateTemplateStyle,
  type PostLength,
} from '@/lib/services/ai-service';
import {
  getPortfolioByUsername,
  getBioByUsername,
} from '@/lib/services/portfolio-service';

/**
 * POST /api/monthly-update/generate
 *
 * Body: { portfolioUsernames: string[], templateStyle: 'stats-bottom' | 'revenue-opening', postLength?: PostLength }
 *
 * Generates monthly update posts for each requested portfolio using
 * cached gain data (synced from eToro /gain endpoint).
 */
export async function POST(request: NextRequest) {
  try {
    const { portfolioUsernames, templateStyle, postLength = 'medium' } = (await request.json()) as {
      portfolioUsernames: string[];
      templateStyle: MonthlyUpdateTemplateStyle;
      postLength?: PostLength;
    };

    const validLengths: PostLength[] = ['short', 'medium', 'long'];
    if (!validLengths.includes(postLength)) {
      return NextResponse.json(
        { error: 'postLength must be "short", "medium", or "long"' },
        { status: 400 },
      );
    }

    if (!portfolioUsernames || portfolioUsernames.length === 0) {
      return NextResponse.json(
        { error: 'portfolioUsernames is required' },
        { status: 400 },
      );
    }

    if (templateStyle !== 'stats-bottom' && templateStyle !== 'revenue-opening') {
      return NextResponse.json(
        { error: 'templateStyle must be "stats-bottom" or "revenue-opening"' },
        { status: 400 },
      );
    }

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const isJanuary = month === 0;

    const results: Array<{
      portfolioUsername: string;
      content: string;
      topTickers: string[];
      monthlyGain: number | null;
      ytdGain: number | null;
    }> = [];
    const errors: string[] = [];

    const batchSize = 3;
    for (let i = 0; i < portfolioUsernames.length; i += batchSize) {
      const batch = portfolioUsernames.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (username) => {
          const portfolio = getPortfolioByUsername(username);
          if (!portfolio) throw new Error(`Portfolio ${username} not found`);

          const bio = getBioByUsername(username);

          const gainData = portfolio.gainData;
          if (!gainData || gainData.monthly.length === 0) {
            throw new Error(
              `No gain data for ${username}. Please refresh portfolio data first.`,
            );
          }

          const latestMonthly = gainData.monthly.reduce((latest, entry) =>
            new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest,
          );

          const latestYearly =
            !isJanuary && gainData.yearly.length > 0
              ? gainData.yearly.reduce((latest, entry) =>
                  new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest,
                )
              : null;

          const revenueData = {
            monthlyGain: latestMonthly.gain,
            ytdGain: latestYearly?.gain,
          };

          const result = await generateMonthlyUpdateContent(
            portfolio,
            bio,
            revenueData,
            templateStyle,
            month,
            year,
            postLength,
          );

          return {
            portfolioUsername: username,
            content: result.content,
            topTickers: result.topTickers,
            monthlyGain: latestMonthly.gain,
            ytdGain: latestYearly?.gain ?? null,
          };
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
      month,
      year,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Monthly update generate error:', error);
    return NextResponse.json(
      {
        error: 'Monthly update generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
