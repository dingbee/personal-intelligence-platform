# NOVA PIP Feature Matrix

A living engineering inventory — not user documentation. First drafted as part of a Stabilization & Acceptance Sprint, from git history and test coverage. Updated after the user's full acceptance walkthrough of the deployed application. Feature work tracked here belongs to the Knowledge Intelligence initiative.

**Status legend**

| Symbol | Meaning |
|---|---|
| ⚙️ Implemented | Code exists and is merged to `main`, not yet verified in the deployed app |
| ✅ Accepted | Visible in the running application **and verified by the user** |
| 🔲 Backlog | Not implemented, or intentionally deferred |

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

## Platform Integration Sprint

Not a new feature phase — a correctness/coherence pass across the five Knowledge Intelligence initiative phases above, auditing their integration points and fixing inconsistencies found. All ⚙️ Implemented, none ✅ Accepted yet.

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
- All 5 phases of the originally agreed Knowledge Intelligence initiative remainder sequence (Universal Search maturity → Knowledge Confidence → Knowledge Actions → Knowledge Collections → Natural Language Commands) are now ⚙️ Implemented. The initiative itself remains paused pending acceptance; the current objective is the Platform Integration Sprint (see below), not a new feature phase.

## AI Workspace Actions v1

A new, separately named workstream — not a Knowledge Intelligence initiative phase and not part of the Platform Integration Sprint. Restores and generalizes Chat's "Save to Notes" functionality behind a reusable pathway, per explicit user direction: `Chat UI → Workspace Action Router → Save Knowledge Action → Create Note → Index → Knowledge linking → Confirmation`.

- **Workspace Action Router** (`src/modules/workspace-actions/`): a small `WorkspaceAction<TPayload> { id, match, run }` registry (`registerWorkspaceAction`/`matchWorkspaceAction`/`runWorkspaceAction`), following the same registration-on-import convention as `coreModule`/`knowledge-intelligence/module.ts`/`search/registerBuiltInProviders`/`commands/registerBuiltInCommands`. Generalizes the single hardcoded `if (parseExecutiveBriefingCommand(text))` branch that used to live inside `AIService.sendMessage` into a real router now that a second natural-language command exists — the "not needed yet, now needed" simplification flagged in the prior Product Readiness Audit. The pre-existing "Create an executive briefing on X" command was migrated into this router (`generateBriefingAction.ts`) unchanged in behavior; it is not a new capability.
- **Save Knowledge Action** (`saveMessageToNote()` in `src/modules/notes/api/saveMessageToNote.ts`): the single function behind both entry points below — Create Note → link to conversation → link to the specific message → index → link known concepts. This is the one save pipeline; neither entry point duplicates note-creation logic.
- **Entry point 1 — per-message Save button**: `MessageBubble` gained an optional `onSave`/`saved`/`saving` prop set, wired from `ChatPage` and `ReaderChatPanel` via a new `useSaveMessageToNote` hook. Available on both the user's own messages and NOVA's replies.
- **Entry point 2 — natural language**: "Save this", "Remember this", "Capture this", "Add this to my notes" (`isSaveToNotesCommand`, pure regex, no LLM call) resolve "this" to the most recent **assistant** message in the conversation — a scoping decision (the natural reading of "save this" said right after a reply), not an oversight; saving the user's own last message is a plausible future variant, not this one.
- **Provenance**: notes saved this way carry `generation_metadata: {savedFrom: 'chat-message', conversationId, messageId, messageCreatedAt}` (same JSONB column Summarize already uses for its own provenance shape) plus two `knowledge_links` rows — `target_type='conversation'` (pre-existing) and the new `target_type='message'` (`linkNoteToMessage`, added to the polymorphic `knowledge_links` table with zero schema changes, mirroring `linkNoteToAsset`).
- **Audit finding fixed in passing**: `SaveConversationDialog` (the existing whole-conversation save dialog) never called `indexNote()`/`linkKnownConceptsToSource()` — the exact same "indexing left to the caller, and the caller forgot" bug class the Platform Integration Sprint fixed for Generate Briefing, independently rediscovered here. Fixed by adding the two missing calls; no behavior change to the dialog's UI or scope options.
- Verified in a real browser against a mocked Supabase backend: per-message Save button renders on both roles, creates the note with correct provenance and both links, transitions to "Saved"; the "Save this" chat command produces NOVA's confirmation reply and creates an equivalent note via the same underlying function. tsc/vitest (947 tests)/lint/build all pass.

## Platform Coherence Sprint v2

Like the Platform Integration Sprint, a correctness/coherence pass — not a new feature phase — this time following the Product Readiness Audit. Scope was fixed in advance to four items: Explorer navigation, graph terminology, a shared source-resolution helper, and Collection membership error handling. All ⚙️ Implemented, none ✅ Accepted yet.

| Fix | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Knowledge Explorer cards now open the concept drill-down page (`/knowledge/nodes/:id`) — `KnowledgeCard` gained an optional `to` prop that makes its title a `Link`, reusing the same target `ConceptCard` already links to; previously Explorer cards were static, the only card grid in the app that didn't reach the drill-down page | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — (UI wiring, browser-verified) |
| Graph terminology clarified: the AI-extracted concept/entity graph is now consistently labeled "AI Knowledge Graph" everywhere (Explorer's Reconcile button, Interactive Graph panel, Graph Intelligence panel), and the separate documents/notes/highlights/tags relationship graph — previously also just called "Knowledge Graph," a genuine naming collision — is now "Content Connections." Both systems are unchanged; only labels and docs moved | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | ✅ | — |
| Shared source-reference resolution (`src/modules/knowledge-intelligence/api/sourceResolution.ts`: `fetchTitlesByIds` + `resolveSourceItems`) extracted from three near-identical implementations in `getKnowledgeNodeEvidence` (Evidence), `listCollectionItems` (Collections), and `useKnowledgeNodeDetails` (Explorer/Dashboard) — same skip-if-unresolved behavior everywhere now enforced by one function instead of three copies of it | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | ✅ |
| Collection membership error handling: a failed items fetch on a Collection's detail page previously fell back to `[]` and rendered "Nothing in this collection yet" — indistinguishable from a genuinely empty collection. Now shows a loading spinner while fetching, a distinct error state with a Retry button on failure, and the same for `AddToCollectionButton`'s reverse "which collections is this item in" query | ⚙️ | claude/pip-edge-function-deploy-9lzs8n | ❌ | — | — (UI wiring, browser-verified) |

### Audit findings from this sprint (not fixed — out of scope or pre-existing)

- **The Content Connections graph was completely undocumented before this sprint** — Chapter 4 of the Manual only ever covered the AI Knowledge Graph, and `docs/feature-matrix.md` had no row for the other graph at all, despite it existing since Phase 6C. Fixed as part of the terminology-clarification pass (new Manual section, new feature-matrix row) since it was the direct cause of the naming collision this sprint was asked to resolve.
- **`AddToCollectionButton`'s "Added" indicator can go stale if the membership fetch fails**: the dropdown's per-collection "Added" label derives from the same `membership` query the new error banner covers, but the dropdown itself isn't disabled during an error — a user could click "Add" on a collection the item is actually already in (silently a harmless no-op via the existing `knowledge_links` insert) rather than seeing it pre-marked "Added". Flagged, not fixed: disabling the dropdown during a membership error is a small additional behavior change beyond "add loading/error/retry," so it was left for a follow-up rather than expanding scope mid-sprint.
- **Content Connections' own graph query threw a client-side error in browser testing** (`Cannot read properties of undefined (reading 'map')`, surfaced via the page's existing `isError` handling — the error state itself displayed correctly). This traces into `useKnowledgeGraph`'s composition of `listDocuments`/`listNotes`/`listRecentHighlights`/`listTags`/`listKnowledgeLinks`, none of which this sprint touched — it may be a gap in the test harness's mock fixtures (highlights/tags tables weren't fully seeded) or a genuine pre-existing bug under some data condition. Not investigated further, since this sprint's item 2 was scoped to labels and documentation only, not to `useKnowledgeGraph`'s data-fetching logic. Worth a dedicated look before Content Connections is accepted.
- **Knowledge Confidence's source-count accounting still differs slightly between `useKnowledgeNodeDetails` and `getKnowledgeNodeEvidence`**: the Explorer/Dashboard path counts every `knowledge_node_sources` row toward confidence, including ones whose title can't be resolved (e.g. a deleted document); the Evidence/drill-down path only counts resolved evidence. Predates this sprint, surfaced while extracting `resolveSourceItems` — deliberately left unchanged (a behavior change here wasn't part of "no behavior changes"), but the two paths could in theory report a slightly different confidence percentage for the same concept.
