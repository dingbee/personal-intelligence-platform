# PIP → ARRIYIA Personal — Release Scope v1 (Sprint 9.5/10)

This document exists so someone unfamiliar with the project can understand **why we stopped where we stopped** before Sprint 10 (Final Platform Validation) and the eventual freeze. It is the authoritative statement of what ARRIYIA Personal v1 *is*, what it deliberately *excludes*, and why. Read alongside `docs/arriyia-personal-release-backlog.md` (the itemized backlog) and `docs/arriyia-product-roadmap.md` (what comes after Personal).

## How this document was produced

A full-repository audit: every `TODO`/`FIXME`/`HACK`/`XXX` marker (none found — the codebase carries no unresolved inline markers), every "not implemented"/"deferred"/"out of scope"/"known limitation"/"placeholder"/"workaround" comment (23 real hits after filtering false positives, each read in context), every prior sprint's own "Known limitations" / "Target state (remaining)" sections (Sprints 4-9, the UX-14 blueprint's five addenda, the UX-14 strategic roadmap), and a fresh trace of the end-to-end user journey against the current code, not against what a prior document claimed. Every item below was reconciled against the actual current repository state at HEAD `ca16138` — several previously-documented limitations turned out to be stale (the precondition they cited no longer holds) even though the underlying capability itself was still genuinely unbuilt; those are called out explicitly rather than silently carried forward or silently dropped.

## What ARRIYIA Personal v1 includes

A single coherent proposition, validated end-to-end across Sprints 1-9: **bring your personal knowledge in, and get reliable, evidence-grounded, personalized answers about it — with honest failure when the platform doesn't know.**

Concretely, all of the following are shipped, tested, and validated (not aspirational):

- **Authentication**: email/password signup, login, forgot/reset password, session-protected routes. Beta-invite-gated onboarding (`beta_invites` → `user_plan_assignments`), appropriate for a pre-general-availability release.
- **Personal profile**: structured preference vocabulary (occupation, industry, expertise, goals, communication style, decision style), completion tracking, editable in Settings.
- **Knowledge Library**: documents (PDF, EPUB, DOCX, TXT, Markdown, spreadsheets), notes, images, all with collections, tags, search, filtering, and a per-document detail view showing processing status and extraction metadata.
- **Ingestion pipeline**: extraction → chunking → embedding, with an honest `processing_jobs` status machine, real error messages on failure, a working "Reprocess" retry, and rate-limit-safe batched embedding with automatic backoff.
- **Reading**: EPUB and PDF readers with chapter/page navigation, highlights, and an embedded chat panel scoped to the open document.
- **Spreadsheet intelligence**: column/type/pattern detection, precomputed sums/comparisons/trends/anomalies surfaced identically in the reader and in chat — chat never re-derives figures from raw text when a deterministic answer already exists.
- **Image intelligence**: vision analysis, OCR, document-intelligence extraction (dates/decisions/tasks), all reaching the knowledge graph and Universal Search the same way documents do.
- **Universal Search**: hybrid semantic+lexical ranking across documents, notes, images, conversations, and knowledge-graph concepts, with confidence/importance/recency signals, all provider-concurrent and result-capped.
- **AI Conversations**: retrieval-grounded chat with document/note/image/spreadsheet/memory/graph context, each in its own labeled, evidence-not-instruction-guarded prompt block; conversation history bounded (Sprint 9/10); single-hop provider fallback with categorized, honest error messages; streaming with idle-timeout protection.
- **Personal Memory**: a real distinction between explicit profile facts, learned preferences, and conversation-derived memory, relevance-filtered per turn (not "store everything, inject everything"), confidence-ranked, user-editable and individually deletable, with a visible "used by NOVA" trace.
- **Knowledge Graph**: automatic concept/entity extraction and relationship discovery across every source type, confidence-scored, with evidence timelines, a query classifier for common question shapes, and topical gap suggestions — always labeled as suggestions, never fabricated fact.
- **Context, provenance, and honesty**: every retrieved excerpt is labeled with its source document/page/chapter; the model is explicitly told evidence is not instruction (closing the prompt-injection surface Sprint 4 identified); a genuine retrieval/provider failure is logged and, where it can't be worked around, surfaces an honest message — never a fabricated answer presented as a real one.
- **Workspace collaboration**: shared workspaces with member roles, and notes/assets/knowledge nodes that can be shared within a workspace under RLS — present and tested, though this is flagged in the roadmap document as functionality that already leans toward the Business tier's territory (see "Product boundaries" below).
- **Reliability & performance**: the two most recent sprints (8/10, 9/10) specifically hardened error taxonomy, partial-success behavior, and retrieval/orchestration latency — see those sprints' own docs for the itemized record.

## What v1 intentionally excludes

Nothing here is an oversight; each has a documented reason and a destination (P2/Strategic/Future — see the backlog).

- **Full account deletion.** Individual content (documents, notes, images, memories, conversations) can each be deleted today. A single "delete my account and everything in it" action does not exist. This is the one item in this audit closest to a release-quality concern rather than a pure enhancement — see the backlog's P1 entry and the reasoning for not autonomously building it this sprint.
- **Cross-conversation retrieval** (past chats as chat grounding evidence for other chats).
- **UI reference chips** for notes/assets/graph/memory (the model already cites them in text; a clickable citation UI does not exist yet for those four source types — it already exists for document chunks).
- **Reasoning-plan-influenced prompting.** The planner classifies intent and computes a strategy today, and it's shown in the UI's "Explain My Answer" trace — but it does not yet change what's actually sent to the model. This was the blueprint's own recommended next step and remains not done.
- **Chart/report/template artifact generation** — only spreadsheet artifacts can be AI-generated today.
- **"Improve this artifact"** — no iterative refinement action exists on a generated artifact.
- **True background/scheduled intelligence** ("NOVA noticed something while you were away") — needs infrastructure this deployment doesn't have (no scheduled execution exists anywhere in `supabase/functions/`).
- **Agent Capabilities** (autonomous multi-step action-taking) — explicitly deferred pending a permission/confirmation model that doesn't exist yet.
- **Semantic (embedding-similarity) chunking** — registered as a strategy but throws if ever selected; never actually selected by the ingestion pipeline (which only ever picks `paragraph` or `chapter-aware`). Dead-but-harmless.
- **Route-level code splitting / paginated Library** — real performance/architecture facts recorded in Sprint 9/10's own docs, not fixed there, not fixed here either — no evidence of current user-facing harm, and both require a genuine UI-layer change disproportionate to a hardening pass.

## Accepted limitations for v1

These are conscious trade-offs, not defects:

1. **No structured "which source failed" signal reaches the model or UI.** A retrieval failure is diagnosable server-side (Sprint 8/10's logging) but the model can't tell the user "note search specifically failed this turn" — it silently continues with whatever else succeeded. Extending six functions' return contracts is judged a larger, separate change.
2. **`retrieveAssetContext` has no lexical fallback** the way document/note retrieval does — lower severity since images already reach chat via semantic search with real content.
3. **No live load-testing was possible in this environment.** Sprint 9/10's chosen bounds (40-message history window, 200-row memory fetch) are defensible order-of-magnitude estimates, not numbers derived from a load test against a production-scale account.
4. **Asset import provenance parity gap.** Notes and Knowledge Nodes record an `importedFrom` block on import (via `generation_metadata`); Assets don't, because at the time that package type was built, `assets` had no JSONB metadata column at all. **That precondition is now stale** — `assets.metadata` has existed since the Multimodal Intelligence v1 migration — but the provenance-recording code itself was never written to use it. Recorded here as a documentation correction, not treated as urgent (informational parity only, no correctness/security impact).
5. **No trigram (pg_trgm/GIN) index on document/note content for lexical search.** A leading-wildcard `ILIKE` can't use a btree index regardless; both queries are already scoped by an indexed `document_id`/`workspace_id` first. No evidence this is currently slow.

## P0/P1 decisions

**No P0 (release-blocking) issue was found in this audit.** This is the expected, honest result of nine prior sprints each specifically hunting for correctness, security, reliability, and performance defects at increasing depth — Sprint 9.5 did not find anything at that severity that Sprints 4-9 missed. See the backlog's P0 section for the explicit statement of this.

**One P1 (release-quality) item was identified and *not* autonomously fixed**: full account deletion. Per this sprint's own Phase 7 criteria, it was deliberately left to a human decision rather than built now, because:
- Two reasonable, materially different implementations exist (immediate hard delete vs. a grace-period soft delete), and choosing between them is a product/legal decision, not an engineering one.
- It touches every user-owned table plus Storage buckets — a genuinely wide, cross-cutting change, not a localized fix.
- Getting it wrong (deleting too little, leaving orphaned rows, or deleting too much and violating another user's shared-workspace content) is a worse outcome than shipping v1 without it and building it deliberately.

This is recorded as the release backlog's single highest-priority pre-general-availability item, distinct from anything blocking *this* freeze.

## Business candidates

Capabilities already present or clearly implied that fit ARRIYIA Business (organizational, not individual, intelligence) better than Personal:
- Workspace collaboration/sharing (already partially built — see "Product boundaries" below).
- Chart/report/template artifact generation and "Improve this artifact" (business reporting is a stronger natural fit than personal knowledge management).
- Advanced permissions beyond the current single member-role model.
- Decision Intelligence / workflow automation implied by the planner's unused `responseStrategy` classification.

## Enterprise candidates

Capabilities that make sense only at institutional scale:
- True background/scheduled intelligence (needs shared infrastructure, not per-user compute).
- Agent Capabilities with a real permission/confirmation model — enterprise governance requirements (audit trails, approval chains) are the natural forcing function for building this properly.
- Compliance/governance tooling, departmental knowledge boundaries, institutional memory across many users.

## Architectural decisions intentionally deferred

- Whether to promote the `ai_memory` naming-convention-based personalization layer to a dedicated `user_profile` table (blueprint's own §1, option (b)) — recommendation stands at "keep the convention" until a real requirement (cross-user query, structured filtering) emerges.
- Whether Business/Enterprise should be domain-vertical modules (Finance, Legal, HR, ...) or a smaller set of horizontal capabilities reused across domains — see `docs/arriyia-product-roadmap.md` for the reasoning; no decision is made here, deliberately.

## Rationale for major exclusions

Every excluded item above shares one of two properties: it requires a product/UX decision this audit is not positioned to make unilaterally (account deletion's soft-vs-hard-delete question, chart-artifact scope, Agent Capabilities' permission model), or it requires infrastructure this deployment doesn't have and building it speculatively would violate this sprint's own explicit instruction to protect the existing, deliberately-consolidated architecture (scheduled execution, a permission layer, a second chunking strategy nobody currently needs). None were excluded because they seemed unimportant — each has a named home in the backlog or roadmap, not an unmarked drop.
