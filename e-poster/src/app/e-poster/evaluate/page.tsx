'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'react-hot-toast';

type ImpactLevel = 'low' | 'medium' | 'high';

interface AssetImpact {
  symbol: string;
  instrumentName: string;
  impactLevel: ImpactLevel;
  direction: 'positive' | 'negative' | 'neutral';
  reasoning: string;
  allocation: number;
  relevanceContribution: number;
}

interface NewsImpactResult {
  portfolioUsername: string;
  relevancePercent: number;
  affectedAssets: AssetImpact[];
  reasoning: string;
}

interface EvaluationResponse {
  results: NewsImpactResult[];
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

export default function EvaluatePage() {
  const router = useRouter();
  const [news, setNews] = useState<{
    headline: string;
    body: string;
    url?: string;
  } | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(
    null,
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const newsData = sessionStorage.getItem('newsContent');
    if (!newsData) {
      toast.error(
        'No news content found. Please start from the news input page.',
      );
      router.push('/e-poster/news-input');
      return;
    }
    const parsed = JSON.parse(newsData);
    setNews(parsed);
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

  const handleContinue = () => {
    if (selectedPortfolios.size === 0) {
      toast.error('Select at least one portfolio');
      return;
    }
    sessionStorage.setItem(
      'selectedPortfoliosForReview',
      JSON.stringify(Array.from(selectedPortfolios)),
    );
    router.push('/e-poster/review');
  };

  const directionIcon = (dir: string) => {
    if (dir === 'positive')
      return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (dir === 'negative')
      return <TrendingDown className="h-3 w-3 text-red-600" />;
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
              <p className="text-sm text-muted-foreground line-clamp-3">
                {news.body}
              </p>
            </CardContent>
          </Card>

          {isEvaluating ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Analyzing relevance across all portfolios with Claude AI...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This may take a minute.
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
                        {' '}
                        ({evaluation.filteredCount} filtered out below 5%
                        relevance)
                      </span>
                    )}
                    {' — '}select which ones to generate posts for
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {evaluation.results.map((result) => {
                      const hasCredentials =
                        evaluation.portfoliosWithCredentials.includes(
                          result.portfolioUsername,
                        );
                      const isSelected = selectedPortfolios.has(
                        result.portfolioUsername,
                      );

                      return (
                        <div
                          key={result.portfolioUsername}
                          className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() =>
                            togglePortfolio(result.portfolioUsername)
                          }
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  togglePortfolio(result.portfolioUsername)
                                }
                                className="rounded"
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
                            <div className="flex items-center gap-1">
                              <span
                                className={`font-bold ${relevanceColor(result.relevancePercent)}`}
                              >
                                {result.relevancePercent}% relevant
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-2">
                            {result.reasoning}
                          </p>

                          {result.affectedAssets.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {result.affectedAssets.map((asset) => {
                                const style =
                                  IMPACT_LEVEL_STYLES[asset.impactLevel];
                                return (
                                  <span
                                    key={asset.symbol}
                                    className={`text-xs px-2 py-1 rounded-full border inline-flex items-center gap-1.5 ${style.bg}`}
                                    title={`${asset.reasoning}\nAllocation: ${asset.allocation}% | Contribution: ${asset.relevanceContribution}%`}
                                  >
                                    {directionIcon(asset.direction)}
                                    <span className={style.text}>
                                      ${asset.symbol}
                                    </span>
                                    <span
                                      className={`text-[10px] font-semibold ${style.text} opacity-75`}
                                    >
                                      {style.label}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {selectedPortfolios.size} portfolio(s) selected
                </p>
                <Button
                  onClick={handleContinue}
                  disabled={selectedPortfolios.size === 0}
                >
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
