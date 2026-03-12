/**
 * Post models for e-poster
 */

export type PostType = 'news' | 'educational' | 'monthly-update' | 'performance-highlight';

export interface PostDraft {
  id: string;
  newsId: string;
  portfolioId: string;
  portfolioName: string;
  postType: PostType;
  templateId?: string;
  content: string;
  tags: PostTag[];
  mentions?: PostMention[];
  attachments?: PostAttachment[];
  status: 'draft' | 'pending' | 'posted' | 'failed';
  isDeleted: boolean;
  etoroPostId?: string;
  createdAt: string;
  postedAt?: string;
  error?: string;
}

export interface PostTag {
  name: string;
  id: string; // Instrument ID as string
}

export interface PostMention {
  userName: string;
  id: string; // User ID as string
  isDirect: boolean;
}

export interface PostAttachment {
  url: string;
  title?: string;
  description?: string;
  mediaType?: 'None' | 'Image' | 'Video';
  media?: {
    image?: {
      width?: number;
      height?: number;
      url?: string;
    };
    video?: {
      videoSourceId?: string;
      videoSource?: 'None' | 'YouTube' | 'Vimeo';
      image?: {
        width?: number;
        height?: number;
        url?: string;
      };
    };
  };
}

export interface CreatePostRequest {
  owner: number; // User ID
  message: string;
  tags?: {
    tags: PostTag[];
  };
  mentions?: {
    mentions: PostMention[];
  };
  attachments?: PostAttachment[];
}

export interface CreatePostResponse {
  id: string;
  owner: {
    id: string;
    username?: string;
  };
  created: string;
  message: {
    text: string;
  };
  attachments?: PostAttachment[];
  isDeleted: boolean;
  isSpam: boolean;
  editStatus: 'None' | 'Edited' | 'Moderated';
}

export interface PostHistory {
  posts: PostDraft[];
  total: number;
  page: number;
  pageSize: number;
}

