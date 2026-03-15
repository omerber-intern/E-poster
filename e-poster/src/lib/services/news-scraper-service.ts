import Parser from 'rss-parser';

export interface ScrapedArticle {
  headline: string;
  body: string;
  url?: string;
}

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; e-poster-bot/1.0)',
  },
});

/**
 * Fetches the latest articles from an RSS or Atom feed.
 * Maps item.title → headline, item.contentSnippet ?? item.content → body, item.link → url.
 */
export async function fetchLatestArticles(
  feedUrl: string,
  maxArticles = 5,
): Promise<ScrapedArticle[]> {
  const feed = await parser.parseURL(feedUrl);

  return feed.items.slice(0, maxArticles).map((item) => ({
    headline: item.title?.trim() ?? 'Untitled',
    body: (item.contentSnippet ?? item.content ?? item.summary ?? '').trim(),
    url: item.link ?? undefined,
  }));
}
