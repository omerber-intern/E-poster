'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import type { PostDraft, PostType } from '@/lib/models/post';

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

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

export default function HistoryPage() {
  const [posts, setPosts] = useState<PostDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [portfolioNames, setPortfolioNames] = useState<string[]>([]);

  const [selectedPortfolio, setSelectedPortfolio] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [lastStatusCheck, setLastStatusCheck] = useState<string | null>(null);

  const loadHistory = useCallback(async (pageNum: number = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('pageSize', String(pageSize));
      if (selectedPortfolio) params.set('portfolio', selectedPortfolio);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (includeDeleted) params.set('includeDeleted', 'true');

      const response = await fetch(`/api/posts/history?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load history');

      const data = await response.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
      if (data.portfolioNames) {
        setPortfolioNames(data.portfolioNames);
      }
    } catch (error) {
      toast.error('Failed to load post history');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPortfolio, fromDate, toDate, includeDeleted, pageSize]);

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  useEffect(() => {
    fetch('/api/posts/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.lastStatusCheck) setLastStatusCheck(data.lastStatusCheck);
      })
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    setPage(1);
    loadHistory(1);
  };

  const handleClearFilters = () => {
    setSelectedPortfolio('');
    setFromDate('');
    setToDate('');
    setIncludeDeleted(false);
  };

  const handleRefreshStatus = async () => {
    setIsRefreshingStatus(true);
    try {
      const res = await fetch('/api/posts/status', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastStatusCheck(data.lastStatusCheck);
        toast.success(
          `Checked ${data.checked} post${data.checked !== 1 ? 's' : ''}. ${data.changed} status${data.changed !== 1 ? 'es' : ''} updated.`,
        );
        loadHistory(page);
      } else {
        toast.error(data.error || 'Status refresh failed');
      }
    } catch {
      toast.error('Failed to refresh post statuses');
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = selectedPortfolio || fromDate || toDate || includeDeleted;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/e-poster">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Post History</CardTitle>
                  <CardDescription>
                    Search and filter posted content. Dates are in DD/MM/YYYY format.
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshStatus}
                    disabled={isRefreshingStatus}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-1.5 ${isRefreshingStatus ? 'animate-spin' : ''}`}
                    />
                    {isRefreshingStatus ? 'Checking...' : 'Refresh Status'}
                  </Button>
                  {lastStatusCheck && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Last check: {formatDateTime(lastStatusCheck)}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label htmlFor="portfolio-filter" className="text-sm font-medium mb-1.5 block">
                    Portfolio
                  </Label>
                  <select
                    id="portfolio-filter"
                    value={selectedPortfolio}
                    onChange={(e) => setSelectedPortfolio(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">All Portfolios</option>
                    {portfolioNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="from-date" className="text-sm font-medium mb-1.5 block">
                    From Date (DD/MM/YYYY)
                  </Label>
                  <Input
                    id="from-date"
                    placeholder="25/02/2026"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="to-date" className="text-sm font-medium mb-1.5 block">
                    To Date (DD/MM/YYYY)
                  </Label>
                  <Input
                    id="to-date"
                    placeholder="02/03/2026"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>

                <div className="flex flex-col justify-end gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-deleted"
                      checked={includeDeleted}
                      onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
                    />
                    <Label htmlFor="include-deleted" className="text-sm">
                      Show deleted
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSearch} size="sm" className="flex-1">
                      <Search className="h-4 w-4 mr-1" />
                      Search
                    </Button>
                    {hasFilters && (
                      <Button onClick={handleClearFilters} variant="outline" size="sm">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {hasFilters && (
                <div className="text-sm text-muted-foreground mb-4">
                  Showing {total} result{total !== 1 ? 's' : ''}
                  {selectedPortfolio && ` for "${selectedPortfolio}"`}
                  {fromDate && ` from ${fromDate}`}
                  {toDate && ` to ${toDate}`}
                  {includeDeleted && ' (including deleted)'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading history...
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {hasFilters
                    ? 'No posts match your search criteria.'
                    : 'No posts yet. Start by creating a post from the dashboard.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <Card
                      key={post.id}
                      className={post.isDeleted ? 'opacity-60' : ''}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold">{post.portfolioName}</h4>
                            <span className="text-sm text-muted-foreground">
                              @{post.portfolioId}
                            </span>
                            {post.postType && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${POST_TYPE_COLORS[post.postType] || 'bg-gray-100 text-gray-800'}`}
                              >
                                {POST_TYPE_LABELS[post.postType] || post.postType}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                              post.isDeleted
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {post.isDeleted ? 'Deleted' : 'Active'}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3 line-clamp-3 whitespace-pre-wrap">
                          {post.content}
                        </p>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          {post.postedAt && (
                            <span>Posted: {formatDateTime(post.postedAt)}</span>
                          )}
                          {post.etoroPostId && (
                            <span>eToro ID: {post.etoroPostId}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => loadHistory(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => loadHistory(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
