# Performance & Scale Validation v1 (PIP Sprint 9/10)

See `pip-performance-v1-discovery.md` for the full audit. This is a validation/hardening sprint: the retrieval, orchestration, ingestion, and search architecture across Sprints 3-8 was found to already be substantially performance-aware — bounded result caps everywhere, correctly-ordered rate-limit-safe batching in the ingestion pipeline, already-concurrent Universal Search providers, and full pgvector index coverage. Seven real, evidence-based defects were found and fixed. No second retrieval engine, caching system, indexing system, or other new infrastructure was introduced, per the task's own explicit constraint.

## What was already performant (confirmed, not touched)

- **Per-source result caps.** Every retrieval function already bounds its own contribution before formatting — `SEMANTIC_MATCH_COUNT`, `MAX_LEXICAL_ONLY_ADDITIONS`, `MAX_NODES`/`MAX_RELATIONSHIPS`, `MAX_MATCHED_NODES`, `MAX_EVIDENCE_PER_NODE`, `MAX_MEMORIES_PER_TYPE`. Context assembly does not grow unbounded as the knowledge base grows.
- **Universal Search.** `runUniversalSearch.ts` already runs every provider concurrently via `Promise.all`, caps each provider's own result count, and computes cross-provider evidence counts with one batched query rather than one per result.
- **Ingestion pipeline.** Embedding batches are correctly sequential (parallel batches would create a rate-limit thundering herd against a shared per-account OpenAI limit); already-embedded batches survive a retry via `upsert`'s `onConflict`; a reprocess replaces chunks rather than appending, so it can't accumulate duplicate embedding work.
- **Database indexes**, everywhere except the two gaps below: `document_chunks`, `notes`, `assets`, `knowledge_nodes`, `knowledge_node_sources`, `knowledge_links`, `conversations` all have indexes matching their actual query shapes, plus pgvector indexes on every embedding column.

## Problems found and fixed

1. **The chat query was embedded three times per turn.** `retrieveContext`, `retrieveAssetContext`, and `retrieveNoteContext` each independently called the embedding provider on the exact same text — three real OpenAI API calls (network round trips and billed tokens) for one identical string, every single chat message. **Fix**: `AIService.sendMessage` now embeds the query once and passes the result to all three via a new optional `embedding` parameter on each function; each falls back to embedding internally when the parameter is omitted, so none of them changed behavior for any other caller (there is none in production, but their own unit tests still cover the standalone path).

2. **Six independent retrieval sources ran in strict sequence.** `retrieveContext`, `retrieveAssetContext`, `retrieveNoteContext`, `retrieveNamedEntityGraphContext`, `retrieveMemoryContext`, and `retrieveSpreadsheetContext` don't consume each other's results, but were each `await`-ed one after another — roughly six sequential network round trips per turn. **Fix**: all six now run inside one `Promise.all`. The two sources that genuinely depend on that batch's output (`retrieveGraphContext`, which needs the matched document/asset ids, and `resolveChunkProvenance`, which needs the matched chunk ids) now run as a second, still-concurrent-with-each-other stage. Every existing never-throws contract (Sprint 7/10, Sprint 8/10) is unchanged — the same `.catch()` handlers that previously wrapped a bare `await` now wrap a `Promise.all` array element instead, with identical fallback values and logging.

3. **`retrieveContext` and `retrieveNoteContext` each ran their own semantic and lexical searches in sequence internally.** Same shape of bug as #2, one level down: the vector-similarity RPC and the lexical `ILIKE` search don't depend on each other, but were sequential. **Fix**: both now run concurrently via `Promise.all`; a query with no lexical terms still skips the lexical round trip entirely, unchanged from before.

4. **Quota was checked after all retrieval work, not before.** A user who was already over their message quota still paid for the full retrieval pass (now up to 8 concurrent Supabase round trips plus an embedding call) before being rejected. **Fix**: `checkQuota` now runs immediately after the user's message is inserted (and after the workspace-action short-circuit, which never touched quota either way), before any retrieval or embedding work begins.

5. **Conversation history sent to the model had no bound.** `ChatPage.tsx` and `ReaderChatPanel.tsx` both built the `history` array sent to `sendMessage` from the conversation's *entire* message list — a conversation with hundreds of turns resent its whole transcript, verbatim, on every follow-up message, growing prompt size, latency, and cost without limit as the conversation aged. The underlying `listMessages`/`useMessages` fetch is correctly left unbounded (the chat UI must show the complete history) — the bound belongs at the point where history is turned into a provider request, not at the display layer. **Fix**: new `buildChatHistory` helper, used by both call sites, keeps only the most recent `MAX_HISTORY_MESSAGES` (40) messages, oldest-first, unchanged shape otherwise.

6. **`retrieveMemoryContext`'s `listMemories` call had no fetch limit.** Every chat turn fetched the user's *entire* active memory table (across every workspace, if `workspaceId` is null), then discarded all but ~30 rows (`MAX_MEMORIES_PER_TYPE` × 3 types) after relevance filtering and ranking. For most accounts this is a small, cheap table; for a long-lived, heavy user (months of auto-detected `conversation_memory` rows) this cost would grow without bound, forever. `listMemories` already orders by `updated_at desc` — the same tie-break `rankMemories` itself uses — so capping the fetch doesn't change which memories are ultimately selected for any realistic account. **Fix**: added `.limit(200)`, roughly 6-7× the maximum any turn could ever actually use.

7. **`ai_memory` had zero indexes beyond its primary key**, since the table was created (`0010_reconcile_knowledge_tables.sql`). Every query against it — from #6 above, and from the Memory Management page — has been a full table scan. **Fix**: additive migration `0040_performance_indexes.sql` adds `ai_memory (user_id, is_active, updated_at desc)`, matching the RLS-enforced `user_id` predicate every query carries plus the `is_active` filter and `updated_at` ordering every existing call already uses. The same migration adds `messages (conversation_id, created_at)`, since the existing single-column index could serve `listMessages`'s filter but not its sort.

## Performance contracts (now bounded or guaranteed)

- **Conversation history sent to the model**: ≤ `MAX_HISTORY_MESSAGES` (40) most recent messages, regardless of conversation length.
- **Memory fetch per chat turn**: ≤ 200 rows scanned/transferred, regardless of how many memories the account has accumulated; ≤ 30 (10 per type × 3 types) ever reach the prompt — this second number is unchanged from before this sprint.
- **Query embedding calls per chat turn**: exactly 1, regardless of how many retrieval sources need it.
- **Independent retrieval sources per chat turn**: run concurrently, not sequentially — turn latency for the retrieval phase is now bounded by the slowest single source, not their sum.
- Every per-source result cap documented in the discovery doc's Phase 4 table is unchanged and re-confirmed, not loosened, by this sprint.

## AI / model efficiency

Query embedding calls dropped from 3 to 1 per chat turn — a direct reduction in both latency (2 fewer network round trips on the critical path) and OpenAI billing (2 fewer embedding requests) for every single message sent. No chat-completion (model) call was duplicated anywhere — confirmed unchanged: `runWithFallback` calls exactly one candidate provider per attempt, and Sprint 8/10's `useAnalyzeImage` fix already prevents redundant vision calls.

## Database efficiency

Two additive indexes (`ai_memory`, `messages`) close the only two tables in the schema found to lack index support for their actual query shape. No table was redesigned, no column dropped or renamed, no destructive change. `ai_memory`'s fetch is now also bounded (`.limit(200)`), so the index and the bound compound: fewer rows scanned, and the scan itself is now index-supported rather than sequential.

## Frontend efficiency

No frontend code was changed this sprint. Two real architectural gaps were found and documented rather than fixed (see `pip-performance-v1-discovery.md`'s Phase 8 and the "Known limitations" section below): no route-level code splitting, and an unbounded, unpaginated Library document list. Neither had measured evidence of current user-facing harm, and fixing either properly (Suspense-wrapped lazy routes across the whole router; a real pagination UX) is a larger, separate change than this hardening sprint's "smallest necessary" scope.

## Security

Confirmed, not just assumed: parallelizing retrieval changes only *when* each Supabase call fires, never which rows RLS returns to it — every call site's `userId`/`workspaceId` arguments are identical to before, verified by diffing the actual query construction. The shared query embedding is a plain array passed through one function call for the lifetime of a single `sendMessage` invocation, never cached or stored — no new cross-request or cross-user state was introduced. The two new indexes are structural only; no RLS policy, column, or predicate changed. Both new bounds (history window, memory fetch limit) can only reduce what reaches the model, never broaden it past the existing `userId`/`workspaceId` scoping.

## Testing

Deterministic tests at the state/contract/call-count boundary, none dependent on wall-clock timing:

- `buildChatHistory.test.ts` (new, 5 tests): unchanged mapping under the cap, empty conversation, cap enforcement on an oversized conversation (with oldest-first ordering preserved), no growth past the cap at any size, exact-boundary behavior.
- `retrieveContext.test.ts` (+2): reuses a precomputed embedding without calling the provider again; still embeds internally when none is passed.
- `retrieveNoteContext.test.ts` (+2): same two contracts.
- `retrieveAssetContext.test.ts` (new file, 4 tests — none existed before this sprint): basic no-match/unanalyzed-asset behavior plus the same two embedding-reuse contracts.
- `retrieveMemoryContext.test.ts` (updated 1 test): `listMemories` is now called with `limit: 200`.
- `AIService.test.ts` (+4, new "Performance & Scale" describe block): the query is embedded exactly once per turn; the one computed embedding is shared identically with all three retrieval functions that need it; quota is checked before any retrieval work runs, and a rejected turn never calls a single retrieval source or the embedding provider; a normal turn still completes correctly with every source's result reaching the prompt/contextTrace when every source succeeds concurrently.

Full suite: `tsc -b` clean · `vitest run` — **1852/1852 passing** (13 new/updated this sprint) · `oxlint` clean · `vite build` succeeds (pre-existing chunk-size warning only, unchanged in kind, main bundle size unaffected beyond the new code's own footprint). No regression to Milestones 1-8, retrieval, provider routing, or reliability behavior — the full suite includes all of their existing tests, unchanged and passing.

## Known limitations

- **No route-level code splitting.** The app ships as one ~1.27MB main bundle. A real, confirmed architectural fact — not fixed this sprint because converting the router to `React.lazy` + `Suspense` touches every route and carries real regression risk (broken imports, missing loading states) disproportionate to a hardening sprint. No measured evidence (Lighthouse, TTI data) of current user-facing harm exists in this environment either.
- **`listDocuments`/the Library page fetch every document, unbounded, with no pagination UI.** Real, but the fix needs a UI change (pagination or virtualization), not just a query-layer limit — adding a raw `.limit()` alone would silently hide documents past the cutoff, a worse outcome than the current unbounded-but-complete fetch. Deferred as a separate, larger piece of work.
- **`document_chunks`/`notes` content lexical search (`ILIKE '%term%'`) has no trigram index.** A leading wildcard can't use a btree index regardless; both queries are already scoped by an indexed `document_id`/`workspace_id` first. No evidence this is currently slow — a speculative GIN trigram index was deliberately not added, per this sprint's own "measure or prove it, don't optimize without evidence" instruction.
- **No live load-testing was performed.** This environment has no way to generate or measure against a genuinely large (10k+ document) knowledge base; every bound chosen (40-message history window, 200-row memory fetch) is a defensible, order-of-magnitude estimate reasoned from the system's own existing per-turn usage (≤30 memories, a handful of recent turns of real conversational context), not a number derived from a load test.

## Manual QA still required (before this sprint can be called 🟢 PASS rather than 🟡 PARTIAL)

This environment has no authenticated browser session against the deployed app and no access to production-scale data. The following require a human to verify against the live app:
1. Send a chat message in a conversation with 100+ prior turns and confirm the response still correctly references recent context, and that the provider request's history is visibly bounded (via network inspection or provider-side logging) rather than growing with conversation length.
2. Confirm chat turn latency is measurably lower on a cold turn (multiple sources actually returning results) now that retrieval runs concurrently — compare against the pre-sprint commit if possible.
3. Exhaust a test account's quota and confirm the rejection now returns noticeably faster (no retrieval/embedding work precedes it).
4. Run `explain analyze` against the `ai_memory` and `messages` queries on a project with real data to confirm the new indexes are actually being used by the query planner.
5. Confirm no regression in retrieval quality — the same documents/notes/images that were reachable from chat before this sprint are still reachable after it, for a representative set of real questions.
