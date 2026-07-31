# NOVA PIP Feature Matrix

A living engineering inventory — not user documentation. Generated as the first deliverable of the UX-13 Stabilization & Acceptance Sprint, from git history and test coverage, not from memory of what shipped.

**Status legend**

| Symbol | Meaning |
|---|---|
| ⚙️ Implemented | Code exists and is merged to `main` |
| ✅ Accepted | Visible in the running application **and verified by the user** |
| 🔲 Backlog | Not implemented, or intentionally deferred |

As of this draft, every row's `Branch` is `main` (the Stabilization Sprint's reconciliation merge just brought `main` fully current with all UX-13 work through Knowledge Node Search). The `Accepted` column is **not something this document can fill in** — per the three-state model, that requires the user to actually exercise the feature in the deployed app. Every row below is marked ❌ Accepted except the one item explicitly confirmed by the user already. This matrix's job is to give that acceptance pass a checklist, not to pre-answer it.

`Manual` reflects whether the NOVA PIP Manual has a chapter for this feature yet (none do — the Manual is the sprint's second deliverable, not yet started as of this draft). `Tests` reflects whether the module has automated test coverage at all (file existence, not full-coverage confirmation).

---

## Library & Reading

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Document upload (PDF/EPUB/DOCX/TXT/MD) | ⚙️ | main | ❌ | ❌ | ✅ |
| Collections + tags | ⚙️ | main | ❌ | ❌ | ✅ |
| Document Detail page | ⚙️ | main | ❌ | ❌ | ❌ |
| PDF Reader (page rendering + text layer) | ⚙️ | main | ❌ | ❌ | ❌ |
| EPUB Reader (chapters) | ⚙️ | main | ❌ | ❌ | ✅ |
| Spreadsheet Reader (xlsx/csv/ods) | ⚙️ | main | ❌ | ❌ | ✅ |
| Spreadsheet Intelligence (column/type/pattern detection, Analyst Layer, Summary Card) | ⚙️ | main | ❌ | ❌ | ✅ |
| Image Reader | ⚙️ | main | ❌ | ❌ | ❌ |
| Image upload + derivatives pipeline (thumbnail/optimized) | ⚙️ | main | ❌ | ❌ | ✅ |
| Image Lightbox | ⚙️ | main | ❌ | ❌ | ❌ |
| Mobile image upload fix ("File is empty") | ⚙️ | main | ❌ | ❌ | ✅ |

## Notes

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Notes CRUD (create/edit/delete) | ⚙️ | main | ❌ | ❌ | ✅ |
| Note tags | ⚙️ | main | ❌ | ❌ | ❌ |
| Save conversation → Note | ⚙️ | main | ❌ | ❌ | ❌ |
| Create note from Reader highlight | ⚙️ | main | ❌ | ❌ | ❌ |
| Note ↔ Asset linking | ⚙️ | main | ❌ | ❌ | ❌ |

## Chat & AI

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Multi-conversation Chat page | ⚙️ | main | ❌ | ❌ | ✅ |
| Provider selection + per-conversation switching | ⚙️ | main | ❌ | ❌ | ✅ |
| Provider availability detection | ⚙️ | main | ❌ | ❌ | ✅ |
| Provider fallback chain (multi-hop) | ⚙️ | main | ❌ | ❌ | ✅ |
| RAG retrieval grounding (document chunks) | ⚙️ | main | ❌ | ❌ | ✅ |
| Reader Chat Panel (in-reader chat) | ⚙️ | main | ❌ | ❌ | ✅ |
| NOVA Insight Drawer (Chat) | ⚙️ | main | ❌ | ❌ | ✅ |
| Reader Insight Drawer (minimize/maximize) | ⚙️ | main | ❌ | ❌ | ✅ |
| AI Health Dashboard (provider observability) | ⚙️ | main | ❌ | ❌ | ✅ |
| Memory management (explicit/learned/conversation memory) | ⚙️ | main | ❌ | ❌ | ✅ |
| Command Bar / NOVA command palette | ⚙️ | main | ❌ | ❌ | ✅ |

## Knowledge Graph & Intelligence

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Knowledge extraction (LLM concepts/entities, manual trigger) | ⚙️ | main | ❌ | ❌ | ✅ |
| Cross-document relationship detection | ⚙️ | main | ❌ | ❌ | ✅ |
| Canonical node dedup (resolveCanonicalNode, Phase 9A) | ⚙️ | main | ❌ | ❌ | ✅ |
| Knowledge Explorer (card grid + filters) | ⚙️ | main | ❌ | ❌ | ❌ |
| Interactive Concept Graph (SVG, focus/expand/pin) | ⚙️ | main | ❌ | ❌ | ✅ |
| Graph clustering (connected components) | ⚙️ | main | ❌ | ❌ | ✅ |
| Deterministic concept matcher (Phase 2B) | ⚙️ | main | ❌ | ❌ | ✅ |
| Knowledge Node → note/conversation evidence linking (Phase 2B) | ⚙️ | main | ❌ | ❌ | ❌ |
| Concept Card in Universal Search (Phase 2B) | ⚙️ | main | ❌ | ❌ | ❌ |
| Node drill-down page (Overview/Related/Timeline, Phase 2B) | ⚙️ | main | ❌ | ❌ | ❌ |
| Knowledge Confidence scoring | 🔲 | — | — | — | — |
| Node lifecycle (merge/rename/archive) | 🔲 | — | — | — | — |
| Explorer virtualization/pagination | 🔲 | — | — | — | — |

## Universal Search

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Document search provider (embedding similarity) | ⚙️ | main | ❌ | ❌ | ❌ |
| Conversation search provider (grouped, scored — Phase 2A) | ⚙️ | main | ❌ | ❌ | ✅ |
| Notes search provider (Phase 1) | ⚙️ | main | ❌ | ❌ | ❌ |
| Graph Layer / Concept Card branch (Phase 2B) | ⚙️ | main | ❌ | ❌ | ❌ |
| Cross-provider ranking refinement | 🔲 | — | — | — | — |
| Hybrid semantic + lexical search | 🔲 | — | — | — | — |
| Zero-result recovery | 🔲 | — | — | — | — |

## Knowledge Capture

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Quick Capture dialog + command (documents/images/notes/URLs) | ⚙️ | main | ❌ | ❌ | ❌ |
| Deployment reconciliation (branch → main drift) | ✅ resolved this sprint | main | pending user re-test in deployed app | ❌ | — |

## Workspace Intelligence

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Workspace Intelligence Hub (homepage) | ⚙️ | main | ❌ | ❌ | ✅ |
| Executive Dashboard | ⚙️ | main | ❌ | ❌ | ✅ |
| Workspace Evolution / timeline | ⚙️ | main | ❌ | ❌ | ✅ |
| Workspace objectives + knowledge gap detection | ⚙️ | main | ❌ | ❌ | ✅ |
| Workspace management (create/switch/archive) | ⚙️ | main | ❌ | ❌ | ✅ |

## Settings & Platform

| Feature | Status | Branch | Accepted | Manual | Tests |
|---|---|---|---|---|---|
| Provider Control Center | ⚙️ | main | ❌ | ❌ | ❌ |
| Default provider resolution + overrides | ⚙️ | main | ❌ | ❌ | ✅ |
| Auth (login/signup/password reset) | ⚙️ | main | ❌ | ❌ | ❌ |
| Mobile nav drawer | ⚙️ | main | ❌ | ❌ | ❌ |

---

## Notes on this draft

- **Spreadsheet Information Panel ↔ Chat consistency** is the one item with explicit user acceptance so far (confirmed fixed in Spreadsheet Intelligence v1.1) — it's folded into the Spreadsheet Intelligence row above rather than broken out, since it was a fix to that feature, not a separate one.
- Rows marked `Tests: ❌` don't necessarily mean untested behavior — some are pure-UI pages verified only via the session's Playwright scripts (which live in a scratchpad, not the repo) rather than committed test files. That distinction matters for the acceptance pass: a ❌ here means "no committed automated test," not "never verified once."
- This is a first draft generated from module structure and git history, not a hand-audit of every sub-feature — it should be treated as the acceptance pass's checklist, corrected and expanded as you go through it, not as a finished document.
