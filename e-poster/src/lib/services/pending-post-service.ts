import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  PendingPost,
  PendingPostsData,
  PendingPostStatus,
} from '../models/schedule';
import type { PostType } from '../models/post';

const DATA_DIR = path.join(process.cwd(), 'data');
const PENDING_FILE = path.join(DATA_DIR, 'pending-posts.json');

function readPending(): PendingPostsData {
  try {
    const raw = fs.readFileSync(PENDING_FILE, 'utf-8');
    return JSON.parse(raw) as PendingPostsData;
  } catch {
    return { posts: [], updatedAt: new Date().toISOString() };
  }
}

function writePending(data: PendingPostsData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export interface CreatePendingPostParams {
  scheduleId: string;
  scheduleName: string;
  portfolioUsername: string;
  portfolioName: string;
  postType: PostType;
  content: string;
}

export function createPendingPost(params: CreatePendingPostParams): PendingPost {
  const data = readPending();

  const post: PendingPost = {
    id: uuidv4(),
    scheduleId: params.scheduleId,
    scheduleName: params.scheduleName,
    portfolioUsername: params.portfolioUsername,
    portfolioName: params.portfolioName,
    postType: params.postType,
    content: params.content,
    status: 'pending_approval',
    generatedAt: new Date().toISOString(),
  };

  data.posts.unshift(post);
  data.updatedAt = new Date().toISOString();
  writePending(data);

  return post;
}

export function getPendingPosts(filters?: {
  status?: PendingPostStatus;
  portfolio?: string;
  scheduleId?: string;
}): PendingPost[] {
  const data = readPending();
  let filtered = data.posts;

  if (filters?.status) {
    filtered = filtered.filter((p) => p.status === filters.status);
  }
  if (filters?.portfolio) {
    const q = filters.portfolio.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.portfolioUsername.toLowerCase() === q ||
        p.portfolioName.toLowerCase() === q,
    );
  }
  if (filters?.scheduleId) {
    filtered = filtered.filter((p) => p.scheduleId === filters.scheduleId);
  }

  return filtered;
}

export function getPendingPostById(id: string): PendingPost | null {
  return readPending().posts.find((p) => p.id === id) ?? null;
}

export function getPendingCount(): number {
  return readPending().posts.filter((p) => p.status === 'pending_approval').length;
}

export function updatePendingPost(
  id: string,
  updates: Partial<Pick<PendingPost, 'content' | 'status' | 'error'>>,
): PendingPost | null {
  const data = readPending();
  const post = data.posts.find((p) => p.id === id);
  if (!post) return null;

  if (updates.content !== undefined) post.content = updates.content;
  if (updates.error !== undefined) post.error = updates.error;
  if (updates.status !== undefined) {
    post.status = updates.status;
    if (updates.status === 'approved' || updates.status === 'rejected') {
      post.reviewedAt = new Date().toISOString();
    }
    if (updates.status === 'posted') {
      post.postedAt = new Date().toISOString();
    }
  }

  data.updatedAt = new Date().toISOString();
  writePending(data);
  return post;
}

export function deletePendingPost(id: string): boolean {
  const data = readPending();
  const idx = data.posts.findIndex((p) => p.id === id);
  if (idx === -1) return false;

  data.posts.splice(idx, 1);
  data.updatedAt = new Date().toISOString();
  writePending(data);
  return true;
}
