# Knowledge Intelligence Architecture Audit

**Date:** 2026-07-28
**Status:** Audit only — no code or database changes made. Awaiting approval before implementation.
**Scope:** Readiness assessment for AI document summaries, chapter summaries, flashcards, notes/annotations, highlights, Q&A, knowledge graph foundation, and cross-document connections.

## Executive summary

The roadmap (BACKLOG-006) treats "AI summaries, Flashcards, Notes, Highlights, Bookmarks, Knowledge graph, Cross-document linking, Timeline view" as unbuilt future work. **That's only partly true.** The audit found:

- **Highlights, chapter-level AI summaries, and flashcards are already fully built and working** — real generation (via a genuine capability/prompt-template/provider orchestration layer), real persistence, real UI — just scoped inside the Reader (`/library/:id/read`), not surfaced anywhere else (Document Detail page, Library, or a dedicated Knowledge page).
- **A production-grade AI capability abstraction already exists** (`src/modules/core/{capabilities,prompts,providers,workflows}` + `src/modules/ai/orchestration/runCapability.ts`), with 12 capabilities already registered (`chat`, `summarize`, `explain`, `quiz`, `flashcards`, `timeline`, `compare`, `extract`, `translate`, `rewrite`, `outline`, `mind-map`) — 9 of which have no prompt template yet, meaning most of "Knowledge Intelligence" is a matter of writing prompts and persistence, not building new infrastructure.
- **`notes`, `note_tags`, `knowledge_links`, and `ai_memory` tables already exist in the live database**, well-designed (RLS, indexes, a genuine polymorphic graph-edge table for `knowledge_links`) — but **none of the four has a migration file in this repo**, and **zero frontend code references any of them**. This is the same class of drift found in Phase 2 (the `profiles` backfill), one level up: schema-definition drift, not just data drift.
- **Citation infrastructure is inconsistent.** Chat messages already track `context_chunk_ids` (which chunks were retrieved for a given answer) — real provenance. Nothing else does: `chapter_summaries`/`flashcards`/`highlights`/`notes` only record a `chapter_index`, never which specific chunks fed a generation. Search results link to the parent document/conversation, not the matched passage.

Net effect: this is much closer to "wire up citations, extend what exists, migrate the drifted tables, then build the truly new surfaces (document-level summaries, Q&A, knowledge graph UI)" than "build Knowledge Intelligence from a blank slate."

---

## 1. Document Intelligence Foundation

**Schema (live-verified):**
- `documents` → `extraction_metadata` (1:1, `document_id` PK-ish via FK+cascade) → `document_chunks` (1:many, `UNIQUE(document_id, chunk_index)`, carries `char_start`/`char_end`/`chapter_index`/`chapter_title`/`token_count`) → `embeddings` (1:1 per chunk, `UNIQUE(chunk_id)`, HNSW cosine index — real ANN search, not a linear scan) → `processing_jobs` (audit trail of the pipeline run, `error_message`/`started_at`/`completed_at`).
- Relationships are correct and consistently `ON DELETE CASCADE` from documents down through chunks/embeddings/metadata/jobs — deleting a document cleans up everything, no orphans possible.

**Is the schema sufficient? Mostly yes, with one real gap.** `document_chunks.char_start`/`char_end` + `chapter_index` give exact provenance *within a chunk* — a citation can point to "chapter 3, characters 450–920" and that's reconstructible against the source text. What's missing is **linking generated content back to the specific chunk(s) it was derived from.** `chapter_summaries`/`flashcards`/`highlights` key on `chapter_index` (a whole chapter, dozens of chunks), not `chunk_id`. `messages.context_chunk_ids uuid[]` already establishes the correct pattern — it's just not applied anywhere else yet.

**Are citations possible?** For chat: yes, at the chunk level (`context_chunk_ids` exists, just has no UI beyond a count in `MessageBubble.tsx`). For summaries/flashcards/highlights: only at chapter granularity today — good enough for "this came from chapter 3," not for "this came from this exact paragraph."

---

## 2. AI Generated Content Model

**What already exists and works**, end to end (generation → persistence → display):

| Feature | Table | Key | Generation path |
|---|---|---|---|
| Chapter summary | `chapter_summaries` | `(document_id, chapter_index)` — one per chapter, upsert overwrites | `ChapterSummaryPanel` → `runCapability('summarize', ...)` → `chapter_summaries.upsert(onConflict: 'document_id,chapter_index')` |
| Flashcards | `flashcards` | `id`, indexed on `document_id` (many per chapter, no upsert) | `FlashcardsPanel` → `runCapability('flashcards', ...)` → JSON-parsed → bulk insert |
| Highlight + note | `highlights` | `id` | User-authored only (`SelectionHighlightButton` → `createHighlight`) — no AI generation path |

**What's registered but has no prompt template (so `runCapability` throws if called):** `explain`, `quiz`, `timeline`, `compare`, `extract`, `translate`, `rewrite`, `outline`, `mind-map`. These are "half-built" in the sense that the capability metadata and provider execution plumbing exist; only the prompt (and, for most, a persistence table + UI) is missing.

**What's completely absent:**
- **Document-level summary.** `chapter_summaries`' PK is `(document_id, chapter_index)` with `chapter_index integer not null` — there's no row shape for "the whole document" (no nullable/sentinel chapter_index, no separate table). PDFs and TXT files have no chapter structure at all (`extraction_metadata.chapter_count` is often null for them), so a chapter-scoped-only summary model doesn't even apply to those file types.
- **Generated Q&A** (distinct from chat) — the `quiz` capability is registered, unused.
- **AI-assisted notes / insights** — `notes` table exists (see §4), nothing generates into it.

**Recommended architecture for new content types:**
- **Ownership**: every table so far is single-owner (`user_id`, RLS `auth.uid() = user_id`, ALL). Keep this — it's the established, correct pattern; no multi-tenant sharing exists anywhere in this schema yet, so don't introduce it prematurely for Knowledge Intelligence tables.
- **Versioning**: `chapter_summaries` today has *no* versioning — regeneration overwrites in place via upsert. That's a reasonable default (matches "Regenerate" UX already built), but it means a user can't compare old vs. new. If versioning is wanted, the minimal addition is a `version` int + relaxing the PK to `(document_id, chapter_index, version)` with a `is_current boolean` flag — not a new table. Don't over-build this until a real need appears; the existing overwrite-on-regenerate model is fine for v1.
- **Regeneration strategy**: follow the existing pattern exactly — `runCapability()` + upsert (single-version content like summaries) or delete-and-reinsert (multi-row content like flashcards, matching how `replaceDocumentChunks` already does delete+insert for chunks).
- **User editing workflow**: nothing today supports editing AI-generated content after the fact (a chapter summary can only be regenerated, not hand-edited; flashcards can't be edited, only exist as generated). If hand-editing is wanted for v1, it's a small addition (an `edited boolean` or `edited_at` timestamp so regeneration doesn't clobber a user's edit) — flag as a product decision, not an architecture gap.
- **Citation/provenance**: add `source_chunk_ids uuid[] default '{}'` to any new or existing generated-content table that should support citations, mirroring `messages.context_chunk_ids` exactly. This is the single highest-leverage schema addition in this audit — it's a one-line-per-table change that unlocks real "click a citation, see the passage" UX everywhere.

---

## 3. Retrieval Architecture

**Solid, real, already extensible — not a gap area.**
- `match_document_chunks(query_embedding, match_count, filter_user_id, filter_document_id, filter_workspace_id)` and `match_messages(...)` — pgvector cosine similarity RPCs, backed by an HNSW index (`embeddings_embedding_idx`) — production-grade ANN search, confirmed via live index inspection.
- `retrieveContext()` correctly scopes to one document (Reader chat) or the whole workspace (library-wide chat), with explicit reasoning in-code for why document-scoped chat ignores the workspace filter.
- `src/modules/search/` is a real, working two-source semantic search (documents + conversations) built on an explicit `SearchProvider` registry pattern — comments in the code already anticipate `notes`/`highlights`/`flashcards` as future sources. Adding one is: an embeddings-bearing table (or reuse `document_chunks`' relationship for highlights/flashcards, which already point at a document+chapter), a `match_*` RPC, and a provider registration — a well-paved extension, not new architecture.
- **Chunk ranking**: cosine similarity only, `match_count: 8` hardcoded in `retrieveContext`. No re-ranking, no hybrid keyword+vector, no recency/importance weighting. Fine for v1; a real gap only if search quality becomes a problem (already tracked as BACKLOG-004).

**Gaps:**
- No citation UI anywhere (chat shows a count, not links; search results link to the parent document, not the matched passage) — same root cause as §2's provenance gap, same fix (`source_chunk_ids` + a "Sources" UI component reusable across chat/summaries/search).
- Search hasn't been extended to notes/highlights/flashcards — expected, since those barely exist as content yet.

---

## 4. Knowledge Graph Foundation

**`knowledge_links` already exists, live, well-designed, and completely unused.**

```
knowledge_links: id, user_id, workspace_id, source_type text, source_id uuid,
                 target_type text, target_id uuid, created_at
UNIQUE (source_type, source_id, target_type, target_id)
INDEX (source_type, source_id), INDEX (target_type, target_id)   -- both directions
```

This is a genuine polymorphic graph-edge table — `source_type`/`target_type` as plain text (not FK-constrained, necessarily, since they can point at documents, notes, highlights, etc.) with bidirectional indexing and duplicate-edge prevention. It's a real minimum-viable graph foundation, already built. What it's missing for actual knowledge-graph use:
- **No relationship label** — an edge says *that* two things are linked, not *why* ("cites", "contradicts", "same-topic", "user-linked"). Add a `relationship_type text` column (nullable initially, so existing rows — there are none yet — aren't broken).
- **No provenance of the link itself** — was it user-created or AI-suggested? Add `created_by text check (created_by in ('user','ai'))` or similar, plus optionally a `confidence float` for AI-suggested links, so the UI can distinguish "you connected these" from "the system thinks these are related."
- **No entities/concepts table.** There is currently *nothing* representing a "concept" or "topic" as a first-class object — only links between existing rows (documents, presumably notes). Real entity extraction (people, places, topics) would need a new `entities` table (`id, user_id, name, type, created_at`) that `knowledge_links` could then point at via `source_type='entity'`/`target_type='entity'`. This does not exist yet, anywhere, and is the one truly greenfield piece of the knowledge graph story.

**Recommended minimum viable foundation** (in priority order):
1. Migrate `knowledge_links` (and `notes`/`note_tags`/`ai_memory`) into this repo's tracked migrations — currently pure drift, zero record of how/why they were created.
2. Add `relationship_type` + `created_by` to `knowledge_links` (additive, non-breaking).
3. Ship manual "link this note to this document" UX using `knowledge_links` as-is — proves the UI/data model before any AI auto-linking exists.
4. Only after that: an `entities` table + an extraction capability (`extract`, already registered, no prompt yet) that proposes entities and auto-creates `knowledge_links` rows with `created_by='ai'`.

Do not build a heavier graph model (e.g., a dedicated graph database, weighted multi-relationship types, graph traversal queries) until real usage shows the simple edge table is insufficient — it isn't yet, because nothing uses it.

---

## 5. UX Architecture — where features should live

Current state: AI generation (summaries, flashcards) and highlights are **only** reachable from inside the Reader, which itself is only reachable for EPUBs with chapter structure (PDF/TXT/DOCX have no chapter-scoped UI at all, and no Reader route applies to them).

Recommended placement:

| Feature | Primary surface | Why |
|---|---|---|
| Per-chapter summary/flashcards/highlights | Reader (existing) | Already correct — chapter-scoped content belongs where chapters are read. |
| **Whole-document summary** | **Document Detail page** (`/library/:documentId`, built in Phase 3) | This page already displays `extraction_metadata` and chunk counts — a document-level summary is exactly the kind of metadata this page exists to surface. Natural, low-effort addition. |
| Notes (general, not chapter-bound) | Dedicated `/notes` page (already routed, currently a pure stub) | `notes.document_id` is nullable — notes are explicitly designed to optionally attach to a document, not require one. A standalone Notes workspace matches that model. |
| Document-scoped notes | Document Detail page, secondary section | Same page, filtered `notes` query by `document_id`. |
| Q&A / generated questions | Reader (per-chapter, alongside flashcards) initially; a dedicated view later if quiz-taking becomes a real mode | Mirrors flashcards' existing placement — reuse the pattern, don't invent a new one prematurely. |
| Knowledge graph / cross-document connections | New dedicated "Knowledge" page (not built yet) | This doesn't belong inside a single document's view — it's inherently cross-document. Needs its own route (e.g. `/knowledge`), likely a simple list/table of links before any graph visualization. |
| Citations (chunk-level "sources") | A shared, reusable component | Currently chat shows a bare count; this should become one small `<CitationList>`-style component used by chat, search results, and (once built) summaries — not reimplemented per-surface. |

No changes to the Library page, Sidebar nav structure, or AppShell are implied by this — `/notes` and a future `/knowledge` route already fit the existing `AppShell`-nested route pattern (`src/app/router.tsx`) with zero structural change.

---

## 6. AI Provider Architecture

**This is the strongest part of the existing codebase for this initiative — already exactly what's needed, no redesign required.**

- **Current interfaces**: `ChatProvider` (`{id, chat(request): AsyncGenerator<string>}`) and `EmbeddingProvider` (`{modelName, dimensions, embed(texts, context?)}`) are both minimal, correctly separated (chat generation vs. embeddings are different concerns, never conflated), and both already have real implementations (`anthropic`/`openai`/`google` chat providers; `OpenAIEmbeddingProvider` + a `PlaceholderEmbeddingProvider` for offline dev).
- **Provider abstraction**: two-layer, deliberately. `core/providers/registry.ts` holds UI-facing *metadata* only (label, status: available/planned) — what the Settings page renders. `ai/providers/registry.ts` holds the *real* callable instances — what `AIService`/`runCapability` actually invoke. This separation is exactly right and should be preserved as-is.
- **Future multi-model support**: already designed for it. `coreModule.ts` already lists `ollama`, `openrouter`, `azure-openai` as `status: 'planned'` provider descriptors — the extension point exists, just needs real `ChatProvider` implementations added to `ai/providers/registry.ts` (this is explicitly BACKLOG-005, correctly deferred).
- **Capability execution**: `runCapability()` already resolves capability → active prompt template → provider generically — any new Knowledge Intelligence feature (document summary, Q&A, entity extraction) is a new capability + prompt template away from working, using infrastructure that already exists and is already proven (it's what powers chapter summaries and flashcards today).
- **One piece of stale documentation found**: `src/modules/core/README.md` still says "No capability actually executes anything yet... there's no AI provider wired up until a later milestone" — this is no longer true (`runCapability.ts` exists and is used in production by the Reader). Low-priority doc fix, flagged for the technical-debt backlog (BACKLOG-008), not urgent.

Per your constraint, I did not open or modify `supabase/functions/ai-chat/index.ts` or anything under `src/modules/ai/providers/`/`src/modules/ai/embeddings/` beyond reading them — BACKLOG-001/002 remain untouched and deferred.

---

## Recommended schema changes

In priority order — **none applied**, all pending approval:

1. **Backfill migration files for `notes`, `note_tags`, `knowledge_links`, `ai_memory`.** These exist live but have zero record in `supabase/migrations/`. Same class of issue as the `profiles` backfill in Phase 2, one level up (schema drift, not data drift). Should be a single migration that `CREATE TABLE IF NOT EXISTS`s all four with their current live definitions (captured in this audit above), so the repo's migration history matches reality before anything new is built on top.
2. **Add `source_chunk_ids uuid[] default '{}'`** to `chapter_summaries`, `flashcards`, and any new generated-content table — mirrors `messages.context_chunk_ids`, the one existing precedent for citation tracking. Highest-leverage single change in this audit.
3. **Add a document-level summary home.** Either relax `chapter_summaries.chapter_index` to nullable with a documented "null = whole document" convention, or (cleaner, recommended) a small dedicated `document_summaries` table (`document_id, user_id, content, model, source_chunk_ids, created_at, updated_at`) — avoids overloading a chapter-scoped table's meaning.
4. **`knowledge_links`: add `relationship_type text` and `created_by text`** — additive, non-breaking, unlocks meaningful graph edges instead of unlabeled ones.
5. **New `entities` table** (only once entity extraction is actually being built, not before): `id, user_id, workspace_id, name, type, created_at` — the one genuinely new table this audit identifies, everything else is extending what exists.
6. **Generated Q&A table** (for the `quiz` capability, once it has a prompt template): mirrors `flashcards`' shape closely (`id, document_id, user_id, chapter_index, question, answer, source_chunk_ids, created_at`).

## Recommended module structure

Following the codebase's existing domain-first convention (`src/modules/<domain>/{api,components,hooks,pages}`), no new top-level architecture needed:

- **`src/modules/notes/`** — currently a stub with only `pages/NotesPage.tsx`. Needs `api/notes.ts`, `hooks/useNotes.ts`, `components/NoteCard.tsx`/`NoteEditor.tsx`, matching the shape of `src/modules/library/` exactly (this codebase already has a proven template for "list + create + edit + delete a user-owned, taggable, document-linkable resource" — it's the Library module).
- **`src/modules/knowledge/`** (new) — a dedicated module for cross-document connections: `api/knowledgeLinks.ts`, `hooks/useKnowledgeLinks.ts`, `pages/KnowledgePage.tsx`, plus (later) `components/GraphView.tsx`. Routed at `/knowledge`.
- **Document-level summary**: lives inside `src/modules/library/` (alongside `DocumentDetailPage.tsx`, since that's its natural home per §5) or a new `src/modules/summaries/` if it grows complex enough to warrant separation — start inside `library/` and extract later if needed, don't pre-split.
- **Q&A / quiz**: extend `src/modules/reader/` following the exact `FlashcardsPanel`/`useFlashcards` pattern (`useQuiz`, `QuizPanel`, `api/quiz.ts`) — this is a near-copy of existing, proven code, not new design.
- **Citations component**: `src/shared/components/ui/CitationList.tsx` (or similar) — belongs in `shared/` since chat, search, and summaries all need it, matching how `Spinner`/`EmptyState`/`ConfirmDialog` are already shared.
- **`core/` registries**: no structural change — register new capabilities/prompts in `coreModule.ts` (or a new domain module if this ever needs to feel separate from "core") exactly as `summarize`/`flashcards` already are.

## Implementation roadmap

**1. Foundation** (schema/drift fixes, no new user-facing features)
- Backfill migrations for `notes`/`note_tags`/`knowledge_links`/`ai_memory`.
- Add `source_chunk_ids` to `chapter_summaries`/`flashcards`.
- Update `chapter_summaries`/`flashcards` generation code to populate `source_chunk_ids` (the chunk IDs already exist in-memory at generation time — `ChapterSummaryPanel`/`FlashcardsPanel` already have the chapter's chunks loaded, just aren't recording their IDs).
- Fix the stale `core/README.md`.

**2. MVP intelligence features** (extend what exists, using proven patterns)
- Document-level summary on the Document Detail page (new capability/prompt + `document_summaries` table, `runCapability()` reused as-is).
- Build the real Notes module (`api/notes.ts` + hooks + UI), following the Library module's template — this alone closes the biggest "planned but stub" gap (BACKLOG-006's "Notes" item).
- A shared `CitationList` component, wired into chat first (data already exists via `context_chunk_ids`), then summaries once `source_chunk_ids` lands.
- Extend `src/modules/search/`'s provider registry to include notes and highlights as searchable sources — the extension point already exists.

**3. Advanced features** (genuinely new architecture)
- `entities` table + entity-extraction capability (prompt for the already-registered `extract` capability) → auto-populate `knowledge_links` with `created_by='ai'`.
- Dedicated `/knowledge` page: start as a simple list of links per document/note; graph visualization only once there's enough real data to justify it.
- Q&A/quiz capability (prompt template for `quiz`, a `quiz_questions` table, `QuizPanel` mirroring `FlashcardsPanel`).
- Cross-document "compare"/"timeline"/"mind-map" capabilities — prompt templates for capabilities already registered but unused; genuinely multi-document in a way nothing built so far is, so worth sequencing last.

---

## Constraints honored

No code written, no database modified (all schema recommendations above are proposals, not applied), no changes to `supabase/functions/ai-chat` or existing AI Chat/Embedding architecture (BACKLOG-001/002 remain deferred and untouched). Waiting for approval before any implementation begins.
