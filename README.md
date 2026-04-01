# Creative Studio

AI-powered creative studio for curriculum content and illustration generation, backed by a RAG (Retrieval-Augmented Generation) pipeline. Built for content teams to query a curriculum knowledge base, generate new lessons, create character illustrations, and adapt content for international markets.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM + pgvector
- **AI Generation**: Claude API (Anthropic) for content generation and review
- **Embeddings**: Gemini Embeddings (primary) / OpenAI Embeddings (legacy)
- **Illustration**: Replicate (Flux LoRA) + Gemini image generation
- **Video**: Remotion (programmatic React video)
- **Voice**: ElevenLabs TTS

## Architecture

```
                    +------------------+
                    |   React Client   |
                    |  (Vite + TW)     |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Express API     |
                    |  (TypeScript)    |
                    +--------+---------+
                             |
            +----------------+----------------+
            |                |                |
   +--------v------+  +-----v------+  +------v-------+
   |  RAG Pipeline  |  | Generation |  | Illustration |
   |               |  |            |  |   Pipeline   |
   +--------+------+  +-----+------+  +--------------+
            |                |
   +--------v------+  +-----v------+
   |  Retrieval    |  |   Claude   |
   |  (pgvector)   |  |    API     |
   +---------------+  +------------+
```

### RAG Pipeline

1. **Ingestion** (`src/ingestion/`): Parses curriculum documents into chunks, generates embeddings via Gemini, stores in PostgreSQL with pgvector.
2. **Retrieval** (`src/retrieval/`): Hybrid search combining semantic (vector similarity), keyword (text matching), and fusion (Reciprocal Rank Fusion) strategies. Includes intent detection for cultural adaptation queries.
3. **Generation** (`src/generation/`): Claude API generates grounded responses with citations, lesson content, story narratives, and cultural adaptations. All responses cite source material.

### Key Features

- **Curriculum RAG Chat**: Ask questions about the curriculum, get grounded answers with citations
- **Lesson Generation**: AI-generated lessons with A/B testing, iterative refinement, and AI review scoring
- **Cultural Adaptation**: Adapt content for 25+ international markets with cached cultural profiles
- **Illustration Pipeline**: Generate and refine character art with LoRA-trained models
- **Character Art**: Gemini-powered character illustration with style bible enforcement
- **Story Writing**: Narrative story generation using curriculum characters and concepts
- **Video Production**: Programmatic video creation with Remotion
- **Conversation History**: Persistent chat with project-scoped conversations

## Getting Started

### Prerequisites

- Node.js 20.x
- PostgreSQL with the `vector` extension (pgvector)
- Google OAuth credentials (for authentication)

### Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your values (DATABASE_URL, Google OAuth, JWT_SECRET are required)

# Set up the database
npx prisma db push
npx prisma generate

# Run development server (client + API)
npm run dev
```

The app runs at `http://localhost:5173` (client) and `http://localhost:3001` (API).

### AI Features (Optional)

AI features degrade gracefully when API keys are not configured:

- **Without ANTHROPIC_API_KEY**: Chat returns a placeholder message; lesson generation returns a mock lesson
- **Without GEMINI_API_KEY**: Embedding functions return zero vectors; illustration generation is disabled
- **Without REPLICATE_API_TOKEN**: LoRA illustration generation is disabled
- **Without ELEVENLABS_API_KEY**: Voice generation is disabled

Set the relevant API keys in `.env` to enable each feature.

## Project Structure

```
src/
  ingestion/       # Document parsing, chunking, embedding
  retrieval/       # Semantic search, keyword search, fusion, intent detection
  generation/      # Claude-powered content generation
    curriculum/    # Lesson generation, review, templates
    illustrations/ # Character art generation and chat
    episode/       # Video episode pipeline
    marketing/     # UGC brief and script generation
  server/          # Express API routes and middleware
    auth/          # Google OAuth + JWT
    routes/        # API endpoints
    middleware/    # Auth guards, rate limiting
  lib/             # Shared utilities (Anthropic, OpenAI, Gemini, Prisma clients)
  data/            # Static reference data
client/            # React frontend
remotion/          # Programmatic video compositions
prisma/            # Database schema and migrations
```

## License

This is a portfolio demonstration project.
