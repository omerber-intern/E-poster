/**
 * Keyword Matcher - Matches news content to instruments using keywords
 */

export interface KeywordMatch {
  instrumentId: number;
  instrumentName: string;
  symbol: string;
  matchType: 'exact' | 'partial';
  confidence: number;
  matchedKeywords: string[];
}

/**
 * Match instruments in news content using keyword matching
 */
export function matchInstrumentsByKeywords(
  newsContent: string,
  instruments: Array<{ id: number; name: string; symbol: string }>
): KeywordMatch[] {
  const content = newsContent.toLowerCase();
  const matches: KeywordMatch[] = [];

  for (const instrument of instruments) {
    const matchedKeywords: string[] = [];
    let matchType: 'exact' | 'partial' = 'partial';
    let confidence = 0;

    // Check for exact symbol match (e.g., "AAPL", "MSFT")
    const symbolRegex = new RegExp(`\\b${instrument.symbol}\\b`, 'i');
    if (symbolRegex.test(content)) {
      matchedKeywords.push(instrument.symbol);
      matchType = 'exact';
      confidence = 0.9;
    }

    // Check for company name match
    const nameWords = instrument.name.toLowerCase().split(/\s+/);
    let nameMatches = 0;
    for (const word of nameWords) {
      if (word.length > 3 && content.includes(word)) {
        matchedKeywords.push(word);
        nameMatches++;
      }
    }

    // If multiple words match, increase confidence
    if (nameMatches > 0) {
      confidence = Math.max(confidence, Math.min(0.7, nameMatches / nameWords.length));
      if (nameMatches === nameWords.length) {
        matchType = 'exact';
        confidence = 0.95;
      }
    }

    // Only include if we found matches
    if (matchedKeywords.length > 0) {
      matches.push({
        instrumentId: instrument.id,
        instrumentName: instrument.name,
        symbol: instrument.symbol,
        matchType,
        confidence,
        matchedKeywords,
      });
    }
  }

  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extract potential instrument names from text
 */
export function extractInstrumentNames(text: string): string[] {
  // Common patterns for mentioning instruments
  const patterns = [
    /\b([A-Z]{2,5})\b/g, // Ticker symbols (2-5 uppercase letters)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|Corp|Corporation|LLC|Ltd|Limited|Company|Co\.)/g, // Company names
  ];

  const found: string[] = [];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !found.includes(match[1])) {
        found.push(match[1]);
      }
    }
  }

  return found;
}

