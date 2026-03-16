import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const HOSTNAME_SOURCE_MAP: Record<string, string> = {
  'finance.yahoo.com': 'Yahoo Finance',
  'yahoo.com': 'Yahoo Finance',
  'bloomberg.com': 'Bloomberg',
  'reuters.com': 'Reuters',
  'cnbc.com': 'CNBC',
  'marketwatch.com': 'MarketWatch',
  'ft.com': 'Financial Times',
  'wsj.com': 'Wall Street Journal',
  'investing.com': 'Investing.com',
  'seekingalpha.com': 'Seeking Alpha',
  'barrons.com': "Barron's",
  'thestreet.com': 'TheStreet',
  'fool.com': 'Motley Fool',
  'benzinga.com': 'Benzinga',
};

function deriveSource(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const [domain, name] of Object.entries(HOSTNAME_SOURCE_MAP)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return name;
      }
    }
    return hostname;
  } catch {
    return '';
  }
}

/** Regex-based fallback parser used if Haiku cleanup fails. */
function parseMarkdownFallback(markdown: string, metaTitle: string): { headline: string; body: string } {
  const lines = markdown.split('\n');
  let headline = '';
  const bodyLines: string[] = [];
  let foundHeadline = false;

  for (const line of lines) {
    if (!foundHeadline && /^#\s+/.test(line)) {
      headline = line.replace(/^#+\s+/, '').trim();
      foundHeadline = true;
      continue;
    }
    bodyLines.push(line);
  }

  const body = bodyLines
    .join('\n')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const finalHeadline = metaTitle
    ? metaTitle.replace(/\s*[|\-–]\s*Yahoo Finance.*$/i, '').trim()
    : headline;

  return { headline: finalHeadline, body };
}

/**
 * Use Claude Haiku to strip noise from raw scraped markdown and return
 * a clean { headline, body } JSON object.
 */
async function cleanWithHaiku(
  rawMarkdown: string,
  metaTitle: string,
): Promise<{ headline: string; body: string }> {
  const client = new Anthropic();

  const prompt = `You are a news article extractor. You will receive raw scraped markdown content from a finance news website. Your job is to extract ONLY the actual journalism from it.

Return a JSON object with exactly two fields:
- "headline": the article's main title/headline (use the provided meta title if given, otherwise extract from the content)
- "body": the clean article body text — all paragraphs, quotes, and analysis that make up the actual news story

REMOVE completely:
- Video player UI text (Play, Pause, Skip, timecodes, quality levels, captions settings, etc.)
- "Loading chart...", "Story Continues", "Read more:" lines
- Navigation menus, header/footer elements
- Author bio paragraphs at the end
- "View Comments", "Terms and Privacy Policy", copyright lines
- Sidebar content, trending tickers, market data tables unrelated to the article
- Any other website chrome that is not part of the article itself

KEEP:
- All article paragraphs and sentences
- All quotes from sources
- All subheadings that are part of the article structure
- All facts, data points, and analysis

Meta title (prefer this for the headline field): ${metaTitle || '(none provided)'}

Raw scraped content:
${rawMarkdown.slice(0, 15000)}

Respond with ONLY valid JSON, no markdown fences, no explanation.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  // Strip markdown code fences if the model wrapped the JSON anyway
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(cleaned) as { headline?: string; body?: string };

  return {
    headline: (parsed.headline || '').trim(),
    body: (parsed.body || '').trim(),
  };
}

/**
 * POST /api/news/scrape
 *
 * Body: { url: string }
 * Returns: { headline, body, source }
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) {
      return NextResponse.json(
        { error: 'Scraping service is not configured (missing API key).' },
        { status: 500 },
      );
    }

    // Step 1 — Fetch raw content via Firecrawl
    const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    const firecrawlData = await firecrawlRes.json();

    if (!firecrawlRes.ok || !firecrawlData.success) {
      console.error('Firecrawl error:', firecrawlData);
      return NextResponse.json(
        { error: 'Could not retrieve the article. The site may be behind a paywall or blocking access.' },
        { status: 422 },
      );
    }

    const markdown: string = firecrawlData.data?.markdown || '';

    if (!markdown || markdown.trim().length < 50) {
      return NextResponse.json(
        { error: 'The article returned no readable content. It may be behind a paywall.' },
        { status: 422 },
      );
    }

    const metaTitle: string = firecrawlData.data?.metadata?.title || '';
    const source = deriveSource(url);

    // Step 2 — Clean with Claude Haiku, fall back to regex parser on failure
    let headline = '';
    let body = '';

    try {
      ({ headline, body } = await cleanWithHaiku(markdown, metaTitle));
    } catch (haikusErr) {
      console.warn('Haiku cleanup failed, using regex fallback:', haikusErr);
      ({ headline, body } = parseMarkdownFallback(markdown, metaTitle));
    }

    if (!headline && !body) {
      return NextResponse.json(
        { error: 'Could not extract article content. Please enter the details manually.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ headline, body, source });
  } catch (error) {
    console.error('Scrape error:', error);

    const message =
      error instanceof Error && error.message.toLowerCase().includes('timeout')
        ? 'Request timed out. The site may be slow or blocking access.'
        : 'Failed to fetch the article. Please enter the details manually.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
