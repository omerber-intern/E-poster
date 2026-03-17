import { NextRequest, NextResponse } from 'next/server';
import { getPortfoliosFromCache } from '@/lib/services/portfolio-service';
import type { PortfolioHolding } from '@/lib/models/portfolio';

export interface DiscoveredArticle {
  title: string;
  body: string;
  source: string;
  url: string;
  tickers: string[];
  publishedAt: string;
}

interface AlphaVantageArticle {
  title: string;
  url: string;
  time_published: string; // e.g. "20260316T131026"
  authors: string[];
  summary: string;
  source: string;
  overall_sentiment_score: number;
  overall_sentiment_label: string;
  ticker_sentiment: Array<{
    ticker: string;
    relevance_score: string;
    ticker_sentiment_score: string;
    ticker_sentiment_label: string;
  }>;
  topics: Array<{ topic: string; relevance_score: string }>;
}

interface AlphaVantageResponse {
  items: string;
  sentiment_score_definition: string;
  relevance_score_definition: string;
  feed: AlphaVantageArticle[];
  Information?: string;
  Note?: string;
}

/** Parses Alpha Vantage time_published (20260316T131026) → ISO string */
function parsePublishedDate(raw: string): string {
  if (!raw || raw.length < 15) return '';
  try {
    // Format: YYYYMMDDTHHMMSS
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    const hour = raw.slice(9, 11);
    const min = raw.slice(11, 13);
    const sec = raw.slice(13, 15);
    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
  } catch {
    return '';
  }
}

/**
 * Extracts top N stock tickers from merged portfolio holdings,
 * sorted by allocation weight descending.
 */
function getTopTickers(holdings: PortfolioHolding[], topN = 10): string[] {
  const tickerWeights = new Map<string, number>();

  for (const holding of holdings) {
    if (!holding.symbol) continue;
    const existing = tickerWeights.get(holding.symbol) ?? 0;
    tickerWeights.set(holding.symbol, existing + (holding.allocation ?? 0));
  }

  return [...tickerWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([symbol]) => symbol);
}

async function fetchAlphaVantageNews(
  params: Record<string, string>,
): Promise<AlphaVantageArticle[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error('ALPHA_VANTAGE_API_KEY is not configured');

  const query = new URLSearchParams({ function: 'NEWS_SENTIMENT', ...params, apikey: apiKey });
  const res = await fetch(`https://www.alphavantage.co/query?${query.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpha Vantage API error ${res.status}: ${text}`);
  }

  const data: AlphaVantageResponse = await res.json();

  if (data.Information) {
    throw new Error(`Alpha Vantage rate limit: ${data.Information}`);
  }
  if (data.Note) {
    throw new Error(`Alpha Vantage note: ${data.Note}`);
  }

  return data.feed ?? [];
}

function mapArticle(article: AlphaVantageArticle): DiscoveredArticle {
  return {
    title: article.title?.trim() ?? '',
    body: article.summary?.trim() ?? '',
    source: article.source ?? '',
    url: article.url ?? '',
    tickers: (article.ticker_sentiment ?? []).map((t) => t.ticker),
    publishedAt: parsePublishedDate(article.time_published),
  };
}

/**
 * POST /api/news/discover
 *
 * Body: { mode: 'latest' | 'portfolio', portfolioIds?: string[] }
 * Returns: { articles: DiscoveredArticle[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, portfolioIds } = body as {
      mode: 'latest' | 'portfolio';
      portfolioIds?: string[];
    };

    if (mode !== 'latest' && mode !== 'portfolio') {
      return NextResponse.json(
        { error: 'mode must be "latest" or "portfolio"' },
        { status: 400 },
      );
    }

    let articles: AlphaVantageArticle[] = [];

    if (mode === 'latest') {
      articles = await fetchAlphaVantageNews({ sort: 'LATEST' });
    } else {
      // portfolio mode
      const { portfolios } = getPortfoliosFromCache();

      const selectedIds = portfolioIds && portfolioIds.length > 0 ? portfolioIds : null;
      const matched = selectedIds
        ? portfolios.filter((p) => selectedIds.includes(p.username))
        : portfolios;

      const allHoldings = matched.flatMap((p) => p.holdings);
      const tickers = getTopTickers(allHoldings, 10);

      if (tickers.length === 0) {
        // No tickers found — fall back to latest
        articles = await fetchAlphaVantageNews({ sort: 'LATEST' });
      } else {
        articles = await fetchAlphaVantageNews({
          tickers: tickers.join(','),
          sort: 'LATEST',
        });
      }
    }

    // Alpha Vantage free tier always returns up to 50; take the first 6
    const mapped = articles.slice(0, 6).map(mapArticle);

    return NextResponse.json({ articles: mapped });
  } catch (error) {
    console.error('News discover error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch news' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/news/discover
 * Returns list of portfolios for the picker UI.
 */
export async function GET() {
  try {
    const { portfolios } = getPortfoliosFromCache();
    const list = portfolios.map((p) => ({
      id: p.username,
      name: p.displayName ?? p.username,
    }));
    return NextResponse.json({ portfolios: list });
  } catch (error) {
    console.error('Portfolio list error:', error);
    return NextResponse.json({ portfolios: [] });
  }
}
