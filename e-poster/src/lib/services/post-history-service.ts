import fs from 'fs';
import path from 'path';
import type { PostDraft, PostType, PostTag, PostAttachment } from '../models/post';
import {
  ETORO_API_BASE_URL,
  API_ENDPOINTS,
  getPostHeaders,
  getPortfolioCredentials,
} from '../etoro-api-config';

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'post-history.json');

interface PostHistoryData {
  posts: PostDraft[];
  updatedAt: string;
  lastStatusCheck?: string;
}

export interface AddPostParams {
  portfolioUsername: string;
  portfolioName?: string;
  postType: PostType;
  content: string;
  etoroPostId?: string;
  tags?: PostTag[];
  attachments?: PostAttachment[];
}

export interface SearchFilters {
  portfolio?: string;
  fromDate?: string; // DD/MM/YYYY
  toDate?: string;   // DD/MM/YYYY
  includeDeleted?: boolean;
}

function parseDDMMYYYY(dateStr: string): Date | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function readHistory(): PostHistoryData {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as PostHistoryData;
  } catch {
    return { posts: [], updatedAt: new Date().toISOString() };
  }
}

function writeHistory(data: PostHistoryData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function addToHistory(params: AddPostParams): PostDraft {
  const data = readHistory();

  const post: PostDraft = {
    id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    newsId: '',
    portfolioId: params.portfolioUsername,
    portfolioName: params.portfolioName || params.portfolioUsername,
    postType: params.postType,
    content: params.content,
    tags: params.tags || [],
    attachments: params.attachments,
    status: 'posted',
    isDeleted: false,
    etoroPostId: params.etoroPostId,
    createdAt: new Date().toISOString(),
    postedAt: new Date().toISOString(),
  };

  data.posts.unshift(post);
  data.updatedAt = new Date().toISOString();
  writeHistory(data);

  return post;
}

export function searchHistory(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 20,
): { posts: PostDraft[]; total: number; page: number; pageSize: number } {
  const data = readHistory();
  let filtered = data.posts;

  if (!filters.includeDeleted) {
    filtered = filtered.filter((p) => !p.isDeleted);
  }

  if (filters.portfolio) {
    const q = filters.portfolio.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.portfolioId.toLowerCase() === q ||
        p.portfolioName.toLowerCase() === q,
    );
  }

  if (filters.fromDate) {
    const from = parseDDMMYYYY(filters.fromDate);
    if (from) {
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((p) => {
        if (!p.postedAt) return false;
        return new Date(p.postedAt) >= from;
      });
    }
  }

  if (filters.toDate) {
    const to = parseDDMMYYYY(filters.toDate);
    if (to) {
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => {
        if (!p.postedAt) return false;
        return new Date(p.postedAt) <= to;
      });
    }
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return { posts: paged, total, page, pageSize };
}

export function getAllPortfolioNames(): string[] {
  const data = readHistory();
  const names = new Set<string>();
  for (const post of data.posts) {
    names.add(post.portfolioName);
  }
  return Array.from(names).sort();
}

export function getLastStatusCheck(): string | null {
  const data = readHistory();
  return data.lastStatusCheck || null;
}

interface EtoroFeedPost {
  id: string;
  post?: {
    id?: string;
    isDeleted?: boolean;
  };
}

/**
 * Fetches each portfolio's feed from eToro and syncs the isDeleted status
 * for all posts we have in history. Uses GET /api/v1/feeds/user/{userId}.
 */
export async function refreshPostStatuses(): Promise<{
  checked: number;
  changed: number;
  errors: string[];
  lastStatusCheck: string;
}> {
  const data = readHistory();
  const errors: string[] = [];
  let checked = 0;
  let changed = 0;

  const postsWithEtoroId = data.posts.filter((p) => p.etoroPostId);
  if (postsWithEtoroId.length === 0) {
    const now = new Date().toISOString();
    data.lastStatusCheck = now;
    data.updatedAt = now;
    writeHistory(data);
    return { checked: 0, changed: 0, errors: [], lastStatusCheck: now };
  }

  const portfolioIds = new Set(postsWithEtoroId.map((p) => p.portfolioId));

  for (const portfolioUsername of portfolioIds) {
    const creds = await getPortfolioCredentials(portfolioUsername);
    if (!creds) {
      errors.push(`No credentials for ${portfolioUsername}`);
      continue;
    }

    const headers = await getPostHeaders(portfolioUsername);
    if (!headers) {
      errors.push(`Could not build headers for ${portfolioUsername}`);
      continue;
    }

    const portfolioPosts = postsWithEtoroId.filter((p) => p.portfolioId === portfolioUsername);
    const etoroPostIds = new Set(portfolioPosts.map((p) => p.etoroPostId!));

    try {
      const url = `${ETORO_API_BASE_URL}${API_ENDPOINTS.FEEDS_USER}${creds.gcid}?take=100`;
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        errors.push(`${portfolioUsername}: HTTP ${res.status}`);
        continue;
      }

      const responseData = await res.json();
      const discussions: EtoroFeedPost[] = responseData.discussions || [];

      const feedPostMap = new Map<string, boolean>();
      for (const disc of discussions) {
        const postId = disc.post?.id || disc.id;
        const isDeleted = disc.post?.isDeleted === true;
        if (postId) {
          feedPostMap.set(postId, isDeleted);
        }
      }

      for (const post of portfolioPosts) {
        checked++;
        const foundInFeed = feedPostMap.has(post.etoroPostId!);

        if (foundInFeed) {
          const etoroDeleted = feedPostMap.get(post.etoroPostId!) === true;
          if (post.isDeleted !== etoroDeleted) {
            post.isDeleted = etoroDeleted;
            changed++;
          }
        } else if (!post.isDeleted) {
          post.isDeleted = true;
          changed++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${portfolioUsername}: ${msg}`);
    }
  }

  const now = new Date().toISOString();
  data.lastStatusCheck = now;
  data.updatedAt = now;
  writeHistory(data);

  return { checked, changed, errors, lastStatusCheck: now };
}
