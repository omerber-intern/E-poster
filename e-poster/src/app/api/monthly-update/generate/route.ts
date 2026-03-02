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
    const currentMonth = now.getMonth();
    const month = currentMonth === 0 ? 11 : currentMonth - 1;
    const year = currentMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
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

          // Find the gain entry that matches the report month (previous month)
          let monthlyEntry = gainData.monthly.find((entry) => {
            const d = new Date(entry.timestamp);
            return d.getUTCMonth() === month && d.getUTCFullYear() === year;
          });

          if (!monthlyEntry) {
            // Fallback: use the second-to-last entry (skip the current partial month)
            const sorted = [...gainData.monthly].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            );
            monthlyEntry = sorted.length >= 2 ? sorted[1] : sorted[0];
          }

          if (!monthlyEntry) {
            throw new Error(
              `No gain data for the report month for ${username}. Please refresh portfolio data.`,
            );
          }

          // For YTD, find the latest yearly entry up to the report month
          const yearlyEntry =
            !isJanuary && gainData.yearly.length > 0
              ? gainData.yearly
                  .filter((e) => new Date(e.timestamp) <= new Date(year, month + 1, 0))
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null
              : null;

          const revenueData = {
            monthlyGain: monthlyEntry.gain,
            ytdGain: yearlyEntry?.gain,
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
            monthlyGain: monthlyEntry.gain,
            ytdGain: yearlyEntry?.gain ?? null,
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
