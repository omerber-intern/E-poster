import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioByUsername } from '@/lib/services/portfolio-service';
import {
  getApplicableDisclaimers,
  getAllDisclaimerRules,
} from '@/lib/services/disclaimer-service';

/**
 * POST /api/disclaimers/detect
 *
 * Body: { portfolioUsername: string, content: string }
 *
 * Auto-detects applicable disclaimers based on portfolio holdings and post content.
 * Returns both the auto-detected disclaimers and the full list for manual toggle.
 */
export async function POST(request: NextRequest) {
  try {
    const { portfolioUsername, content } = (await request.json()) as {
      portfolioUsername: string;
      content: string;
    };

    if (!portfolioUsername || content === undefined) {
      return NextResponse.json(
        { error: 'portfolioUsername and content are required' },
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

    const detected = getApplicableDisclaimers(portfolio.holdings, content);
    const allRules = getAllDisclaimerRules();

    return NextResponse.json({
      detected: detected.map((d) => ({
        id: d.rule.id,
        category: d.rule.category,
        useCase: d.rule.useCase,
        text: d.rule.text,
        reason: d.reason,
        isAutoDetected: d.isAutoDetected,
      })),
      allAvailable: allRules.map((r) => ({
        id: r.id,
        category: r.category,
        useCase: r.useCase,
        text: r.text,
        detectionType: r.detectionType,
      })),
    });
  } catch (error) {
    console.error('Disclaimer detection error:', error);
    return NextResponse.json(
      {
        error: 'Disclaimer detection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
