# Search & Retrieval Unification v1 (PIP Sprint 7/10)

See `search-retrieval-unification-v1-discovery.md` for the full audit. This is a validation and consolidation sprint: the retrieval architecture is real, mostly working, and largely well-designed — it is not one coherent system, but two parallel paths (chat grounding and Universal Search) that legitimately share the same low-level building blocks (pgvector RPCs, `hybridScore.ts`, `extractLexicalSearchTerms.ts`) at two different granularities for two different consumers. One genuine, confirmed capability gap was found and fixed — notes were fully searchable in Universal Search but completely unreachable from chat — plus one pre-existing security hardening gap found during the same audit. No second search engine, ranking engine, or knowledge engine was built.

## Problems found

1. **Notes unreachable from chat (the central finding).** `notesSearchProvider` has done full hybrid semantic+lexical search over note content for two sprints (`match_notes` RPC, `note_embeddings`, populated on every note save). Chat's own retrieval path (`AIService.sendMessage`) never queried notes at all — confirmed by grepping every file under `src/modules/ai/`, `src/modules/knowledge-intelligence/`, and `src/modules/intelligence/` for any reference to `match_notes`/`notes`/`notesSearchProvider`: zero matches. A fact written only in a note was unreachable from chat unless a knowledge-graph node for its subject happened to already exist from a different source (documents/images can auto-create graph nodes; notes can only link to an *existing* one, per Sprint 5's own finding). This is the direct notes counterpart of the original ARRIYIA document gap Sprint 4 fixed.
2. **`<visual_context>` (analyzed images) had no evidence-not-instruction guard.** Both notes and assets are workspace-shareable (`0029_note_sharing.sql`, the relevant section of `0031_shared_knowledge_objects.sql`), so their content can legitimately originate from a different workspace member — exactly like documents already can. The base `rag-chat@1.0` template's guard has only ever covered `{{context}}` (document chunks, added Sprint 4). `<visual_context>` never got the same treatment when it was introduced (Stabilization sprint) — a real, pre-existing gap, found during this sprint's Phase 8 security audit rather than left for a future one, since it's the same one-line fix at the same layer as the new note block.

Everything else audited (document chunk retrieval, asset semantic retrieval, spreadsheet retrieval, knowledge-graph/named-entity retrieval, memory retrieval, deduplication, empty-result honesty, the ranking model) was confirmed **already working correctly** — see the discovery doc's full gap-classification table. No new weights were invented anywhere; Phase 5's own instruction ("do not arbitrarily invent new weights... justify from observed retrieval failures") was followed literally — the audit found no ranking-model defect to fix.

## Changes

- **`retrieveNoteContext.ts` (new)** — the chat-context counterpart of `retrieveAssetContext.ts`, for notes. Reuses `match_notes` (the same RPC `notesSearchProvider` already calls) for semantic search, and a new content-level lexical fallback (mirroring `lexicalChunkSearch.ts`'s exact shape: one ILIKE query per extracted term, run in parallel, deduped) rather than `notesSearchProvider`'s title-only fallback — chat needs to find the passage that mentions a rare term, not just a note whose title happens to match.
- **`buildSystemPrompt.ts`** — new optional `noteMatches` parameter (appended last, so no existing positional call site needed to change), rendering a `<note_context>` block labeled `(Note: Title)` per match, matching the chunk/asset provenance convention. Both `<note_context>` and `<visual_context>` now carry a shared `EVIDENCE_NOT_INSTRUCTION_NOTE` — the same guard `{{context}}` has had since Sprint 4, reused verbatim rather than a new mechanism.
- **`AIService.ts`** — calls `retrieveNoteContext` alongside `retrieveAssetContext` (same never-throws-at-the-call-site contract, `.catch(() => [])`), passes the result into `buildSystemPrompt`, and counts note matches into `contextTrace.retrievedChunks` the same way asset matches already are.

## Retrieval matrix

| Source | Searchable (Universal Search) | Semantic | Lexical | Graph | Chat grounding | Provenance |
|---|---|---|---|---|---|---|
| Documents | ✅ | ✅ | ✅ (content) | ✅ | ✅ | Title + page/chapter (Sprint 4) |
| PDFs | ✅ (same `documents` table) | ✅ | ✅ | ✅ | ✅ | Same as documents |
| Images | ✅ | ✅ | ✅ (title only) | ✅ | ✅ (semantic only) | Self-labeled `Image: "title"` |
| OCR text | — (folded into image analysis) | ✅ (part of image embedding) | — | ✅ | ✅ | Same as images |
| **Notes** | ✅ | ✅ | **✅ (content, new)** | Indirect (via graph link) | **✅ (new)** | Self-labeled `(Note: title)` |
| Spreadsheets | ✅ (same `documents` table) | ✅ | ✅ | ✅ | ✅ | Same as documents, plus a precomputed `<spreadsheet_analysis>` block |
| Conversations | ✅ (past conversations) | ✅ | ✅ (title only) | — | Current conversation only (`history`); past conversations deliberately not retrieved as evidence — see Known Limitations | — |
| Knowledge nodes | ✅ (lexical title only) | — (no embedding column, by design) | ✅ | ✅ | ✅ (Sprint 5) | Self-labeled `Concept:`/`Entity:` + evidence source-type breakdown |
| Relationships | — (not independently searchable) | — | — | ✅ | ✅ (Sprint 5) | Evidence count + source types |
| Personal memory | — (not a Universal Search provider, by design — ambient personalization, not a browsable object) | — | — | — | ✅ (Sprint 6, relevance-filtered) | Section title (explicit/learned/conversation) |

## Intelligence improvements

What ARRIYIA can now reliably retrieve that it could not before this sprint: a fact written only in a note — the exact reported failure shape ("What does the article say about ARRIYIA?" for a document, now also true for "What did I write about ARRIYIA in my notes?") — reaches chat directly, whether the note matched semantically or by an exact literal term the embedding model missed.

## Cross-source intelligence

Documents, images, spreadsheets, notes, knowledge-graph evidence, and memory now all independently contribute to the same turn's context, each in its own clearly labeled block (`{{context}}`, `<visual_context>`, `<spreadsheet_analysis>`, `<note_context>`, `<knowledge_connections>`, `<personal_context>`). Confirmed via 4 new deterministic tests (Phase 8 Tests C, D, E, I) that two sources genuinely combine in one prompt rather than one overwriting the other — the same discipline Sprint 5 established for chunk-sourced vs. named-entity graph context, now proven across every evidence type.

## Provenance

Every evidence block is self-labeled or externally labeled with its real source: chunk excerpts carry `(Document Title — Page N)` (Sprint 4); images self-label `Image: "title"` inside their content; notes now self-label `(Note: Title)` per match; graph evidence self-labels `Concept:`/`Entity:` plus a source-type breakdown; memory is grouped by section title. No internal database ID is ever exposed in prompt text — every label uses a real title, never a UUID.

## Testing

24 new tests, all deterministic at the retrieval/context-contract boundary, none dependent on a particular LLM's wording:
- `retrieveNoteContext.test.ts` (7) — semantic-only pass-through with no lexical terms, boosts a note found both ways, includes a note found only lexically (the ARRIYIA-in-a-note case), never duplicates a note matched both ways, falls back to semantic-only when the lexical search itself fails, labels an untitled note honestly, throws on a genuine RPC error (never-throws lives at the AIService call site, matching `retrieveAssetContext`'s own convention).
- `buildSystemPrompt.test.ts` (+6) — `<note_context>` block rendering, title labeling, the injection guard on both `<note_context>` and (newly) `<visual_context>`, empty-input omission, block ordering, multiple independently-labeled note matches.
- `AIService.test.ts` (+11) — note content reaching the prompt, note matches counted into `contextTrace`, never-throws on `retrieveNoteContext` rejection, plus 8 explicit Phase 8 cross-feature acceptance tests (A/B combined, C, D, E, G, H, I, J).

Full suite: `tsc -b` clean · `vitest run` — **1830/1830 passing** (24 new this sprint) · `oxlint` clean · `vite build` succeeds (pre-existing chunk-size warning only, unrelated). No regression to Milestones 1–6, provider routing, multimodal analysis, or Knowledge Exchange — full suite includes all of their existing tests, unchanged and passing.

## Security

No new database table, RPC, or edge function. `retrieveNoteContext` reuses `match_notes`'s existing RLS-enforced security predicate and, for its own lexical fallback, the exact same authenticated-client + optional `workspace_id` filter pattern `lexicalChunkSearch.ts` already established — no new security predicate to keep in sync. Confirmed both notes and assets are workspace-shareable by reading their actual RLS policies (`0029_note_sharing.sql`, `0031_shared_knowledge_objects.sql`), which is why both evidence blocks now carry the same instruction-vs-data guard the base template already applies to document chunks.

## Not verified (named explicitly, per this engagement's standing rule)

Per the same limitation reported for every prior milestone: this environment has no authenticated browser session against the deployed app. Phase 9's live acceptance script (real PDF/image/note/spreadsheet/knowledge-graph-entity/personal-memory, run against the deployed app, explicitly re-testing "What has ARRIYIA been mentioned about in the article?") was **not run**. What's verified instead: the confirmed retrieval gap is fixed and tested against deterministic reproductions of every Phase 8 scenario, and the rest of the retrieval architecture was independently confirmed correct by reading and testing the actual code, not assumed from documentation.

## Known limitations

- **Cross-conversation retrieval is deliberately not built.** Past conversations are fully searchable in Universal Search (`conversationSearchProvider`) but chat only ever receives the *current* conversation's own history. This is a real gap, but a materially larger and different feature than "make an existing source type's content reachable" — it has real product/UX implications (should NOVA default to citing unrelated past conversations without being asked?), and none of Phase 8's required test scenarios need it. Left for a future, deliberate product decision rather than built opportunistically inside a retrieval-validation sprint.
- **`retrieveAssetContext` still has no lexical fallback**, unlike `assetSearchProvider`. Lower severity than the notes gap (images already reach chat with real analyzed content via semantic search); documented, not fixed this sprint.
- **UI reference chips are not extended to notes/assets/graph/memory.** `resolveReferences.ts` remains document/chapter-only. This is a UI feature (citation chips a user can click), not a model-evidence-access gap — the model's own textual provenance (the labels described above) is already present regardless. Left alone to keep this sprint scoped to retrieval, not UI.
- **Ranking model unchanged.** No recency/importance bonus was added to chat's chunk-level retrieval (unlike Universal Search) — audited and found to be a legitimate granularity difference (those bonuses operate on whole-document metadata that doesn't translate meaningfully to an individual chunk), not a missing weight.

## Deployment status

No edge function changes required — the fix is entirely in how chat's context is assembled client-side; `ai-chat` unchanged this sprint (last verified byte-identical to the repo, still v18, no drift, in Sprint 5).
