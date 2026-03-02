'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, Search } from 'lucide-react';
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

type ImpactLevel = 'low' | 'medium' | 'high';

interface TopicImpact {
  topic: string;
  impactScore: number;
  direction: 'positive' | 'negative' | 'neutral';
}

interface HoldingImpact {
  symbol: string;
  instrumentName: string;
  impactLevel: ImpactLevel;
  direction: 'positive' | 'negative' | 'neutral';
  reasoning: string;
  allocation: number;
}

interface NewsEvaluationResult {
  portfolioUsername: string;
  relevancePercent: number;
  topicImpacts: TopicImpact[];
  affectedHoldings: HoldingImpact[];
}

interface EvaluationResponse {
  results: NewsEvaluationResult[];
  portfoliosWithCredentials: string[];
  totalPortfolios: number;
  filteredCount: number;
  evaluatedAt: string;
}

const IMPACT_LEVEL_STYLES: Record<
  ImpactLevel,
  { label: string; bg: string; text: string }
> = {
  high: { label: 'HIGH', bg: 'bg-purple-100 border-purple-300', text: 'text-purple-800' },
  medium: { label: 'MED', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  low: { label: 'LOW', bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
};

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return 'text-purple-700 font-semibold';
  if (score >= 40) return 'text-blue-600';
  return 'text-gray-500';
};

export default function EvaluatePage() {
  const router = useRouter();
  const [news, setNews] = useState<{
    headline: string;
    body: string;
    url?: string;
  } | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<string>>(new Set());
  const [postLength, setPostLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newsData = sessionStorage.getItem('newsContent');
    if (!newsData) {
      toast.error('No news content found. Please start from the news input page.');
      router.push('/e-poster/news-input');
      return;
    }
    const parsed = JSON.parse(newsData);
    setNews(parsed);

    // Use cached result if available (e.g. navigating back from review page)
    const cached = sessionStorage.getItem('evaluationData');
    if (cached) {
      setEvaluation(JSON.parse(cached));
      return;
    }

    runEvaluation(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runEvaluation = async (newsContent: {
    headline: string;
    body: string;
    url?: string;
  }) => {
    setIsEvaluating(true);
    try {
      const response = await fetch('/api/news/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newsContent),
      });

      if (!response.ok) throw new Error('Evaluation failed');

      const data = (await response.json()) as EvaluationResponse;
      setEvaluation(data);
      sessionStorage.setItem('evaluationData', JSON.stringify(data));
      sessionStorage.setItem('newsForReview', JSON.stringify(newsContent));
    } catch {
      toast.error('Failed to evaluate news impact');
    } finally {
      setIsEvaluating(false);
    }
  };

  const togglePortfolio = (username: string) => {
    setSelectedPortfolios((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const toggleTopics = (username: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const filteredResults = evaluation?.results.filter((r) =>
    r.portfolioUsername.toLowerCase().includes(searchQuery.toLowerCase()),
  ) ?? [];

  const checkAll = () =>
    setSelectedPortfolios(new Set(filteredResults.map((r) => r.portfolioUsername)));

  const uncheckAll = () => setSelectedPortfolios(new Set());

  const handleContinue = () => {
    if (selectedPortfolios.size === 0) {
      toast.error('Select at least one portfolio');
      return;
    }
    sessionStorage.setItem(
      'selectedPortfoliosForReview',
      JSON.stringify(Array.from(selectedPortfolios)),
    );
    sessionStorage.setItem('newsPostLength', postLength);
    router.push('/e-poster/review');
  };

  const directionIcon = (dir: string) => {
    if (dir === 'positive') return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (dir === 'negative') return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  const relevanceColor = (pct: number) => {
    if (pct >= 30) return 'text-purple-700';
    if (pct >= 15) return 'text-blue-600';
    return 'text-gray-600';
  };

  if (!news) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/e-poster/news-input">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">News</CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="font-semibold mb-1">{news.headline}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3">{news.body}</p>
            </CardContent>
          </Card>

          {isEvaluating ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Scoring industry topics across all portfolios with Claude Haiku...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Phase 1: parallel topic batches → Phase 2: holding tagging for relevant portfolios
                </p>
              </CardContent>
            </Card>
          ) : evaluation ? (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Portfolio Relevance Analysis</CardTitle>
                  <CardDescription>
                    {evaluation.results.length} relevant portfolio(s) found
                    {evaluation.filteredCount > 0 && (
                      <span className="text-muted-foreground">
                        {' '}({evaluation.filteredCount} filtered below 5% relevance)
                      </span>
                    )}
                    {' — '}select which ones to generate posts for
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                  <div className="border rounded-lg max-h-[600px] overflow-y-auto divide-y">
                    {filteredResults.map((result) => {
                      const hasCredentials = evaluation.portfoliosWithCredentials.includes(
                        result.portfolioUsername,
                      );
                      const isSelected = selectedPortfolios.has(result.portfolioUsername);
                      const showTopics = expandedTopics.has(result.portfolioUsername);

                      return (
                        <div
                          key={result.portfolioUsername}
                          className={`p-4 cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => togglePortfolio(result.portfolioUsername)}
                        >
                          {/* Header row */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePortfolio(result.portfolioUsername)}
                                className="rounded"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="font-semibold">
                                @{result.portfolioUsername}
                              </span>
                              {!hasCredentials && (
                                <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                                  No API key
                                </span>
                              )}
                            </div>
                            <span className={`font-bold ${relevanceColor(result.relevancePercent)}`}>
                              {result.relevancePercent}% relevant
                            </span>
                          </div>

                          {/* Affected Holdings */}
                          {result.affectedHoldings.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {result.affectedHoldings.map((h) => {
                                const style = IMPACT_LEVEL_STYLES[h.impactLevel];
                                return (
                                  <span
                                    key={h.symbol}
                                    className={`text-xs px-2 py-1 rounded-full border inline-flex items-center gap-1.5 ${style.bg}`}
                                    title={`${h.reasoning}\nAllocation: ${h.allocation}%`}
                                  >
                                    {directionIcon(h.direction)}
                                    <span className={style.text}>${h.symbol}</span>
                                    <span className={`text-[10px] font-semibold ${style.text} opacity-75`}>
                                      {style.label}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Topic impacts (expandable) */}
                          {result.topicImpacts.length > 0 && (
                            <div>
                              <button
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTopics(result.portfolioUsername);
                                }}
                              >
                                {showTopics ? 'Hide' : 'Show'} industry topic scores
                                ({result.topicImpacts.length})
                              </button>
                              {showTopics && (
                                <div className="mt-2 grid grid-cols-2 gap-1">
                                  {result.topicImpacts.slice(0, 20).map((t) => (
                                    <div
                                      key={t.topic}
                                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                    >
                                      {directionIcon(t.direction)}
                                      <span className="truncate flex-1">{t.topic}</span>
                                      <span className={`shrink-0 ${SCORE_COLOR(t.impactScore)}`}>
                                        {t.impactScore}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedPortfolios.size} of {evaluation.results.length} selected
                  </p>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">Post Length</CardTitle>
                </CardHeader>
                <CardContent>
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
                        ~150 words. Quick news reaction.
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
                        ~200 words. Balanced news analysis.
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
                        ~250 words. Detailed news commentary.
                      </p>
                    </button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {selectedPortfolios.size} portfolio(s) selected
                </p>
                <Button onClick={handleContinue} disabled={selectedPortfolios.size === 0}>
                  Generate Posts ({selectedPortfolios.size})
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
