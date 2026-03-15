import { NextRequest, NextResponse } from 'next/server';
import { getNewsSchedules, markScheduleRun } from '@/lib/services/schedule-service';
import { runNewsPipeline } from '@/lib/services/news-pipeline-service';

/**
 * POST /api/news/auto-process
 *
 * Body: { headline, body, url? }
 *
 * Full pipeline (delegated to news-pipeline-service):
 *   1. Find all active news schedules
 *   2. Evaluate news against their portfolios
 *   3. Filter by each schedule's newsConfig threshold
 *   4. Map relevance to post length via schedule's lengthMapping
 *   5. Generate, append disclaimers, post or create pending
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

    const newsSchedules = getNewsSchedules();
    if (newsSchedules.length === 0) {
      return NextResponse.json(
        { error: 'No active news schedules configured. Create a news schedule first.' },
        { status: 400 },
      );
    }

    const output = await runNewsPipeline({ headline, body, url }, newsSchedules);

    // Mark all schedules that had matching portfolios as run
    for (const result of output.results) {
      const sched = newsSchedules.find(
        (s) => s.portfolioUsername.toLowerCase() === result.portfolioUsername.toLowerCase(),
      );
      if (sched) markScheduleRun(sched.id);
    }

    if (output.totalEvaluated === 0) {
      return NextResponse.json({
        ...output,
        message: 'No cached portfolio data matches the news schedules.',
      });
    }

    if (output.totalQualified === 0) {
      return NextResponse.json({
        ...output,
        message: 'No portfolios met the relevance threshold of any active news schedule.',
      });
    }

    return NextResponse.json(output);
  } catch (error) {
    console.error('Auto-process error:', error);
    return NextResponse.json(
      {
        error: 'Auto-process failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
