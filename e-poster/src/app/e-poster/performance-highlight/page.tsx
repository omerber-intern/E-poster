'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';

type PostLength = 'short' | 'medium' | 'long';

interface PortfolioInfo {
  username: string;
  hasCredentials: boolean;
  monthlyGain: number | null;
  prevMonthGain: number | null;
  ytdGain: number | null;
}

function GainBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        N/A
      </span>
    );
  }
  const isPos = value >= 0;
  return (
    <span
      className={`flex items-center gap-1 text-xs font-medium ${isPos ? 'text-green-600' : 'text-red-500'}`}
    >
      {isPos ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isPos ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

function getGainByMonth(
  entries: { timestamp: string; gain: number }[],
  month: number,
  year: number,
): number | null {
  if (!entries || entries.length === 0) return null;
  const match = entries.find((e) => {
    const d = new Date(e.timestamp);
    return d.getUTCMonth() === month && d.getUTCFullYear() === year;
  });
  return match?.gain ?? null;
}

function getLatestGain(entries: { timestamp: string; gain: number }[]): number | null {
  if (!entries || entries.length === 0) return null;
  const latest = entries.reduce((prev, curr) =>
    new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev,
  );
  return latest.gain;
}

export default function PerformanceHighlightPage() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<PortfolioInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [postLength, setPostLength] = useState<PostLength>('medium');
  const [isLoading, setIsLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonthName = new Date(prevMonthYear, prevMonth).toLocaleString('en-US', { month: 'short' });
  const currentMonthName = now.toLocaleString('en-US', { month: 'short' });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();

        const allUsernames: string[] = data.allUsernames || [];
        const withCreds: string[] = data.portfoliosWithCredentials || [];
        const portfoliosData: Array<{
          username: string;
          gainData?: {
            monthly: { timestamp: string; gain: number }[];
            yearly: { timestamp: string; gain: number }[];
          };
        }> = data.portfolios || [];

        const portfolioMap = new Map(portfoliosData.map((p) => [p.username, p]));

        setPortfolios(
          allUsernames.map((u) => {
            const p = portfolioMap.get(u);
            const gainData = p?.gainData;
            return {
              username: u,
              hasCredentials: withCreds.includes(u),
              monthlyGain: gainData ? getGainByMonth(gainData.monthly, currentMonth, now.getFullYear()) : null,
              prevMonthGain: gainData ? getGainByMonth(gainData.monthly, prevMonth, prevMonthYear) : null,
              ytdGain: gainData ? getLatestGain(gainData.yearly) : null,
            };
          }),
        );
      } catch {
        toast.error('Failed to load portfolios');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filteredPortfolios = portfolios.filter((p) =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const togglePortfolio = (username: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const checkAll = () =>
    setSelected(new Set(filteredPortfolios.map((p) => p.username)));

  const uncheckAll = () => setSelected(new Set());

  const missingGainData = [...selected].filter((u) => {
    const p = portfolios.find((x) => x.username === u);
    return p && p.monthlyGain === null && p.prevMonthGain === null;
  });

  const negativePerformance = [...selected].filter((u) => {
    const p = portfolios.find((x) => x.username === u);
    if (!p) return false;
    const bestGain = Math.max(p.prevMonthGain ?? -Infinity, p.monthlyGain ?? -Infinity);
    return bestGain < 0;
  });

  const handleGenerate = () => {
    if (selected.size === 0) {
      toast.error('Select at least one portfolio');
      return;
    }
    if (missingGainData.length > 0) {
      toast.error(
        `${missingGainData.length} portfolio(s) have no gain data. Please refresh portfolio data first.`,
      );
      return;
    }
    sessionStorage.setItem(
      'performanceHighlightData',
      JSON.stringify({
        portfolioUsernames: Array.from(selected),
        postLength,
      }),
    );
    router.push('/e-poster/performance-highlight/review');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/e-poster/create">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Create a post
            </Button>
          </Link>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Performance Highlight</CardTitle>
              <CardDescription>
                Generate promotional posts that highlight and compliment your
                portfolios&apos; strong performance. Select portfolios and choose
                a post length.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Post length picker */}
              <div className="mb-6">
                <p className="text-sm font-medium mb-3">Post Length</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPostLength('short')}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      postLength === 'short'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <p className="font-medium text-sm mb-1">Short</p>
                    <p className="text-xs text-muted-foreground">
                      ~150 words. Quick highlight with key stats.
                    </p>
                  </button>

                  <button
                    onClick={() => setPostLength('medium')}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      postLength === 'medium'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <p className="font-medium text-sm mb-1">Medium</p>
                    <p className="text-xs text-muted-foreground">
                      ~200 words. Balanced coverage of strategy and performance.
                    </p>
                  </button>

                  <button
                    onClick={() => setPostLength('long')}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      postLength === 'long'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <p className="font-medium text-sm mb-1">Long</p>
                    <p className="text-xs text-muted-foreground">
                      ~250 words. Full promotional post with detailed
                      breakdown.
                    </p>
                  </button>
                </div>
              </div>

              {/* Search + bulk actions */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search portfolios..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={checkAll}>
                  Check All
                </Button>
                <Button variant="outline" size="sm" onClick={uncheckAll}>
                  Uncheck All
                </Button>
              </div>

              {/* Portfolio list */}
              <div className="border rounded-lg divide-y max-h-[480px] overflow-y-auto">
                {filteredPortfolios.map((p) => {
                  const bestGain = Math.max(p.prevMonthGain ?? -Infinity, p.monthlyGain ?? -Infinity);
                  const isNegative = bestGain < 0;
                  return (
                    <label
                      key={p.username}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.username)}
                        onChange={() => togglePortfolio(p.username)}
                        className="rounded"
                      />
                      <span className="flex-1 font-medium text-sm">
                        @{p.username}
                      </span>

                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-right">
                          <p className="text-muted-foreground">{prevMonthName}</p>
                          <GainBadge value={p.prevMonthGain} />
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">{currentMonthName}</p>
                          <GainBadge value={p.monthlyGain} />
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">YTD</p>
                          <GainBadge value={p.ytdGain} />
                        </div>
                      </div>

                      {isNegative && selected.has(p.username) && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          <AlertTriangle className="h-3 w-3" />
                          Negative
                        </span>
                      )}

                      {!p.hasCredentials && (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                          No API key
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  {selected.size} of {portfolios.length} selected
                </p>
                <div className="flex flex-col items-end gap-1">
                  {missingGainData.length > 0 && (
                    <p className="text-xs text-amber-600">
                      {missingGainData.length} selected portfolio(s) missing
                      gain data — refresh portfolio data first
                    </p>
                  )}
                  {negativePerformance.length > 0 && (
                    <p className="text-xs text-amber-600">
                      {negativePerformance.length} selected portfolio(s) have
                      negative monthly performance
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={selected.size === 0}
            >
              Generate Posts ({selected.size} portfolios)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
