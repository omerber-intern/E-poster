import type { PostType } from './post';

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type ScheduleFlowType = 'automatic' | 'approval';
export type PendingPostStatus = 'generating' | 'pending_approval' | 'approved' | 'rejected' | 'posted' | 'failed';

export interface ScheduleGenerationConfig {
  postLength?: 'short' | 'medium' | 'long';
  additionalContext?: string;
  templateStyle?: string;
}

export interface LengthRange {
  label: 'short' | 'medium' | 'long';
  min: number;
  max: number;
}

export interface NewsScrapingConfig {
  feedUrl: string;
  maxArticles?: number; // default 5
}

export interface NewsScheduleConfig {
  minimumRelevancePercent: number;
  lengthMapping: LengthRange[];
  scraping?: NewsScrapingConfig;
}

export interface Schedule {
  id: string;
  name: string;
  portfolioUsername: string;
  portfolioName: string;
  postType: PostType;
  frequency?: ScheduleFrequency;
  flowType: ScheduleFlowType;

  dayOfWeek?: number;       // 0 (Sun) - 6 (Sat) for weekly
  dayOfMonth?: number;      // 1-31 for monthly
  timeOfDay?: string;       // "HH:mm" 24h format — undefined for news

  generationConfig: ScheduleGenerationConfig;
  newsConfig?: NewsScheduleConfig;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;       // undefined for news (event-triggered)
  lastRunError?: string;
}

export interface PendingPost {
  id: string;
  scheduleId: string;
  scheduleName: string;
  portfolioUsername: string;
  portfolioName: string;
  postType: PostType;
  content: string;
  status: PendingPostStatus;
  generatedAt: string;
  reviewedAt?: string;
  postedAt?: string;
  error?: string;
  imageUrl?: string;
}

export interface SchedulesData {
  schedules: Schedule[];
  updatedAt: string;
}

export interface PendingPostsData {
  posts: PendingPost[];
  updatedAt: string;
}

export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const FLOW_TYPE_LABELS: Record<ScheduleFlowType, string> = {
  automatic: 'Automatic',
  approval: 'Needs Approval',
};

export const DAY_OF_WEEK_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export const DEFAULT_NEWS_LENGTH_MAPPING: LengthRange[] = [
  { label: 'short', min: 15, max: 30 },
  { label: 'medium', min: 30, max: 60 },
  { label: 'long', min: 60, max: 100 },
];

export const DEFAULT_NEWS_MIN_RELEVANCE = 15;
