import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeNewsTopicImpact,
  analyzeHoldingImpact,
  generatePostContent,
  type NewsEvaluationResult,
  type PostLength,
} from '@/lib/services/ai-service';
import {
  getPortfoliosFromCache,
  getPortfolioByUsername,
  getBioByUsername,
} from '@/lib/services/portfolio-service';
import { getNewsSchedules, markScheduleRun } from '@/lib/services/schedule-service';
import { getApplicableDisclaimers } from '@/lib/services/disclaimer-service';
import { createPendingPost } from '@/lib/services/pending-post-service';
import { addToHistory } from '@/lib/services/post-history-service';
import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getPostHeaders,
  getPortfolioCredentials,
} from '@/lib/etoro-api-config';
import type { Schedule, LengthRange } from '@/lib/models/schedule';

interface AutoProcessResult {
  portfolioUsername: string;
  relevancePercent: number;
  postLength: string;
  flowType: string;
  scheduleName: string;
  action: 'posted' | 'pending_approval' | 'failed';
  postId?: string;
  pendingPostId?: string;
  error?: string;
}

function mapRelevanceToLength(
  relevance: number,
  mapping: LengthRange[],
): PostLength {
  const sorted = [...mapping].sort((a, b) => b.min - a.min);
  for (const range of sorted) {
    if (relevance >= range.min) return range.label;
  }
  return 'short';
}

async function publishToEtoro(
  portfolioUsername: string,
  message: string,
): Promise<{ postId: string }> {
  const creds = getPortfolioCredentials(portfolioUsername);
  if (!creds) throw new Error(`No API credentials for ${portfolioUsername}`);

  const headers = getPostHeaders(portfolioUsername);
  if (!headers) throw new Error(`Could not build headers for ${portfolioUsername}`);

  const url = `${ETORO_API_BASE_URL}${API_ENDPOINTS.FEEDS_POST}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ owner: parseInt(creds.gcid, 10), message }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eToro API error ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  return { postId: data.id };
}

async function appendDisclaimers(
  portfolioUsername: string,
  content: string,
): Promise<string> {
  const portfolio = getPortfolioByUsername(portfolioUsername);
  if (!portfolio) return content;

  try {
    const detected = await getApplicableDisclaimers(portfolio.holdings, content);
    if (detected.length === 0) return content;
    return `${content}\n\n${detected.map((d) => d.rule.text).join('\n')}`;
  } catch (error) {
    console.error(`[auto-process] Disclaimer detection failed for ${portfolioUsername}:`, error);
    return content;
  }
}

/**
 * POST /api/news/auto-process
 *
 * Body: { headline, body, url? }
 *
 * Full pipeline:
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

    const { portfolios } = getPortfoliosFromCache();
    if (portfolios.length === 0) {
      return NextResponse.json(
        { error: 'No portfolio data cached. Run /api/sync first.' },
        { status: 400 },
      );
    }

    // Build a map of portfolio username -> schedule for quick lookup
    const scheduleByPortfolio = new Map<string, Schedule>();
    for (const sched of newsSchedules) {
      scheduleByPortfolio.set(sched.portfolioUsername.toLowerCase(), sched);
    }

    const targetPortfolios = portfolios.filter((p) =>
      scheduleByPortfolio.has(p.username.toLowerCase()),
    );

    if (targetPortfolios.length === 0) {
      return NextResponse.json({
        results: [],
        message: 'No cached portfolio data matches the news schedules.',
        totalEvaluated: 0,
        processedAt: new Date().toISOString(),
      });
    }

    const news = { headline, body, url };

    // Phase 1: Topic-level impact (parallel)
    const phase1Results = await Promise.allSettled(
      targetPortfolios.map((p) => analyzeNewsTopicImpact(news, p)),
    );

    const evalErrors: string[] = [];
    const phase1Successes = phase1Results
      .map((r, idx) => {
        if (r.status === 'fulfilled') return r.value;
        evalErrors.push(`${targetPortfolios[idx].username} (Phase 1): ${r.reason}`);
        return null;
      })
      .filter((r) => r !== null);

    const MIN_EVAL_THRESHOLD = 5;
    const relevantPhase1 = phase1Successes.filter(
      (r) => r.relevancePercent >= MIN_EVAL_THRESHOLD,
    );

    // Phase 2: Holding-level impact for relevant portfolios (parallel)
    const portfolioMap = new Map(targetPortfolios.map((p) => [p.username, p]));
    const phase2Results = await Promise.allSettled(
      relevantPhase1.map((p1) => {
        const portfolio = portfolioMap.get(p1.portfolioUsername)!;
        return analyzeHoldingImpact(news, portfolio, p1);
      }),
    );

    const evaluationResults: NewsEvaluationResult[] = [];
    phase2Results.forEach((r, idx) => {
      const p1 = relevantPhase1[idx];
      evaluationResults.push({
        portfolioUsername: p1.portfolioUsername,
        relevancePercent: p1.relevancePercent,
        topicImpacts: p1.topicImpacts,
        affectedHoldings: r.status === 'fulfilled' ? r.value.affectedHoldings : [],
      });
      if (r.status === 'rejected') {
        evalErrors.push(`${p1.portfolioUsername} (Phase 2): ${r.reason}`);
      }
    });

    // Apply each schedule's newsConfig threshold and length mapping
    interface QualifiedMatch {
      schedule: Schedule;
      relevancePercent: number;
      postLength: PostLength;
    }

    const qualified: QualifiedMatch[] = [];
    for (const evalResult of evaluationResults) {
      const sched = scheduleByPortfolio.get(evalResult.portfolioUsername.toLowerCase());
      if (!sched?.newsConfig) continue;

      if (evalResult.relevancePercent < sched.newsConfig.minimumRelevancePercent) continue;

      qualified.push({
        schedule: sched,
        relevancePercent: evalResult.relevancePercent,
        postLength: mapRelevanceToLength(
          evalResult.relevancePercent,
          sched.newsConfig.lengthMapping,
        ),
      });
    }

    if (qualified.length === 0) {
      return NextResponse.json({
        results: [],
        message: 'No portfolios met the relevance threshold of any active news schedule.',
        totalEvaluated: evaluationResults.length,
        evaluationErrors: evalErrors.length > 0 ? evalErrors : undefined,
        processedAt: new Date().toISOString(),
      });
    }

    // Build evaluation lookup
    const evalMap = new Map(
      evaluationResults.map((r) => [r.portfolioUsername.toLowerCase(), r]),
    );

    // Generate, disclaim, and post/pending for each qualifying portfolio
    const results: AutoProcessResult[] = [];

    for (const match of qualified) {
      const { schedule } = match;
      const result: AutoProcessResult = {
        portfolioUsername: schedule.portfolioUsername,
        relevancePercent: match.relevancePercent,
        postLength: match.postLength,
        flowType: schedule.flowType,
        scheduleName: schedule.name,
        action: 'failed',
      };

      try {
        const portfolio = getPortfolioByUsername(schedule.portfolioUsername);
        const bio = getBioByUsername(schedule.portfolioUsername);
        const impact = evalMap.get(schedule.portfolioUsername.toLowerCase());

        if (!portfolio || !impact) {
          result.error = 'Portfolio or evaluation data not found';
          results.push(result);
          continue;
        }

        const generated = await generatePostContent(
          news,
          portfolio,
          bio,
          impact,
          undefined,
          match.postLength,
        );

        const content = await appendDisclaimers(schedule.portfolioUsername, generated.content);

        if (schedule.flowType === 'automatic') {
          try {
            const { postId } = await publishToEtoro(schedule.portfolioUsername, content);
            addToHistory({
              portfolioUsername: schedule.portfolioUsername,
              postType: 'news',
              content,
              etoroPostId: postId,
            });
            result.action = 'posted';
            result.postId = postId;
          } catch (postError) {
            result.error = postError instanceof Error ? postError.message : String(postError);
          }
        } else {
          const pending = createPendingPost({
            scheduleId: schedule.id,
            scheduleName: `[News] ${schedule.name}`,
            portfolioUsername: schedule.portfolioUsername,
            portfolioName: schedule.portfolioName,
            postType: 'news',
            content,
          });
          result.action = 'pending_approval';
          result.pendingPostId = pending.id;
        }

        markScheduleRun(schedule.id);
      } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
      }

      results.push(result);
    }

    return NextResponse.json({
      results,
      totalEvaluated: evaluationResults.length,
      totalQualified: qualified.length,
      posted: results.filter((r) => r.action === 'posted').length,
      pendingApproval: results.filter((r) => r.action === 'pending_approval').length,
      failed: results.filter((r) => r.action === 'failed').length,
      evaluationErrors: evalErrors.length > 0 ? evalErrors : undefined,
      processedAt: new Date().toISOString(),
    });
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
