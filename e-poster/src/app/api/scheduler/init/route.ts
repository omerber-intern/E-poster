import { NextResponse } from 'next/server';
import {
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
} from '@/lib/services/scheduler-engine';

export async function GET() {
  return NextResponse.json({ running: isSchedulerRunning() });
}

export async function POST() {
  try {
    startScheduler();
    return NextResponse.json({ running: true, message: 'Scheduler started' });
  } catch (error) {
    console.error('Scheduler init error:', error);
    return NextResponse.json(
      { error: 'Failed to start scheduler' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    stopScheduler();
    return NextResponse.json({ running: false, message: 'Scheduler stopped' });
  } catch (error) {
    console.error('Scheduler stop error:', error);
    return NextResponse.json(
      { error: 'Failed to stop scheduler' },
      { status: 500 },
    );
  }
}
