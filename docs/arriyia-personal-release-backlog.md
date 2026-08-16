# ARRIYIA Personal — Release Backlog

Produced by Sprint 9.5/10 (Backlog, Technical Debt & Release Scope Review); updated by Sprint 10/10 (Final Platform Validation). This is the authoritative pre-freeze backlog. See `docs/pip-release-scope-v1.md` for the narrative definition of what v1 is and why, `docs/arriyia-product-roadmap.md` for where deferred strategic items go next, and `docs/account-deletion-data-map.md` for the account-deletion contract Sprint 10/10 added.

Baseline audited: `dingbee/personal-intelligence-platform`, branch `main`. Sprint 9.5/10 audited HEAD `ca16138` (Sprint 9/10, verified clean and passing before that audit began); Sprint 10/10 audited HEAD `ee06450` (Sprint 9.5/10, verified clean and passing before this validation began).

**Post-freeze note:** this backlog is scoped to the ARRIYIA Personal v1 release definition above and is left as the historical record for that milestone — nothing below is rewritten or removed. The Professional Intelligence tier that shipped after this freeze (Data/Analysis/Research/Planning/Decision/Action Intelligence, Execution Foundation, Intelligence Ledger, History) has its own backlog reconciliation, including a deployment-drift incident where several already-correct capabilities appeared broken because production was behind the repository — see `docs/production/arriyia-production-truth.md`, the current authoritative production-truth source, for that tier's disposition.

## Release Definition

ARRIYIA Personal v1 is a personal knowledge platform: a user brings in documents, notes, images, and spreadsheets; the platform extracts, indexes, and connects that knowledge into a graph; the user asks questions in natural language and gets answers grounded in their own material, personalized by what the platform has learned about them, with honest handling when it doesn't know something. See `docs/pip-release-scope-v1.md`'s "What ARRIYIA Personal v1 includes" for the full, validated feature list.

## P0 — Release Blockers

**None identified — confirmed twice.** Nine prior sprints (4-9) each specifically audited for correctness, security, reliability, and performance defects at increasing depth and closed every P0-severity issue found along the way (the ARRIYIA-in-article retrieval failure, the image-context integration gap, the memory over-injection gap, the notes-unreachable-from-chat gap, six silent failure paths, three reliability defects, seven performance defects). Sprint 9.5/10's own fresh pass (full backlog-marker search, every prior sprint's "known limitations" reconciled against current code, a fresh end-to-end trace) found nothing at that severity. Sprint 10/10's final validation — a repository-wide RLS/isolation re-audit, a full secrets/hardcoded-identity scan, and the complete regression suite — found nothing either.

## P1 — Release Quality

| Item | Current State | Decision | Reason |
|---|---|---|---|
| Full account deletion | **RESOLVED (Sprint 10/10).** `supabase/functions/delete-account` deletes the Auth account (cascading every owned table via the schema's existing `on delete cascade` design), every owned Storage object (`documents`/`assets` buckets), preserves other users' content in any shared workspace (`workspace_id` uses `on delete set null` everywhere), and refuses to delete a platform-admin account (role-based check, not a hardcoded identity). Settings UI entry point: `DeleteAccountCard`. | **FIXED** | Sprint 9.5/10 deferred this pending a full data-lifecycle map, since it looked ambiguous (hard vs. soft delete) without one. Sprint 10/10's Phase 7 did that mapping (`docs/account-deletion-data-map.md`) and found the schema's own existing FK design already made a safe, deterministic hard-delete implementation possible with no product decision required — what remained (Storage cleanup, the Auth API call) was localized and safe to build now. |

No other P1 items were found in either sprint. Every other issue uncovered was either already closed by a prior sprint, genuinely low-severity, or a deliberate architectural deferral with a documented reason.

## Accepted P2 — Post-Release

| Item | Current State | Reason accepted |
|---|---|---|
| No structured "which source failed" signal to model/UI | Server-side diagnosable (Sprint 8/10 logging); model silently continues with whatever else succeeded | Extending 6 functions' return contracts is a larger, separate change than a hardening pass should absorb |
| `retrieveAssetContext` has no lexical fallback | Semantic-only for images | Lower severity — images already reach chat via semantic search with real content |
| No route-level code splitting | Single ~1.27MB main bundle | Systemic router change, real regression risk, no measured evidence of current harm |
| `listDocuments`/Library page unbounded, no pagination UI | Fetches entire library every load | Needs a UI change (pagination/virtualization), not just a query limit — a raw limit alone would silently hide documents |
| No trigram index for document/note content lexical search | `ILIKE` scoped by indexed columns first | Leading-wildcard ILIKE can't use a btree anyway; no evidence of current cost |
| No live load-testing possible in this environment | Bounds (40-message history, 200-row memory fetch) are reasoned estimates, not load-test-derived | No way to generate/measure production-scale data here |
| `semanticChunker` unimplemented, unreachable | Registered in the chunking registry but never selected (`processDocument.ts` only ever picks `paragraph`/`chapter-aware`); throws if ever invoked | Dead-but-harmless; embedding provider precondition it originally cited is now satisfied, but nothing currently calls it |
| `PlaceholderEmbeddingProvider` unused | Defined, implements the interface, zero production call sites | Dead code from early dev scaffolding; safe to remove in a future cleanup, zero current risk |
| Asset import has no `importedFrom` provenance block | Notes/Knowledge Nodes record one via `generation_metadata`; Assets don't | Documentation was stale (claimed no metadata column exists; `assets.metadata` has existed since Multimodal Intelligence v1) — informational parity gap only, no correctness/security impact |
| Reasoning Planner output not wired into the prompt | Computed and shown in the UI trace, never changes what the model sees | The blueprint's own recommended next step, still not done; touches every live response, needs the same staged verification discipline as any other `AIService` prompt change |
| "Frequently revisited chapter" reading insight | Not computed — no per-chapter visit-count tracking exists to derive it from | Same class of gap as UX-8's "opened N times," deliberately not built without the underlying signal |
| Chart/report/template artifact generation | Only spreadsheet artifacts can be AI-generated | Real gap, not urgent for a *personal* knowledge platform's core proposition |
| "Improve this artifact" | No iterative refinement action on a generated artifact | Real gap, deliberately deferred twice already (Experience Layer discovery, UX-14.4.4) |
| `linkNoteToMemory` has no caller | Ready primitive, never wired up | No existing matching algorithm transfers to memory content; building one was judged speculative |

## Strategic — ARRIYIA Business

| Item | Reason it belongs to Business, not Personal |
|---|---|
| Workspace collaboration / sharing (member roles, shared notes/assets/knowledge nodes) | Already partially built and shipped — flagged explicitly, not removed, since it's tested and working. Multi-user coordination over shared material is an organizational concern; Personal's core proposition is individual knowledge. See the roadmap document's "Product boundaries" section for the full reasoning on why this stays as-is rather than being ripped out. |
| Chart/report/template artifact generation, "Improve this artifact" | Business reporting/analysis is a stronger natural fit than personal knowledge management |
| Advanced permissions beyond the current single member-role model | Organizational governance concern |
| Decision Intelligence / workflow automation (implied by the planner's unused `responseStrategy` classification) | Structured business decision support, not personal Q&A |

## Strategic — ARRIYIA Enterprise

| Item | Reason it belongs to Enterprise, not Personal |
|---|---|
| True background/scheduled intelligence ("noticed something while you were away") | Needs shared scheduled-execution infrastructure this deployment doesn't have — the kind of investment that pays off at institutional scale |
| Agent Capabilities (autonomous multi-step action-taking) with a real permission/confirmation model | Enterprise governance requirements (audit trails, approval chains) are the natural forcing function for building the permission model properly |
| Compliance/governance tooling, departmental knowledge boundaries, institutional memory across many users | Institutional-scale concerns with no Personal analog |

## Future / Exploratory

| Item | Notes |
|---|---|
| Cross-conversation retrieval (past chats as grounding evidence for other chats) | A real, product-sensitive feature — larger than "wire up an existing source type" (Sprint 7/10's own framing). Belongs in Personal's future roadmap, not Business/Enterprise — it deepens the existing personal-memory proposition. |
| UI reference chips for notes/assets/graph/memory | Citation-UI polish, not a model-evidence-access gap (the model already cites these sources in text) |
| Promote `ai_memory` naming-convention personalization to a dedicated `user_profile` table | No current requirement (cross-user query, structured filtering) uniquely needs it; keep the convention until one exists |

## Obsolete / Closed

| Item | Disposition |
|---|---|
| `PlaceholderEmbeddingProvider` | No longer serves its stated "offline dev" purpose (never wired to an env-var switch or any call site) — recommend deletion in a future cleanup, not this sprint |
| Stale "assets has no JSONB metadata column" documentation (`assetPackageTypes.ts`'s own comment) | Factually incorrect as of the Multimodal Intelligence v1 migration; corrected in this backlog's record, source comment left as-is since editing it carries no behavioral effect and is out of this sprint's scope |

## Release Decision

**Nothing blocks the ARRIYIA rebranding/migration phase.** No P0 exists, in either Sprint 9.5/10's or Sprint 10/10's audit. The one P1 (account deletion) — identified by Sprint 9.5/10, resolved by Sprint 10/10 — is closed. Every remaining item has an explicit destination (P2/Business/Enterprise/Future/Obsolete) and none require resolution before the platform can be considered technically ready to become ARRIYIA Personal v1. See `docs/pip-release-scope-v1.md` for the full final-validation conclusion.
