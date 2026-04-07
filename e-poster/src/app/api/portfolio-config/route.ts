import { NextRequest, NextResponse } from 'next/server';
import {
  getMaskedConfigs,
  addPortfolios,
} from '@/lib/services/portfolio-config-service';
import type { PortfolioCredentials } from '@/lib/models/portfolio';

/**
 * GET /api/portfolio-config
 *
 * Returns all portfolios with masked credential info.
 */
export async function GET() {
  try {
    const configs = getMaskedConfigs();
    return NextResponse.json({ portfolios: configs });
  } catch (error) {
    console.error('Error reading portfolio config:', error);
    return NextResponse.json(
      { error: 'Failed to read portfolio config' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/portfolio-config
 *
 * Add new portfolios with required credentials.
 * Body: { portfolios: [{ username, credentials: { apiKey, userKey, gcid } }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entries: { username: string; credentials: PortfolioCredentials }[] =
      body.portfolios;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'portfolios array is required and must not be empty' },
        { status: 400 },
      );
    }

    for (const entry of entries) {
      if (!entry.username?.trim()) {
        return NextResponse.json(
          { error: 'Each entry must have a non-empty username' },
          { status: 400 },
        );
      }
      if (!entry.credentials?.apiKey || !entry.credentials?.userKey) {
        return NextResponse.json(
          {
            error: `Missing required credentials (apiKey, userKey) for ${entry.username}`,
          },
          { status: 400 },
        );
      }
    }

    const result = addPortfolios(
      entries.map((e) => ({
        username: e.username.trim(),
        credentials: e.credentials,
      })),
    );

    return NextResponse.json({
      success: true,
      added: result.added,
      duplicates: result.duplicates,
    });
  } catch (error) {
    console.error('Error adding portfolios:', error);
    return NextResponse.json(
      { error: 'Failed to add portfolios' },
      { status: 500 },
    );
  }
}
