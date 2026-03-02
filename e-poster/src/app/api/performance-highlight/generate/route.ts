import { NextRequest, NextResponse } from 'next/server';
import {
  generatePerformanceHighlightContent,
  type PerformanceHighlightLength,
} from '@/lib/services/ai-service';
import {
  getPortfolioByUsername,
  getBioByUsername,
} from '@/lib/services/portfolio-service';

/**
 * POST /api/performance-highlight/generate
 *
 * Body: { portfolioUsernames: string[], postLength: 'short' | 'medium' | 'long' }
 *
 * Generates performance highlight posts for each requested portfolio using
 * cached gain data (synced from eToro /gain endpoint).
 */
export async function POST(request: NextRequest) {
  try {
    const { portfolioUsernames, postLength } = (await request.json()) as {
      portfolioUsernames: string[];
      postLength: PerformanceHighlightLength;
    };

    if (!portfolioUsernames || portfolioUsernames.length === 0) {
      return NextResponse.json(
        { error: 'portfolioUsernames is required' },
        { status: 400 },
      );
    }

    const validLengths: PerformanceHighlightLength[] = ['short', 'medium', 'long'];
    if (!validLengths.includes(postLength)) {
      return NextResponse.json(
        { error: 'postLength must be "short", "medium", or "long"' },
        { status: 400 },
      );
    }

    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const now = new Date();
    const currentMonth = now.getMonth();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const isJanuary = currentMonth === 0;

    const results: Array<{
      portfolioUsername: string;
      content: string;
      topTickers: string[];
      monthlyGain: number | null;
      ytdGain: number | null;
      gainMonthName: string;
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

          // Get both previous month and current month gains
          const prevMonthEntry = gainData.monthly.find((e) => {
            const d = new Date(e.timestamp);
            return d.getUTCMonth() === prevMonth && d.getUTCFullYear() === prevMonthYear;
          });

          const currentMonthEntry = gainData.monthly.find((e) => {
            const d = new Date(e.timestamp);
            return d.getUTCMonth() === currentMonth && d.getUTCFullYear() === now.getFullYear();
          });

          // Pick the more impressive month (higher gain)
          let chosenEntry = prevMonthEntry ?? currentMonthEntry;
          let chosenMonthName = MONTH_NAMES[prevMonth];

          if (prevMonthEntry && currentMonthEntry) {
            if (currentMonthEntry.gain > prevMonthEntry.gain) {
              chosenEntry = currentMonthEntry;
              chosenMonthName = MONTH_NAMES[currentMonth];
            }
          } else if (!prevMonthEntry && currentMonthEntry) {
            chosenEntry = currentMonthEntry;
            chosenMonthName = MONTH_NAMES[currentMonth];
          }

          if (!chosenEntry) {
            // Fallback: use the latest entry
            chosenEntry = gainData.monthly.reduce((latest, entry) =>
              new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest,
            );
            const d = new Date(chosenEntry.timestamp);
            chosenMonthName = MONTH_NAMES[d.getUTCMonth()];
          }

          const latestYearly =
            !isJanuary && gainData.yearly.length > 0
              ? gainData.yearly.reduce((latest, entry) =>
                  new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest,
                )
              : null;

          const revenueData = {
            monthlyGain: chosenEntry.gain,
            ytdGain: latestYearly?.gain,
            gainMonthName: chosenMonthName,
          };

          const result = await generatePerformanceHighlightContent(
            portfolio,
            bio,
            revenueData,
            postLength,
          );

          return {
            portfolioUsername: username,
            content: result.content,
            topTickers: result.topTickers,
            monthlyGain: chosenEntry.gain,
            ytdGain: latestYearly?.gain ?? null,
            gainMonthName: chosenMonthName,
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
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Performance highlight generate error:', error);
    return NextResponse.json(
      {
        error: 'Performance highlight generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
