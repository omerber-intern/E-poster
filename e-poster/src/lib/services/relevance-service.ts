/**
 * Relevance Service - Evaluates news relevance to portfolios using AI and keyword matching
 */

import type {
  NewsContent,
  NewsEvaluationResult,
  PortfolioMatch,
  MatchedInstrument,
  ExtractedInstrument,
} from '../models/news';
import type { SmartPortfolio } from '../models/portfolio';
import { getSmartPortfolios, getPortfolioInstrumentIds } from './portfolio-service';
import { analyzeNewsWithAI } from '../utils/ai-analyzer';
import { matchInstrumentsByKeywords, extractInstrumentNames } from '../utils/keyword-matcher';

/**
 * Evaluate news relevance to portfolios
 */
export async function evaluateNewsRelevance(
  news: NewsContent,
  portfolioUsernames?: string[],
  useAI: boolean = true
): Promise<NewsEvaluationResult> {
  const newsText = `${news.headline}\n\n${news.body}`;
  
  // Get portfolios to evaluate against
  const portfolios = await getSmartPortfolios(portfolioUsernames);
  
  // Extract instruments from news
  const extractedInstruments: ExtractedInstrument[] = [];
  let themes: string[] = [];
  let evaluationMethod: 'ai' | 'keyword' | 'hybrid' = 'keyword';

  // Try AI analysis first if enabled
  if (useAI && process.env.OPENAI_API_KEY) {
    try {
      const aiResult = await analyzeNewsWithAI(newsText, process.env.OPENAI_API_KEY);
      
      // Add AI-extracted instruments
      aiResult.instruments.forEach(inst => {
        extractedInstruments.push({
          instrumentId: inst.instrumentId || 0,
          instrumentName: inst.instrumentName,
          symbol: inst.symbol || '',
          extractionMethod: 'ai',
          confidence: inst.confidence || 0.7,
        });
      });

      themes = aiResult.themes || [];
      evaluationMethod = 'hybrid';
    } catch (error) {
      console.warn('AI analysis failed, falling back to keyword matching:', error);
    }
  }

  // Fallback to keyword matching
  if (extractedInstruments.length === 0) {
    const extractedNames = extractInstrumentNames(newsText);
    // Note: In a real implementation, you'd look up these names in the instrument database
    // For now, we'll use keyword matching against portfolio holdings
  }

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

    // Calculate relevance score
    let relevanceScore = 0;
    const matchedInstruments: MatchedInstrument[] = [];

    // Check extracted instruments against portfolio holdings
    for (const extracted of extractedInstruments) {
      if (instrumentIds.includes(extracted.instrumentId)) {
        const holding = portfolio.holdings.find(h => h.instrumentId === extracted.instrumentId);
        if (holding) {
          matchedInstruments.push({
            instrumentId: extracted.instrumentId,
            instrumentName: holding.instrumentName,
            symbol: holding.symbol,
            matchType: 'semantic',
            confidence: extracted.confidence,
          });
          relevanceScore += extracted.confidence * 20; // Scale to 0-100
        }
      }
    }

    // Add keyword matches
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
    extractedInstruments,
    themes,
    relevanceScore: overallRelevance,
    evaluationMethod,
    evaluatedAt: new Date(),
  };
}

