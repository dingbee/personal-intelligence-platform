# Second Brain

An AI-native personal knowledge platform — collect, understand, organize, and
interact with your knowledge. Not a document viewer, not a chat wrapper: an
AI research and study companion grounded in your own content (RAG, not model
memory).

## Stack

- React + Vite + TypeScript (strict mode) + Tailwind CSS
- TanStack Query for server-state (data fetching/caching/mutations)
- Supabase (Postgres, Auth, Storage, pgvector)
- Model-agnostic AI layer (OpenAI / Anthropic / Gemini), added from Milestone 4 onward

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

Apply `supabase/migrations/` to your Supabase project, in order (via the
Supabase CLI or the SQL editor), before signing up:

- `0001_init.sql` — `profiles` table + auto-provisioning trigger, required
  for auth to work end to end.
- `0002_library.sql` — `collections`, `documents`, `tags`, `document_tags`,
  and the private `documents` Storage bucket, required for the library.

## Folder boundaries

```
src/
  app/            Root component, router, app-wide providers
  modules/        One folder per product surface — feature code lives here
    auth/         Auth context, hooks, guarded routes, auth pages
    library/      Document library: upload, collections/folders, tags, search-by-title
    notes/        Rich notes (later milestone)
    search/       Semantic search (later milestone)
    ai/
      chat/       Chat UI
      orchestration/  Prompt construction, provider selection, retrieval glue
      providers/  Pluggable OpenAI / Anthropic / Gemini adapters
      embeddings/ Embedding generation for chunks and notes
      retrieval/  Vector similarity search + context assembly
    settings/     Account settings
  shared/         Cross-module code
    components/
      layout/     App shell, sidebar, top bar
      ui/         Small reusable primitives (Button, Input, Spinner, EmptyState)
    lib/          Supabase client, other infra clients
    types/        Shared TypeScript types (e.g. generated DB types)
supabase/
  migrations/     SQL migrations, applied in order
```

Each `modules/*` folder owns its own pages/components/hooks. `shared/` never
imports from `modules/`. `ai/` submodules stay independent of each other —
`orchestration` composes `providers`, `embeddings`, and `retrieval`, not the
other way around — so providers or retrieval strategies can be swapped
without touching the chat UI.

## Roadmap

1. Project foundation and authentication
2. **Knowledge library and document management** ← current milestone
3. Document processing and indexing
4. AI chat with RAG
5. Semantic search
6. EPUB reading workspace
7. Notes and knowledge linking
8. Personal memory and AI personalization
9. Knowledge graph
10. AI agents and advanced workflows

Each milestone should land as a stable, production-quality increment —
prioritize clean architecture and extensibility over speed.
