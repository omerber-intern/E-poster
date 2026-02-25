# e-poster

Smart Portfolio Content Publisher for eToro

## Overview

e-poster is a Next.js application that enables posting news content to relevant eToro smart portfolio accounts. The application supports:

- Manual news input
- AI-powered relevance evaluation (using OpenAI)
- Keyword matching for instrument detection
- Configurable post templates
- Review workflow before posting
- Post history tracking

## Features

1. **News Input**: Manual text input/paste for news content
2. **Relevance Evaluation**: Combines AI analysis and keyword matching to find relevant portfolios
3. **Portfolio Discovery**: Automatically discovers and fetches smart portfolio holdings
4. **Post Templates**: Configurable templates with variable substitution
5. **Review Workflow**: Manual review and approval before posting
6. **Post History**: Track all posted content with status

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (create `.env.local`):
```
ETORO_API_KEY=your_api_key
ETORO_USER_KEY=your_user_key
ETORO_BEARER_TOKEN=your_bearer_token (optional)
OPENAI_API_KEY=your_openai_key (optional, for AI analysis)
ETORO_API_BASE_URL=https://www.etoro.com/api/public/v1
```

3. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3601`

## Usage

1. **Input News**: Navigate to `/news-input` and enter your news content
2. **Evaluate**: The system will automatically evaluate which portfolios are relevant
3. **Select Portfolios**: Choose which portfolios to post to
4. **Review**: Review the generated posts and edit if needed
5. **Post**: Enter your eToro user ID and post to selected portfolios

## API Endpoints

- `POST /api/news/evaluate` - Evaluate news relevance
- `GET /api/portfolios` - Get list of smart portfolios
- `POST /api/posts/create` - Create a post via eToro API
- `GET /api/posts/history` - Get post history
- `GET /api/templates` - Get templates
- `POST /api/templates` - Create template
- `PUT /api/templates` - Update template
- `DELETE /api/templates` - Delete template

## Architecture

- **Services**: Core business logic in `src/lib/services/`
- **Models**: TypeScript models in `src/lib/models/`
- **API Routes**: Next.js API routes in `src/app/api/`
- **Components**: React components in `src/components/`
- **Pages**: Next.js pages in `src/app/`

## Notes

- The application uses the eToro API endpoint: `POST /api/v1/feeds/post`
- Authentication requires `x-api-key` and `x-user-key` headers
- Each request requires a unique `x-request-id` (UUID v4)
- Posts can include instrument tags and mentions
- The owner user ID must be provided when posting

