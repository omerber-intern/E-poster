import { schedule as cronSchedule, type ScheduledTask } from 'node-cron';
import {
  getDueSchedules,
  markScheduleRun,
  updateSchedule,
} from './schedule-service';
import { createPendingPost, updatePendingPost } from './pending-post-service';
import { addToHistory } from './post-history-service';
import {
  getPortfolioByUsername,
  getBioByUsername,
} from './portfolio-service';
import {
  generateEducationalContent,
  generateMonthlyUpdateContent,
  generatePerformanceHighlightContent,
  type PostLength,
  type MonthlyUpdateTemplateStyle,
} from './ai-service';
import {
  getPostHeaders,
  getPortfolioCredentials,
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
} from '../etoro-api-config';
import { getApplicableDisclaimers } from './disclaimer-service';
import { fetchLatestArticles } from './news-scraper-service';
import { runNewsPipeline } from './news-pipeline-service';
import type { Schedule } from '../models/schedule';

let schedulerTask: ScheduledTask | null = null;
let isRunning = false;

async function generateContent(
  schedule: Schedule,
): Promise<string> {
  const portfolio = getPortfolioByUsername(schedule.portfolioUsername);
  if (!portfolio) {
    throw new Error(`Portfolio ${schedule.portfolioUsername} not found`);
  }
  const bio = getBioByUsername(schedule.portfolioUsername);
  const postLength = (schedule.generationConfig.postLength ?? 'medium') as PostLength;

  switch (schedule.postType) {
    case 'educational': {
      const result = await generateEducationalContent(
        portfolio,
        bio,
        schedule.generationConfig.additionalContext,
        postLength,
      );
      return result.content;
    }
    case 'monthly-update': {
      const now = new Date();
      const currentMonth = now.getMonth();
      const month = currentMonth === 0 ? 11 : currentMonth - 1;
      const year = currentMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const isJanuary = month === 0;

      const gainData = portfolio.gainData;
      if (!gainData || gainData.monthly.length === 0) {
        throw new Error(`No gain data for ${schedule.portfolioUsername}`);
      }

      let monthlyEntry = gainData.monthly.find((e) => {
        const d = new Date(e.timestamp);
        return d.getUTCMonth() === month && d.getUTCFullYear() === year;
      });
      if (!monthlyEntry) {
        const sorted = [...gainData.monthly].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        monthlyEntry = sorted.length >= 2 ? sorted[1] : sorted[0];
      }
      if (!monthlyEntry) {
        throw new Error(`No gain data for the report month for ${schedule.portfolioUsername}`);
      }

      const yearlyEntry =
        !isJanuary && gainData.yearly.length > 0
          ? gainData.yearly
              .filter((e) => new Date(e.timestamp) <= new Date(year, month + 1, 0))
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null
          : null;

      const templateStyle = (schedule.generationConfig.templateStyle ?? 'stats-bottom') as MonthlyUpdateTemplateStyle;
      const result = await generateMonthlyUpdateContent(
        portfolio,
        bio,
        { monthlyGain: monthlyEntry.gain, ytdGain: yearlyEntry?.gain },
        templateStyle,
        month,
        year,
        postLength,
      );
      return result.content;
    }
    case 'performance-highlight': {
      const now = new Date();
      const currentMonth = now.getMonth();
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevMonthYear = currentMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const isJanuary = currentMonth === 0;
      const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];

      const gainData = portfolio.gainData;
      if (!gainData || gainData.monthly.length === 0) {
        throw new Error(`No gain data for ${schedule.portfolioUsername}`);
      }

      const prevMonthEntry = gainData.monthly.find((e) => {
        const d = new Date(e.timestamp);
        return d.getUTCMonth() === prevMonth && d.getUTCFullYear() === prevMonthYear;
      });
      const currentMonthEntry = gainData.monthly.find((e) => {
        const d = new Date(e.timestamp);
        return d.getUTCMonth() === currentMonth && d.getUTCFullYear() === now.getFullYear();
      });

      let chosenEntry = prevMonthEntry ?? currentMonthEntry;
      let chosenMonthName = MONTH_NAMES[prevMonth];
      if (prevMonthEntry && currentMonthEntry && currentMonthEntry.gain > prevMonthEntry.gain) {
        chosenEntry = currentMonthEntry;
        chosenMonthName = MONTH_NAMES[currentMonth];
      } else if (!prevMonthEntry && currentMonthEntry) {
        chosenEntry = currentMonthEntry;
        chosenMonthName = MONTH_NAMES[currentMonth];
      }
      if (!chosenEntry) {
        chosenEntry = gainData.monthly.reduce((latest, entry) =>
          new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest,
        );
        chosenMonthName = MONTH_NAMES[new Date(chosenEntry.timestamp).getUTCMonth()];
      }

      const latestYearly =
        !isJanuary && gainData.yearly.length > 0
          ? gainData.yearly.reduce((latest, entry) =>
              new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest,
            )
          : null;

      const result = await generatePerformanceHighlightContent(
        portfolio,
        bio,
        { monthlyGain: chosenEntry.gain, ytdGain: latestYearly?.gain, gainMonthName: chosenMonthName },
        postLength,
      );
      return result.content;
    }
    default:
      throw new Error(`Unsupported post type for scheduling: ${schedule.postType}`);
  }
}

async function publishToEtoro(
  portfolioUsername: string,
  message: string,
): Promise<{ postId: string; postedAt: string }> {
  const creds = getPortfolioCredentials(portfolioUsername);
  if (!creds) throw new Error(`No API credentials for ${portfolioUsername}`);

  const headers = getPostHeaders(portfolioUsername);
  if (!headers) throw new Error(`Could not build headers for ${portfolioUsername}`);

  const payload = {
    owner: parseInt(creds.gcid, 10),
    message,
  };

  const url = `${ETORO_API_BASE_URL}${API_ENDPOINTS.FEEDS_POST}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eToro API error ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  return { postId: data.id, postedAt: new Date().toISOString() };
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

    const disclaimerTexts = detected.map((d) => d.rule.text);
    return `${content}\n\n${disclaimerTexts.join('\n')}`;
  } catch (error) {
    console.error(`[scheduler] Disclaimer detection failed for ${portfolioUsername}:`, error);
    return content;
  }
}

async function executeNewsSchedule(schedule: Schedule): Promise<void> {
  console.log(`[scheduler] Executing news schedule "${schedule.name}" for ${schedule.portfolioUsername}`);

  const scraping = schedule.newsConfig?.scraping;
  if (!scraping?.feedUrl) {
    const errMsg = 'No RSS feed URL configured';
    console.warn(`[scheduler] News schedule "${schedule.name}": ${errMsg}`);
    updateSchedule(schedule.id, { lastRunError: errMsg });
    markScheduleRun(schedule.id);
    return;
  }

  const maxArticles = scraping.maxArticles ?? 5;

  let articles;
  try {
    articles = await fetchLatestArticles(scraping.feedUrl, maxArticles);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const errMsg = `Failed to fetch RSS feed: ${msg}`;
    console.error(`[scheduler] ${errMsg} for "${schedule.name}"`);
    updateSchedule(schedule.id, { lastRunError: errMsg });
    markScheduleRun(schedule.id);
    return;
  }

  if (articles.length === 0) {
    const errMsg = 'No articles found in the RSS feed';
    console.log(`[scheduler] ${errMsg} for "${schedule.name}"`);
    updateSchedule(schedule.id, { lastRunError: errMsg });
    markScheduleRun(schedule.id);
    return;
  }

  console.log(`[scheduler] Processing ${articles.length} article(s) for "${schedule.name}"`);

  const pipelineErrors: string[] = [];
  for (const article of articles) {
    if (!article.body) {
      console.log(`[scheduler] Skipping article with no body: "${article.headline}"`);
      continue;
    }

    try {
      const output = await runNewsPipeline(article, [schedule]);
      console.log(
        `[scheduler] Article "${article.headline}": posted=${output.posted}, pending=${output.pendingApproval}, failed=${output.failed}`,
      );
      if (output.failed > 0) {
        const failedResults = output.results.filter((r) => r.action === 'failed');
        for (const r of failedResults) {
          pipelineErrors.push(`"${article.headline}": ${r.error || 'unknown error'}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler] Pipeline error for article "${article.headline}": ${msg}`);
      pipelineErrors.push(`"${article.headline}": ${msg}`);
    }
  }

  if (pipelineErrors.length > 0) {
    updateSchedule(schedule.id, { lastRunError: pipelineErrors.join('; ') });
  } else {
    updateSchedule(schedule.id, { lastRunError: undefined });
  }

  markScheduleRun(schedule.id);
}

async function executeSchedule(schedule: Schedule): Promise<void> {
  if (schedule.postType === 'news') {
    return executeNewsSchedule(schedule);
  }

  console.log(`[scheduler] Executing schedule "${schedule.name}" for ${schedule.portfolioUsername}`);

  // For approval flow: create a generating placeholder so the UI can show progress
  const placeholder =
    schedule.flowType === 'approval'
      ? createPendingPost({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          portfolioUsername: schedule.portfolioUsername,
          portfolioName: schedule.portfolioName,
          postType: schedule.postType,
          content: '',
          status: 'generating',
        })
      : null;

  try {
    const rawContent = await generateContent(schedule);
    const content = await appendDisclaimers(schedule.portfolioUsername, rawContent);

    if (schedule.flowType === 'automatic') {
      const { postId } = await publishToEtoro(schedule.portfolioUsername, content);
      addToHistory({
        portfolioUsername: schedule.portfolioUsername,
        portfolioName: schedule.portfolioName,
        postType: schedule.postType,
        content,
        etoroPostId: postId,
      });
      console.log(`[scheduler] Auto-posted for ${schedule.portfolioUsername}: ${postId}`);
    } else if (placeholder) {
      updatePendingPost(placeholder.id, { status: 'pending_approval', content });
      console.log(`[scheduler] Created pending post for approval: ${schedule.portfolioUsername}`);
    }

    updateSchedule(schedule.id, { lastRunError: undefined });
    markScheduleRun(schedule.id);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[scheduler] Failed to execute schedule "${schedule.name}":`, msg);
    if (placeholder) {
      updatePendingPost(placeholder.id, { status: 'failed', error: msg });
    }
    updateSchedule(schedule.id, { lastRunError: msg });
    markScheduleRun(schedule.id);
  }
}

export async function runDueSchedules(): Promise<{
  executed: number;
  errors: string[];
}> {
  if (isRunning) {
    return { executed: 0, errors: ['Scheduler is already running'] };
  }

  isRunning = true;
  const errors: string[] = [];
  let executed = 0;

  try {
    const dueSchedules = getDueSchedules();
    console.log(`[scheduler] Found ${dueSchedules.length} due schedule(s)`);

    for (const schedule of dueSchedules) {
      try {
        await executeSchedule(schedule);
        executed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${schedule.name}: ${msg}`);
      }
    }
  } finally {
    isRunning = false;
  }

  return { executed, errors };
}

export function startScheduler(): void {
  if (schedulerTask) {
    console.log('[scheduler] Already running, skipping start');
    return;
  }

  schedulerTask = cronSchedule('* * * * *', async () => {
    await runDueSchedules();
  });

  console.log('[scheduler] Started — checking for due schedules every minute');
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('[scheduler] Stopped');
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerTask !== null;
}
