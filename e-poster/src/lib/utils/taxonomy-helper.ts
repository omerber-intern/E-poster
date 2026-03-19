/**
 * Taxonomy Helper
 *
 * Resolves each portfolio holding's industry breakdown using a three-tier lookup:
 *   1. data/taxonomy.json      — user-supplied, covers ~83% of symbols directly
 *   2. data/unmapped-industries.json — persisted LLM classifications from prior syncs
 *   3. Haiku batch classification  — for any symbols still not resolved
 *
 * Weight conversion: taxonomy uses bucket ranges (e.g. "20-40%").
 * We convert to midpoints then normalize per symbol so weights sum to 100.
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import type { IndustryBreakdown } from '../models/portfolio';

const DATA_DIR = path.join(process.cwd(), 'data');
const TAXONOMY_FILE = path.join(DATA_DIR, 'taxonomy.json');
const UNMAPPED_FILE = path.join(DATA_DIR, 'unmapped-industries.json');

const BUCKET_MIDPOINTS: Record<string, number> = {
  '0-10%': 5,
  '10-20%': 15,
  '20-40%': 30,
  '40-60%': 50,
  '60-80%': 70,
  '80-100%': 90,
};

interface TaxonomyRow {
  instrumentId: number;
  symbol: string;
  instrumentName: string;
  majorCategory: string;
  subcategory: string;
  topic: string;
  weightBucket: string;
  reason: string;
}

// Module-level caches — populated once per process lifetime
let taxonomyCache: Map<string, IndustryBreakdown[]> | null = null;
let unmappedCache: Map<string, IndustryBreakdown[]> | null = null;

// ---------------------------------------------------------------------------
// Taxonomy file loader
// ---------------------------------------------------------------------------

export function loadTaxonomy(): Map<string, IndustryBreakdown[]> {
  if (taxonomyCache) return taxonomyCache;

  const raw = fs.readFileSync(TAXONOMY_FILE, 'utf-8');
  const rows: TaxonomyRow[] = JSON.parse(raw);

  const grouped = new Map<string, TaxonomyRow[]>();
  for (const row of rows) {
    if (!grouped.has(row.symbol)) grouped.set(row.symbol, []);
    grouped.get(row.symbol)!.push(row);
  }

  const result = new Map<string, IndustryBreakdown[]>();
  for (const [symbol, entries] of grouped) {
    const withMidpoints = entries.map((e) => ({
      ...e,
      midpoint: BUCKET_MIDPOINTS[e.weightBucket] ?? 5,
    }));
    const sum = withMidpoints.reduce((acc, e) => acc + e.midpoint, 0);
    if (sum === 0) continue;

    const breakdown: IndustryBreakdown[] = withMidpoints.map((e) => ({
      topic: e.topic,
      subcategory: e.subcategory,
      majorCategory: e.majorCategory,
      weight: Math.round((e.midpoint / sum) * 10000) / 100,
    }));
    result.set(symbol, breakdown);
  }

  taxonomyCache = result;
  return result;
}

// ---------------------------------------------------------------------------
// Unmapped industries cache (LLM-classified, persisted across syncs)
// ---------------------------------------------------------------------------

export function loadUnmappedIndustries(): Map<string, IndustryBreakdown[]> {
  if (unmappedCache) return unmappedCache;

  try {
    const raw = fs.readFileSync(UNMAPPED_FILE, 'utf-8');
    const obj = JSON.parse(raw) as Record<string, IndustryBreakdown[]>;
    unmappedCache = new Map(Object.entries(obj));
  } catch {
    unmappedCache = new Map();
  }
  return unmappedCache;
}

export function saveUnmappedIndustries(
  map: Map<string, IndustryBreakdown[]>,
): void {
  const obj: Record<string, IndustryBreakdown[]> = {};
  for (const [symbol, breakdown] of map) {
    obj[symbol] = breakdown;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(UNMAPPED_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  unmappedCache = map;
}

// ---------------------------------------------------------------------------
// Single-symbol lookup (taxonomy -> unmapped cache)
// ---------------------------------------------------------------------------

export function resolveIndustries(
  symbol: string,
): IndustryBreakdown[] | undefined {
  const taxonomy = loadTaxonomy();
  if (taxonomy.has(symbol)) return taxonomy.get(symbol);

  const unmapped = loadUnmappedIndustries();
  if (unmapped.has(symbol)) return unmapped.get(symbol);

  return undefined;
}

// ---------------------------------------------------------------------------
// Haiku batch classification for truly unmapped symbols
// ---------------------------------------------------------------------------

const CLASSIFY_BATCH_SIZE = 15;

async function classifyBatch(
  client: Anthropic,
  batch: Array<{ symbol: string; name: string }>,
): Promise<Map<string, IndustryBreakdown[]>> {
  const assetsList = batch
    .map((a, i) => `${i + 1}. Symbol: ${a.symbol}, Name: ${a.name}`)
    .join('\n');

  const prompt = `Classify each asset below by its revenue streams into specific industry topics.

Use these major categories:
- "Tech & Data"
- "Consumer & Commerce"
- "Financial Services & Fintech"
- "Health & Life Sciences"
- "Energy & Utilities"
- "Industrials, Transport & Infrastructure"
- "Materials, Real Assets & Commodities"
- "Crypto & Digital Assets"
- "Multi-Asset, Indices & Strategies"

ASSETS TO CLASSIFY:
${assetsList}

Respond ONLY with valid JSON array. Each weight must be a number 0-100, and all weights for a single symbol must sum to exactly 100:
[
  {
    "symbol": "<SYMBOL>",
    "industries": [
      {
        "topic": "<specific topic name>",
        "subcategory": "<subcategory>",
        "majorCategory": "<one of the major categories above>",
        "weight": <number 0-100>
      }
    ]
  }
]`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 3000,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return new Map();

  let parsed: Array<{ symbol: string; industries: IndustryBreakdown[] }>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return new Map();
  }

  const result = new Map<string, IndustryBreakdown[]>();
  for (const item of parsed) {
    if (item.symbol && Array.isArray(item.industries) && item.industries.length > 0) {
      result.set(item.symbol, item.industries);
    }
  }
  return result;
}

export async function classifyUnmappedAssets(
  assets: Array<{ symbol: string; name: string }>,
): Promise<Map<string, IndustryBreakdown[]>> {
  if (assets.length === 0) return new Map();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[taxonomy-helper] ANTHROPIC_API_KEY is not set — skipping LLM classification for', assets.length, 'symbols');
    return new Map();
  }

  const client = new Anthropic({ apiKey });

  // Split into batches to avoid token truncation, fire all in parallel
  const batches: Array<Array<{ symbol: string; name: string }>> = [];
  for (let i = 0; i < assets.length; i += CLASSIFY_BATCH_SIZE) {
    batches.push(assets.slice(i, i + CLASSIFY_BATCH_SIZE));
  }

  try {
    const batchResults = await Promise.all(
      batches.map((batch) => classifyBatch(client, batch)),
    );

    const result = new Map<string, IndustryBreakdown[]>();
    for (const batchMap of batchResults) {
      for (const [symbol, breakdown] of batchMap) {
        result.set(symbol, breakdown);
      }
    }

    return result;
  } catch (err) {
    console.warn('[taxonomy-helper] Anthropic classification failed — skipping for', assets.length, 'symbols. Error:', err instanceof Error ? err.message : String(err));
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Batch resolve for all holdings across all portfolios
// ---------------------------------------------------------------------------

export async function resolveAllIndustries(
  holdings: Array<{ symbol: string; name: string }>,
): Promise<Map<string, IndustryBreakdown[]>> {
  const result = new Map<string, IndustryBreakdown[]>();
  const toClassify: Array<{ symbol: string; name: string }> = [];

  // Deduplicate — process each unique symbol once
  const seen = new Set<string>();
  for (const holding of holdings) {
    if (seen.has(holding.symbol)) continue;
    seen.add(holding.symbol);

    const resolved = resolveIndustries(holding.symbol);
    if (resolved) {
      result.set(holding.symbol, resolved);
    } else {
      toClassify.push(holding);
    }
  }

  if (toClassify.length > 0) {
    console.log(
      `[taxonomy-helper] Classifying ${toClassify.length} unmapped symbols via Haiku...`,
    );
    const classified = await classifyUnmappedAssets(toClassify);
    const unmapped = loadUnmappedIndustries();

    for (const [symbol, breakdown] of classified) {
      result.set(symbol, breakdown);
      unmapped.set(symbol, breakdown);
    }
    saveUnmappedIndustries(unmapped);
    console.log(
      `[taxonomy-helper] Saved ${classified.size} new classifications to unmapped-industries.json`,
    );
  }

  return result;
}
