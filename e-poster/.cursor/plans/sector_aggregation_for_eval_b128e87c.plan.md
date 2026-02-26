---
name: Sector aggregation for eval
overview: Aggregate portfolio positions by instrument (merging duplicates) during sync, classify each holding using a user-provided taxonomy file, and rewrite the AI evaluation prompt to use industry breakdown + top 10 holdings instead of listing every position.
todos:
  - id: merge-positions
    content: Merge positions by instrumentId during sync (sum allocations, keep Long/Short separate)
    status: pending
  - id: add-taxonomy
    content: Load the user-provided taxonomy JSON file and build a lookup from stocksIndustryId to industry name
    status: pending
  - id: capture-industry-id
    content: Extract stocksIndustryId from the instruments API response in instrument-helper.ts
    status: pending
  - id: store-sector
    content: Add sector/industry field to PortfolioHolding model and populate it during sync using the taxonomy lookup
    status: pending
  - id: rewrite-prompt
    content: Rewrite holdingsSummary() in ai-service.ts to output industry allocation + top 10 holdings
    status: pending
  - id: test-sync-and-eval
    content: Run sync then evaluate to verify all 15 portfolios are evaluated successfully
    status: pending
isProject: false
---

# Sector Aggregation for Portfolio Evaluation

## Problem

Portfolios now have real data with up to 1,170 positions (BalancedPicks). The `holdingsSummary()` function sends every position as a line to Claude, causing 13 out of 15 portfolios to fail evaluation (likely token limit or timeout). Additionally, many portfolios have duplicate positions for the same instrument.

## Solution

Three changes across sync and evaluation:

### 1. Merge positions by instrument at sync time

In [portfolio-service.ts](e-poster/src/lib/services/portfolio-service.ts), after fetching positions, aggregate by `instrumentId`:

- Sum `investmentPct` for positions of the same instrument
- If the same instrument has both Long and Short positions, keep them separate (different `positionType`)
- Drop `positionId` from the merged holding (it no longer maps 1:1)

This reduces position counts significantly (e.g., Momentum-LS: 208 -> 51, ActiveTraders: 391 -> 154).

### 2. Classify holdings by industry using a taxonomy file

**Source of industry data:**
- The eToro instruments API (`/api/v1/market-data/instruments?instrumentIds=...`) returns a `stocksIndustryId` (integer) per instrument in the `instrumentDisplayDatas` array.
- The user will provide a **taxonomy JSON file** that maps each `stocksIndustryId` to an industry name. This file will be placed at `e-poster/data/taxonomy.json`.
- This replaces the need to call the `/api/v1/market-data/stocks-industries` API at runtime.

**Expected taxonomy file format** (user will provide):
```json
{
  "industries": [
    { "stocksIndustryId": 1, "industryName": "Technology" },
    { "stocksIndustryId": 2, "industryName": "Healthcare" },
    ...
  ]
}
```

**Step A** — Extract `stocksIndustryId` from the instruments API response.

In [instrument-helper.ts](e-poster/src/lib/utils/instrument-helper.ts), update `InstrumentInfo` to capture it:

```typescript
export interface InstrumentInfo {
  instrumentId: number;
  name: string;
  symbol: string;
  stocksIndustryId?: number;
}
```

Update the parsing in `getInstrumentsByIds()` to read `inst.stocksIndustryId` from the API response and store it in the map.

**Step B** — Load the taxonomy file and build a lookup.

Add a helper (e.g., in `instrument-helper.ts` or a new `taxonomy-helper.ts`) that reads `data/taxonomy.json` and returns a `Map<number, string>` from `stocksIndustryId` to `industryName`.

**Step C** — Store industry on each holding.

Add `sector?: string` to `PortfolioHolding` in [portfolio.ts](e-poster/src/lib/models/portfolio.ts).

In [portfolio-service.ts](e-poster/src/lib/services/portfolio-service.ts) `syncPortfolioData()`, after resolving instruments:
1. Collect all unique `stocksIndustryId` values from the instrument map
2. Look them up in the taxonomy map
3. Set `sector` on each merged holding

### 3. Rewrite the AI evaluation prompt

In [ai-service.ts](e-poster/src/lib/services/ai-service.ts), replace `holdingsSummary()` with a compact format:

```
SECTOR ALLOCATION:
Technology: 35.2% (12 holdings)
Healthcare: 18.1% (8 holdings)
Financials: 12.4% (6 holdings)
...

TOP 10 HOLDINGS:
$AAPL — 8.2% Long (Technology)
$NVDA — 6.1% Long (Technology)
$JPM — 4.5% Long (Financials)
...
```

Update the system prompt to tell Claude it's receiving sector allocation + top holdings instead of full position lists. Claude should evaluate relevance based on sector exposure and the specific top holdings.

The relevance scoring logic (lines 140-169) stays the same — Claude returns affected assets, and we look up their allocation from the actual holdings data.

## Files to change

- [e-poster/data/taxonomy.json](e-poster/data/taxonomy.json) — **user-provided** taxonomy file mapping `stocksIndustryId` -> `industryName`
- [e-poster/src/lib/models/portfolio.ts](e-poster/src/lib/models/portfolio.ts) — add `sector?: string` to `PortfolioHolding`
- [e-poster/src/lib/utils/instrument-helper.ts](e-poster/src/lib/utils/instrument-helper.ts) — capture `stocksIndustryId` from API, add taxonomy loader
- [e-poster/src/lib/services/portfolio-service.ts](e-poster/src/lib/services/portfolio-service.ts) — merge positions by instrument, look up industry from taxonomy, store sector on holdings
- [e-poster/src/lib/services/ai-service.ts](e-poster/src/lib/services/ai-service.ts) — rewrite `holdingsSummary()` to produce industry breakdown + top 10, update prompt

## Key context for another agent

- **Branch**: `portfolio-evaluation` (branched from `portfolio-data-fix` which is branched from `main`)
- **Workspace**: `c:\Users\omerber\Desktop\coding projects\e-poster\e-poster`
- **Tech stack**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Dev server**: runs on port 3001 (`npm run dev`)
- **Sync trigger**: `POST http://localhost:3001/api/sync?type=portfolios` refreshes all portfolio data
- **Evaluate trigger**: `POST http://localhost:3001/api/news/evaluate` with body `{ headline, body }` runs AI evaluation

### Current data flow

```
Portfolio API (/api/v1/user-info/people/{username}/portfolio/live)
  → positions[] with instrumentId, investmentPct, isBuy, leverage, positionId
  
Instruments API (/api/v1/market-data/instruments?instrumentIds=...)
  → instrumentDisplayDatas[] with instrumentID, instrumentDisplayName, symbolFull, stocksIndustryId

Taxonomy file (data/taxonomy.json) — user-provided
  → maps stocksIndustryId → industryName

syncPortfolioData() in portfolio-service.ts
  → fetches positions for all 15 portfolios in ALPHA_PORTFOLIOS
  → resolves instrument names/symbols via getInstrumentsByIds() (batched, 50 per request)
  → builds PortfolioHolding[] and writes to data/portfolios.json

analyzeNewsImpact() in ai-service.ts
  → sends holdings to Claude for relevance scoring
  → holdingsSummary() currently lists ALL positions (causes failures for large portfolios)
  → needs to be rewritten to send industry breakdown + top 10 holdings
```

### Key portfolio sizes (positions → unique instruments)

- Short-Tech: 8 → 8
- PureMomentum: 54 → 49
- PureGrowth: 46 → 32
- Momentum-LS: 208 → 51
- MarketPicks: 476 → 249
- BalancedPicks: 1170 → 653
- OutSmartNSDQ: 138 → 80
- ProPicks: 258 → 158
- GainersQtr: 266 → 187
- ActiveTraders: 391 → 154
- SharpTraders: 259 → 177
- SectorNeutral: 72 → 57
- Pure-Value: 128 → 100
- SectorGurus: 78 → 67
- NasdaqAI-Inverse: 63 → 48

### eToro API auth (for all GET requests)

Headers: `x-api-key` (env: ETORO_API_KEY), `x-user-key` (env: ETORO_USER_KEY), `x-request-id` (random UUID). Configured in `getBaseHeaders()` in `etoro-api-config.ts`.
