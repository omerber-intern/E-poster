import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingPosts,
  getPendingPostById,
  updatePendingPost,
  deletePendingPost,
  getPendingCount,
} from '@/lib/services/pending-post-service';
import { addToHistory } from '@/lib/services/post-history-service';
import {
  getPostHeaders,
  getPortfolioCredentials,
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
} from '@/lib/etoro-api-config';
import type { PendingPostStatus } from '@/lib/models/schedule';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PendingPostStatus | null;
    const portfolio = searchParams.get('portfolio');
    const countOnly = searchParams.get('countOnly');

    if (countOnly === 'true') {
      return NextResponse.json({ count: getPendingCount() });
    }

    const posts = getPendingPosts({
      status: status || undefined,
      portfolio: portfolio || undefined,
    });

    return NextResponse.json({ posts, total: posts.length });
  } catch (error) {
    console.error('Get pending posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending posts' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, content } = body as {
      id: string;
      action: 'approve' | 'reject' | 'edit';
      content?: string;
    };

    if (!id || !action) {
      return NextResponse.json(
        { error: 'id and action are required' },
        { status: 400 },
      );
    }

    const post = getPendingPostById(id);
    if (!post) {
      return NextResponse.json(
        { error: 'Pending post not found' },
        { status: 404 },
      );
    }

    if (action === 'edit') {
      if (!content) {
        return NextResponse.json(
          { error: 'content is required for edit action' },
          { status: 400 },
        );
      }
      const updated = updatePendingPost(id, { content });
      return NextResponse.json({ post: updated });
    }

    if (action === 'reject') {
      const updated = updatePendingPost(id, { status: 'rejected' });
      return NextResponse.json({ post: updated });
    }

    if (action === 'approve') {
      const finalContent = content || post.content;

      const creds = getPortfolioCredentials(post.portfolioUsername);
      if (!creds) {
        updatePendingPost(id, { status: 'failed', error: 'No API credentials' });
        return NextResponse.json(
          { error: `No API credentials for ${post.portfolioUsername}` },
          { status: 403 },
        );
      }

      const headers = getPostHeaders(post.portfolioUsername);
      if (!headers) {
        updatePendingPost(id, { status: 'failed', error: 'Could not build headers' });
        return NextResponse.json(
          { error: 'Could not build headers' },
          { status: 500 },
        );
      }

      try {
        const payload = {
          owner: parseInt(creds.gcid, 10),
          message: finalContent,
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
          updatePendingPost(id, {
            status: 'failed',
            error: `eToro API error ${response.status}: ${text.substring(0, 200)}`,
          });
          return NextResponse.json(
            { error: 'eToro API rejected the post', details: text.substring(0, 200) },
            { status: response.status },
          );
        }

        const data = await response.json();

        addToHistory({
          portfolioUsername: post.portfolioUsername,
          portfolioName: post.portfolioName,
          postType: post.postType,
          content: finalContent,
          etoroPostId: data.id,
        });

        updatePendingPost(id, { status: 'posted', content: finalContent });

        return NextResponse.json({
          success: true,
          postId: data.id,
          portfolioUsername: post.portfolioUsername,
        });
      } catch (postError) {
        const msg = postError instanceof Error ? postError.message : String(postError);
        updatePendingPost(id, { status: 'failed', error: msg });
        return NextResponse.json(
          { error: 'Failed to publish post', details: msg },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update pending post error:', error);
    return NextResponse.json(
      { error: 'Failed to update pending post' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const deleted = deletePendingPost(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Pending post not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete pending post error:', error);
    return NextResponse.json(
      { error: 'Failed to delete pending post' },
      { status: 500 },
    );
  }
}
