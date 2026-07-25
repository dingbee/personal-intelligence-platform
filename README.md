# Second Brain

An AI-native personal intelligence platform — collect, understand, organize,
and interact with your knowledge. Not a document viewer, not a chat wrapper:
an AI research and study companion grounded in your own content (RAG, not
model memory), built to grow into domain-specific use cases (education,
writing, research, ...) without rearchitecting the core. See "Platform
architecture" below.

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
- `0003_processing.sql` — `processing_jobs`, `extraction_metadata`,
  `document_chunks`, `embeddings` (pgvector, placeholder-dimension 1536),
  and the `match_document_chunks` similarity search function.
- `0004_workspaces.sql` — `workspaces` table, plus a nullable `workspace_id`
  on `documents` and `collections`. Nullable by design: existing rows keep
  `workspace_id = null` and still show up in the "All workspaces" view —
  no backfill needed.

Document processing (extraction/chunking/embedding) runs client-side in the
browser after upload — there's no server/edge function yet, so it only runs
while the uploading tab is open. Moving it to a Supabase Edge Function is a
natural follow-up once there's a reason to (e.g. very large files, or
processing that should survive the tab closing); the `DocumentProcessor` /
`Chunker` / `EmbeddingProvider` / `VectorStore` interfaces don't change
either way.

## Folder boundaries

```
src/
  app/            Root component, router, app-wide providers
  modules/        One folder per product surface — feature code lives here
    auth/         Auth context, hooks, guarded routes, auth pages
    library/      Document library: upload, collections/folders, tags, search-by-title
    processing/   Document processing pipeline (extract → chunk → embed → index)
      extractors/ Per-file-type DocumentProcessor implementations (pdf/epub/docx/txt/markdown)
      chunking/   Chunker strategies (fixed-length, paragraph, chapter-aware; semantic stubbed)
      pipeline/   Orchestrates extract → chunk → store → embed → index for one document
      api/        Supabase queries for processing_jobs, extraction_metadata, document_chunks
    reader/       Basic EPUB reader (chapter nav, typography, local reading progress)
    notes/        Rich notes (later milestone)
    search/       Semantic search (later milestone)
    ai/
      chat/       Chat UI
      orchestration/  Prompt construction, provider selection, retrieval glue (later milestone)
      providers/  Pluggable OpenAI / Anthropic / Gemini adapters (later milestone)
      embeddings/ EmbeddingProvider interface + placeholder implementation
      retrieval/  VectorStore interface + pgvector-backed implementation
    workspaces/   Workspace switcher/context — the primary organizational unit
    core/         Platform extensibility: capability/prompt/provider/workflow
                  registries + the module-registration mechanism (see below)
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

## Platform architecture

Milestone 3.5 introduced two extensibility points, ahead of RAG/AI-chat
(Milestone 4) on purpose — retrofitting them after multiple AI features
existed would have been far more expensive than seeding them now, before
anything depends on their absence.

**Workspaces** (`modules/workspaces/`) are the primary organizational unit —
"Biology 101", "My Book", "Thesis" — each scoping its own documents and
collections. Fully backward compatible: `workspace_id` is nullable, and the
default "All workspaces" view (no workspace selected) shows every
document/collection exactly as it did before workspaces existed. Selecting
a workspace scopes uploads, collection creation, and the library view to it;
nothing else in the library changed to support this — the scoping happens
inside the data hooks (`useDocuments`, `useCollections`,
`useDocumentMutations`), not in the pages that call them.

**Platform modules** (`modules/core/`) let domain-specific features
(Education, Writing, Research, News, Business, ...) register AI
capabilities, prompt templates, provider descriptors, and workflows without
modifying core code. Four registries (capabilities/prompts/providers/
workflows), one generic `createRegistry<T>()` implementation behind all of
them, and a single `registerPlatformModule()` entry point that a domain
module calls once. The built-in `coreModule.ts` (generic capabilities like
Summarize/Quiz/Flashcards, and provider descriptors for Claude/GPT/Gemini/
Ollama/OpenRouter/Azure) exists specifically as the worked example for
what a future domain module looks like — see `modules/core/README.md`.

This milestone deliberately stops at the extension points: no capability
executes anything, no domain module is implemented, and no AI provider is
wired up yet (that's Milestone 4). The registries exist so that when
execution does land, it resolves capability → prompt → provider, rather
than branching on document type or feature name.

## Roadmap

1. Project foundation and authentication
2. Knowledge library and document management
3. Document processing and indexing (includes a basic EPUB reader)
3.5. **Platform architecture** ← current milestone — Workspaces, module/capability/prompt/provider registries
4. AI chat with RAG
5. Semantic search
6. EPUB reading workspace (AI chat/summary/flashcards/quiz per book)
7. Notes and knowledge linking
8. Personal memory and AI personalization
9. Knowledge graph
10. AI agents and advanced workflows

Each milestone should land as a stable, production-quality increment —
prioritize clean architecture and extensibility over speed.
