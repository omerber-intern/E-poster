'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  X,
  Edit3,
  Loader2,
  Eye,
  Clock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import type { PostType } from '@/lib/models/post';
import type { PendingPost, PendingPostStatus } from '@/lib/models/schedule';

const POST_TYPE_LABELS: Record<PostType, string> = {
  news: 'News',
  educational: 'Educational',
  'monthly-update': 'Monthly Update',
  'performance-highlight': 'Performance Highlight',
};

const POST_TYPE_COLORS: Record<PostType, string> = {
  news: 'bg-blue-100 text-blue-800',
  educational: 'bg-purple-100 text-purple-800',
  'monthly-update': 'bg-amber-100 text-amber-800',
  'performance-highlight': 'bg-emerald-100 text-emerald-800',
};

const STATUS_CONFIG: Record<
  PendingPostStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  generating: { label: 'Generating', color: 'bg-blue-100 text-blue-800', icon: Sparkles },
  pending_approval: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: Check },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: X },
  posted: { label: 'Posted', color: 'bg-green-100 text-green-800', icon: Check },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

type FilterStatus = 'all' | PendingPostStatus;

export default function PendingPostsPage() {
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending_approval');
  const [portfolioFilter, setPortfolioFilter] = useState('');
  const [portfolioNames, setPortfolioNames] = useState<string[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Edit dialog
  const [editingPost, setEditingPost] = useState<PendingPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Preview dialog
  const [previewPost, setPreviewPost] = useState<PendingPost | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPosts = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      // When filtering pending_approval, also fetch generating posts (shown at top)
      if (statusFilter !== 'all' && statusFilter !== 'pending_approval') {
        params.set('status', statusFilter);
      }
      if (portfolioFilter) params.set('portfolio', portfolioFilter);

      const res = await fetch(`/api/pending-posts?${params.toString()}`);
      const data = await res.json();
      const all: PendingPost[] = data.posts || [];

      // When in pending_approval view, show generating + pending_approval
      const visible =
        statusFilter === 'pending_approval'
          ? all.filter((p) => p.status === 'generating' || p.status === 'pending_approval')
          : all;

      // Sort: generating first, then by date desc
      visible.sort((a, b) => {
        if (a.status === 'generating' && b.status !== 'generating') return -1;
        if (b.status === 'generating' && a.status !== 'generating') return 1;
        return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      });

      setPosts(visible);

      const names = new Set<string>();
      for (const p of all) names.add(p.portfolioName);
      setPortfolioNames(Array.from(names).sort());

      // Start/stop polling based on whether any posts are generating
      const hasGenerating = visible.some((p) => p.status === 'generating');
      if (hasGenerating && !pollingRef.current) {
        pollingRef.current = setInterval(() => loadPosts(true), 5000);
      } else if (!hasGenerating && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch {
      if (!silent) toast.error('Failed to load pending posts');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [statusFilter, portfolioFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPosts();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [loadPosts]);

  const handleAction = async (
    postId: string,
    action: 'approve' | 'reject',
    content?: string,
  ) => {
    setProcessingIds((prev) => new Set(prev).add(postId));
    try {
      const res = await fetch('/api/pending-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, action, content }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to ${action}`);
      }

      toast.success(
        action === 'approve'
          ? 'Post approved and published!'
          : 'Post rejected',
      );
      loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleEdit = (post: PendingPost) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;

    setProcessingIds((prev) => new Set(prev).add(editingPost.id));
    try {
      const res = await fetch('/api/pending-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPost.id,
          action: 'edit',
          content: editContent,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('Content updated');
      setEditDialogOpen(false);
      loadPosts();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(editingPost.id);
        return next;
      });
    }
  };

  const handleApproveAll = async () => {
    const pending = posts.filter((p) => p.status === 'pending_approval');
    if (pending.length === 0) return;

    if (!confirm(`Approve and publish ${pending.length} post(s)?`)) return;

    for (const post of pending) {
      await handleAction(post.id, 'approve');
    }
  };

  const pendingCount = posts.filter((p) => p.status === 'pending_approval').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/e-poster/schedule">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Schedule
            </Button>
          </Link>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Pending Approvals</h1>
              <p className="text-muted-foreground mt-1">
                Review AI-generated posts before they go live.
              </p>
            </div>
            {pendingCount > 1 && (
              <Button onClick={handleApproveAll}>
                <Check className="h-4 w-4 mr-2" />
                Approve All ({pendingCount})
              </Button>
            )}
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="generating">Generating</option>
                    <option value="approved">Approved</option>
                    <option value="posted">Posted</option>
                    <option value="rejected">Rejected</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Portfolio</Label>
                  <select
                    value={portfolioFilter}
                    onChange={(e) => setPortfolioFilter(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">All Portfolios</option>
                    {portfolioNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Posts List */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading pending posts...
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {statusFilter === 'pending_approval'
                  ? 'No posts waiting for approval.'
                  : 'No posts match your filter.'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const statusInfo = STATUS_CONFIG[post.status];
                const isProcessing = processingIds.has(post.id);
                const isPending = post.status === 'pending_approval';
                const isGenerating = post.status === 'generating';

                return (
                  <Card
                    key={post.id}
                    className={isGenerating ? 'opacity-75 border-blue-200' : ''}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{post.portfolioName}</span>
                          <span className="text-sm text-muted-foreground">
                            @{post.portfolioUsername}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              POST_TYPE_COLORS[post.postType] || 'bg-gray-100'
                            }`}
                          >
                            {POST_TYPE_LABELS[post.postType]}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusInfo.color}`}
                          >
                            {isGenerating && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(post.generatedAt), 'MMM d, HH:mm')}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground mb-2">
                        Schedule: {post.scheduleName}
                      </div>

                      {isGenerating ? (
                        <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-4 mb-4 text-blue-700">
                          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                          <div>
                            <p className="text-sm font-medium">Generating post content…</p>
                            <p className="text-xs text-blue-500 mt-0.5">
                              This usually takes 15–30 seconds. The page will update automatically.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap line-clamp-6 mb-4 bg-muted/30 rounded-lg p-3">
                            {post.content}
                          </p>

                          {post.error && (
                            <div className="text-sm text-red-600 mb-3 flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                              {post.error}
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPreviewPost(post);
                                setPreviewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                            {isPending && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(post)}
                                  disabled={isProcessing}
                                >
                                  <Edit3 className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <div className="flex-1" />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAction(post.id, 'reject')}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <X className="h-4 w-4 mr-1" />
                                      Reject
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAction(post.id, 'approve')}
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="h-4 w-4 mr-1" />
                                      Approve & Post
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Post Content</DialogTitle>
                <DialogDescription>
                  {editingPost?.portfolioName} - {POST_TYPE_LABELS[editingPost?.postType || 'news']}
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Preview Dialog */}
          <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Post Preview</DialogTitle>
                <DialogDescription>
                  {previewPost?.portfolioName} (@{previewPost?.portfolioUsername})
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted/30 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{previewPost?.content}</p>
              </div>
              {previewPost?.status === 'pending_approval' && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewDialogOpen(false);
                      if (previewPost) handleAction(previewPost.id, 'reject');
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setPreviewDialogOpen(false);
                      if (previewPost) handleAction(previewPost.id, 'approve');
                    }}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve & Post
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
