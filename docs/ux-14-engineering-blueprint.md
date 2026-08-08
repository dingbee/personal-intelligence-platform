# NOVA PIP UX-14 Engineering Blueprint

**Status: design only.** No code, migrations, or UI changes were made to produce this document — it defines exactly how UX-14 should be built on top of the existing architecture, per explicit instruction not to implement yet. Builds on `docs/ux-14-strategic-roadmap.md`.

**A note on accuracy before anything else:** writing this blueprint required reading the actual implementation more closely than the Roadmap's survey pass did, and two of its Phase 1 characterizations turn out to be understated. Recorded here rather than silently left inconsistent between documents:

- **Personal Intelligence Layer** is not the empty gap the Roadmap suggested. `src/modules/ai/memory/profileFields.ts` already defines a real, structured, 7-field preference vocabulary (occupation, industry, expertise, goals, communication style, answer length, decision style — single- and multi-select, with a completion tracker and per-field "why this matters" copy), stored as convention-named `ai_memory` rows (`source: 'profile:<field>'`). It's a genuine, working personalization layer — just implemented as a naming convention over the memory table rather than dedicated schema.
- **Proactive Intelligence** is not zero, either. A real rule-based computation layer already exists (`src/modules/intelligence/orchestrator/`: attention, resurfacing, signals, suggestions, workspace insights) and part of it — the single highest-priority attention item — already reaches the actual model prompt today, not just a UI panel. What's genuinely missing is persistence, cross-session delivery, and true background computation — narrower and more specific gaps than "nothing proactive exists."

Both corrections make the engineering work smaller and safer than the Roadmap implied: more of this is completion of existing plumbing than new construction.

---

## 1. Personal Intelligence Layer

### Current state

- `profiles` (`src/shared/types/database.ts:9-16`): `id, email, display_name, default_chat_provider_id, created_at, updated_at` — no goals/working-style/professional-context columns, by design.
- Real personalization lives in `ai_memory` via a naming convention, not the profile table: `profileFields.ts` defines `ProfileFieldKey` (`occupation | industry | expertise | goals | communication_style | answer_length | decision_style`), each stored as one or more `ai_memory` rows with `memory_type: 'explicit_profile'` and `source: 'profile:<field>'`. Single-select fields (occupation, industry, communication_style, answer_length, decision_style) are enforced to at most one row; multi-select fields (expertise, goals) are one row per value.
- `computeProfileCompletion` gives a 0-100% completion score; `PROFILE_FIELD_WHY` gives each field a one-line rationale shown in Settings' `ProfileSection.tsx`.
- These rows are already live in the chat runtime — `retrieveMemoryContext` → `formatMemoriesForPrompt` → injected into the system prompt in `AIService.sendMessage` (`AIService.ts:106,112`), same as any other memory.

### Target state

Two genuinely different directions exist; picking one explicitly (rather than drifting into both) matters:

- **(a) Keep the convention, make the vocabulary less hardcoded.** Fields stay as `ai_memory` rows; only the fixed `ProfileFieldKey` union and options arrays move from hardcoded TS constants toward something more declarative if new fields are added often. Reuses 100% of existing retrieval, prompt-injection, RLS, and edit UI.
- **(b) Promote to a dedicated `user_profile` table** with typed columns. More queryable (e.g., filtering/joining on structured values), but duplicates part of the retrieval/injection pipeline unless that pipeline is refactored to read from two sources, and departs from this codebase's established single-memory-model discipline.

**Recommendation: (a).** It satisfies "build on existing architecture" directly, the convention already works and is already live, and there is no current requirement (cross-user query, structured filtering) that (b) would uniquely solve.

### Required components

- No new module. Extends `src/modules/ai/memory/profileFields.ts` and `ProfileSection.tsx` only, if/when new fields are added.

### Database impact

None required. (Option (b), if ever chosen instead, would need a new `user_profile` table — not designed here since it's not the recommended path.)

### AI runtime impact

None new — already wired (see Current state). Future work here is about prompt-formatting priority among existing fields, not new plumbing.

### UI impact

None required beyond what exists (`ProfileSection.tsx` already renders this). Additive only if the field vocabulary grows.

### Dependencies

None — foundational, no upstream UX-14 dependency.

### Risks

Building a parallel `user_profile` table while the `ai_memory` convention keeps being used elsewhere would recreate the "two implementations of the same concern" pattern this project already corrected twice during the Reliability & Truth Audit (confidence calculation, source resolution). Any future schema evolution here must fully replace the convention, not duplicate it.

### Recommended sequence

**First.** Lowest risk, most existing infrastructure, and Workspace Intelligence (§ later in the Roadmap) and Proactive Intelligence's eventual personalization both become more valuable once this is confirmed as the durable model.

---

## 2. Memory Intelligence

**Phase 1 (Confidence Persistence): ⚙️ Implemented — UX-14.3.** `confidence` is now a real, persisted column, populated on the one path that produces a real score (`MemoryApprovalPanel`'s "Remember" action) and safely null everywhere else. Reinforcement, decay, and prompt-selection ranking (this section's original Target state) remain not implemented — explicitly out of scope for UX-14.3 by instruction. Full record in `docs/ux-14-architecture-consolidation.md`.

**Phase 1.5 (Memory Capture Pipeline): ⚙️ Implemented — UX-14.3.5.** `detectMemoryCandidates` is now called from a live surface — wired once into `useSendMessage` (shared by `ChatPage` and `ReaderChatPanel`), running synchronously after each turn completes over the just-sent user message. `MemoryApprovalPanel` is now mounted on both chat surfaces, so the candidate queue UX-14.3's persistence fix targeted is no longer always empty in production. No detection logic, prompt, or model behavior changed — this phase only supplied the missing caller. Full record in `docs/ux-14-architecture-consolidation.md`.

### Current state (as of UX-14.3.5)

- `ai_memory` (`database.ts`): `memory_type ('explicit_profile' | 'learned_preference' | 'conversation_memory')`, `content`, `source`, `is_active`, `workspace_id` (nullable = global), timestamps, **`confidence numeric | null`** (added `0027_ai_memory_confidence.sql`).
- `scoreMemoryConfidence.ts` computes a deterministic 0-1 score (regex/heuristic: penalizes questions, hypotheticals, hedging, temporary language; rewards strong/explicit markers) at detection time (`detectMemoryCandidates.ts`), for `MemoryApprovalPanel`'s badge and its `MIN_CONFIDENCE` filter.
- `detectMemoryCandidates` is now called live: `useSendMessage.send()` runs it over the raw user `text` immediately after a successful turn, storing results in new `memoryCandidates` hook state. Both `ChatPage.tsx` and `ReaderChatPanel.tsx` mount `MemoryApprovalPanel` against that state, next to their existing insight drawers. Detection remains fully synchronous, client-side, and gated by the pre-existing `containsSensitiveTopic` privacy filter — unchanged by this phase.
- Persistence is a single shared function, `useMemories().rememberCandidate(candidate)`, used identically by `MemoryManagementPage.tsx`, `ChatPage.tsx`, and `ReaderChatPanel.tsx` — `create.mutate({ memoryType, content, source: 'conversation', confidence })`. `MemoryManagementPage.tsx`'s previous local duplicate of this mapping was removed in favor of the shared one.
- Lifecycle is a single manual `is_active` boolean (migration `0018_ai_memory_active_flag.sql`), toggled individually or by category via `setMemoryActive`/`setMemoryCategoryActive`. Full CRUD exists: `createMemory`, `updateMemory`, `deleteMemory`, `deleteAllMemories` (`src/modules/ai/memory/api/memory.ts`) — both `createMemory` and `updateMemory` accept an optional `confidence`.
- Already live in the chat runtime: `retrieveMemoryContext` (capped at `MAX_MEMORIES_PER_TYPE = 10`) → `formatMemoriesForPrompt` → system prompt, in every `AIService.sendMessage` call. `confidence` flows through automatically wherever `AiMemory` rows are loaded (`listMemories` selects `*`) — no retrieval code changed, per instruction.

### Current limitations

1. Confidence isn't visible or usable after creation — a user can't see "how sure is NOVA about this" for an existing memory, only at the one-time approval moment.
2. No reinforcement — a fact restated across 10 conversations scores identically to one mentioned once.
3. No decay — a `learned_preference` from months ago carries the same weight as one from yesterday.
4. The prompt-injection cap (`MAX_MEMORIES_PER_TYPE`) selects by recency (implied "most-recently-updated first" per existing code comments), not confidence or relevance — a low-confidence recent memory can crowd out a high-confidence older one in what the model actually sees.
5. No committed browser-verification harness exists for the full authenticated approve/dismiss/persist loop this phase activates — flagged three milestones running now (UX-14.2, UX-14.3, UX-14.3.5).

### Target state (remaining, not this phase)

Reinforce confidence when a similar fact recurs, decay it when unused, and use it to rank which memories are selected into the prompt when the cap is hit — replacing pure recency with confidence-weighted selection. Surface it to the user on existing memory cards ("NOVA is fairly confident about this, based on 4 mentions"). None of this is built yet; UX-14.3 Phase 1 only made the value durable and retrievable, per its explicit constraints (no decay, no aging, no ranking change, no UI redesign).

### Required components (Phase 1 — done)

- ~~Persist confidence at write time~~ **Done** — `rememberCandidate` passes `candidate.confidence` through; manual entries and profile fields correctly stay `null` (not an inference, not a fabricated baseline).
- A reinforcement step (near-duplicate detection confirmed **not** to exist in `detectMemoryCandidates.ts` — grounded, not assumed) — **not built**, future work.
- A decay calculation — **not built**, future work; still recommend on-read computation over a stored decaying value (see Dependencies).
- `formatMemoriesForPrompt`'s selection-when-capped logic — **unchanged**, per explicit instruction ("do not change ranking, do not change filtering").

### Database impact

Additive only: `confidence numeric` (nullable, `check (confidence is null or (confidence between 0 and 1))`) on `ai_memory` — applied both to the live Supabase project and as `supabase/migrations/0027_ai_memory_confidence.sql`. No `last_reinforced_at` added — nothing in this phase uses it, and adding unused schema would be speculative; a future reinforcement phase adds it when it has a real writer. No destructive change, no new table.

### AI runtime impact

None. `formatMemoriesForPrompt`'s cap logic is unchanged; the write path gained one optional field, not new logic.

### UI impact

None in this phase (explicit constraint: "no UI redesign"). `confidence` is available on every `AiMemory` object returned by `listMemories`/`useMemories` for a future consumer, but `MemoryCard` does not render it yet.

### Dependencies

A genuine decay model (confidence drifting down without user action) needs *something* to recompute it periodically. Two options: compute it live on read as a pure function of stored confidence + elapsed time (no storage of the decayed value, no background job) — or run it on a schedule, which needs the same missing background-execution infrastructure Proactive Intelligence's second increment needs. **Recommend the on-read approach specifically to avoid pulling in that dependency prematurely.**

### Risks

An overly aggressive decay/reinforcement model can make memory feel unstable ("NOVA forgot something I told it once"). The curve should be conservative by default, and the existing manual `is_active` toggle must always override any computed decay — the user's explicit choice should never be silently outranked by an algorithm.

### Recommended sequence

**Second.** No dependency on § 1, deepens something already live in production today, and is the most contained, lowest-schema-risk area of the four.

---

## 3. Proactive Intelligence

### Current state

More already exists than a first pass suggests (see the correction note at the top of this document):

- `src/modules/intelligence/orchestrator/` — `attentionEngine`, `resurfacingEngine`, `signalEngine`, `suggestionEngine`, `workspaceInsightEngine`, `decisionEngine`, `priorityEngine` — compose an `InteractionState` (attention items, resurfaced knowledge, workspace insights, action suggestions, signals) via `buildInteractionState` (`orchestrator.ts`).
- This runs **client-side, after each chat turn completes** (`ChatPage.tsx` comment: "requests InteractionState once per completed turn"), feeding only the `NovaInsightDrawer` UI panel. It never runs independent of a chat turn, is never persisted, and is recomputed from scratch (then discarded) every time.
- Separately, `resolveAttentionContext` (`contextResolver.ts:76-99`) reuses the same `detectAttentionItems` engine to select the single highest-priority attention item and inject it into `NovaContext` → the actual system prompt via `buildNovaContextPrompt`. **This is already a live, if narrow, proactive signal reaching real model responses today** — a materially different (and more valuable) integration point than the UI-only `InteractionState` path, worth building on rather than replacing.
- A second, separate, smaller recommendation function exists on the Hub page — `generateDashboardRecommendations` (`dashboardRecommendations.ts`) — that partially duplicates `suggestionEngine.ts`'s `deriveActionSuggestions` (both wrap existing commands with a reason string, computed independently, with overlapping trigger conditions).
- The delivery surface for anything resembling a notification is inert: `TopBar`'s bell is `disabled`, titled "No notifications yet."
- No background/scheduled execution exists anywhere — `supabase/functions/` has exactly two request/response functions (`ai-chat`, `provider-availability`); no `pg_cron`, no scheduled function.

### Target state

Two clearly separated increments — conflating them into one undifferentiated "Proactive Intelligence" feature is the main design risk here:

1. **Persistent, cross-session, delivered-outside-chat suggestions.** Consolidate the existing (overlapping) computation into one source, persist its output with read/dismissed state, and surface it through the currently-disabled notification bell. No new background execution required — it can still compute synchronously on page load/app open, just write to a table instead of only holding it in React state, so it survives across sessions and can be dismissed permanently.
2. **True background-computed intelligence** ("NOVA noticed something while you were away") — requires scheduled execution this project doesn't have. Explicitly out of scope for this increment; needs an infrastructure spike first.

### Required components

- Consolidate `suggestionEngine.ts` and `dashboardRecommendations.ts` into one recommendation source **before** either is extended further — doing this after persistence ships would mean migrating persisted duplicate logic later, not just refactoring code.
- A `notifications` (naming TBD) module: persistence API + hook.
- Wire the `TopBar` bell to that store (enable it, add a dropdown/panel).

### Database impact

One new, additive table (e.g., `workspace_suggestions`: `id, user_id, workspace_id, kind, content/reason, source_command_id, created_at, read_at nullable, dismissed_at nullable`). No change to existing tables. Sized for increment 1 only — increment 2 may need additional fields (e.g., a dedup/debounce key) not designed here, since it's future exploration per the Roadmap.

### AI runtime impact

None for increment 1 — pure consolidation and persistence of already-computed, rule-based (non-LLM) suggestions. Increment 2 would need new runtime/infra, not just new app code.

### UI impact

Activate the existing, currently-disabled notification bell; add a dropdown/panel listing persisted suggestions with a dismiss action. No other new UI surface needed for increment 1.

### Dependencies

Increment 1 depends on nothing outside itself — can proceed in parallel with §§ 1-2 if sequencing pressure requires it, though sequencing after § 1 lets suggestions eventually be personalized rather than purely workspace-generic. Increment 2 depends on a scheduled-execution infrastructure decision (Roadmap's "future exploration").

### Risks

- Persisting on top of two still-duplicated recommendation engines would bake the duplication into a database table, making it harder to unify later — consolidate first, persist second.
- A persisted-but-never-dismissed suggestion needs a real staleness rule (e.g., auto-expire "continue reading X" once the user finishes or deletes that document), or the notification feed silently accumulates garbage. This needs an explicit invalidation design, not just a `dismissed_at` column and an assumption it'll get used.

### Recommended sequence

**Third**, after §§ 1-2 — so suggestions can eventually be personalized/confidence-weighted — though the consolidation-and-persistence work has no hard technical blocker and could start earlier if needed.

---

## 4. Intelligence Layer (reasoning/planning)

### Current state

Two genuinely distinct subsystems exist under `src/modules/intelligence/` — conflating them would misstate what's already true:

1. **The context/orchestrator system** (`contextResolver.ts`, `orchestrator.ts`) **already influences real model responses.** `resolveNovaContext` assembles workspace/activity/user/knowledge/memory/attention(top item)/evolution context into `NovaContext`, formatted by `contextFormatter.ts` and appended to the system prompt via `buildNovaContextPrompt` — live, in every chat turn, today.
2. **The planning/reasoning system** (`intent/`, `planner/`, `decision/`, `strategy/`, `learning/`) **does not.** `buildReasoningPlan` (`planner.ts`) classifies intent via `classifyIntent` and selects a strategy from a fixed rule table (`planningRules.ts`) — its own comment states it "performs no AI work." Computed in `ChatPage.tsx`, its output is rendered only in a reasoning-trace / "Explain My Answer" UI panel. It is never passed into `AIService.sendMessage` and never reaches the system prompt.

### Target state

A deliberate choice between two real options, stated explicitly rather than defaulted into:

- **(a) Feed the existing planner's output into the prompt.** `buildReasoningPlan`'s `intent` / `responseStrategy` / `requiredContext` already exist — pass them into prompt construction so the classified intent and chosen strategy actually shape what's sent to the model, not just a UI trace. Reuses the existing rule-based classifier; no new AI call; a wiring change plus new prompt text.
- **(b) Let the plan drive code-path/tool selection**, not just prompt text (e.g., a `multi-step` classification triggers a different execution path). This is substantially larger and overlaps directly with Agent Capabilities, which the Roadmap already deferred to future exploration — pulling it in here under a different heading would be exactly the kind of scope drift Phase 2's constraints were meant to prevent.

**Recommendation: (a) only, for UX-14.**

### Required components

- Move `buildReasoningPlan`'s invocation from `ChatPage.tsx` into `AIService.sendMessage`, alongside the existing `resolveNovaContext` call — this is the one real plumbing gap: the plan is currently computed in the UI layer, but prompt assembly happens in `AIService.ts`, which doesn't receive it.
- Extend `buildNovaContextPrompt` (or add a sibling prompt-fragment function) to render the plan's `intent`/`responseStrategy` into prompt text.
- `SendMessageResult` gains the computed plan so `ChatPage.tsx` reads it back for the trace panel instead of computing it a second time — this also removes a live duplication: the plan is currently computed once for display, with the same underlying signals separately available inside `AIService`.

### Database impact

None — this is prompt construction and control flow only, no new persistence.

### AI runtime impact

Direct and central: `AIService.sendMessage`'s system-prompt assembly changes to include reasoning-plan-derived text on every call; `SendMessageResult`'s shape gains the plan.

### UI impact

`ChatPage.tsx`'s reasoning-trace panel changes from "compute your own trace" to "read the trace `AIService` already computed" — same visual output, different data source. No new UI surface.

### Dependencies

None on §§ 1-3, though sequencing after § 1 is sensible since a richer profile model could eventually feed `classifyIntent`/`selectResponseStrategy` too.

### Risks

This is the one area where "no coding yet" is easiest to violate in spirit without realizing it — the change looks small (thread one more parameter through) but alters what the model actually sees on every live chat turn in production. It needs the same staged verification this project has applied to every other `AIService` change (mocked-backend browser test, then a check against real transcripts), not a casual wire-up, given the live blast radius established by RC1's deployment.

### Recommended sequence

**Fourth.** Smallest in schema/infra terms but highest in "touches every live response" blast radius — should land after §§ 1-3 establish the pattern of shipping UX-14 increments safely against the live product, not first just because it looks structurally simple.

---

## 5. Artifact Intelligence

Not one of the four areas this blueprint originally scoped — added retrospectively because UX-14.4 grew into a real fifth track after this document was first written. Kept short rather than retrofitting the full nine-subheading blueprint ritual onto work that's already implemented; full technical detail lives in the dedicated documents this section points to, not duplicated here.

**Current state (as of UX-14.4.4).** NOVA can classify what an AI response *is* (`ArtifactKind` — Phase 1), export a deterministically-parsed spreadsheet to XLSX/CSV with formulas preserved and never evaluated (Path A — Phase 2), compile a structured, address-free `SpreadsheetSpecification` into the same output type Path A produces (Phase 3), generate one from a natural-language request through the full validated pipeline (UX-14.4.2), and present that output as a recognizable object rather than plain chat text (UX-14.4.3). UX-14.4.4 closed the gap between what UX-14.4.3 built and what it actually surfaced: a real regression (the "not saved yet" framing silently disappearing behind the new preview card) is fixed with an explicit unsaved-state badge; `creationMethod`, written since UX-14.4.3 but read by nothing, now has a display label and a line on `NoteDetailPage.tsx`; and a saved artifact's related knowledge — already recorded by `linkKnownConceptsToSource` for every note, but only ever queryable node-first — is now readable note-first too and shown via the existing `SourceReference` chip primitive. None of this touched persistence, the Save-to-Notes pipeline, or added a table. Full records: `docs/ux-14.4-knowledge-artifact-architecture.md` (Phase 1), `docs/ux-14.4-phase2-spreadsheet-artifact-discovery.md` (Phase 2 + the UX-14.4.5 acceptance harness), `docs/ux-14.4-path-b-generation-discovery.md` and `docs/ux-14.4-spreadsheet-specification-discovery.md` (Path B design), `docs/ux-14.4.3-artifact-experience-layer-discovery.md` (Experience Layer discovery), `docs/ux-14-architecture-consolidation.md` (UX-14.4.1 through UX-14.4.4 implementation records).

**Target state (remaining, not yet built).** Chart/report/template artifact kinds have no generation capability yet — only spreadsheets do. `columnFormats`/column `type` hints still don't map to an actual Excel number format. A saved multi-sheet generated spec loses its sheet names and format hints on the Save-to-Notes markdown round-trip (both already-inert fields today, so a disclosed, zero-impact gap rather than a regression). Automatic "which memories relate to this artifact" matching is not built — `linkNoteToMemory` is a ready primitive with no caller yet, deliberately: no existing matching algorithm transfers to memory content, and building one, or plumbing memory ids through `retrieveMemoryContext`'s string-only return type, was judged speculative for both UX-14.4.3 and UX-14.4.4. A "Reviewed" or "Improved" artifact lifecycle state has no home yet either — there is no persisted row before a Save happens, so those states are chat-history-only today. No "Improve this artifact" capability exists — the highest-value next AI-generation feature identified across both the Experience Layer discovery and this milestone's own findings, deliberately deferred both times as feature expansion rather than polish.

**Risks.** The formula-injection risk the Path B architecture discovery identified is now actually mitigated, not just described: `validateFormulaSafety` runs on every compiled formula cell before `renderSpreadsheetArtifactMarkdown` ever sees it, and a rejection fails the whole generation closed (no partial output, nothing sanitized-and-passed). A second, unrelated risk was found and fixed during UX-14.4.2's own implementation, not predicted in advance: reusing `sheetToGrid.ts` (which imports `xlsx`) from the new eagerly-registered Workspace Action pulled the ~330KB `xlsx` library into the main bundle — caught by `verify:bundle` before commit, fixed by giving `cellAddressing.ts` a dependency-free `decodeCellAddress`, now covered by a permanent regression test. UX-14.4.3 checked for the same class of regression in its own new eagerly-loaded files and confirmed it didn't recur; UX-14.4.4 did the same for its own changes (main bundle grew ~1KB, matching the new code's own size). A genuinely new finding this milestone: UX-14.4.3's own preview-card work silently dropped a real user-facing signal (§ Current state) — a reminder that "presentation-only, no persistence" changes still carry real UX risk and need the same "trace the actual flow" discipline as anything else, not just a bundle-size check.

**Recommended sequence.** With generation, validation, formula safety, structured preview, provenance, and knowledge-linking all live and correctly surfaced, the next natural step is extending the same `Specification -> validate -> compile -> render` pattern to a second artifact kind (chart is the next-most-requested per the Roadmap), rather than deepening spreadsheet-only capability further — or, alternatively, building the "Improve this artifact" capability now that generation/validation/safety are proven. Sharing/collaboration (UX-14.5) is a separate, larger track blocked on a new authorization model — every table in the schema is still single-owner `auth.uid() = user_id` RLS, confirmed directly against every migration — and is not a prerequisite of, nor unlocked by, any of this artifact-metadata work.

---

## Cross-cutting sequencing

1. Personal Intelligence Layer (§1) — confirm/extend the existing convention.
2. Memory Intelligence (§2) — persist confidence, no new dependency.
3. Proactive Intelligence, increment 1 (§3) — consolidate the two existing suggestion engines, then persist and deliver through the existing (disabled) notification bell.
4. Intelligence Layer (§4) — wire the existing planner's output into the actual prompt, replacing the UI-only trace with a real one.
5. **Decision point, not yet scheduled:** an infrastructure spike for scheduled/background execution (needed for Proactive Intelligence's increment 2), and an explicit permission/confirmation model (needed before Agent Capabilities can be scoped at all) — both remain future exploration per the Roadmap, not part of this blueprint's four sections.

Every section above builds on code that already exists and is already live in production; none requires new database infrastructure beyond additive columns/tables on top of the existing single-owner RLS model, and none requires new AI runtime capability beyond richer prompt construction. That is a direct consequence of treating NOVA PIP v1 as a foundation rather than something to rebuild, per the constraint this blueprint was written under.

---

## Addendum — AI Experience Intelligence v1

This blueprint's own §3 correction called out "persistence, cross-session delivery, and true background computation" as the narrower, more specific gaps than "nothing proactive exists." AI Experience Intelligence v1 (see `docs/ai-experience-intelligence-discovery.md`) closed the **persistence** piece: `dismissed_suggestions` (`0037_dismissed_suggestions.sql`) gives every existing `IntelligenceItem`/`Recommendation` a real, cross-session "I've seen this" mechanism, wired into the Hub's attention/organize/shared/learned zones and its recommendations section. Cross-session delivery (a notification surface beyond in-page rendering) and true background/scheduled computation remain the still-open items from this addendum's own §3 — unchanged, and still a decision point rather than scheduled work.

That phase also closed a small, separate gap in §1's Personal Intelligence Layer: memory retrieval now ranks by the `confidence` score the system has computed since `0027_ai_memory_confidence.sql` but never read back at prompt-assembly time (`rankMemories.ts`), and added one new evidence-backed signal — an unresolved-conversation continuation nudge — to the existing `recommendationEngine.ts` dashboard branch, using data the Hub already fetches.

---

## Addendum — Multimodal Intelligence v1

Outside this blueprint's original four sections entirely — assets/images didn't exist as a concept when this document was written — but worth recording here since it's a foundational AI-runtime change, not a UX increment. See `docs/multimodal-intelligence-v1.md` for the full record. In short: `ChatProviderMessage`/the `ai-chat` edge function gained image-content support (additive; every existing text call site unchanged), one new `analyze-image` vision call was added, and its output is fed into the same `runKnowledgeExtraction` chain documents already use (generalized to `runKnowledgeExtractionFromContent` with a polymorphic `sourceType`) — assets now reach the knowledge graph the same way documents do. Only the OpenAI path is functional in this deployment; Anthropic/Google have symmetric code but no configured secret, same pre-existing limitation the text-chat path already had.

## Addendum — Multimodal Intelligence v2 — Visual Knowledge Intelligence

Extends v1's addendum above rather than opening new ground. See `docs/multimodal-intelligence-v2.md` for the full record. The four "Feature Areas" the task named (OCR, Screenshot, Spreadsheet Vision, Handwritten Notes) are answered as prompt-level framings of the same single vision call plus the same reused document-intelligence extraction — not four new engines — per the task's own explicit "no duplicate intelligence engines" constraint. `analyzeImage`'s parser now also reports a detected language and a self-estimated confidence per dimension (`text`/`entities`/`relationships`), always labeled as the model's own estimate rather than a calibrated score, since no provider in this deployment exposes one for vision output; `ImageReaderPage` surfaces a review-requested banner when any dimension is reported low. `runDocumentIntelligence` was generalized (`runDocumentIntelligenceFromContent`, the same split-function pattern v1 used for knowledge extraction) so an image's transcribed content can produce real dates/decisions/tasks, renderable as a structured Note via a new "Convert to structured note" action — resolving "Notes + Knowledge Nodes + Tasks" without inventing a first-class Task entity this codebase doesn't have. Finally, OCR output stopped being dead text: a new `asset_embeddings`/`match_assets` pair and `assetSearchProvider` (mirroring the existing per-source-type search architecture exactly) make image-derived text genuinely findable through Universal Search, not just stored.

## Addendum — Knowledge Intelligence Layer v1

Also outside this blueprint's original four sections — it evolves the knowledge graph/search/recommendation stack Multimodal Intelligence v1/v2 fed into, rather than the personal-intelligence/memory/proactive/reasoning layers §§1-4 scoped. See `docs/knowledge-intelligence-layer-v1.md` for the full record. The discovery audit found relationship detection, node confidence, relationship strength, BFS/pathfinding, and graph rendering already existed and were well-tested — this phase closes seven narrower gaps instead of building any of that twice: the AI Knowledge Graph can now show a concept's evidence sources (including assets/conversations, via new `GraphNodeType` variants — the first place either has ever been a graph node) as an optional "Show sources" layer on the existing `GraphCanvas`; cross-document relationship discovery (previously manual-button-only) now also runs automatically, fire-and-forget, after every extraction, tagged distinctly so newly-found connections can be surfaced and dismissed; each relationship can report `{relationship, evidenceCount, sources}` rather than a bare confidence number; the evidence timeline is grouped into calendar-month periods instead of a flat recency list; a deterministic query classifier (mirroring `intentClassifier.ts`) answers five question shapes about a concept by dispatching to composers that already existed; one new adaptive capability suggests topical (not just structural) knowledge gaps, always labeled a suggestion; and concept search is now a real, ranked `SearchProvider` inside Universal Search's one ranking pipeline, with a small capped "importance" bonus from evidence-citation counts applied uniformly alongside the existing recency bonus.

## Addendum — Search & Retrieval Unification v1 (PIP Sprint 7/10)

A validation sprint over the retrieval architecture every prior PIP sprint (3-6) had already been extending — see `docs/search-retrieval-unification-v1-discovery.md` and `docs/search-retrieval-unification-v1.md` for the full record. The discovery's central finding, worth recording here since it's an architectural fact about the codebase rather than a single sprint's feature: ARRIYIA has **two parallel retrieval paths**, not one — chat's own purpose-built retrieval functions (`AIService.ts`'s `retrieveContext`/`retrieveAssetContext`/`retrieveGraphContext`/etc.) and Universal Search's `SearchProvider` registry (`runUniversalSearch.ts`) — that legitimately share the same pgvector RPCs and `hybridScore.ts` lexical-boost logic at two different granularities (chunk-level grounding vs. document-level browsing) rather than duplicating them. The one place this divergence became a real gap rather than a deliberate design choice: `notesSearchProvider` has done full hybrid search over note content since UX-13.11 Phase 1, but chat's retrieval path never queried notes at all — a note-only fact was unreachable from chat unless a knowledge-graph node for it already existed from a different source. Fixed with `retrieveNoteContext.ts`, the same shape as the existing `retrieveAssetContext.ts`, reusing `match_notes` rather than a new mechanism. The sprint's security pass also found and closed a second, smaller pre-existing gap: `<visual_context>` (analyzed images, workspace-shareable since Multimodal Intelligence v2) never carried the evidence-not-instruction guard `{{context}}` has had since Sprint 4 — now shared verbatim by both `<visual_context>` and the new `<note_context>` block. Two real gaps deliberately left open rather than expanded into during a validation sprint: cross-conversation retrieval (past chats as grounding evidence — a materially larger, more product-sensitive feature than "wire up an existing source type") and UI reference chips for notes/assets/graph/memory (a citation-UI feature, not a model-evidence-access gap).

## Addendum — Reliability & Error-Handling v1 (PIP Sprint 8/10)

A hardening sprint, not an expansion sprint — see `docs/pip-reliability-v1-discovery.md` and `docs/pip-reliability-v1.md` for the full record. The discovery's central finding: the reliability architecture built across Sprints 4-7 was already mature — a single, consistently reused error taxonomy (`normalizeAiError.ts`'s `AiErrorCategory`) for the AI-call layer, a separate and equally coherent `processing_jobs.status` state machine for document processing, and a consistent "an optional context source must never break the whole turn" contract already followed by every retrieval function chat's context assembly depends on. No second taxonomy, retry system, or provider-routing layer was introduced. Three real defects were found and fixed instead: six optional-context retrieval failures (`retrieveGraphContext`, `retrieveMemoryContext`, `retrieveSpreadsheetContext`, `retrieveNamedEntityGraphContext`, and `AIService.ts`'s asset/note call sites) correctly never broke a chat turn but were also completely unlogged, making a genuine ongoing failure indistinguishable from "this source found nothing" even in server logs; `useAnalyzeImage` discarded an already-successful vision analysis whenever a downstream enrichment step (knowledge extraction or document intelligence) failed, the literal inverse of "never present a failed analysis as successful" — fixed by persisting the core analysis the instant it succeeds and treating both enrichment steps as best-effort; and `quotaService.checkQuota` reported a genuine database failure with the exact same user-facing reason as a legitimate "no active plan" state, fixed to fail closed with an honest, distinct reason. The one gap this sprint identified but deliberately did not close: no structured "which specific source failed" signal reaches the model or the UI today — the logging fix makes failures diagnosable server-side, but extending six well-tested functions' return contracts to carry a failure flag is a larger, separate change than a hardening sprint should absorb in one pass.

## Addendum — Performance & Scale Validation v1 (PIP Sprint 9/10)

A validation/hardening sprint, not a rewrite — see `docs/pip-performance-v1-discovery.md` and `docs/pip-performance-v1.md` for the full record. The discovery's central finding: per-source retrieval result caps, Universal Search's already-concurrent provider execution, the ingestion pipeline's rate-limit-safe sequential embedding batching, and near-complete database index coverage were all already correct — no second retrieval engine, caching system, or indexing system was introduced. Seven real defects were found and fixed instead, all in `AIService.ts`'s orchestration and its immediate dependencies: the chat query was being embedded three separate times per turn (`retrieveContext`/`retrieveAssetContext`/`retrieveNoteContext` each independently calling the embedding provider on identical text) — now embedded once and shared via a new optional `embedding` parameter each function falls back from when omitted; six mutually-independent retrieval sources ran in strict sequence despite none consuming another's result — now run concurrently via `Promise.all`, with the two sources that genuinely depend on that batch's output (`retrieveGraphContext`, `resolveChunkProvenance`) forming a second, still-concurrent stage; `retrieveContext`/`retrieveNoteContext` each ran their own semantic-RPC-then-lexical-search internally in sequence — now concurrent; `quotaService.checkQuota` ran after the entire retrieval pass instead of before it, so an already-over-quota user still paid for a full retrieval cycle before rejection; conversation history sent to the model had no bound at all, so an aging conversation resent its entire transcript on every turn — a new `buildChatHistory` helper caps it at the most recent 40 messages, leaving the UI's own unbounded message list untouched; and `ai_memory` was fetched unboundedly on every chat turn *and* had zero indexes since the table's creation — both closed with a `.limit(200)` and one additive composite index (alongside a second index fixing `messages`'s sort-unsupported single-column index). Two real architectural gaps were found and deliberately left open rather than expanded into: no route-level code splitting exists anywhere in the router (a single ~1.27MB main bundle), and `listDocuments`/the Library page fetch every document unbounded with no pagination UI to safely consume a query-level limit — both confirmed real, neither fixed, since properly closing either is a larger UI-layer change than a hardening sprint's "smallest necessary" scope, and neither had measured evidence of current user-facing harm in an environment with no load-testing or production-scale data available.
