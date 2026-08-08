# Memory & Personalization v1 (PIP Sprint 6/10)

See `memory-personalization-v1-discovery.md` for the full audit. This sprint is a validation sprint: nearly all of the memory infrastructure — storage, RLS, human-approved detection, structured profile fields, confidence scoring, deletion, and management UI — already existed (UX-5.3A/B, UX-13.6, UX-14.3) and was confirmed correct. One real, structural gap was found and fixed: memory retrieval never received the current question's text, so it could not tell a relevant memory from an irrelevant one. No second memory system, no new table, no new confidence model.

## What was fixed

**`filterMemoriesByRelevance.ts` (new)** — the memory-layer counterpart of Sprint 4/5's lexical relevance fixes. `explicit_profile` and `learned_preference` memories always pass through unfiltered — they're durable, topic-independent personalization (identity, communication style) by their own prompt section titles ("What NOVA knows about you" / "Learned preferences"), and Phase 2's Test A/B explicitly expect a stated preference to keep applying without the user repeating it. `conversation_memory` ("From past conversations") is different by construction — its own detection patterns (`detectMemoryCandidates`: "I'm researching/working on/writing/building/studying X") are inherently project/topic-scoped — so it's the one type Test C's "irrelevant memory must not be injected merely because it exists" actually targets. Reuses `extractLexicalSearchTerms` (Sprint 4/5, unchanged) rather than a new extraction function.

**`retrieveMemoryContext.ts`** — now takes the turn's `text` and applies the filter before formatting. Previously it called `listMemories` and handed up to 30 memories (10 per type) straight to the prompt regardless of what was asked.

**`AIService.ts`** — one-line change: passes `text` through to `retrieveMemoryContext`, matching the shape `retrieveContext`/`retrieveNamedEntityGraphContext` already use.

**`MEMORY_SAFETY_NOTE` (`buildSystemPrompt.ts`)** extended with two clauses, reusing the existing note rather than adding a second one: (1) an evidence-not-instruction guard for `<personal_context>`, mirroring the guard the `rag-chat@1.0` template already applies to `{{context}}` since Sprint 4 — memory content is data about the user, never a command; (2) since `formatMemoriesForPrompt` already orders each section most-recently-updated first (`rankMemories`, unchanged), telling the model to trust the earlier-listed entry when two same-topic memories conflict turns that existing ordering into a real, if partial, answer to Phase 9's Test F (supersession) — without building a new dedup or contradiction-detection system.

**`MemoryCard.tsx`** — the "Used by NOVA" tooltip copy was updated to stay honest now that `conversation_memory` eligibility is conditional on relevance ("...for conversation memories, only when it's relevant to what you're asking"), rather than implying unconditional inclusion. `isMemoryUsedByPrompt`'s underlying rank/cap computation is unchanged — it still answers "is this memory within the type's retrieval window," which remains the correct question; only the copy needed updating.

## What was intentionally not changed

- **Fuzzy/semantic memory deduplication or merging** — would require an embeddings/LLM call to compare memory content pairwise; a real, separate feature, not attempted here. The framing-only fix (trust the more recent entry) preserves the user's ownership of their own memory list — they can manually delete an outdated one — rather than the system silently discarding data it decided was obsolete.
- **Structured Profile fields' update-in-place semantics** — already correct (confirmed in discovery), not touched.
- **Deterministic candidate detection, sensitive-topic blocking, human-approval gate** — already correct, not touched.
- **RLS / user isolation** — already correct (`ai_memory` deliberately excluded from workspace-sharing, confirmed by reading the migration comments directly), not touched.
- **Workspace-scoped vs. global (`workspace_id: null`) memory pools not merging across a workspace switch** — a real, pre-existing behavior from UX-13.6/UX-5.x, not a regression and not touched: redesigning workspace/memory scoping is a product decision outside a validation sprint's scope, and it's ambiguous which behavior is "more correct" without one.
- **A second memory/personalization engine** — the fix is one new pure filter function reusing an already-existing, already-tested extraction function, plus a two-sentence addition to an existing prompt note. No new capability, no new prompt template, no new table.

## Cross-source / boundary validation

Confirmed via reading every `createMemory`/`.create.mutate` call site (not assumed): memory is only ever written from (1) manual entry in Settings, or (2) `detectMemoryCandidates` run against the user's own just-sent chat message, always requiring human approval before persisting. No code path anywhere extracts a memory from a document, note, image, spreadsheet, or another user's content — this is the mechanism that already satisfies Phase 3/Test G ("workspace or document knowledge does not automatically become personal memory") architecturally, not by a runtime check this sprint had to add.

## Evidence & confidence

Unchanged (`scoreMemoryConfidence`, `rankMemories`) — both already deterministic, already honest about uncertainty (manual entries carry a `null` confidence rather than a fabricated score), and already reused consistently across detection, ranking, and the "used by NOVA" UI badge so none of the three can drift from each other.

## Personalization behavior

What NOVA can now do that it could not before this sprint: exclude a stored `conversation_memory` fact from a turn it has nothing to do with, while continuing to apply durable identity/style personalization (`explicit_profile`/`learned_preference`) on every turn regardless of topic — directly answering the product principle "remember what matters" over "store everything," without weakening the durable-preference behavior Test A/B require.

## Testing

18 new tests, all deterministic at the retrieval/context-contract boundary, none dependent on a particular LLM's wording:
- `filterMemoriesByRelevance.test.ts` (9) — explicit_profile/learned_preference always kept; conversation_memory excluded when unrelated (Test C) and kept when a term overlaps; case-insensitive matching; excluded entirely when the question has no extractable terms; a mixed list filters each item independently; empty input.
- `retrieveMemoryContext.test.ts` (7) — null with no stored memories; explicit_profile reaches the prompt regardless of the question (Test A/B); conversation_memory excluded/included by relevance (Test C); workspaceId passed through unchanged; never throws on a listMemories failure; null when every memory is filtered out even though memories exist.
- `buildSystemPrompt.test.ts` (+2) — the personal-context note tells the model to treat entries as information, not instructions; the note tells the model to trust the more-recently-listed entry on a same-topic conflict (Test F).
- `AIService.test.ts` (updated 1) — `retrieveMemoryContext` is now called with `{ userId, workspaceId, text }`, not just `{ userId, workspaceId }`.

Existing coverage already proving other Phase 9 letters (not duplicated): `rankMemories.test.ts`/`formatMemoriesForPrompt.test.ts` (confidence + most-recently-updated ranking — Test D groundwork), `buildSystemPrompt.test.ts`'s pre-existing "must never override or" assertion (Test E — current-instruction precedence, unchanged this sprint), `detectMemoryCandidates.test.ts` (only ever operates on the user's own message text, never document/note content — Test G).

Full suite: `tsc -b` clean · `vitest run` — **1806/1806 passing** (18 new this sprint) · `oxlint` clean · `vite build` succeeds (pre-existing chunk-size warning only, unrelated). No regression to Milestones 1–5, provider routing, multimodal analysis, Universal Search, or Knowledge Exchange — full suite includes all of their existing tests, unchanged and passing.

## Security

No new database table, RPC, or edge function. RLS on `ai_memory` (`auth.uid() = user_id`) confirmed unchanged by reading the actual migration SQL, and confirmed deliberately excluded from the workspace-sharing pattern applied elsewhere (`0028_workspace_members.sql`/`0031_shared_knowledge_objects.sql`'s own comments say so explicitly). The client Supabase instance uses the anon key everywhere (`src/shared/lib/supabase.ts`) — no service-role bypass exists anywhere in app code, so RLS is always enforced. No API key, provider name, or routing detail appears in any new string. The `<personal_context>` block now carries the same evidence-not-instruction guard `{{context}}` has had since Sprint 4.

## Not verified (named explicitly, per this engagement's standing rule)

Per the same limitation reported for every prior milestone: this environment has no authenticated browser session against the deployed app. Phase 10's live acceptance script (teach a preference → new conversation → confirm it applies → change the preference → confirm the new one wins → ask something unrelated → confirm no interference → inspect/edit/delete a memory → confirm deletion takes effect) was **not run**. What's verified instead: the retrieval-relevance gap is fixed and tested against realistic, deterministic reproductions of Phase 2's test scenarios, and the underlying storage/RLS/detection/confidence model was independently confirmed correct by reading and testing the actual code, not assumed from documentation.

Live-testable only, not exercisable here: cross-user isolation (RLS is verified by reading the policy SQL, not by an actual second-user request), and deletion "taking effect" end-to-end through a real Supabase round trip (verified architecturally — a real `DELETE`, no soft-delete, no cache — but not run against a live database in this environment).

## Deployment status

No edge function changes required — the fix is entirely in how chat's context is assembled client-side; `ai-chat` unchanged this sprint (last verified byte-identical to the repo, still v18, no drift, in Sprint 5).
