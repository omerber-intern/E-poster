/**
 * Relevance Service - Evaluates news relevance to portfolios using keyword matching
 */

import type {
  NewsContent,
  NewsEvaluationResult,
  PortfolioMatch,
  MatchedInstrument,
} from '../models/news';
import type { SmartPortfolio } from '../models/portfolio';
import { getSmartPortfolios, getPortfolioInstrumentIds } from './portfolio-service';
import { matchInstrumentsByKeywords } from '../utils/keyword-matcher';

/**
 * Evaluate news relevance to portfolios
 */
export async function evaluateNewsRelevance(
  news: NewsContent,
  portfolioUsernames?: string[],
): Promise<NewsEvaluationResult> {
  const newsText = `${news.headline}\n\n${news.body}`;
  
  const portfolios = await getSmartPortfolios(portfolioUsernames);
  
  const evaluationMethod: 'keyword' = 'keyword';

  // Evaluate each portfolio
  const matchedPortfolios: PortfolioMatch[] = [];

  for (const portfolio of portfolios) {
    const instrumentIds = getPortfolioInstrumentIds(portfolio);
    
    // Create instrument lookup for keyword matching
    const instruments = portfolio.holdings.map(h => ({
      id: h.instrumentId,
      name: h.instrumentName,
      symbol: h.symbol,
    }));

    // Match instruments using keywords
    const keywordMatches = matchInstrumentsByKeywords(newsText, instruments);

    let relevanceScore = 0;
    const matchedInstruments: MatchedInstrument[] = [];

    for (const match of keywordMatches) {
      if (!matchedInstruments.find(m => m.instrumentId === match.instrumentId)) {
        matchedInstruments.push({
          instrumentId: match.instrumentId,
          instrumentName: match.instrumentName,
          symbol: match.symbol,
          matchType: match.matchType,
          confidence: match.confidence,
        });
        relevanceScore += match.confidence * 15;
      }
    }

    // Normalize score to 0-100
    relevanceScore = Math.min(100, relevanceScore);

    // Only include portfolios with some relevance
    if (relevanceScore > 10 || matchedInstruments.length > 0) {
      matchedPortfolios.push({
        portfolioId: portfolio.id,
        portfolioName: portfolio.displayName,
        username: portfolio.username,
        relevanceScore: Math.round(relevanceScore),
        matchedInstruments,
        matchMethod: evaluationMethod,
      });
    }
  }

  // Sort by relevance score (highest first)
  matchedPortfolios.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Calculate overall relevance score
  const overallRelevance = matchedPortfolios.length > 0
    ? matchedPortfolios[0].relevanceScore
    : 0;

  return {
    newsId: news.id || `news-${Date.now()}`,
    matchedPortfolios,
    extractedInstruments: [],
    themes: [],
    relevanceScore: overallRelevance,
    evaluationMethod,
    evaluatedAt: new Date(),
  };
}

