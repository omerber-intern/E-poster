import { NextRequest, NextResponse } from 'next/server';
import {
  generatePostContent,
  type NewsEvaluationResult,
  type PostLength,
} from '@/lib/services/ai-service';
import {
  getPortfolioByUsername,
  getBioByUsername,
} from '@/lib/services/portfolio-service';

/**
 * POST /api/posts/generate
 *
 * Body: { headline, body, url?, portfolioUsername, impact, examplePosts?, postLength? }
 *
 * Generates a post using Claude for a specific portfolio + news combination.
 */
export async function POST(request: NextRequest) {
  try {
    const {
      headline,
      body,
      url,
      portfolioUsername,
      impact,
      examplePosts,
      postLength = 'medium',
    } = (await request.json()) as {
      headline: string;
      body: string;
      url?: string;
      portfolioUsername: string;
      impact: NewsEvaluationResult;
      examplePosts?: string[];
      postLength?: PostLength;
    };

    const validLengths: PostLength[] = ['short', 'medium', 'long'];
    if (!validLengths.includes(postLength)) {
      return NextResponse.json(
        { error: 'postLength must be "short", "medium", or "long"' },
        { status: 400 },
      );
    }

    if (!headline || !body || !portfolioUsername || !impact) {
      return NextResponse.json(
        { error: 'headline, body, portfolioUsername, and impact are required' },
        { status: 400 },
      );
    }

    const portfolio = getPortfolioByUsername(portfolioUsername);
    if (!portfolio) {
      return NextResponse.json(
        { error: `Portfolio ${portfolioUsername} not found in cache` },
        { status: 404 },
      );
    }

    const bio = getBioByUsername(portfolioUsername);

    const result = await generatePostContent(
      { headline, body, url },
      portfolio,
      bio,
      impact,
      examplePosts,
      postLength,
    );

    return NextResponse.json({
      content: result.content,
      topTickers: result.topTickers,
      portfolioUsername,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Generate post error:', error);
    return NextResponse.json(
      {
        error: 'Post generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
