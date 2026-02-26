/**
 * Post Service - Creates posts via eToro API using per-portfolio credentials.
 */

import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getPostHeaders,
  getPortfolioCredentials,
} from '../etoro-api-config';
import type { CreatePostRequest, CreatePostResponse, PostTag, PostAttachment } from '../models/post';

export interface CreatePostOptions {
  portfolioUsername: string;
  message: string;
  tags?: PostTag[];
  attachments?: PostAttachment[];
}

export async function createDiscussionPost(
  options: CreatePostOptions,
): Promise<CreatePostResponse> {
  const creds = getPortfolioCredentials(options.portfolioUsername);
  if (!creds) {
    throw new Error(
      `No API credentials configured for ${options.portfolioUsername}`,
    );
  }

  const headers = getPostHeaders(options.portfolioUsername);
  if (!headers) {
    throw new Error(
      `Could not build headers for ${options.portfolioUsername}`,
    );
  }

  const payload: CreatePostRequest = {
    owner: parseInt(creds.gcid, 10),
    message: options.message,
  };

  if (options.tags && options.tags.length > 0) {
    payload.tags = { tags: options.tags };
  }

  if (options.attachments && options.attachments.length > 0) {
    payload.attachments = options.attachments;
  }

  const url = `${ETORO_API_BASE_URL}${API_ENDPOINTS.FEEDS_POST}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseText || 'Unknown error'}`);
  }

  return JSON.parse(responseText) as CreatePostResponse;
}
