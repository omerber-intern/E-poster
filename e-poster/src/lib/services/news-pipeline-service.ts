import {
  analyzeNewsTopicImpact,
  analyzeHoldingImpact,
  generatePostContent,
  type NewsEvaluationResult,
  type PostLength,
} from './ai-service';
import {
  getPortfoliosFromCache,
  getPortfolioByUsername,
  getBioByUsername,
} from './portfolio-service';
import { getApplicableDisclaimers } from './disclaimer-service';
import { createPendingPost } from './pending-post-service';
import type { Schedule, LengthRange } from '../models/schedule';

export interface NewsInput {
  headline: string;
  body: string;
  url?: string;
}

export interface NewsProcessResult {
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

export interface NewsPipelineOutput {
  results: NewsProcessResult[];
  totalEvaluated: number;
  totalQualified: number;
  posted: number;
  pendingApproval: number;
  failed: number;
  evaluationErrors?: string[];
  processedAt: string;
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
    console.error(`[news-pipeline] Disclaimer detection failed for ${portfolioUsername}:`, error);
    return content;
  }
}

/**
 * Runs the full news evaluation + generation + publish pipeline for a single news item
 * against a set of active news schedules.
 *
 * Used by both the manual auto-process API route and the scheduled cron engine.
 */
export async function runNewsPipeline(
  news: NewsInput,
  newsSchedules: Schedule[],
): Promise<NewsPipelineOutput> {
  const { portfolios } = getPortfoliosFromCache();

  const scheduleByPortfolio = new Map<string, Schedule>();
  for (const sched of newsSchedules) {
    scheduleByPortfolio.set(sched.portfolioUsername.toLowerCase(), sched);
  }

  const targetPortfolios = portfolios.filter((p) =>
    scheduleByPortfolio.has(p.username.toLowerCase()),
  );

  if (targetPortfolios.length === 0) {
    return {
      results: [],
      totalEvaluated: 0,
      totalQualified: 0,
      posted: 0,
      pendingApproval: 0,
      failed: 0,
      processedAt: new Date().toISOString(),
    };
  }

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
      postLength: mapRelevanceToLength(evalResult.relevancePercent, sched.newsConfig.lengthMapping),
    });
  }

  const evalMap = new Map(
    evaluationResults.map((r) => [r.portfolioUsername.toLowerCase(), r]),
  );

  const results: NewsProcessResult[] = [];

  for (const match of qualified) {
    const { schedule } = match;
    const result: NewsProcessResult = {
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
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }

    results.push(result);
  }

  return {
    results,
    totalEvaluated: evaluationResults.length,
    totalQualified: qualified.length,
    posted: results.filter((r) => r.action === 'posted').length,
    pendingApproval: results.filter((r) => r.action === 'pending_approval').length,
    failed: results.filter((r) => r.action === 'failed').length,
    evaluationErrors: evalErrors.length > 0 ? evalErrors : undefined,
    processedAt: new Date().toISOString(),
  };
}
