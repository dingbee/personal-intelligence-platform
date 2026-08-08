# Document Intelligence v1 — Discovery (PIP Sprint 4/10)

## Phase 1 — Environment verification

Repository `dingbee/personal-intelligence-platform`, branch `main`, clean working tree, `HEAD` at `0bed157` (Sprint 3/10's own commit) before this sprint's changes. Supabase project `uzshazetfkjkrdnxwjtl`. `ai-chat` Edge Function confirmed still at v18, source diffed line-by-line against `supabase/functions/ai-chat/index.ts` in the repo — **byte-identical, no drift**. Document-related migrations confirmed: `0002_library.sql` (`documents`), `0003_processing.sql` (`processing_jobs`, `extraction_metadata`, `document_chunks`, `embeddings`, `match_document_chunks`), `0007_search.sql` (adds `document_chunks.workspace_id`), `0031_shared_knowledge_objects.sql` (widens `match_document_chunks` and the `document_chunks`/`embeddings` RLS policies to cover workspace-shared documents, not just owned ones).

## Phase 2 — Full path trace and the actual root cause

```
Upload → documents row → Storage → extract() (pdf.ts/docx.ts/txt.ts/markdown.ts)
  → chunk (chapterAwareChunker, falls back to paragraphChunker)
  → document_chunks (+ chapter_index/chapter_title — page number for PDFs)
  → embeddings (OpenAI text-embedding-3-small, via ai-chat edge function)
  → retrieveContext (AIService.sendMessage)
      → match_document_chunks RPC — pure vector cosine similarity, top 8
      → buildSystemPrompt → {{context}} → provider
```

**Ingestion.** PDF (`pdfjs-dist`, one "chapter" per page, titled `"Page N"`), DOCX (`mammoth`, raw text, no chapters), TXT (raw), Markdown supported. No `.xls`-equivalent gap here — no OCR/scanned-PDF path exists anywhere in the codebase (confirmed absent, consistent with the same finding already recorded in `multimodal-intelligence-v2-discovery.md`): `pdfjs`'s `getTextContent()` only reads an embedded text layer, so a scanned (image-only) PDF silently produces empty page text and zero chunks — the upload still reports `status: 'ready'` with nothing retrievable, no explicit warning. Named as a known limitation below; building OCR is a materially different, larger feature and out of this sprint's scope.

**The actual root cause of the ARRIYIA failure — two independent defects, both traced by reading the real code, not guessed:**

1. **`retrieveContext` (`AIService.sendMessage`'s only retrieval call) was pure vector cosine similarity, capped at 8 results, with zero lexical/exact-match fallback anywhere in the chat path.** `match_document_chunks` (`supabase/migrations/0031_shared_knowledge_objects.sql`) is `order by embeddings.embedding <=> query_embedding limit match_count` — nothing else. A rare, invented-looking proper noun mentioned exactly once in a long document is a known hard case for embedding similarity: the "nearest" chunks to a full-sentence question's embedding are not guaranteed to be the one chunk that happens to contain the literal word. Verified this isn't hypothetical: Universal Search's own `documentSearchProvider.ts` already has a "hybrid semantic + lexical" fallback (`hybridScore.ts`, built in an earlier sprint) — but it only does `ILIKE` against `documents.title`, never against `document_chunks.content`. **No lexical search over chunk content existed anywhere in this codebase before this sprint** — not in chat retrieval, not even in Universal Search.

2. **Even when a relevant chunk *was* retrieved, the model was never told which document or page it came from.** `resolveReferences.ts` (built in an earlier UX-7 phase) already fetches exactly this data — `getChunkLocations`/`getDocumentTitles`, keyed by the same `chunkId`/`documentId` every retrieved match already carries — but only *after* the LLM has already answered, purely to render the UI's reference chips. `buildSystemPrompt`'s `{{context}}` block has only ever been `[i] ${match.content}` — no title, no page, no chapter. This means "Where is ARRIYIA mentioned?" (Phase 3's Test B) had **no honest answer available to the model even in the best case** — the data existed in the database and was fetched every turn, just never threaded into the prompt.

Both are real, verifiable code defects — not something that could plausibly be fixed by better prompt wording alone.

**Chunking.** `document_chunks.chapter_index`/`chapter_title` already survive chunking (`chapterAwareChunker`), and for PDFs `chapter_title` literally is `"Page N"` (`pdf.ts`) — this is real, already-correct provenance data, just not surfaced to the model (see defect 2 above). DOCX/TXT/Markdown have no chapter data at all (no fabricated page numbers possible or attempted).

**Retrieval.** Semantic (`match_document_chunks`), keyword/hybrid (only for Universal Search's document *titles*, not chat's chunk *content* — the gap above), Universal Search (separate feature, unaffected), graph retrieval (`retrieveGraphContext`, unrelated to chunk text), reranking (none — a real absence, but out of scope: fixing the *presence* of the right chunk in results is this sprint's priority over reordering an already-correct result set), query expansion (none), entity/exact-name matching (**the confirmed gap fixed this sprint**).

**Context assembly.** `AIService.sendMessage` — traced directly: `matches = retrieveContext(...)` → `buildSystemPrompt(matches, ...)` → `system` string → `streamChatCompletion`. Confirmed: yes, a document containing the answer could be silently excluded whenever the correct chunk wasn't in the top-8 semantic matches — exactly the ARRIYIA scenario.

**Prompt grounding.** The `rag-chat@1.0` template (`coreModule.ts`) already instructed "answer using ONLY the context... if the context does not contain the answer, say so plainly" — the honesty instruction already existed. It did **not** say anything about evidence vs. instructions (prompt-injection defense) or reference which document/page the evidence came from (nothing to reference — see defect 2).

## Phase 7 — Security audit (read-only, before any change)

`ai-chat` (Deno edge function) is a pure passthrough — forwards `system`/`messages` verbatim to each provider's own API. No provider names, API keys, or routing internals appear in any client-facing string. `document_chunks`/`embeddings` RLS (`0031_shared_knowledge_objects.sql`) already correctly scopes visibility to the owner or a workspace member with `viewer`+ role — verified by reading the policy SQL directly, and confirmed the *same* predicate is what any new lexical query must respect (see the v1 doc for how the fix reuses this without a parallel security rule).

## Gap classification

| Area | Status | Notes |
|---|---|---|
| PDF/DOCX/TXT/Markdown ingestion | 🟢 WORKING | |
| Scanned PDF / OCR | ⚪ MISSING | Named, out of scope — separate feature |
| Chapter/page provenance capture at extraction time | 🟢 WORKING | Already correct, just not surfaced (see below) |
| Semantic retrieval | 🟢 WORKING | Correct as far as it goes |
| **Exact/entity-aware lexical retrieval over chunk content** | ⚪ MISSING → 🟢 FIXED | Root cause #1 |
| **Provenance reaching the model's own context (not just UI chips)** | 🔴 BROKEN → 🟢 FIXED | Root cause #2 |
| Document-scoped retrieval (chat about one open document) | 🟢 WORKING | Already correctly scoped via `documentId`, unaffected |
| Reranking / query expansion | ⚪ MISSING | Not needed to fix the diagnosed failure; not built |
| Prompt-injection defense (evidence not authority) | 🟡 PARTIAL → 🟢 HARDENED | Honesty instruction existed; injection framing added |
