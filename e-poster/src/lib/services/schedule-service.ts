import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  addDays,
  addWeeks,
  addMonths,
  setHours,
  setMinutes,
  startOfDay,
  isBefore,
  getDay,
  setDate,
} from 'date-fns';
import type {
  Schedule,
  SchedulesData,
  ScheduleFrequency,
  ScheduleFlowType,
  ScheduleGenerationConfig,
  NewsScheduleConfig,
} from '../models/schedule';
import type { PostType } from '../models/post';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');

function readSchedules(): SchedulesData {
  try {
    const raw = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
    return JSON.parse(raw) as SchedulesData;
  } catch {
    return { schedules: [], updatedAt: new Date().toISOString() };
  }
}

function writeSchedules(data: SchedulesData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function computeNextRun(
  frequency: ScheduleFrequency,
  timeOfDay: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  after: Date = new Date(),
): string {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  let next: Date;

  switch (frequency) {
    case 'daily': {
      next = setMinutes(setHours(startOfDay(after), hours), minutes);
      if (!isBefore(after, next)) {
        next = addDays(next, 1);
      }
      break;
    }
    case 'weekly': {
      const targetDay = dayOfWeek ?? 1; // default Monday
      const currentDay = getDay(after);
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      next = addDays(startOfDay(after), daysUntil);
      next = setMinutes(setHours(next, hours), minutes);
      if (!isBefore(after, next)) {
        next = addDays(next, 7);
      }
      break;
    }
    case 'monthly': {
      const targetDate = dayOfMonth ?? 1;
      next = setDate(startOfDay(after), targetDate);
      next = setMinutes(setHours(next, hours), minutes);
      if (!isBefore(after, next)) {
        next = addMonths(next, 1);
        next = setDate(next, targetDate);
        next = setMinutes(setHours(next, hours), minutes);
      }
      break;
    }
  }

  return next.toISOString();
}

export function computeNextNRuns(
  frequency: ScheduleFrequency,
  timeOfDay: string,
  count: number,
  dayOfWeek?: number,
  dayOfMonth?: number,
): string[] {
  const runs: string[] = [];
  let after = new Date();
  for (let i = 0; i < count; i++) {
    const nextRun = computeNextRun(frequency, timeOfDay, dayOfWeek, dayOfMonth, after);
    runs.push(nextRun);
    after = new Date(new Date(nextRun).getTime() + 60000);
  }
  return runs;
}

export interface CreateScheduleParams {
  name: string;
  portfolioUsername: string;
  portfolioName: string;
  postType: PostType;
  frequency?: ScheduleFrequency;
  flowType: ScheduleFlowType;
  timeOfDay?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  generationConfig: ScheduleGenerationConfig;
  newsConfig?: NewsScheduleConfig;
}

export function createSchedule(params: CreateScheduleParams): Schedule {
  const data = readSchedules();
  const now = new Date().toISOString();
  const isNews = params.postType === 'news';

  const schedule: Schedule = {
    id: uuidv4(),
    name: params.name,
    portfolioUsername: params.portfolioUsername,
    portfolioName: params.portfolioName,
    postType: params.postType,
    frequency: isNews ? undefined : params.frequency,
    flowType: params.flowType,
    timeOfDay: isNews ? undefined : params.timeOfDay,
    dayOfWeek: params.dayOfWeek,
    dayOfMonth: params.dayOfMonth,
    generationConfig: params.generationConfig,
    newsConfig: isNews ? params.newsConfig : undefined,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    nextRunAt:
      !isNews && params.frequency && params.timeOfDay
        ? computeNextRun(
            params.frequency,
            params.timeOfDay,
            params.dayOfWeek,
            params.dayOfMonth,
          )
        : undefined,
  };

  data.schedules.push(schedule);
  data.updatedAt = now;
  writeSchedules(data);

  return schedule;
}

export function createBatchSchedules(
  paramsList: CreateScheduleParams[],
): Schedule[] {
  return paramsList.map((p) => createSchedule(p));
}

export function getAllSchedules(): Schedule[] {
  return readSchedules().schedules;
}

export function getActiveSchedules(): Schedule[] {
  return readSchedules().schedules.filter((s) => s.isActive);
}

export function getScheduleById(id: string): Schedule | null {
  return readSchedules().schedules.find((s) => s.id === id) ?? null;
}

export function getSchedulesByPortfolio(username: string): Schedule[] {
  return readSchedules().schedules.filter(
    (s) => s.portfolioUsername.toLowerCase() === username.toLowerCase(),
  );
}

export function updateSchedule(
  id: string,
  updates: Partial<
    Pick<
      Schedule,
      | 'name'
      | 'frequency'
      | 'flowType'
      | 'timeOfDay'
      | 'dayOfWeek'
      | 'dayOfMonth'
      | 'generationConfig'
      | 'newsConfig'
      | 'isActive'
    >
  >,
): Schedule | null {
  const data = readSchedules();
  const schedule = data.schedules.find((s) => s.id === id);
  if (!schedule) return null;

  Object.assign(schedule, updates);
  schedule.updatedAt = new Date().toISOString();

  if (
    schedule.postType !== 'news' &&
    schedule.frequency &&
    schedule.timeOfDay &&
    (updates.frequency !== undefined ||
      updates.timeOfDay !== undefined ||
      updates.dayOfWeek !== undefined ||
      updates.dayOfMonth !== undefined)
  ) {
    schedule.nextRunAt = computeNextRun(
      schedule.frequency,
      schedule.timeOfDay,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
    );
  }

  data.updatedAt = schedule.updatedAt;
  writeSchedules(data);
  return schedule;
}

export function deleteSchedule(id: string): boolean {
  const data = readSchedules();
  const idx = data.schedules.findIndex((s) => s.id === id);
  if (idx === -1) return false;

  data.schedules.splice(idx, 1);
  data.updatedAt = new Date().toISOString();
  writeSchedules(data);
  return true;
}

export function markScheduleRun(id: string): Schedule | null {
  const data = readSchedules();
  const schedule = data.schedules.find((s) => s.id === id);
  if (!schedule) return null;

  const now = new Date();
  schedule.lastRunAt = now.toISOString();

  if (schedule.postType !== 'news' && schedule.frequency && schedule.timeOfDay) {
    schedule.nextRunAt = computeNextRun(
      schedule.frequency,
      schedule.timeOfDay,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
      new Date(now.getTime() + 60000),
    );
  }

  schedule.updatedAt = now.toISOString();
  data.updatedAt = schedule.updatedAt;
  writeSchedules(data);
  return schedule;
}

export function getNewsSchedules(): Schedule[] {
  return getActiveSchedules().filter((s) => s.postType === 'news');
}

export function getDueSchedules(): Schedule[] {
  const now = new Date();
  return getActiveSchedules().filter(
    (s) => s.postType !== 'news' && s.nextRunAt && new Date(s.nextRunAt) <= now,
  );
}

export function getSchedulesForDateRange(
  start: Date,
  end: Date,
  portfolioFilter?: string,
): Array<{ schedule: Schedule; runDate: string }> {
  const schedules = (
    portfolioFilter
      ? getActiveSchedules().filter(
          (s) =>
            s.portfolioUsername.toLowerCase() === portfolioFilter.toLowerCase(),
        )
      : getActiveSchedules()
  ).filter((s) => s.postType !== 'news' && s.frequency && s.timeOfDay);

  const results: Array<{ schedule: Schedule; runDate: string }> = [];

  for (const schedule of schedules) {
    let cursor = new Date(start.getTime() - 1);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const nextRun = computeNextRun(
        schedule.frequency!,
        schedule.timeOfDay!,
        schedule.dayOfWeek,
        schedule.dayOfMonth,
        cursor,
      );
      const nextDate = new Date(nextRun);
      if (nextDate > end) break;
      results.push({ schedule, runDate: nextRun });
      cursor = new Date(nextDate.getTime() + 60000);
    }
  }

  return results.sort(
    (a, b) => new Date(a.runDate).getTime() - new Date(b.runDate).getTime(),
  );
}
