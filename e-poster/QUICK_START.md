# e-poster Quick Start Guide

## Setup

1. **Install Dependencies**
   ```bash
   cd e-poster
   npm install
   ```

2. **Configure Environment Variables**
   
   Create a `.env.local` file in the `e-poster/` directory:
   ```
   ETORO_API_KEY=your_etoro_api_key
   ETORO_USER_KEY=your_etoro_user_key
   ETORO_BEARER_TOKEN=your_bearer_token (optional)
   OPENAI_API_KEY=your_openai_key (optional, for AI analysis)
   ETORO_API_BASE_URL=https://www.etoro.com/api/public/v1
   ```

3. **Run the Application**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:3601`

## Usage Workflow

### Step 1: Input News
- Navigate to the dashboard
- Click "Input News"
- Enter headline and body content
- Optionally add source and URL
- Click "Continue to Evaluation"

### Step 2: Evaluate Relevance
- The system automatically evaluates which smart portfolios are relevant
- Uses AI analysis (if OpenAI key is configured) and keyword matching
- View relevance scores and matched instruments
- Select portfolios you want to post to
- Click "Continue to Review"

### Step 3: Review & Post
- Review the generated post content for each selected portfolio
- Edit post content if needed
- Enter your eToro user ID (the account that will post)
- Click "Post" for each portfolio
- Posts are created via eToro API and saved to history

### Step 4: View History
- Navigate to "Post History" to see all posted content
- View status (posted, failed, pending)
- See timestamps and error messages if any

## API Endpoints

- `POST /api/news/evaluate` - Evaluate news relevance to portfolios
- `GET /api/portfolios` - Get list of smart portfolios
- `POST /api/posts/create` - Create a post via eToro API
- `GET /api/posts/history` - Get post history
- `GET /api/templates` - Get post templates
- `POST /api/templates` - Create a template
- `PUT /api/templates` - Update a template
- `DELETE /api/templates` - Delete a template

## Known Smart Portfolios

The application is pre-configured with these smart portfolio usernames:
- SectorNeutral
- SectorGurus
- Momentum L-S
- PureMomentum
- NasdaqAI-Edge
- NasdaqAI-Inverse

You can modify the list in `src/lib/services/portfolio-service.ts`

## Notes

- All API calls to eToro are made server-side to avoid CORS issues
- Posts require a valid eToro user ID (owner)
- Instrument tags are automatically added based on matched instruments
- Post history is stored in-memory (will be lost on server restart)
- For production, consider using a database for post history

