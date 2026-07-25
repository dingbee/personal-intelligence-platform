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
- Supabase (Postgres, Auth, Storage, pgvector, Edge Functions)
- Model-agnostic AI layer: Anthropic (Claude), OpenAI (GPT), Google (Gemini) for chat; OpenAI for embeddings

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
- `0005_ai_chat.sql` — `conversations`, `messages`, and an updated
  `match_document_chunks` that can optionally scope similarity search to one
  document (for "chat about this book" instead of the whole library).

Document processing (extraction/chunking/embedding) runs client-side in the
browser after upload — there's no background worker yet, so it only runs
while the uploading tab is open. Moving it server-side (e.g. into the
`ai-chat` edge function, or its own) is a natural follow-up once there's a
reason to (very large files, processing that should survive the tab
closing); the `DocumentProcessor` / `Chunker` / `EmbeddingProvider` /
`VectorStore` interfaces don't change either way.

### AI provider setup (required for chat and embeddings to work)

Real API keys must never live in client code — anything prefixed `VITE_` in
a Vite app is bundled straight into the browser and is publicly visible.
All provider calls go through a Supabase Edge Function
(`supabase/functions/ai-chat`) that holds the keys server-side:

```bash
supabase functions deploy ai-chat
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-...       # also used for embeddings
supabase secrets set GOOGLE_API_KEY=...
```

You only need the key(s) for the provider(s) you actually use for chat, but
`OPENAI_API_KEY` is required regardless since embeddings (used by both
document processing and chat retrieval) always go through OpenAI's
`text-embedding-3-small`. Without it, document processing's "embedding"
stage fails cleanly (visible in the library's status badge, retryable via
"Reprocess") rather than silently producing garbage.

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
      chat/       Conversations/messages UI + data layer (RAG chat, per-workspace or per-document)
      orchestration/  AIService (the one entry point UI calls), retrieval glue, prompt construction
      providers/  ChatProvider interface + thin adapters that call the ai-chat edge function
      embeddings/ EmbeddingProvider interface + OpenAI implementation (+ a placeholder for offline dev)
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

This milestone deliberately stopped at the extension points: no capability
executed anything, no domain module was implemented, and no AI provider was
wired up yet. Milestone 4 is what actually lands execution — see "AI
architecture" below for how it resolves capability → prompt → provider
without the UI ever branching on document type or feature name.

## AI architecture

**Rule: UI and feature code call `AIService` (`modules/ai/orchestration/AIService.ts`),
never a provider directly.** `ChatPage` doesn't know or care whether a
conversation is using Claude, GPT, or Gemini — it calls `sendMessage()`,
which resolves retrieval, prompt construction, and the provider through the
registries introduced in Milestone 3.5:

```
ChatPage
  -> AIService.sendMessage()
       -> retrieveContext()       (embed query, pgvector similarity search)
       -> buildSystemPrompt()     (promptRegistry's 'rag-chat' template + retrieved chunks)
       -> getChatProvider(id)     (modules/ai/providers/registry.ts)
       -> provider.chat()         -> ai-chat edge function -> Claude / GPT / Gemini
```

This isn't just organizational preference — it's the only place a real API
key can live. A Vite app has no server of its own, so any code that calls
Anthropic/OpenAI/Google directly from the browser would need the key in a
`VITE_*` env var, which ships in the client bundle for anyone to read. The
`supabase/functions/ai-chat` Edge Function is the actual security boundary:
it holds the keys as Supabase Function secrets and normalizes each
provider's distinct streaming wire format (Anthropic's SSE content blocks,
OpenAI's delta chunks, Gemini's candidate parts) into one plain text-delta
stream, so the client-side `ChatProvider` adapters (`providers/anthropic.ts`,
`openai.ts`, `gemini.ts`) don't need any provider-specific parsing — they're
identical files except for one string (the provider id).

Retrieval quality now depends on real embeddings (`OpenAIEmbeddingProvider`,
`text-embedding-3-small`, matching the `embeddings` table's pgvector
dimension chosen back in Milestone 3) rather than Milestone 3's placeholder
hash vectors — both implement the same `EmbeddingProvider` interface, so
document processing and chat retrieval didn't need to change to pick this
up, only which instance they construct.

## Roadmap

1. Project foundation and authentication
2. Knowledge library and document management
3. Document processing and indexing (includes a basic EPUB reader)
3.5. Platform architecture — Workspaces, module/capability/prompt/provider registries
4. **AI chat with RAG** ← current milestone — real Claude/GPT/Gemini + OpenAI embeddings, via an Edge Function
5. Semantic search
6. EPUB reading workspace (AI chat/summary/flashcards/quiz per book)
7. Notes and knowledge linking
8. Personal memory and AI personalization
9. Knowledge graph
10. AI agents and advanced workflows

Each milestone should land as a stable, production-quality increment —
prioritize clean architecture and extensibility over speed.
