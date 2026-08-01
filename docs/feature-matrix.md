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

## Knowledge Graph & Intelligence

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Knowledge extraction (LLM concepts/entities, manual trigger) | ✅ | main | ✅ | ✅ | ✅ |
| Cross-document relationship detection | ✅ | main | ✅ | ✅ | ✅ |
| Canonical node dedup (resolveCanonicalNode, Phase 9A) | ✅ | main | ✅ | ✅ | ✅ |
| Knowledge Explorer (card grid + filters) | ✅ | main | ✅ | ✅ | ❌ |
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
