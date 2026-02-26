import { NextRequest, NextResponse } from 'next/server';
import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getBaseHeaders,
} from '@/lib/etoro-api-config';

/**
 * POST /api/portfolio-config/validate
 *
 * Validates that the given eToro usernames exist.
 * For valid users, returns the gcid so it can be auto-filled.
 *
 * Body: { usernames: string[] }
 * Returns: { valid: [{ username, gcid }], invalid: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const usernames: string[] = body.usernames;

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return NextResponse.json(
        { error: 'usernames array is required' },
        { status: 400 },
      );
    }

    const valid: { username: string; gcid: string }[] = [];
    const invalid: string[] = [];

    for (const username of usernames) {
      try {
        const url = new URL(
          `${ETORO_API_BASE_URL}${API_ENDPOINTS.USER_INFO}`,
        );
        url.searchParams.append('usernames', username.trim());

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: getBaseHeaders(),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          invalid.push(username);
          continue;
        }

        const data = await res.json();
        const user = data?.users?.[0];

        if (!user) {
          invalid.push(username);
          continue;
        }

        valid.push({
          username,
          gcid: String(user.gcid ?? ''),
        });
      } catch {
        invalid.push(username);
      }
    }

    return NextResponse.json({ valid, invalid });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 },
    );
  }
}
