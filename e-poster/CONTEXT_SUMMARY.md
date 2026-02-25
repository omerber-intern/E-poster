# E-Poster Project — Context Summary for New Chat

Use this file to bootstrap a new Cursor context window. Paste the text below into the new chat.

---

## Prompt to paste into the new chat

```
I'm continuing work on the e-poster project. Please read CONTEXT_SUMMARY.md at the project root for full context on what has been built so far, the architecture, and what remains to be done. The workspace is at:

c:\Users\omerber\Desktop\coding projects\e-poster\e-poster
```

---

## Project Overview

**e-poster** is a Next.js 15 (App Router, Turbopack) application that manages content publishing for 15 eToro Alpha portfolios. It uses **Claude AI (Anthropic)** to analyze news impact on portfolios and generate posts. The dev server runs on port 3001.

### Tech Stack
- Next.js 15.2.4, React 19, TypeScript
- Tailwind CSS 4, shadcn/ui (new-york style)
- Anthropic SDK (`@anthropic-ai/sdk`) for Claude AI
- react-hot-toast, lucide-react, zod, react-hook-form

---

## Architecture

### Two User Flows

**Flow 1 — News Post:**
1. User enters news (headline, body, URL) at `/e-poster/news-input`
2. System calls Claude to analyze impact on all 15 portfolios (`POST /api/news/evaluate`)
3. Evaluate page shows per-portfolio impact %, affected tickers ($TICKER format), reasoning
4. User selects portfolios → Review page generates post content via Claude (`POST /api/posts/generate`)
5. User edits content → Posts via eToro API (`POST /api/posts/create`)

**Flow 2 — Educational Content:**
1. User selects portfolios at `/e-poster/educational` (search bar, check/uncheck all)
2. Optionally adds context about desired content type
3. System generates educational content via Claude (`POST /api/educational/generate`)
4. User reviews/edits at `/e-poster/educational/review` → Posts via eToro API

### Data Layer
- Portfolio holdings cached in `data/portfolios.json` (synced via `POST /api/sync?type=portfolios`)
- Portfolio bios cached in `data/bios.json` (synced via `POST /api/sync?type=bios`)
- Sync fetches from eToro endpoints: `GET /api/v1/user-info/people?usernames=X` and `GET /api/v1/trading/info/portfolio?usernames=X`
- All GET requests use Short-Tech's API credentials
- POST requests (publishing) use per-portfolio credentials from `PORTFOLIO_CREDENTIALS` env var (JSON map)

### 15 Alpha Portfolios
Short-Tech, PureMomentum, PureGrowth, Momentum-LS, MarketPicks, BalancedPicks, OutSmartNSDQ, ProPicks, GainersQtr, ActiveTraders, SharpTraders, SectorNeutral, Pure-Value, SectorGurus, NasdaqAI-Inverse

Currently only **Short-Tech** has posting credentials. Other portfolios show a **red disabled "Cannot Post — No API Key" button**.

---

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── educational/generate/route.ts   — POST: generate educational content
│   │   ├── instruments/route.ts            — GET: fetch instrument metadata
│   │   ├── news/evaluate/route.ts          — POST: Claude impact analysis
│   │   ├── portfolios/route.ts             — GET: cached portfolio data
│   │   ├── posts/create/route.ts           — POST: publish to eToro
│   │   ├── posts/generate/route.ts         — POST: Claude post generation
│   │   ├── posts/history/route.ts          — GET/POST: post history
│   │   └── sync/route.ts                   — POST: sync portfolios/bios from eToro
│   ├── e-poster/
│   │   ├── page.tsx                        — Dashboard (News Post + Educational + Sync)
│   │   ├── news-input/page.tsx             — News input form
│   │   ├── evaluate/page.tsx               — Impact analysis results
│   │   ├── review/page.tsx                 — Edit & post news content
│   │   ├── educational/page.tsx            — Portfolio selection for edu content
│   │   ├── educational/review/page.tsx     — Edit & post educational content
│   │   └── history/page.tsx                — Post history
│   ├── layout.tsx, page.tsx (root redirect), globals.css
├── components/
│   ├── news-input/NewsInputForm.tsx
│   └── ui/ (button, card, input, label, textarea)
├── lib/
│   ├── config/portfolios.ts                — Master list of 15 portfolio usernames
│   ├── etoro-api-config.ts                 — API base URL, headers, credentials lookup
│   ├── models/
│   │   ├── news.ts, portfolio.ts, post.ts, template.ts
│   ├── services/
│   │   ├── ai-service.ts                   — Claude: analyzeNewsImpact, generatePostContent, generateEducationalContent
│   │   ├── portfolio-service.ts            — Sync + cache read/write for portfolios & bios
│   │   ├── post-service.ts                 — createDiscussionPost with per-portfolio creds
│   │   ├── template-service.ts             — renderNewsPost, renderEducationalPost
│   │   ├── news-service.ts                 — (legacy, unused)
│   │   └── relevance-service.ts            — (legacy, unused)
│   └── utils/
│       ├── ai-analyzer.ts                  — (legacy OpenAI analyzer, unused)
│       ├── instrument-helper.ts            — Fetch instrument names/symbols from eToro
│       ├── keyword-matcher.ts              — (legacy, unused)
│       └── utils.ts                        — cn() utility
data/
├── portfolios.json                         — Cached portfolio holdings (synced from eToro)
└── bios.json                               — Cached portfolio bios (synced from eToro)
```

---

## Environment Variables (`.env.local`)

```
ETORO_API_KEY=...           # Short-Tech x-api-key (used for all GET requests)
ETORO_USER_KEY=...          # Short-Tech user-api-key
ETORO_API_BASE_URL=https://public-api.etoro.com
PORTFOLIO_CREDENTIALS={"Short-Tech":{"apiKey":"...","userKey":"...","gcid":"6517035"}}
ANTHROPIC_API_KEY=...       # Claude API key
```

---

## Key Implementation Details

1. **eToro API quirks:**
   - `x-request-id` header must be a valid UUID (`globalThis.crypto.randomUUID()`)
   - Instrument IDs in query params must NOT have URL-encoded commas (use raw string concatenation, not URLSearchParams)
   - User info response: `{ users: [{ gcid, username, aboutMe, userBio, ... }] }`
   - Portfolio response: `{ clientPortfolio: { positions: [{ instrumentID, isBuy, leverage, amount, ... }] } }`
   - Instruments response: `{ instrumentDisplayDatas: [{ instrumentID, symbolFull, instrumentDisplayName }] }`

2. **Claude AI model:** `claude-sonnet-4-20250514` (set in `ai-service.ts`)

3. **Portfolio holdings include:** symbol, instrumentName, allocation %, positionType (Long/Short), leverage

4. **Session flow:** News input → sessionStorage → Evaluate → sessionStorage → Review. Educational flow uses similar pattern.

5. **Node.js path issue:** `npm` is not in the default shell PATH. Must prepend: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`

---

## What Remains / Next Steps

1. **Disclaimers:** The template system has `{DISCLAIMER}` placeholder ready. Asset-type-specific disclaimer text needs to be provided and integrated.

2. **Legacy cleanup:** These files are unused and can be deleted:
   - `src/lib/services/relevance-service.ts`
   - `src/lib/services/news-service.ts`
   - `src/lib/utils/ai-analyzer.ts`
   - `src/lib/utils/keyword-matcher.ts`
   - `src/app/e-poster/test-api/page.tsx`

3. **Per-portfolio credentials:** Currently only Short-Tech has posting credentials. As other portfolio API keys are provided, add them to `PORTFOLIO_CREDENTIALS` in `.env.local`.

4. **Cron job for daily sync:** The `POST /api/sync` endpoint exists. An external cron/scheduler (e.g., Windows Task Scheduler, Vercel cron) needs to be configured to call it daily.

5. **Example posts:** The `generatePostContent()` function accepts `examplePosts?: string[]` parameter. Providing real example posts will improve output quality.

6. **Post history:** The history page (`/e-poster/history`) and API route exist but use in-memory storage. Could be connected to a database or file-based storage.
