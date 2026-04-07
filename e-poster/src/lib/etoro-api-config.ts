/**
 * eToro API Configuration
 *
 * - GET requests use Short-Tech's credentials (ETORO_API_KEY / ETORO_USER_KEY).
 * - POST requests (posting) use per-portfolio credentials from PORTFOLIO_CREDENTIALS env var.
 */

import type { PortfolioCredentials } from './models/portfolio';
import { getCredentials } from './services/portfolio-config-service';

export const ETORO_API_BASE_URL =
  process.env.ETORO_API_BASE_URL || 'https://public-api.etoro.com';

const API_KEY = process.env.ETORO_API_KEY || '';
const API_USER_KEY = process.env.ETORO_USER_KEY || '';

function generateRequestId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Headers used for all GET requests (Short-Tech credentials).
 */
export function getBaseHeaders(): Record<string, string> {
  if (!API_KEY || !API_USER_KEY) {
    throw new Error(
      'Missing ETORO_API_KEY and/or ETORO_USER_KEY environment variables',
    );
  }

  return {
    'x-request-id': generateRequestId(),
    'x-api-key': API_KEY,
    'x-user-key': API_USER_KEY,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Look up per-portfolio credentials from the PORTFOLIO_CREDENTIALS env var.
 */
export function getPortfolioCredentials(
  username: string,
): PortfolioCredentials | null {
  return getCredentials(username);
}

/**
 * Headers used for POST requests (per-portfolio credentials).
 * Returns null if the portfolio has no credentials.
 */
export function getPostHeaders(
  username: string,
): Record<string, string> | null {
  const creds = getPortfolioCredentials(username);
  if (!creds) return null;

  return {
    'x-request-id': generateRequestId(),
    'x-api-key': creds.apiKey,
    'x-user-key': creds.userKey,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export const API_ENDPOINTS = {
  USER_INFO: '/api/v1/user-info/people',
  FEEDS_POST: '/api/v1/feeds/post',
  FEEDS_USER: '/api/v1/feeds/user/',
  INSTRUMENTS: '/api/v1/market-data/instruments',
  STOCKS_INDUSTRIES: '/api/v1/market-data/stocks-industries',
};

export function getPortfolioInfoUrl(username: string): string {
  return `/api/v1/user-info/people/${encodeURIComponent(username)}/portfolio/live`;
}

export function getPortfolioGainUrl(username: string): string {
  return `/api/v1/user-info/people/${encodeURIComponent(username)}/gain`;
}
