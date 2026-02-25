/**
 * News content models for e-poster
 */

export interface NewsContent {
  id?: string;
  headline: string;
  body: string;
  source?: string;
  url?: string;
  publishedAt?: Date;
  createdAt: Date;
  instruments?: number[]; // Extracted instrument IDs
  themes?: string[]; // Extracted themes/topics
}

export interface NewsEvaluationRequest {
  newsContent: NewsContent;
  portfolioIds?: string[]; // Optional: evaluate against specific portfolios
}

export interface NewsEvaluationResult {
  newsId: string;
  matchedPortfolios: PortfolioMatch[];
  extractedInstruments: ExtractedInstrument[];
  themes: string[];
  relevanceScore: number; // Overall relevance score (0-100)
  evaluationMethod: 'ai' | 'keyword' | 'hybrid';
  evaluatedAt: Date;
}

export interface PortfolioMatch {
  portfolioId: string;
  portfolioName: string;
  username: string;
  relevanceScore: number; // 0-100
  matchedInstruments: MatchedInstrument[];
  reasoning?: string; // AI-generated reasoning
  matchMethod: 'ai' | 'keyword' | 'hybrid';
}

export interface MatchedInstrument {
  instrumentId: number;
  instrumentName: string;
  symbol: string;
  matchType: 'exact' | 'partial' | 'semantic';
  confidence: number; // 0-1
}

export interface ExtractedInstrument {
  instrumentId: number;
  instrumentName: string;
  symbol: string;
  extractionMethod: 'ai' | 'keyword';
  confidence: number; // 0-1
}

