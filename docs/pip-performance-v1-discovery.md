# Performance & Scale Validation v1 — Discovery (PIP Sprint 9/10)

Environment verified at HEAD `f07b744` on `main`, matching the Sprint 8/10 baseline exactly (clean working tree, no drift). This is a validation/hardening sprint over the existing architecture, not a rewrite — every finding below is grounded in reading the actual code paths and query shapes, not assumed from a theoretical pattern.

## Phase 1 — Full pipeline trace

**Chat's critical path** (`AIService.sendMessage`, the one every user-facing turn runs):

```
insertMessage (user) → [workspace-action router: short-circuits if matched]
  → checkQuota
  → embed(text) ×1
  → { retrieveContext, retrieveAssetContext, retrieveNoteContext,
      retrieveNamedEntityGraphContext, retrieveMemoryContext,
      retrieveSpreadsheetContext }  — 6 independent sources
  → { retrieveGraphContext, resolveChunkProvenance }  — 2 sources depending on the batch above
  → buildSystemPrompt → resolveNovaContext → buildReasoningPlan
  → runWithFallback → streamChatCompletion (provider call, streamed)
  → insertMessage (assistant) → touchConversation → consumeQuota → resolveReferences
```

Before this sprint, every arrow after `embed` was a strict `await`-then-`await` chain: `retrieveContext`, `retrieveAssetContext`, `retrieveNoteContext`, `retrieveNamedEntityGraphContext`, `retrieveMemoryContext`, and `retrieveSpreadsheetContext` ran one at a time despite none of them consuming another's result — each is a separate Supabase round trip (some multiple: `retrieveContext`/`retrieveNoteContext` each do a semantic RPC *and* a lexical query internally, also sequential). `retrieveContext`, `retrieveAssetContext`, and `retrieveNoteContext` also each independently called `embeddingProvider.embed([text])` for the exact same string — three real OpenAI embedding calls, three `ai_requests` log rows, for one identical piece of text. `checkQuota` ran *after* all of that work, so a user already over quota still paid for the full retrieval pass before being rejected.

**Ingestion pipeline** (`processDocument.ts`, fire-and-forget from the UI after upload):

```
createProcessingJob → extract → saveExtractionMetadata → chunk → replaceDocumentChunks
  → embed in batches of 100 (sequential, exponential-backoff retry per batch on rate limit)
  → mark completed
```

Confirmed already correctly designed: batches are sequential *on purpose* (parallel batches would create a thundering herd against OpenAI's rate limit, fighting each batch's own backoff), already-embedded batches survive a retry via `upsert(... onConflict: 'chunk_id')`, and a failure records a real error message and status rather than leaving the document silently stuck.

**Separately traced**: Notes (`retrieveNoteContext` for chat, `notesSearchProvider` for Universal Search — both hybrid semantic+lexical, both bounded), Spreadsheets (`retrieveSpreadsheetContext` reads precomputed analysis, no live recomputation per turn), Images (`retrieveAssetContext`, same shape as documents), Memory (`retrieveMemoryContext` — the one source with an unbounded fetch, see Phase 2), Universal Search (`runUniversalSearch.ts` — already concurrent, see Phase 7), Knowledge Graph (`retrieveGraphContext`/`retrieveNamedEntityGraphContext`, both bounded by `MAX_NODES`/`MAX_RELATIONSHIPS`/`MAX_MATCHED_NODES`), Conversations (`listMessages` — unbounded by design for UI display, but was also unbounded going *into* the model, see Phase 4).

## Phase 2 — Retrieval performance

| Question | Finding |
|---|---|
| Which retrieval operations are independent and can run concurrently? | All 6 top-level sources listed above, plus each source's own internal semantic+lexical pair (`retrieveContext`, `retrieveNoteContext`). Confirmed independent by reading each function's parameters — none reads another's return value. |
| Which results are fetched more than once? | The query embedding — three times for one string, confirmed by grep (only `AIService.ts` calls these three functions in production code) and by reading each function's own `embed()` call. |
| Are limits/caps applied before expensive processing? | Yes, consistently: `SEMANTIC_MATCH_COUNT` (5-8), `MAX_LEXICAL_ONLY_ADDITIONS` (3-4), `MAX_NODES`/`MAX_RELATIONSHIPS` (10/10), `MAX_MATCHED_NODES` (3), `MAX_EVIDENCE_PER_NODE`/`MAX_RELATED_PER_NODE` (6/6), `MAX_MEMORIES_PER_TYPE` (10) — every retrieval source already caps its own contribution before formatting. The one exception: `retrieveMemoryContext`'s underlying `listMemories` call had no `.limit()` at all (see below). |
| Does retrieval cost grow reasonably as the knowledge base grows? | Yes for every vector/RPC-backed source (bounded `matchCount`, pgvector indexes already in place — confirmed in Phase 5). No for `ai_memory`: the fetch itself was the user's entire active memory table, filtered/capped only after the full transfer. |
| Does context assembly have a bounded size? | Yes, per-block (see Phase 4) — this was already true before this sprint and confirmed empirically, not assumed. |
| Can one large document or note dominate retrieval? | No — chunking already caps individual chunk size at ingestion time, and `SEMANTIC_MATCH_COUNT`/lexical caps bound how many excerpts from any one source reach the prompt. |
| Are lexical and semantic searches both necessary for each request? | Lexical only runs when `extractLexicalSearchTerms` finds candidate terms (already short-circuited before this sprint); this sprint's change is running the two *concurrently* when both do run, not making lexical unconditional. |
| Are graph lookups bounded? | Yes — `MAX_NODES`/`MAX_RELATIONSHIPS`/`MAX_MATCHED_NODES`, unchanged. |

## Phase 3 — AIService / orchestration performance

Confirmed and fixed: 6 independent retrieval sources ran sequentially; `checkQuota` ran after all retrieval instead of before; the query was embedded 3 times. Confirmed **not** an issue: memory retrieval never blocked document retrieval by data dependency (only by accidental sequencing, now removed); provider routing/error isolation/never-throws contracts (Sprint 8/10) are unchanged — every `.catch()` that existed before this sprint still exists, now just inside a `Promise.all` array position instead of a bare `await` chain. Conversation history growing without bound is a real, separate finding — see Phase 4.

## Phase 4 — Context & prompt growth

Traced each block's actual bound, not assumed:

| Block | Bound | Source |
|---|---|---|
| `{{context}}` (document chunks) | ≤ 8 semantic + ≤ 4 lexical-only | `SEMANTIC_MATCH_COUNT`, `MAX_LEXICAL_ONLY_ADDITIONS` |
| `<note_context>` | ≤ 5 semantic + ≤ 3 lexical-only | `retrieveNoteContext.ts` |
| `<visual_context>` | ≤ 5 | `retrieveAssetContext.ts`'s `MATCH_COUNT` |
| `<knowledge_connections>` | ≤ 10 nodes, ≤ 10 relationships, ≤ 3 named-entity matches with ≤ 6 evidence/related each | `retrieveGraphContext.ts`, `retrieveNamedEntityGraphContext.ts` |
| `<spreadsheet_analysis>` | Precomputed once at processing time, not re-derived per turn | `retrieveSpreadsheetContext.ts` |
| `<personal_context>` | ≤ 10 per memory type (30 total) at *format* time — but the underlying fetch had **no bound at all** | `formatMemoriesForPrompt`'s `maxPerType`, vs. `listMemories`'s missing `.limit()` |
| Conversation history sent to the provider | **None** — every message in the conversation, forever | `ChatPage.tsx`/`ReaderChatPanel.tsx` building `history` from the full `useMessages()` result |

The system does not solve scale by sending everything to the model for the *evidence* blocks — every one of those was already bounded before this sprint. The two real gaps were both about how much data was fetched/carried before the (already-correct) final bound was applied: `ai_memory`'s fetch, and conversation history, which had no bound anywhere in the pipeline. A conversation with hundreds of turns was resending its entire transcript, verbatim, on every single follow-up message — this is the literal case Phase 4 named ("does the system solve scale by simply sending everything to the model").

## Phase 5 — Database / Supabase performance

Read every relevant migration rather than assuming index coverage:

| Table | Indexes before this sprint | Query shape actually used |
|---|---|---|
| `document_chunks` | `document_id`, `user_id`, `workspace_id`, plus pgvector index (`0003_processing.sql`) | Covered |
| `notes` | `user_id`, `workspace_id`, `collection_id`, `document_id`, plus pgvector index (`0025_note_search.sql`) | Covered |
| `knowledge_nodes` / `knowledge_node_sources` / `knowledge_links` | user/workspace/source-type composites | Covered |
| `assets` | `owner_id`, `workspace_id`, plus pgvector index (`0039_asset_search.sql`) | Covered |
| `conversations` | `user_id`, `workspace_id`, `document_id` | Covered |
| `messages` | `conversation_id` only | Every read (`listMessages`) filters by `conversation_id` **and orders by `created_at`** — the existing index serves the filter but not the sort. **Gap.** |
| `ai_memory` | **None beyond the primary key**, since the table's creation (`0010_reconcile_knowledge_tables.sql`) | Every read (`retrieveMemoryContext`, Memory Management page) filters by `user_id` (via RLS `auth.uid()`), often `workspace_id`, `is_active`, ordered by `updated_at`. **Zero index support — every query has been a full table scan.** |

No full-table-scan risk found elsewhere: every other frequently-queried table already has an index matching its actual filter/order shape. `document_chunks`/`notes` content `ILIKE '%term%'` lexical search has no supporting index and can't (a leading wildcard defeats a btree; a trigram/GIN index would be needed) — but both queries are already scoped by an indexed `document_id`/`workspace_id` first, pruning the candidate set before the ILIKE filter runs, and no evidence (query timing, user report, load pattern) suggests this is currently a real bottleneck. Adding a speculative GIN trigram index here would be exactly the "theoretical future scale" schema change this sprint's own instructions say not to make.

## Phase 6 — Upload & processing performance

Already covered in Phase 1: extraction/chunking/embedding is correctly sequential where it needs to be (rate-limit safety) and already parallel where it's safe (`Promise.all` inside `resolveChunkProvenance`, batched upserts). No duplicate-embedding risk found in the ingestion path itself — each chunk is embedded exactly once, and re-processing a document replaces its chunks (`replaceDocumentChunks`) rather than appending, so a retry can't accumulate duplicate embedding work. Processing runs fire-and-forget from the UI (`void processDocument(...)`), already not blocking the upload response.

## Phase 7 — Search & Universal Search

`runUniversalSearch.ts` was already correctly built: every registered provider runs concurrently via `Promise.all` (not sequentially), each with its own `matchCount` cap and its own `.catch()` so one provider's failure doesn't blank the whole search, and cross-provider evidence-count enrichment (`fetchEvidenceCounts`) is one batched `IN (...)` query, not one query per result. No changes made here — confirmed already correct, not assumed.

## Phase 8 — Frontend performance

Two real, confirmed findings, both deliberately **not fixed this sprint** (see `pip-performance-v1.md`'s "changes deliberately not made" for the reasoning): no route-level code splitting exists anywhere in `router.tsx` (confirmed via grep — zero `React.lazy` usage), so the entire app ships as one ~1.27MB main bundle regardless of which page loads first; and `listDocuments`/the Library page fetch every document unbounded, with no pagination or virtualization in the UI to consume a bounded result even if one were added at the query layer. Neither has measured evidence of user-facing harm (no Lighthouse/TTI data available in this environment, no reported slow-load complaint) — both are architectural facts worth recording, not confirmed regressions worth an urgent fix.

No unnecessary-rerender or duplicate-fetch pattern was found in Chat/Reader/Knowledge Graph — each uses TanStack Query's own cache correctly (confirmed by reading `useMessages`, `useConversations`, `useDocument`, etc.), and no component was found computing the same derived value repeatedly without memoization in a way that showed up as a real problem during this reading pass.

## Phase 9 — Cost / resource efficiency

The embedding-deduplication fix (Phase 2/3) is directly a cost fix: 3 OpenAI embedding calls → 1, per chat turn. No duplicate *model* (chat completion) calls were found — `runWithFallback` calls exactly one provider per attempt, and `useAnalyzeImage`'s three-step composition (Sprint 8/10) already avoids redundant vision calls. No duplicate embedding was found in the ingestion path (Phase 6). The `ai_memory` fetch fix (Phase 2/5) is a database-read cost fix, not a model-cost fix.

## Phase 11 — Security preservation (checked alongside each fix)

- Parallelizing retrieval sources changes *when* each Supabase call fires, never *which* rows RLS returns — every call site's `userId`/`workspaceId` arguments are unchanged, confirmed by diffing the actual query construction, not just the surrounding control flow.
- The shared embedding is not cached or stored anywhere — it's a plain in-memory array passed through one function call's argument list for the lifetime of a single `sendMessage` invocation, then discarded. No new cache, no cross-request/cross-user state.
- The two new indexes are structural (query-plan) changes only — no RLS policy was touched, no new column, no relaxed predicate.
- Bounding conversation history and memory fetch size can only *reduce* what reaches the model, never broaden it to another user's or workspace's data — both bounds apply after the existing `userId`/`workspaceId`-scoped query, not instead of it.

## Gap classification

| Finding | Class | Action |
|---|---|---|
| Query embedded 3× per turn | 🔴 confirmed defect | Fixed — embed once, share via new `embedding` param |
| 6 independent retrieval sources sequential | 🔴 confirmed defect | Fixed — `Promise.all` |
| `retrieveContext`/`retrieveNoteContext` internal semantic+lexical sequential | 🔴 confirmed defect | Fixed — `Promise.all` |
| `checkQuota` after retrieval instead of before | 🔴 confirmed defect | Fixed — moved earlier |
| Conversation history unbounded into the model | 🔴 confirmed defect | Fixed — `buildChatHistory`, 40-message window |
| `ai_memory` fetch unbounded | 🔴 confirmed defect | Fixed — `.limit(200)` |
| `ai_memory` has zero indexes | 🔴 confirmed defect | Fixed — additive index |
| `messages` index doesn't cover the sort | 🟡 minor gap | Fixed — additive composite index |
| No route-level code splitting | 🟡 real, unfixed | Deferred — out of hardening-sprint scope |
| `listDocuments`/Library unbounded, no pagination UI | 🟡 real, unfixed | Deferred — needs a UI change, not just a query change |
| Document/note content ILIKE has no trigram index | ⚪ theoretical, unproven | Not fixed — no evidence of current cost, already pruned by indexed scope filters |
| Universal Search provider concurrency | 🟢 already correct | No change |
| Ingestion pipeline batching/retry | 🟢 already correct | No change |
| pgvector indexes | 🟢 already correct | No change |
| Retrieval-level result caps (per source) | 🟢 already correct | No change |
