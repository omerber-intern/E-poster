import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSchedules,
  getSchedulesByPortfolio,
  createSchedule,
  getSchedulesForDateRange,
  type CreateScheduleParams,
} from '@/lib/services/schedule-service';
import type { PostType } from '@/lib/models/post';
import type { ScheduleFrequency, ScheduleFlowType, NewsScheduleConfig } from '@/lib/models/schedule';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portfolio = searchParams.get('portfolio');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (startDate && endDate) {
      const runs = getSchedulesForDateRange(
        new Date(startDate),
        new Date(endDate),
        portfolio || undefined,
      );
      return NextResponse.json({
        runs,
        total: runs.length,
      });
    }

    const schedules = portfolio
      ? getSchedulesByPortfolio(portfolio)
      : getAllSchedules();

    return NextResponse.json({
      schedules,
      total: schedules.length,
    });
  } catch (error) {
    console.error('Get schedules error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      portfolioUsername,
      portfolioName,
      postType,
      frequency,
      flowType,
      timeOfDay,
      dayOfWeek,
      dayOfMonth,
      generationConfig = {},
      newsConfig,
    } = body as {
      name: string;
      portfolioUsername: string;
      portfolioName: string;
      postType: PostType;
      frequency?: ScheduleFrequency;
      flowType: ScheduleFlowType;
      timeOfDay?: string;
      dayOfWeek?: number;
      dayOfMonth?: number;
      generationConfig?: CreateScheduleParams['generationConfig'];
      newsConfig?: NewsScheduleConfig;
    };

    const isNews = postType === 'news';

    if (!name || !portfolioUsername || !postType || !flowType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, portfolioUsername, postType, flowType' },
        { status: 400 },
      );
    }

    if (!isNews && (!frequency || !timeOfDay)) {
      return NextResponse.json(
        { error: 'Non-news schedules require frequency and timeOfDay' },
        { status: 400 },
      );
    }

    const validPostTypes: PostType[] = [
      'news',
      'educational',
      'monthly-update',
      'performance-highlight',
    ];
    if (!validPostTypes.includes(postType)) {
      return NextResponse.json(
        { error: 'Invalid post type' },
        { status: 400 },
      );
    }

    const schedule = createSchedule({
      name,
      portfolioUsername,
      portfolioName: portfolioName || portfolioUsername,
      postType,
      frequency,
      flowType,
      timeOfDay,
      dayOfWeek,
      dayOfMonth,
      generationConfig,
      newsConfig: isNews ? newsConfig : undefined,
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error('Create schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to create schedule', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
