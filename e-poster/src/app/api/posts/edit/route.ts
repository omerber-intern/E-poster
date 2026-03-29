import { NextRequest, NextResponse } from 'next/server';
import { editPostContent } from '@/lib/services/ai-service';

/**
 * POST /api/posts/edit
 *
 * Body: { content: string, instructions: string }
 *
 * Applies free-form editing instructions to an existing post using Claude Sonnet.
 * Returns the edited post text.
 */
export async function POST(request: NextRequest) {
  try {
    const { content, instructions } = (await request.json()) as {
      content: string;
      instructions: string;
    };

    if (!content?.trim() || !instructions?.trim()) {
      return NextResponse.json(
        { error: 'content and instructions are required' },
        { status: 400 },
      );
    }

    const result = await editPostContent(content, instructions);

    return NextResponse.json({ content: result.content });
  } catch (error) {
    console.error('Edit post error:', error);
    return NextResponse.json(
      {
        error: 'Post editing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
