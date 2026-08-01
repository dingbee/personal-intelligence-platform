# NOVA PIP Feature Matrix

A living engineering inventory — not user documentation. First drafted as part of the UX-13 Stabilization & Acceptance Sprint, from git history and test coverage. Updated after the user's full acceptance walkthrough of the deployed application.

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
| Knowledge Confidence scoring | 🔲 | — | — | — | — |
| Node lifecycle (merge/rename/archive) | 🔲 | — | — | — | — |
| Explorer virtualization/pagination | 🔲 | — | — | — | — |

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

## Notes

- Acceptance pass completed by the user against the deployed application; all ⚙️ Implemented rows promoted to ✅ Accepted as a batch confirmation ("all fine"), not itemized per-row feedback. If a specific row is later found not to work, flip it back to ⚙️ and record what broke — don't silently re-mark it ✅.
- The NOVA PIP Manual (`docs/manual/`) now has all 8 planned chapters, covering every ✅ Accepted feature above. The one exception is "Deployment reconciliation," which is an engineering/ops item rather than a user-facing feature, so it isn't a Manual chapter itself — it's mentioned contextually where relevant.
- Screenshots are not yet part of the Manual — chapters document behavior first; visual capture is a follow-up pass.
- 🔲 Backlog rows (Knowledge Confidence scoring, node lifecycle, Explorer virtualization, ranking refinements, hybrid/lexical search, zero-result recovery) remain the canonical UX-13 remainder, per the roadmap sequencing already agreed: Universal Search maturity → Knowledge Confidence → Knowledge Actions → Knowledge Collections → Natural Language Commands.
