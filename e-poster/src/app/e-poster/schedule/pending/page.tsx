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
  Search,
  ImagePlus,
  Wand2,
  Images,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { EtoroPostMockup } from '@/components/post-mockup/EtoroPostMockup';
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
  const [scheduleNameFilter, setScheduleNameFilter] = useState('');
  const [portfolioNames, setPortfolioNames] = useState<string[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Per-post image upload state: postId -> imageUrl
  const [postImages, setPostImages] = useState<Record<string, string>>({});
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Bulk image upload
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const bulkPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Edit dialog
  const [editingPost, setEditingPost] = useState<PendingPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // AI edit dialog
  const [aiEditPost, setAiEditPost] = useState<PendingPost | null>(null);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiEditDialogOpen, setAiEditDialogOpen] = useState(false);
  const [isAiEditing, setIsAiEditing] = useState(false);

  // Preview dialog
  const [previewPost, setPreviewPost] = useState<PendingPost | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPosts = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all' && statusFilter !== 'pending_approval') {
        params.set('status', statusFilter);
      }
      if (portfolioFilter) params.set('portfolio', portfolioFilter);

      const res = await fetch(`/api/pending-posts?${params.toString()}`);
      const data = await res.json();
      const all: PendingPost[] = data.posts || [];

      const visible =
        statusFilter === 'pending_approval'
          ? all.filter((p) => p.status === 'generating' || p.status === 'pending_approval')
          : all;

      visible.sort((a, b) => {
        if (a.status === 'generating' && b.status !== 'generating') return -1;
        if (b.status === 'generating' && a.status !== 'generating') return 1;
        return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      });

      setPosts(visible);

      // Sync imageUrl from server into local state
      setPostImages((prev) => {
        const next = { ...prev };
        for (const p of visible) {
          if (p.imageUrl && !next[p.id]) next[p.id] = p.imageUrl;
        }
        return next;
      });

      const names = new Set<string>();
      for (const p of all) names.add(p.portfolioName);
      setPortfolioNames(Array.from(names).sort());

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

  // Upload a photo file and return the resulting URL
  const uploadPhoto = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url as string;
  };

  // Save imageUrl to a post on the server
  const saveImageToPost = async (postId: string, imageUrl: string, currentContent: string) => {
    await fetch('/api/pending-posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId, action: 'edit', content: currentContent, imageUrl }),
    });
  };

  const handlePhotoUpload = async (postId: string, file: File, currentContent: string) => {
    setUploadingIds((prev) => new Set(prev).add(postId));
    try {
      const url = await uploadPhoto(file);
      setPostImages((prev) => ({ ...prev, [postId]: url }));
      await saveImageToPost(postId, url, currentContent);
      toast.success('Photo attached');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleRemovePhoto = async (postId: string, currentContent: string) => {
    setPostImages((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    await fetch('/api/pending-posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId, action: 'edit', content: currentContent, imageUrl: '' }),
    });
  };

  const handleBulkPhotoUpload = async (file: File) => {
    setIsBulkUploading(true);
    try {
      const url = await uploadPhoto(file);
      const targets = displayedPosts.filter((p) => p.status === 'pending_approval');
      if (targets.length === 0) {
        toast('No pending posts in current filter to attach to.');
        return;
      }
      await Promise.all(
        targets.map((p) => saveImageToPost(p.id, url, p.content)),
      );
      setPostImages((prev) => {
        const next = { ...prev };
        for (const p of targets) next[p.id] = url;
        return next;
      });
      toast.success(`Photo attached to ${targets.length} post(s)`);
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setIsBulkUploading(false);
    }
  };

  const handleAction = async (
    postId: string,
    action: 'approve' | 'reject',
    content?: string,
  ) => {
    setProcessingIds((prev) => new Set(prev).add(postId));
    try {
      const body: Record<string, unknown> = { id: postId, action, content };
      if (action === 'approve' && postImages[postId]) {
        body.imageUrl = postImages[postId];
      }
      const res = await fetch('/api/pending-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to ${action}`);
      }

      toast.success(action === 'approve' ? 'Post approved and published!' : 'Post rejected');
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
          imageUrl: postImages[editingPost.id],
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

  const handleOpenAiEdit = (post: PendingPost) => {
    setAiEditPost(post);
    setAiInstructions('');
    setAiEditDialogOpen(true);
  };

  const handleAiEdit = async () => {
    if (!aiEditPost || !aiInstructions.trim()) return;
    setIsAiEditing(true);
    try {
      const res = await fetch('/api/posts/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: aiEditPost.content, instructions: aiInstructions }),
      });
      if (!res.ok) throw new Error('AI edit failed');
      const data = await res.json();

      await fetch('/api/pending-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: aiEditPost.id,
          action: 'edit',
          content: data.content,
          imageUrl: postImages[aiEditPost.id],
        }),
      });

      toast.success('Post updated with AI edits');
      setAiEditDialogOpen(false);
      loadPosts();
    } catch {
      toast.error('AI edit failed');
    } finally {
      setIsAiEditing(false);
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

  const displayedPosts = scheduleNameFilter.trim()
    ? posts.filter((p) =>
        p.scheduleName.toLowerCase().includes(scheduleNameFilter.trim().toLowerCase()),
      )
    : posts;

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
              <div className="flex items-end gap-4 flex-wrap">
                <div className="flex-1 min-w-[150px]">
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
                <div className="flex-1 min-w-[150px]">
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
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs mb-1 block">Schedule Name</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by name..."
                      value={scheduleNameFilter}
                      onChange={(e) => setScheduleNameFilter(e.target.value)}
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                </div>
                <div className="shrink-0">
                  <Label className="text-xs mb-1 block">Attach to all filtered</Label>
                  <input
                    ref={bulkPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBulkPhotoUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => bulkPhotoInputRef.current?.click()}
                    disabled={isBulkUploading}
                  >
                    {isBulkUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Images className="h-4 w-4 mr-1.5" />
                    )}
                    {isBulkUploading ? 'Uploading...' : 'Bulk Photo'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Posts List */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading pending posts...
            </div>
          ) : displayedPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {scheduleNameFilter.trim()
                  ? `No posts match schedule name "${scheduleNameFilter.trim()}".`
                  : statusFilter === 'pending_approval'
                  ? 'No posts waiting for approval.'
                  : 'No posts match your filter.'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayedPosts.map((post) => {
                const statusInfo = STATUS_CONFIG[post.status];
                const isProcessing = processingIds.has(post.id);
                const isPending = post.status === 'pending_approval';
                const isGenerating = post.status === 'generating';
                const isUploading = uploadingIds.has(post.id);
                const attachedImage = postImages[post.id];

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
                            {isGenerating && <Loader2 className="h-3 w-3 animate-spin" />}
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isPending && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleOpenAiEdit(post)}
                              disabled={isProcessing}
                            >
                              <Wand2 className="h-3.5 w-3.5 mr-1" />
                              Edit with AI
                            </Button>
                          )}
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(post.generatedAt), 'MMM d, HH:mm')}
                          </div>
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
                          <p className="text-sm whitespace-pre-wrap line-clamp-6 mb-3 bg-muted/30 rounded-lg p-3">
                            {post.content}
                          </p>

                          {/* Attached photo */}
                          {attachedImage ? (
                            <div className="relative inline-block mb-3">
                              <img
                                src={attachedImage}
                                alt="Attached"
                                className="h-24 w-auto rounded-lg border object-cover"
                              />
                              {isPending && (
                                <button
                                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90"
                                  onClick={() => handleRemovePhoto(post.id, post.content)}
                                  title="Remove photo"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ) : null}

                          {post.error && (
                            <div className="text-sm text-red-600 mb-3 flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                              {post.error}
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
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

                                {/* Per-post photo upload */}
                                <input
                                  ref={(el) => { photoInputRefs.current[post.id] = el; }}
                                  type="file"
                                  accept="image/jpeg,image/png,image/gif,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePhotoUpload(post.id, file, post.content);
                                    e.target.value = '';
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => photoInputRefs.current[post.id]?.click()}
                                  disabled={isProcessing || isUploading}
                                >
                                  {isUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <ImagePlus className="h-4 w-4 mr-1" />
                                  )}
                                  {isUploading ? 'Uploading...' : attachedImage ? 'Change Photo' : 'Add Photo'}
                                </Button>

                                {attachedImage && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemovePhoto(post.id, post.content)}
                                    disabled={isProcessing}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1 text-muted-foreground" />
                                    Remove Photo
                                  </Button>
                                )}

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
                  {editingPost?.portfolioName} -{' '}
                  {POST_TYPE_LABELS[editingPost?.postType || 'news']}
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* AI Edit Dialog */}
          <Dialog open={aiEditDialogOpen} onOpenChange={setAiEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  Edit with AI
                </DialogTitle>
                <DialogDescription>
                  {aiEditPost?.portfolioName} -{' '}
                  {POST_TYPE_LABELS[aiEditPost?.postType || 'news']}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Current content</Label>
                  <div className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {aiEditPost?.content}
                  </div>
                </div>
                <div>
                  <Label htmlFor="ai-instructions" className="text-sm font-medium mb-1.5 block">
                    Instructions for AI
                  </Label>
                  <Textarea
                    id="ai-instructions"
                    placeholder="e.g. Make it shorter, use a more formal tone, add a call-to-action..."
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAiEditDialogOpen(false)}
                  disabled={isAiEditing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAiEdit}
                  disabled={isAiEditing || !aiInstructions.trim()}
                >
                  {isAiEditing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Editing…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Apply AI Edit
                    </>
                  )}
                </Button>
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
              <div className="bg-gray-50 rounded-xl p-6 max-h-[600px] overflow-y-auto space-y-4">
                <EtoroPostMockup
                  username={previewPost?.portfolioUsername ?? ''}
                  content={previewPost?.content ?? ''}
                />
                {previewPost && postImages[previewPost.id] && (
                  <img
                    src={postImages[previewPost.id]}
                    alt="Attached photo"
                    className="w-full rounded-lg border object-cover max-h-64"
                  />
                )}
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
