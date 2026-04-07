import { NextRequest, NextResponse } from 'next/server';
import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getPostHeaders,
  getPortfolioCredentials,
} from '@/lib/etoro-api-config';
import { addToHistory } from '@/lib/services/post-history-service';
import type { PostType, PostAttachment } from '@/lib/models/post';

/**
 * POST /api/posts/create
 *
 * Body: { portfolioUsername, message, postType?, tags?, attachments? }
 *
 * Publishes a post on behalf of the specified portfolio account using
 * its per-portfolio credentials from PORTFOLIO_CREDENTIALS env var.
 */
export async function POST(request: NextRequest) {
  try {
    const { portfolioUsername, message, postType, tags, attachments } = (await request.json()) as {
      portfolioUsername: string;
      message: string;
      postType?: PostType;
      tags?: Array<{ name: string; id: string }>;
      attachments?: Array<{
        url?: string;
        title?: string;
        description?: string;
        mediaType?: 'None' | 'Image' | 'Video';
        media?: {
          image?: { width?: number; height?: number; url?: string };
        };
      }>;
    };

    if (!portfolioUsername || !message) {
      return NextResponse.json(
        { error: 'portfolioUsername and message are required' },
        { status: 400 },
      );
    }

    const creds = await getPortfolioCredentials(portfolioUsername);
    if (!creds) {
      return NextResponse.json(
        { error: `No API credentials configured for ${portfolioUsername}` },
        { status: 403 },
      );
    }

    const headers = await getPostHeaders(portfolioUsername);
    if (!headers) {
      return NextResponse.json(
        { error: `Could not build headers for ${portfolioUsername}` },
        { status: 500 },
      );
    }

    const payload: Record<string, unknown> = {
      owner: parseInt(creds.gcid, 10),
      message,
    };

    if (tags && tags.length > 0) {
      payload.tags = { tags };
    }

    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }

    const url = `${ETORO_API_BASE_URL}${API_ENDPOINTS.FEEDS_POST}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();

    // #region agent log
    if (response.ok) {
      console.log(`[POST /api/posts/create] SUCCESS portfolio="${portfolioUsername}" status=${response.status}`);
    } else {
      console.error(`[POST /api/posts/create] REJECTED portfolio="${portfolioUsername}" status=${response.status} body="${responseText.substring(0, 500)}"`);
    }
    // #endregion

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'eToro API rejected the post',
          status: response.status,
          details: responseText.substring(0, 500),
        },
        { status: response.status },
      );
    }

    const data = JSON.parse(responseText);

    try {
      addToHistory({
        portfolioUsername,
        postType: postType || 'news',
        content: message,
        etoroPostId: data.id,
        tags,
        attachments: attachments as PostAttachment[] | undefined,
      });
    } catch (historyError) {
      console.error('Failed to save post to history (post was still published):', historyError);
    }

    return NextResponse.json({
      success: true,
      postId: data.id,
      portfolioUsername,
      postedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create post',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
