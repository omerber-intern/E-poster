import { NextRequest, NextResponse } from 'next/server';
import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getPortfolioCredentials,
} from '@/lib/etoro-api-config';

interface TestEntry {
  username: string;
  apiKey?: string;
  userKey?: string;
}

interface TestResult {
  username: string;
  valid: boolean;
  error?: string;
}

/**
 * POST /api/portfolio-config/test-credentials
 *
 * Tests API credentials by making a read-only GET request to eToro.
 * Accepts either supplied credentials or loads stored ones from config.
 *
 * Body: { entries: [{ username, apiKey?, userKey? }] }
 *
 * When apiKey/userKey are omitted, stored credentials are used.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entries: TestEntry[] = body.entries;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'entries array is required' },
        { status: 400 },
      );
    }

    const results: TestResult[] = [];

    for (const entry of entries) {
      let apiKey = entry.apiKey;
      let userKey = entry.userKey;

      if (!apiKey || !userKey) {
        const stored = await getPortfolioCredentials(entry.username);
        if (!stored) {
          results.push({
            username: entry.username,
            valid: false,
            error: 'No credentials configured',
          });
          continue;
        }
        apiKey = stored.apiKey;
        userKey = stored.userKey;
      }

      try {
        const url = new URL(
          `${ETORO_API_BASE_URL}${API_ENDPOINTS.USER_INFO}`,
        );
        url.searchParams.append('usernames', entry.username);

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'x-request-id': crypto.randomUUID(),
            'x-api-key': apiKey,
            'x-user-key': userKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          results.push({
            username: entry.username,
            valid: false,
            error: `HTTP ${res.status}`,
          });
          continue;
        }

        const data = await res.json();
        const user = data?.users?.[0];

        if (user) {
          results.push({ username: entry.username, valid: true });
        } else {
          results.push({
            username: entry.username,
            valid: false,
            error: 'No user data returned',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          username: entry.username,
          valid: false,
          error: msg,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Test credentials error:', error);
    return NextResponse.json(
      { error: 'Failed to test credentials' },
      { status: 500 },
    );
  }
}
