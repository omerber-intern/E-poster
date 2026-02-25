/**
 * AI Analyzer - Uses OpenAI to analyze news content
 */

export interface AIAnalysisResult {
  instruments: Array<{
    instrumentId?: number;
    instrumentName: string;
    symbol?: string;
    confidence: number;
  }>;
  themes: string[];
  summary: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

/**
 * Analyze news content using OpenAI
 */
export async function analyzeNewsWithAI(
  newsContent: string,
  apiKey?: string
): Promise<AIAnalysisResult> {
  if (!apiKey) {
    throw new Error('OpenAI API key not provided');
  }

  const prompt = `Analyze the following financial news content and extract:
1. Financial instruments mentioned (stocks, ETFs, cryptocurrencies, etc.) - provide names and symbols if possible
2. Main themes/topics
3. A brief summary
4. Sentiment (positive, negative, or neutral)

News content:
${newsContent}

Respond in JSON format:
{
  "instruments": [{"instrumentName": "Apple Inc", "symbol": "AAPL", "confidence": 0.9}],
  "themes": ["technology", "earnings"],
  "summary": "Brief summary...",
  "sentiment": "positive"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a financial news analyst. Extract instruments, themes, and sentiment from news content. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in OpenAI response');
    }

    const result = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error in AI analysis');
  }
}

