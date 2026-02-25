# e-poster — Smart Portfolio Content Publisher

e-poster is an internal tool built for publishing news-driven content to eToro smart portfolio feeds. It connects financial news to the portfolios most affected by that news, generates post drafts, and publishes them via the eToro API.

## Tech Stack

The app is built with **Next.js 15** (App Router, Turbopack), **React 19**, and **TypeScript**. Styling uses **Tailwind CSS 4** with **Radix UI** primitives for accessible components (dialogs, tooltips, selects, etc.). Forms are handled with **react-hook-form** + **zod** validation, and toast notifications come from **react-hot-toast**.

## Core Workflow

The application follows a four-step pipeline:

1. **Input News** (`/e-poster/news-input`) — The user pastes a news headline and body (optionally a source and URL). The content is validated (headline max 500 chars, body max 5000) and stored in the browser's `sessionStorage`.

2. **Evaluate Relevance** (`/e-poster/evaluate`) — The app sends the news to `POST /api/news/evaluate`. On the server, the relevance service fetches holdings for a predefined list of smart portfolio accounts from the eToro API, then scores each portfolio against the news. Scoring uses **keyword matching** (exact ticker symbols and company name fragments) and, when an `OPENAI_API_KEY` is configured, **AI analysis** via GPT-4o-mini that extracts mentioned instruments, themes, and sentiment. Portfolios scoring above a threshold are returned with per-instrument confidence values. The user selects which portfolios to target.

3. **Review & Post** (`/e-poster/review`) — For each selected portfolio the app generates a draft containing the headline, body, and matched instrument tags. The user can edit the text, then publishes by providing their eToro user ID. Publishing calls `POST /api/posts/create`, which forwards the payload to eToro's feed post endpoint with the required `x-api-key` and `x-user-key` headers.

4. **History** (`/e-poster/history`) — Lists previously published posts with status indicators (posted, failed, pending). History is currently stored in-memory on the server.

## API Layer

Six Next.js route handlers sit under `src/app/api/`:

- **`/api/news/evaluate`** — relevance scoring
- **`/api/portfolios`** — fetch smart portfolio holdings from eToro
- **`/api/instruments`** — look up instrument metadata by ID
- **`/api/posts/create`** — publish a post to eToro's feed
- **`/api/posts/history`** — read/write post history (in-memory)
- **`/api/templates`** — CRUD for post templates with variable substitution

## Configuration

The app requires `ETORO_API_KEY` and `ETORO_USER_KEY` environment variables for all eToro calls. `ETORO_BEARER_TOKEN` and `OPENAI_API_KEY` are optional. The dev server runs on port 3001.
