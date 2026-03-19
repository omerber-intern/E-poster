'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Zap, CheckCircle2, XCircle, Clock, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import type { NewsContent } from '@/lib/models/news';

interface NewsInputFormProps {
  onNewsSubmit?: (news: NewsContent) => void;
}

interface AutoProcessResult {
  portfolioUsername: string;
  relevancePercent: number;
  postLength: string;
  flowType: string;
  scheduleName: string;
  action: 'posted' | 'pending_approval' | 'failed';
  postId?: string;
  pendingPostId?: string;
  error?: string;
}

interface AutoProcessResponse {
  results: AutoProcessResult[];
  totalEvaluated: number;
  totalQualified: number;
  posted: number;
  pendingApproval: number;
  failed: number;
  message?: string;
  processedAt: string;
}

export function NewsInputForm({ onNewsSubmit }: NewsInputFormProps) {
  const router = useRouter();

  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [provider, setProvider] = useState('');
  const [url, setUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [hasNewsSchedules, setHasNewsSchedules] = useState(false);
  const [autoProcessResults, setAutoProcessResults] = useState<AutoProcessResponse | null>(null);

  useEffect(() => {
    fetch('/api/schedules')
      .then((r) => r.json())
      .then((data) => {
        const hasActive = (data.schedules || []).some(
          (s: { postType: string; isActive: boolean }) => s.postType === 'news' && s.isActive,
        );
        setHasNewsSchedules(hasActive);
      })
      .catch(() => {});
  }, []);

  const validateForm = () => {
    if (!headline.trim() || !body.trim()) {
      toast.error('Please fill in both headline and body');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const news: NewsContent = {
        headline: headline.trim(),
        body: body.trim(),
        source: provider.trim() || undefined,
        url: url.trim() || undefined,
        createdAt: new Date(),
      };

      sessionStorage.setItem('newsContent', JSON.stringify(news));

      if (onNewsSubmit) {
        onNewsSubmit(news);
      } else {
        router.push('/e-poster/evaluate');
      }

      toast.success('News content saved');
    } catch (error) {
      toast.error('Failed to save news content');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoProcess = async () => {
    if (!validateForm()) return;

    setIsAutoProcessing(true);
    setAutoProcessResults(null);

    try {
      const res = await fetch('/api/news/auto-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headline.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
        }),
      });

      const data: AutoProcessResponse = await res.json();

      if (!res.ok) {
        toast.error((data as unknown as { error: string }).error || 'Auto-process failed');
        return;
      }

      setAutoProcessResults(data);

      if (data.results?.length > 0) {
        const posted = data.posted || 0;
        const pending = data.pendingApproval || 0;
        const failed = data.failed || 0;
        const parts: string[] = [];
        if (posted > 0) parts.push(`${posted} posted`);
        if (pending > 0) parts.push(`${pending} pending approval`);
        if (failed > 0) parts.push(`${failed} failed`);
        toast.success(`Auto-processed: ${parts.join(', ')}`);
      } else {
        toast.success(data.message || 'No portfolios qualified');
      }
    } catch (error) {
      toast.error('Auto-process failed');
      console.error(error);
    } finally {
      setIsAutoProcessing(false);
    }
  };

  const actionIcon = (action: string) => {
    switch (action) {
      case 'posted': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'pending_approval': return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case 'posted': return 'Posted';
      case 'pending_approval': return 'Pending Approval';
      default: return 'Failed';
    }
  };

  const isBusy = isSubmitting || isAutoProcessing;

  return (
    <div className="space-y-4">

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Enter article details</CardTitle>
          <CardDescription className="text-sm mt-0.5">
            Fill in the news content manually, then continue to evaluation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="headline">Headline *</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Enter news headline..."
                required
                maxLength={500}
                disabled={isBusy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body Content *</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter news body content..."
                required
                rows={10}
                maxLength={5000}
                disabled={isBusy}
              />
              <p className="text-xs text-muted-foreground">
                {body.length} / 5000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">
                Provider{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g., Yahoo Finance, Reuters, Bloomberg"
                disabled={isBusy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="article-url">
                Article URL{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="article-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="pl-9"
                  disabled={isBusy}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isBusy} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Continue to Evaluation'
                )}
              </Button>
              {hasNewsSchedules && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={handleAutoProcess}
                  className="flex-1"
                >
                  {isAutoProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Auto-Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Auto-Process with Rules
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {autoProcessResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Auto-Process Results</CardTitle>
            <CardDescription>
              Evaluated {autoProcessResults.totalEvaluated} portfolios —{' '}
              {autoProcessResults.totalQualified} qualified
            </CardDescription>
          </CardHeader>
          <CardContent>
            {autoProcessResults.results?.length > 0 ? (
              <div className="space-y-2">
                {autoProcessResults.results.map((r) => (
                  <div
                    key={r.portfolioUsername}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    {actionIcon(r.action)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{r.portfolioUsername}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.relevancePercent}% relevant
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="capitalize">{r.postLength} post</span>
                        <span>·</span>
                        <span>{r.scheduleName}</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.action === 'posted'
                          ? 'bg-green-100 text-green-800'
                          : r.action === 'pending_approval'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {actionLabel(r.action)}
                    </span>
                  </div>
                ))}

                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground border-t mt-3">
                  {(autoProcessResults.posted ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {autoProcessResults.posted} posted
                    </span>
                  )}
                  {(autoProcessResults.pendingApproval ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-amber-500" />
                      {autoProcessResults.pendingApproval} pending
                    </span>
                  )}
                  {(autoProcessResults.failed ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-red-500" />
                      {autoProcessResults.failed} failed
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {autoProcessResults.message || 'No portfolios met the relevance threshold.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
