/**
 * POST /api/posts/status
 * Refresh the isDeleted status of all posts by checking against the eToro API.
 */

import { NextResponse } from 'next/server';
import {
  refreshPostStatuses,
  getLastStatusCheck,
} from '@/lib/services/post-history-service';

export async function GET() {
  try {
    const lastStatusCheck = getLastStatusCheck();
    return NextResponse.json({ lastStatusCheck });
  } catch (error) {
    console.error('Error getting last status check:', error);
    return NextResponse.json(
      { error: 'Failed to get status check info' },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const result = await refreshPostStatuses();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error refreshing post statuses:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh post statuses',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
