import { NextRequest, NextResponse } from 'next/server';
import {
  updateCredentials,
  removePortfolio,
} from '@/lib/services/portfolio-config-service';

/**
 * PUT /api/portfolio-config/[username]
 *
 * Update credentials for an existing portfolio.
 * Body: { credentials: { apiKey, userKey, gcid } }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const body = await request.json();
    const { credentials } = body;

    if (!credentials?.apiKey || !credentials?.userKey || !credentials?.gcid) {
      return NextResponse.json(
        { error: 'credentials object with apiKey, userKey, and gcid is required' },
        { status: 400 },
      );
    }

    const updated = updateCredentials(decodeURIComponent(username), credentials);
    if (!updated) {
      return NextResponse.json(
        { error: `Portfolio '${username}' not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating portfolio credentials:', error);
    return NextResponse.json(
      { error: 'Failed to update credentials' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/portfolio-config/[username]
 *
 * Remove a portfolio from the config.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const removed = removePortfolio(decodeURIComponent(username));
    if (!removed) {
      return NextResponse.json(
        { error: `Portfolio '${username}' not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to remove portfolio' },
      { status: 500 },
    );
  }
}
