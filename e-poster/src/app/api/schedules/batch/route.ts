import { NextRequest, NextResponse } from 'next/server';
import {
  createBatchSchedules,
  type CreateScheduleParams,
} from '@/lib/services/schedule-service';
import type { PostType } from '@/lib/models/post';
import type { NewsScheduleConfig } from '@/lib/models/schedule';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      portfolios,
      postType,
      frequency,
      flowType,
      timeOfDay,
      dayOfWeek,
      dayOfMonth,
      generationConfig = {},
      newsConfig,
      namePrefix,
    } = body as {
      portfolios: Array<{ username: string; name: string }>;
      postType: PostType;
      frequency?: string;
      flowType: string;
      timeOfDay?: string;
      dayOfWeek?: number;
      dayOfMonth?: number;
      generationConfig?: CreateScheduleParams['generationConfig'];
      newsConfig?: NewsScheduleConfig;
      namePrefix?: string;
    };

    if (!portfolios || portfolios.length === 0) {
      return NextResponse.json(
        { error: 'At least one portfolio is required' },
        { status: 400 },
      );
    }

    const isNews = postType === 'news';

    if (!postType || !flowType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    if (!isNews && (!frequency || !timeOfDay)) {
      return NextResponse.json(
        { error: 'Non-news schedules require frequency and timeOfDay' },
        { status: 400 },
      );
    }

    const paramsList: CreateScheduleParams[] = portfolios.map((p) => ({
      name: `${namePrefix || postType} - ${p.name}`,
      portfolioUsername: p.username,
      portfolioName: p.name,
      postType,
      frequency: isNews ? undefined : (frequency as CreateScheduleParams['frequency']),
      flowType: flowType as CreateScheduleParams['flowType'],
      timeOfDay: isNews ? undefined : timeOfDay,
      dayOfWeek,
      dayOfMonth,
      generationConfig,
      newsConfig: isNews ? newsConfig : undefined,
    }));

    const schedules = createBatchSchedules(paramsList);

    return NextResponse.json({
      schedules,
      created: schedules.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Batch create schedules error:', error);
    return NextResponse.json(
      { error: 'Failed to create batch schedules' },
      { status: 500 },
    );
  }
}
