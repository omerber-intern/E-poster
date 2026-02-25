/**
 * API Route: Get post history
 * GET /api/posts/history
 * POST /api/posts/history - Add a post to history
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PostDraft } from '@/lib/models/post';

// In-memory storage (in production, use a database)
const postHistory: PostDraft[] = [];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const posts = postHistory.slice(start, end);

    return NextResponse.json({
      posts,
      total: postHistory.length,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching post history:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch post history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const post: PostDraft = {
      ...body,
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
      postedAt: body.postedAt ? new Date(body.postedAt) : undefined,
    };

    postHistory.unshift(post); // Add to beginning

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Error adding post to history:', error);
    return NextResponse.json(
      {
        error: 'Failed to add post to history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

