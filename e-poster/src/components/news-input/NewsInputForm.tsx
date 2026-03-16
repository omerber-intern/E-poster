'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Zap, CheckCircle2, XCircle, Clock,
  Link2, Search, PenLine, AlertCircle, Newspaper, BookOpen,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import type { NewsContent } from '@/lib/models/news';
import type { DiscoveredArticle } from '@/app/api/news/discover/route';

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

interface PortfolioOption {
  id: string;
  name: string;
}

type ScrapeStatus = 'idle' | 'loading' | 'success' | 'error';
type DiscoverStatus = 'idle' | 'loading' | 'done' | 'error';

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

export function NewsInputForm({ onNewsSubmit }: NewsInputFormProps) {
  const router = useRouter();

  // Article fields
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [source, setSource] = useState('');
  const [url, setUrl] = useState('');

  // Scrape (URL fetch) state
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle');
  const [scrapeError, setScrapeError] = useState('');
  const [scrapedSource, setScrapedSource] = useState('');
  const [showFields, setShowFields] = useState(false);

  // Submit / auto-process state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [hasNewsSchedules, setHasNewsSchedules] = useState(false);
  const [autoProcessResults, setAutoProcessResults] = useState<AutoProcessResponse | null>(null);

  // Discovery state
  const [portfolios, setPortfolios] = useState<PortfolioOption[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');
  const [discoverStatus, setDiscoverStatus] = useState<DiscoverStatus>('idle');
  const [discoveredArticles, setDiscoveredArticles] = useState<DiscoveredArticle[]>([]);
  const [discoverError, setDiscoverError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const [schedRes, portRes] = await Promise.all([
          fetch('/api/schedules'),
          fetch('/api/news/discover'),
        ]);
        const schedData = await schedRes.json();
        const hasActive = (schedData.schedules || []).some(
          (s: { postType: string; isActive: boolean }) =>
            s.postType === 'news' && s.isActive,
        );
        setHasNewsSchedules(hasActive);

        const portData = await portRes.json();
        const list: PortfolioOption[] = portData.portfolios ?? [];
        setPortfolios(list);
        if (list.length > 0) setSelectedPortfolioId(list[0].id);
      } catch { /* ignore */ }
    }
    init();
  }, []);

  const handleDiscover = async (mode: 'latest' | 'portfolio') => {
    setDiscoverStatus('loading');
    setDiscoveredArticles([]);
    setDiscoverError('');

    try {
      const res = await fetch('/api/news/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          portfolioId: mode === 'portfolio' ? selectedPortfolioId : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDiscoverStatus('error');
        setDiscoverError(data.error || 'Failed to fetch news');
        return;
      }

      const articles: DiscoveredArticle[] = data.articles ?? [];
      setDiscoveredArticles(articles);
      setDiscoverStatus('done');

      if (articles.length === 0) {
        setDiscoverError('No articles found. Try the other mode or paste a URL below.');
      }
    } catch {
      setDiscoverStatus('error');
      setDiscoverError('Could not reach the news service. Try again or paste a URL below.');
    }
  };

  const handleUseArticle = (article: DiscoveredArticle) => {
    setHeadline(article.title);
    setBody(article.body);
    setSource(article.source);
    setUrl(article.url);
    setShowFields(true);
    setScrapeStatus('idle');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    toast.success('Article loaded — review the details below');
  };

  const handleScrape = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.error('Please enter a URL first');
      return;
    }
    try {
      new URL(trimmedUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setScrapeStatus('loading');
    setScrapeError('');

    try {
      const res = await fetch('/api/news/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setScrapeStatus('error');
        setScrapeError(data.error || 'Failed to scrape article');
        setShowFields(true);
        return;
      }

      if (data.headline) setHeadline(data.headline);
      if (data.body) setBody(data.body);
      if (data.source) {
        setSource(data.source);
        setScrapedSource(data.source);
      }
      setScrapeStatus('success');
      setShowFields(true);
    } catch {
      setScrapeStatus('error');
      setScrapeError('Could not reach the article. You can enter the details manually below.');
      setShowFields(true);
    }
  };

  const handleEnterManually = () => {
    setShowFields(true);
    setScrapeStatus('idle');
  };

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
        source: source.trim() || undefined,
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

  const isBusy = isSubmitting || isAutoProcessing || scrapeStatus === 'loading';
  const isDiscovering = discoverStatus === 'loading';

  return (
    <div className="space-y-4">

      {/* ── Discovery Card (NEW) ──────────────────────────────────── */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <CardTitle className="text-lg">Find a news article</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Surface relevant articles automatically, or paste a URL below
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Portfolio picker + mode buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {portfolios.length > 0 && (
              <select
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                disabled={isDiscovering}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 min-w-[160px]"
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            <div className="flex gap-2 flex-1">
              <Button
                type="button"
                variant="outline"
                disabled={isDiscovering || isBusy}
                onClick={() => handleDiscover('latest')}
                className="flex-1"
              >
                {isDiscovering ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Newspaper className="h-4 w-4 mr-2" />
                )}
                Latest News
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isDiscovering || isBusy || !selectedPortfolioId}
                onClick={() => handleDiscover('portfolio')}
                className="flex-1"
              >
                {isDiscovering ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <BookOpen className="h-4 w-4 mr-2" />
                )}
                From My Portfolio
              </Button>
            </div>
          </div>

          {/* Loading state */}
          {isDiscovering && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Finding relevant articles...
            </div>
          )}

          {/* Error state */}
          {discoverStatus === 'error' && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
              <span>{discoverError}</span>
            </div>
          )}

          {/* Empty results */}
          {discoverStatus === 'done' && discoveredArticles.length === 0 && (
            <p className="text-sm text-muted-foreground">{discoverError || 'No articles found.'}</p>
          )}

          {/* Article cards */}
          {discoveredArticles.length > 0 && (
            <div className="space-y-2">
              {discoveredArticles.map((article, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-snug line-clamp-2">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {article.source}
                          {article.publishedAt && (
                            <> · {formatRelativeTime(article.publishedAt)}</>
                          )}
                        </span>
                        {article.tickers.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
                          >
                            {t}
                          </span>
                        ))}
                        {article.tickers.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{article.tickers.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => handleUseArticle(article)}
                    >
                      Use
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                  {article.body && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {article.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="relative pt-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or paste a URL</span>
            </div>
          </div>

          {/* URL input + fetch */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (scrapeStatus !== 'idle') {
                    setScrapeStatus('idle');
                    setScrapeError('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleScrape();
                  }
                }}
                placeholder="https://reuters.com/article/..."
                className="pl-9 h-10"
                disabled={scrapeStatus === 'loading' || isDiscovering}
              />
            </div>
            <Button
              type="button"
              disabled={isBusy || !url.trim() || isDiscovering}
              onClick={handleScrape}
              className="shrink-0"
            >
              {scrapeStatus === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Fetch Article
                </>
              )}
            </Button>
          </div>

          {/* Scrape success banner */}
          {scrapeStatus === 'success' && (
            <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
              <span>
                Article extracted successfully
                {scrapedSource && <> from <strong>{scrapedSource}</strong></>}.
                Review the fields below.
              </span>
            </div>
          )}

          {/* Scrape error banner */}
          {scrapeStatus === 'error' && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
              <span>{scrapeError || 'Could not read this article. Please enter the details manually.'}</span>
            </div>
          )}

          {/* Manual entry fallback */}
          {!showFields && scrapeStatus !== 'success' && (
            <button
              type="button"
              onClick={handleEnterManually}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              <PenLine className="h-3.5 w-3.5" />
              Or enter the news manually
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Article Fields ────────────────────────────────── */}
      <div
        className={`space-y-4 transition-all duration-300 ${
          showFields
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none h-0 overflow-hidden'
        }`}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                2
              </div>
              <div>
                <CardTitle className="text-lg">Review article details</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  Edit the content if needed, then submit
                </CardDescription>
              </div>
            </div>
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
                />
                <p className="text-xs text-muted-foreground">
                  {body.length} / 5000 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g., Reuters, Bloomberg"
                />
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
      </div>

      {/* ── Auto-Process Results ─────────────────────────────────── */}
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
