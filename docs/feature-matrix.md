# NOVA PIP Feature Matrix

A living engineering inventory — not user documentation. First drafted as part of a Stabilization & Acceptance Sprint, from git history and test coverage. Updated after the user's full acceptance walkthrough of the deployed application. Feature work tracked here belongs to the Knowledge Intelligence initiative.

**Status legend**

| Symbol | Meaning |
|---|---|
| ⚙️ Implemented | Code exists (see the Branch column — usually a feature branch, not yet `main`), not yet verified in the deployed app |
| ✅ Accepted | Visible in the running application **and verified by the user** |
| 🔲 Backlog | Not implemented, or intentionally deferred |

Corrected by the Reliability & Truth Audit: this legend previously said ⚙️ meant "merged to `main`," which was never actually true of any current ⚙️ row — the Branch column has always named the feature branch. See `docs/reliability-truth-audit.md` for the full audit; its central finding is that `main` is 11 commits behind this branch and none of the last five feature efforts have reached production, which is why every ⚙️ row below is also, functionally, ❌ Blocked on a deploy rather than on further code work.

**Acceptance pass completed.** The user walked through every ⚙️ Implemented row below against the deployed application and confirmed it working — all such rows are now ✅ Accepted. 🔲 Backlog rows are unaffected (nothing to accept yet). If anything regresses later, flip its row back to ⚙️ and note the issue rather than silently re-marking it ✅.

`Manual` reflects whether the NOVA PIP Manual has a chapter covering this feature. `Tests` reflects whether the module has automated test coverage at all (file existence, not full-coverage confirmation).

---

## Library & Reading

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Document upload (PDF/EPUB/DOCX/TXT/MD) | ✅ | main | ✅ | ✅ | ✅ |
| Collections + tags | ✅ | main | ✅ | ✅ | ✅ |
| Document Detail page | ✅ | main | ✅ | ✅ | ❌ |
| PDF Reader (page rendering + text layer) | ✅ | main | ✅ | ✅ | ❌ |
| EPUB Reader (chapters) | ✅ | main | ✅ | ✅ | ✅ |
| Spreadsheet Reader (xlsx/csv/ods) | ✅ | main | ✅ | ✅ | ✅ |
| Spreadsheet Intelligence (column/type/pattern detection, Analyst Layer, Summary Card) | ✅ | main | ✅ | ✅ | ✅ |
| Image Reader | ✅ | main | ✅ | ✅ | ❌ |
| Image upload + derivatives pipeline (thumbnail/optimized) | ✅ | main | ✅ | ✅ | ✅ |
| Image Lightbox | ✅ | main | ✅ | ✅ | ❌ |
| Mobile image upload fix ("File is empty") | ✅ | main | ✅ | ✅ | ✅ |

## Notes

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Notes CRUD (create/edit/delete) | ✅ | main | ✅ | ✅ | ✅ |
| Note tags | ✅ | main | ✅ | ✅ | ❌ |
| Save conversation → Note | ✅ | main | ✅ | ✅ | ❌ |
| Create note from Reader highlight | ✅ | main | ✅ | ✅ | ❌ |
| Note ↔ Asset linking | ✅ | main | ✅ | ✅ | ❌ |

## Chat & AI

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Multi-conversation Chat page | ✅ | main | ✅ | ✅ | ✅ |
| Provider selection + per-conversation switching | ✅ | main | ✅ | ✅ | ✅ |
| Provider availability detection | ✅ | main | ✅ | ✅ | ✅ |
| Provider fallback chain (multi-hop) | ✅ | main | ✅ | ✅ | ✅ |
| RAG retrieval grounding (document chunks) | ✅ | main | ✅ | ✅ | ✅ |
| Reader Chat Panel (in-reader chat) | ✅ | main | ✅ | ✅ | ✅ |
| NOVA Insight Drawer (Chat) | ✅ | main | ✅ | ✅ | ✅ |
| Reader Insight Drawer (minimize/maximize) | ✅ | main | ✅ | ✅ | ✅ |
| AI Health Dashboard (provider observability) | ✅ | main | ✅ | ✅ | ✅ |
| Memory management (explicit/learned/conversation memory) | ✅ | main | ✅ | ✅ | ✅ |
| Command Bar / NOVA command palette | ✅ | main | ✅ | ✅ | ✅ |

## AI Knowledge Graph & Intelligence

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Knowledge extraction (LLM concepts/entities, manual trigger) | ✅ | main | ✅ | ✅ | ✅ |
| Cross-document relationship detection | ✅ | main | ✅ | ✅ | ✅ |
| Canonical node dedup (resolveCanonicalNode, Phase 9A) | ✅ | main | ✅ | ✅ | ✅ |
| Knowledge Explorer (card grid + filters) | ✅ | main | ✅ | ✅ | ❌ |
| Content Connections graph (documents/notes/highlights/tags, `/knowledge/graph` — distinct from the AI Knowledge Graph below, previously undocumented and mislabeled "Knowledge Graph") | ✅ | main | ✅ | ✅ | ❌ |
| Interactive Concept Graph (SVG, focus/expand/pin) | ✅ | main | ✅ | ✅ | ✅ |
| Graph clustering (connected components) | ✅ | main | ✅ | ✅ | ✅ |
| Deterministic concept matcher (Phase 2B) | ✅ | main | ✅ | ✅ | ✅ |
| Knowledge Node → note/conversation evidence linking (Phase 2B) | ✅ | main | ✅ | ✅ | ❌ |
| Concept Card in Universal Search (Phase 2B) | ✅ | main | ✅ | ✅ | ❌ |
| Node drill-down page (Overview/Related/Timeline, Phase 2B) | ✅ | main | ✅ | ✅ | ❌ |
| Knowledge Confidence scoring (source count/diversity/freshness/relationships) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| Knowledge Actions: Merge Notes | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| Knowledge Actions: Generate Briefing (concept → grounded Note, linked back as evidence) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| Knowledge Actions: Export Knowledge Package (concept → Markdown download) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| Knowledge Collections (cross-type curated groupings, spans documents/notes/conversations/images/concepts) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ❌ |
| Natural Language Knowledge Commands: "Create an executive briefing on X" (typed into NOVA chat) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| AI Workspace Actions v1: Workspace Action Router (shared command-matching layer in AIService.sendMessage) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| AI Workspace Actions v1: Save to Notes (per-message button + "Save this"/"Remember this"/"Capture this"/"Add this to my notes") | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| Node lifecycle (merge/rename/archive) | 🔲 | — | — | — | — |
| Note → Task / Conversation → Project actions | 🔲 | — | — | — | — |
| Explorer virtualization/pagination | 🔲 | — | — | — | — |
| Contradiction detection | 🔲 | — | — | — | — |
| Reading-coverage confidence signal | 🔲 | — | — | — | — |

## Universal Search

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Document search provider (embedding similarity) | ✅ | main | ✅ | ✅ | ❌ |
| Conversation search provider (grouped, scored — Phase 2A) | ✅ | main | ✅ | ✅ | ✅ |
| Notes search provider (Phase 1) | ✅ | main | ✅ | ✅ | ❌ |
| Graph Layer / Concept Card branch (Phase 2B) | ✅ | main | ✅ | ✅ | ❌ |
| Cross-provider ranking refinement (uniform recency bonus, all sources) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| Hybrid semantic + lexical search | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ✅ |
| Zero-result recovery (empty library vs. no match) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ❌ |

## Knowledge Capture

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Quick Capture dialog + command (documents/images/notes/URLs) | ✅ | main | ✅ | ✅ | ❌ |
| Deployment reconciliation (branch → main drift) | ✅ resolved | main | ✅ | ❌ | — |

## Workspace Intelligence

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Workspace Intelligence Hub (homepage) | ✅ | main | ✅ | ✅ | ✅ |
| Executive Dashboard | ✅ | main | ✅ | ✅ | ✅ |
| Workspace Evolution / timeline | ✅ | main | ✅ | ✅ | ✅ |
| Workspace objectives + knowledge gap detection | ✅ | main | ✅ | ✅ | ✅ |
| Workspace management (create/switch/archive) | ✅ | main | ✅ | ✅ | ✅ |

## Settings & Platform

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Provider Control Center | ✅ | main | ✅ | ✅ | ❌ |
| Default provider resolution + overrides | ✅ | main | ✅ | ✅ | ✅ |
| Auth (login/signup/password reset) | ✅ | main | ✅ | ✅ | ❌ |
| Mobile nav drawer | ✅ | main | ✅ | ✅ | ❌ |

---

## Platform Coherence Sprint v1

Not a new feature phase — a correctness/coherence pass across the five Knowledge Intelligence initiative phases above, auditing their integration points and fixing inconsistencies found. Retroactively renamed from "Platform Integration Sprint" to align with the "Platform Coherence" naming this and its v2 successor share: both exist for the same reason — making independently implemented capabilities behave as one product, not a feature addition in themselves. All ⚙️ Implemented, none ✅ Accepted yet.

- Cross-feature integration
- Shared behavior reconciliation
- Knowledge Intelligence consistency

| Fix | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Generate Briefing: search indexing + concept-linking moved into the shared `generateBriefing()` function itself (previously only the concept-page hook did this — briefings created via the chat command were silently unsearchable and unlinked) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ (existing coverage) |
| `useKnowledgeNodeDetails` (Explorer + Dashboard insights): now resolves note/conversation sources, not just documents (a pre-Phase-2B filter was silently dropping them) — same underlying data as the Concept Card/drill-down page, now displayed consistently everywhere | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ❌ |
| Knowledge Confidence now computed and shown on the Explorer's and Dashboard's concept cards, not just the Concept Card in Search and the drill-down page — same `computeKnowledgeConfidence`, fed from the same batched query, no new fetch | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ❌ |
| `AddToCollectionButton` now shows an item's existing collection membership (removable, linked) instead of only offering to add — previously there was no way to see from an item's own page which collections it already belonged to | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ❌ |
| Merge Notes carries forward Collection membership to the merged note (previously silently dropped, since the originals — and their membership links — get deleted) | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | ❌ |
| Docs: "UX-13" references replaced with "Knowledge Intelligence initiative" per user direction — code comments (git-historical, e.g. "UX-13.11 Phase 2B") were deliberately left as-is; only the living docs (this file, the Manual) were updated | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | — | ✅ | — |

### Remaining known inconsistencies (not fixed this sprint — see Integration Report)

- Universal Search has no Collections branch — collections aren't searchable by name, and flat search results don't indicate collection membership. Building this is a new capability, not composition of existing ones, so it's out of scope for a "no expansion" sprint.
- Deleting a document/note/conversation/asset that's a Collection member leaves an orphaned `knowledge_links` row pointing at nothing — consistent with the pre-existing, already-documented "knowledge_links never cascades on deletion" behavior for graph evidence, not a new gap, but worth deciding whether Collections specifically should behave differently.
- Collection-level actions (export a whole collection, generate a briefing spanning a collection) don't exist — only per-item actions do.

## Notes

- Acceptance pass completed by the user against the deployed application; all ⚙️ Implemented rows promoted to ✅ Accepted as a batch confirmation ("all fine"), not itemized per-row feedback. If a specific row is later found not to work, flip it back to ⚙️ and record what broke — don't silently re-mark it ✅.
- The NOVA PIP Manual (`docs/manual/`) now has all 8 planned chapters, covering every ✅ Accepted feature above. The one exception is "Deployment reconciliation," which is an engineering/ops item rather than a user-facing feature, so it isn't a Manual chapter itself — it's mentioned contextually where relevant.
- Screenshots are not yet part of the Manual — chapters document behavior first; visual capture is a follow-up pass.
- 🔲 Backlog rows (node lifecycle, note→task/conversation→project, Explorer virtualization, contradiction detection, reading-coverage) remain the canonical Knowledge Intelligence initiative remainder, per the roadmap sequencing already agreed: Universal Search maturity → Knowledge Confidence → Knowledge Actions → Knowledge Collections → Natural Language Commands.
- Knowledge Actions v1 deliberately shipped three actions that reuse existing infrastructure end-to-end (Notes CRUD, the capability/prompt-template pattern, knowledge_node_sources provenance) and deferred note→task/conversation→project, since those need new Task/Project schema entities — a real design decision, not something to invent unilaterally mid-phase.
- Knowledge Collections v1 added exactly one new table (`knowledge_collections`, identity/metadata only) — membership reuses the existing generic `knowledge_links` polymorphic-edge table (`source_type='knowledge_collection'`) the same way linkNoteToHighlight/linkNoteToConversation/linkNoteToAsset already do, so no new join table or per-type schema was needed to span documents/notes/conversations/images/concepts in one collection.
- Natural Language Knowledge Commands v1 shipped its first (and so far only) recognized command, "Create an executive briefing on X," typed directly into NOVA chat. No new orchestration pipeline was built — `AIService.sendMessage` deterministically recognizes the phrase (no LLM call spent on intent classification) and, when matched, calls Search (`searchKnowledgeConcepts`) to resolve the topic to a concept, then reuses the exact same `generateBriefing` pipeline the concept drill-down page's own button calls (which itself now also folds in Collections membership, not just Confidence/Knowledge Graph/Notes as before). An unrecognized topic gets a graceful "couldn't find that concept" reply instead of a wasted or hallucinated LLM call.
- All 5 phases of the originally agreed Knowledge Intelligence initiative remainder sequence (Universal Search maturity → Knowledge Confidence → Knowledge Actions → Knowledge Collections → Natural Language Commands) are now ⚙️ Implemented. The initiative itself remains paused pending acceptance; the current objective is Platform Coherence Sprint v1 (see below), not a new feature phase.

## AI Workspace Actions v1

A new, separately named workstream — not a Knowledge Intelligence initiative phase and not part of Platform Coherence Sprint v1. Restores and generalizes Chat's "Save to Notes" functionality behind a reusable pathway, per explicit user direction: `Chat UI → Workspace Action Router → Save Knowledge Action → Create Note → Index → Knowledge linking → Confirmation`.

- **Workspace Action Router** (`src/modules/workspace-actions/`): a small `WorkspaceAction<TPayload> { id, match, run }` registry (`registerWorkspaceAction`/`matchWorkspaceAction`/`runWorkspaceAction`), following the same registration-on-import convention as `coreModule`/`knowledge-intelligence/module.ts`/`search/registerBuiltInProviders`/`commands/registerBuiltInCommands`. Generalizes the single hardcoded `if (parseExecutiveBriefingCommand(text))` branch that used to live inside `AIService.sendMessage` into a real router now that a second natural-language command exists — the "not needed yet, now needed" simplification flagged in the prior Product Readiness Audit. The pre-existing "Create an executive briefing on X" command was migrated into this router (`generateBriefingAction.ts`) unchanged in behavior; it is not a new capability.
- **Save Knowledge Action** (`saveMessageToNote()` in `src/modules/notes/api/saveMessageToNote.ts`): the single function behind both entry points below — Create Note → link to conversation → link to the specific message → index → link known concepts. This is the one save pipeline; neither entry point duplicates note-creation logic.
- **Entry point 1 — per-message Save button**: `MessageBubble` gained an optional `onSave`/`saved`/`saving` prop set, wired from `ChatPage` and `ReaderChatPanel` via a new `useSaveMessageToNote` hook. Available on both the user's own messages and NOVA's replies.
- **Entry point 2 — natural language**: "Save this", "Remember this", "Capture this", "Add this to my notes" (`isSaveToNotesCommand`, pure regex, no LLM call) resolve "this" to the most recent **assistant** message in the conversation — a scoping decision (the natural reading of "save this" said right after a reply), not an oversight; saving the user's own last message is a plausible future variant, not this one.
- **Provenance**: notes saved this way carry `generation_metadata: {savedFrom: 'chat-message', conversationId, messageId, messageCreatedAt}` (same JSONB column Summarize already uses for its own provenance shape) plus two `knowledge_links` rows — `target_type='conversation'` (pre-existing) and the new `target_type='message'` (`linkNoteToMessage`, added to the polymorphic `knowledge_links` table with zero schema changes, mirroring `linkNoteToAsset`).
- **Audit finding fixed in passing**: `SaveConversationDialog` (the existing whole-conversation save dialog) never called `indexNote()`/`linkKnownConceptsToSource()` — the exact same "indexing left to the caller, and the caller forgot" bug class Platform Coherence Sprint v1 fixed for Generate Briefing, independently rediscovered here. Fixed by adding the two missing calls; no behavior change to the dialog's UI or scope options.
- Verified in a real browser against a mocked Supabase backend: per-message Save button renders on both roles, creates the note with correct provenance and both links, transitions to "Saved"; the "Save this" chat command produces NOVA's confirmation reply and creates an equivalent note via the same underlying function. tsc/vitest (947 tests)/lint/build all pass.

## Platform Coherence Sprint v2

Like Platform Coherence Sprint v1, a correctness/coherence pass — not a new feature phase — this time following the Product Readiness Audit. Scope was fixed in advance to four items: Explorer navigation, graph terminology, a shared source-resolution helper, and Collection membership error handling. All ⚙️ Implemented, none ✅ Accepted yet.

- Navigation consistency
- Terminology clarification
- Shared source resolution
- Error-state consistency

| Fix | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Knowledge Explorer cards now open the concept drill-down page (`/knowledge/nodes/:id`) — `KnowledgeCard` gained an optional `to` prop that makes its title a `Link`, reusing the same target `ConceptCard` already links to; previously Explorer cards were static, the only card grid in the app that didn't reach the drill-down page | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — (UI wiring, browser-verified) |
| Graph terminology clarified: the AI-extracted concept/entity graph is now consistently labeled "AI Knowledge Graph" everywhere (Explorer's Reconcile button, Interactive Graph panel, Graph Intelligence panel), and the separate documents/notes/highlights/tags relationship graph — previously also just called "Knowledge Graph," a genuine naming collision — is now "Content Connections." Both systems are unchanged; only labels and docs moved | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | — |
| Shared source-reference resolution (`src/modules/knowledge-intelligence/api/sourceResolution.ts`: `fetchTitlesByIds` + `resolveSourceItems`) extracted from three near-identical implementations in `getKnowledgeNodeEvidence` (Evidence), `listCollectionItems` (Collections), and `useKnowledgeNodeDetails` (Explorer/Dashboard) — same skip-if-unresolved behavior everywhere now enforced by one function instead of three copies of it | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ |
| Collection membership error handling: a failed items fetch on a Collection's detail page previously fell back to `[]` and rendered "Nothing in this collection yet" — indistinguishable from a genuinely empty collection. Now shows a loading spinner while fetching, a distinct error state with a Retry button on failure, and the same for `AddToCollectionButton`'s reverse "which collections is this item in" query | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — (UI wiring, browser-verified) |

### Audit findings from this sprint (not fixed — out of scope or pre-existing)

- **The Content Connections graph was completely undocumented before this sprint** — Chapter 4 of the Manual only ever covered the AI Knowledge Graph, and `docs/feature-matrix.md` had no row for the other graph at all, despite it existing since Phase 6C. Fixed as part of the terminology-clarification pass (new Manual section, new feature-matrix row) since it was the direct cause of the naming collision this sprint was asked to resolve.
- **`AddToCollectionButton`'s "Added" indicator can go stale if the membership fetch fails**: the dropdown's per-collection "Added" label derives from the same `membership` query the new error banner covers, but the dropdown itself isn't disabled during an error — a user could click "Add" on a collection the item is actually already in (silently a harmless no-op via the existing `knowledge_links` insert) rather than seeing it pre-marked "Added". Flagged, not fixed: disabling the dropdown during a membership error is a small additional behavior change beyond "add loading/error/retry," so it was left for a follow-up rather than expanding scope mid-sprint.
- **Content Connections' own graph query threw a client-side error in browser testing** (`Cannot read properties of undefined (reading 'map')`, surfaced via the page's existing `isError` handling — the error state itself displayed correctly). This traces into `useKnowledgeGraph`'s composition of `listDocuments`/`listNotes`/`listRecentHighlights`/`listTags`/`listKnowledgeLinks`, none of which this sprint touched — it may be a gap in the test harness's mock fixtures (highlights/tags tables weren't fully seeded) or a genuine pre-existing bug under some data condition. **Resolved by the Reliability & Truth Audit**: reproduced deliberately (mock omitting `document_tags` on a document row → error; mock including `document_tags: []` → no error). Real PostgREST always returns an array for a nested embed, so this is confirmed as a test-harness fidelity gap, not a live defect. No code change needed.

## Reliability & Truth Audit

Not a feature phase — a full-platform verification pass across every implemented capability, run against both a mocked backend (interaction correctness) and, for the first time, the live production Supabase project directly (real rows, real errors, real logs). Full report: `docs/reliability-truth-audit.md`. Five confirmed defects found and fixed; one deployment-gap finding (not a code defect) identified as the dominant blocker to acceptance; two items left open pending a human decision rather than more code.

| Fix | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| AI Workspace Actions NL matcher widened to accept real production phrasings (polite lead-ins, trailing "to/in (my) notes") found by querying live user messages — the v1 exact-phrase pattern would have missed them even if deployed | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ |
| Merge Notes: added loading state and a specific, non-overclaiming error message — previously a failed merge produced zero user-facing feedback | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — (UI wiring, verified via tsc/vitest/build) |
| `useKnowledgeNodeDetails`'s existing-but-unreturned `isError` now exposed with a `refetch`; Explorer and Dashboard insights both now render a distinct error state with Retry instead of silently falling through to "empty" | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — (UI wiring, verified via tsc/vitest/build) |
| `InsightPanel` extended with optional, backward-compatible `isError`/`onRetry`/`errorMessage` props to support the above | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — |
| Knowledge Confidence source-count discrepancy (see note above) fixed — `useKnowledgeNodeDetails` now counts only resolved sources | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ (existing coverage) |

### Findings that are not code defects

- **Deployment gap** — `main` is 11 commits behind this branch and contains zero files under `src/modules/workspace-actions/`; none of Knowledge Confidence, Knowledge Actions, Knowledge Collections, Natural Language Commands, AI Workspace Actions, or either Coherence sprint has reached production. This is the direct, confirmed explanation for the user's real observation that Save-to-Notes "doesn't work" in the deployed app — it was never running there. See Recommendation in the full report.
- **Real production `ai_requests` errors** (missing provider API keys, low Anthropic credit balance, occasional edge-function non-2xx) reviewed directly. Classified as configuration/operational, not code defects — the already-accepted Provider Availability Detection and Fallback Chain features exist to handle exactly this, and this data confirms they're surfacing it correctly in production.
- **One historical note** (`3bb041d4-...`) is missing its embedding — root-caused to a real gap in `SaveConversationDialog` that predated the `095aed9` fix already on this branch. The fix prevents recurrence once deployed; the one existing affected row is a data-cleanup decision, not a code fix, and is left open pending the user's call on whether to backfill it.
- Security/performance advisories from Supabase (mutable `search_path`, RLS policies re-evaluating `auth.*()` per row, leaked-password protection disabled, etc.) were reviewed and are pre-existing infrastructure items unrelated to the audited features — listed as a follow-up recommendation in the full report, not fixed here.
- **Knowledge Confidence's source-count accounting differed between `useKnowledgeNodeDetails` and `getKnowledgeNodeEvidence`**: the Explorer/Dashboard path counted every `knowledge_node_sources` row toward confidence, including ones whose title can't be resolved (e.g. a deleted document); the Evidence/drill-down path only counts resolved evidence. Predated this sprint, surfaced while extracting `resolveSourceItems`, deliberately left unchanged here since a behavior change wasn't part of "no behavior changes" for this sprint specifically. **Fixed in the Reliability & Truth Audit** (see `docs/reliability-truth-audit.md`) — `useKnowledgeNodeDetails` now counts only resolved sources, matching the other path exactly. A second, separate divergence in the same confidence inputs (`relatedConceptCount`, capped at 200 edges on Explorer/Dashboard vs. an unbounded per-node query on Evidence/drill-down) was found in that same audit and is documented there as intentionally deferred, since fixing it needs new query infrastructure.

## UX-14: Intelligence Operating System Evolution

Not a Knowledge Intelligence initiative phase — the platform's next evolution stage, from a workspace users operate into a system that works alongside them. Preceded by three planning documents (no code): `docs/ux-14-strategic-roadmap.md`, `docs/ux-14-engineering-blueprint.md`, `docs/ux-14-architecture-consolidation.md`. Implementation proceeds as small, individually verified milestones — each ⚙️ Implemented here reflects code merged to `main`, not yet user-verified.

| Milestone | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| UX-14.1 — Recommendation Consolidation: `suggestionEngine.ts` + `dashboardRecommendations.ts` merged into one `recommendationEngine.ts` (one `Recommendation` type, one `generateRecommendations({scope, ...})` function), behavior-preserving for both existing consumers | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ |
| UX-14.2 — Planner Integration: `buildReasoningPlan` moved from `ChatPage.tsx` (post-response, UI-only) into `AIService.sendMessage` (pre-LLM-call); carried through `SendMessageResult`, not yet injected into the prompt | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ |
| UX-14.3 — Memory Intelligence, Phase 1 (Confidence Persistence): `ai_memory.confidence` persisted (additive migration `0027_ai_memory_confidence.sql`), the exact discard point at `MemoryManagementPage.tsx`'s `rememberCandidate` closed, retrieval/ranking/prompt text unchanged | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — (no new test file; API-layer pass-through, verified via tsc + live-DB transaction check, see `docs/ux-14-architecture-consolidation.md`) |
| UX-14.3.5 — Memory Capture Pipeline (Discovery + Activation): `detectMemoryCandidates` wired into `useSendMessage` (shared by ChatPage/ReaderChatPanel), `MemoryApprovalPanel` mounted on both surfaces, `rememberCandidate` consolidated into one shared `useMemories()` function used by all three call sites; no automatic saving, no detection/prompt/model changes | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — (no new test file; thin wiring over already-tested `detectMemoryCandidates`, verified via tsc + boot-smoke, see `docs/ux-14-architecture-consolidation.md`) |
| UX-14.4 Phase 1 — Artifact Intelligence Foundation: new `ArtifactKind` registry + deterministic `detectArtifactKind` classifier, tagged into `generation_metadata` by `saveMessageToNote`/`generateBriefing`, a Save As kind picker in `SaveConversationDialog`, an `ArtifactKindBadge` on `NoteCard`, and `KnowledgeCard` (Phase 7B, previously unused) activated on `NoteDetailPage` for the `knowledge_card` kind; no exports, no new schema, no collaboration | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ (19 new tests: `detectArtifactKind`, `artifactMetadata`) |
| UX-14.4 Phase 2 (Path A) — Deterministic Spreadsheet Artifact Export: markdown-table → cell parser, explicit formula cells preserved and never evaluated, `generation_metadata.artifactData` payload, format-agnostic XLSX/CSV export dispatcher, preview + Download action on `NoteDetailPage`, lazy-loaded to keep `xlsx` out of the main bundle; no AI generation (Path B), no formula engine, no PDF/DOCX, no new schema, no collaboration | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ (20 new tests, incl. a real `XLSX.write`/`XLSX.read` round trip catching a formula-drop bug before commit) |
| UX-14.4.5 — Artifact Acceptance Harness: lightweight code-level acceptance path (not a live Supabase/browser harness — explicitly not built, see doc) — a full-pipeline lifecycle integration test, named regression tests for both Phase 2 discoveries (SheetJS formula-drop, eager-`xlsx`-import), and a `npm run verify:bundle` script checking real `vite build` output; zero application code changed | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ (5 new tests; bundle script independently verified to both pass on real output and fail on a simulated regression) |
| UX-14.4 Path B — Artifact Intelligence Generation Discovery: design-only. Maps natural-language spreadsheet generation onto the existing Workspace Action Router (found, not built new) + `runCapability` governance; identifies a real formula-injection risk requiring a new validation allowlist before any LLM-authored formula reaches `buildSpreadsheetWorkbook`; recommends a propose-then-approve consent model (departing from Generate Briefing's auto-save) for generated artifacts | 📝 discovery only | claude/pip-edge-function-deploy-9lzs8n | n/a | n/a | n/a (no code) |
| UX-14.4 Path B — Spreadsheet Specification Contract Discovery: design-only. Proposes a new row/column-oriented `SpreadsheetSpecification` type (distinct from `SpreadsheetArtifactData`) so a future producer never has to compute A1 cell addresses; a `validateSpreadsheetSpecification`/`compileSpreadsheetSpecification` split with a reject-whole-spec failure mode; `SpreadsheetArtifactData`/`buildSpreadsheetWorkbook` left completely unchanged, Path A's parser left as a separate parallel producer | 📝 discovery only | claude/pip-edge-function-deploy-9lzs8n | n/a | n/a | n/a (no code) |
| UX-14.4 Phase 3 — Spreadsheet Specification Compiler: implements the approved specification contract — `specificationTypes.ts`, `validateSpreadsheetSpecification` (typed errors, reject-whole-spec, size caps), `compileSpreadsheetSpecification` (pure, deterministic, O(rows×columns), same-row `{{ColumnName}}` formula placeholder resolution); `SpreadsheetArtifactData`/`buildSpreadsheetWorkbook` unchanged except one additive optional `columnFormats` field; cross-verified byte-equivalent to Path A's markdown parser for the same table; no AI, no Workspace Action, no formula engine, no DB migration | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ (28 new tests, incl. the Path A cross-verification test — the milestone's primary correctness guarantee) |

### Findings from UX-14.3 not fixed this milestone

- ~~**`detectMemoryCandidates` has no live caller**~~ **Fixed in UX-14.3.5** — now wired into `useSendMessage`, called on every turn on both `ChatPage` and `ReaderChatPanel`. `MemoryApprovalPanel`'s candidate queue is no longer always empty in production.
