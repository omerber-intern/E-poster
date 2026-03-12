import { NextRequest, NextResponse } from 'next/server';
import { runDueSchedules } from '@/lib/services/scheduler-engine';

export async function POST(_request: NextRequest) {
  try {
    const result = await runDueSchedules();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Execute schedules error:', error);
    return NextResponse.json(
      { error: 'Failed to execute schedules' },
      { status: 500 },
    );
  }
}
