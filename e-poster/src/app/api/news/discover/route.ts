import { NextRequest, NextResponse } from 'next/server';
import { getPortfoliosFromCache, getPortfolioByUsername } from '@/lib/services/portfolio-service';
import type { PortfolioHolding } from '@/lib/models/portfolio';

export interface DiscoveredArticle {
  title: string;
  body: string;
  source: string;
  url: string;
  tickers: string[];
  publishedAt: string;
}

interface TiingoArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  source: string;
  tickers: string[];
  tags: string[];
  publishedDate: string;
  crawlDate: string;
}

/** Maps eToro majorCategory labels → Tiingo tag names */
const MAJOR_CATEGORY_TO_TIINGO_TAG: Record<string, string> = {
  'Tech & Data': 'Technology',
  'Crypto & Digital Assets': 'Cryptocurrency',
  'Financial Services': 'Financial Services',
  'Healthcare & Life Sciences': 'Healthcare',
  'Energy & Utilities': 'Energy',
  'Consumer & Retail': 'Consumer Goods',
  'Industrials & Materials': 'Industrials',
  'Real Estate': 'Real Estate',
  'Media & Telecom': 'Telecommunications',
  'Commodities': 'Commodities',
};

/**
 * Computes top N majorCategory values for a portfolio's holdings,
 * weighted by holding allocation percentage.
 */
function getTopSectorTags(holdings: PortfolioHolding[], topN = 3): string[] {
  const categoryWeights = new Map<string, number>();

  for (const holding of holdings) {
    if (!holding.industries || holding.industries.length === 0) continue;
    for (const industry of holding.industries) {
      const contribution = (holding.allocation * industry.weight) / 100;
      const existing = categoryWeights.get(industry.majorCategory) ?? 0;
      categoryWeights.set(industry.majorCategory, existing + contribution);
    }
  }

  const sorted = [...categoryWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([category]) => MAJOR_CATEGORY_TO_TIINGO_TAG[category] ?? category);

  return sorted.filter(Boolean);
}

async function fetchTiingoNews(params: Record<string, string>): Promise<TiingoArticle[]> {
  const apiKey = process.env.TIINGO_API_KEY;
  if (!apiKey) throw new Error('TIINGO_API_KEY is not configured');

  const query = new URLSearchParams({ ...params, token: apiKey });
  const res = await fetch(`https://api.tiingo.com/tiingo/news?${query.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tiingo API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<TiingoArticle[]>;
}

function mapArticle(article: TiingoArticle): DiscoveredArticle {
  return {
    title: article.title?.trim() ?? '',
    body: article.description?.trim() ?? '',
    source: article.source ?? '',
    url: article.url ?? '',
    tickers: article.tickers ?? [],
    publishedAt: article.publishedDate ?? article.crawlDate ?? '',
  };
}

/**
 * POST /api/news/discover
 *
 * Body: { mode: 'latest' | 'portfolio', portfolioId?: string }
 * Returns: { articles: DiscoveredArticle[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, portfolioId } = body as { mode: 'latest' | 'portfolio'; portfolioId?: string };

    if (mode !== 'latest' && mode !== 'portfolio') {
      return NextResponse.json({ error: 'mode must be "latest" or "portfolio"' }, { status: 400 });
    }

    let articles: TiingoArticle[] = [];

    if (mode === 'latest') {
      articles = await fetchTiingoNews({ limit: '6', sortBy: 'crawlDate' });
    } else {
      // portfolio mode
      if (!portfolioId) {
        return NextResponse.json({ error: 'portfolioId is required for portfolio mode' }, { status: 400 });
      }

      const portfolio = getPortfolioByUsername(portfolioId);
      if (!portfolio) {
        // Fall back to all portfolios if specific one not found
        const { portfolios } = getPortfoliosFromCache();
        const allHoldings = portfolios.flatMap((p) => p.holdings);
        const tags = getTopSectorTags(allHoldings);

        if (tags.length === 0) {
          articles = await fetchTiingoNews({ limit: '6', sortBy: 'crawlDate' });
        } else {
          articles = await fetchTiingoNews({ tags: tags.join(','), limit: '6', sortBy: 'crawlDate' });
        }
      } else {
        const tags = getTopSectorTags(portfolio.holdings);

        if (tags.length === 0) {
          articles = await fetchTiingoNews({ limit: '6', sortBy: 'crawlDate' });
        } else {
          articles = await fetchTiingoNews({ tags: tags.join(','), limit: '6', sortBy: 'crawlDate' });
        }
      }
    }

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
 * GET /api/news/discover/portfolios
 * Returns list of portfolio ids for the portfolio picker.
 * We handle this as a query param on the same route.
 */
export async function GET() {
  try {
    const { portfolios } = getPortfoliosFromCache();
    const list = portfolios.map((p) => ({ id: p.username, name: p.displayName ?? p.username }));
    return NextResponse.json({ portfolios: list });
  } catch (error) {
    console.error('Portfolio list error:', error);
    return NextResponse.json({ portfolios: [] });
  }
}
