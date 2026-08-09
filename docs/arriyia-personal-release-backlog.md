# ARRIYIA Personal — Release Backlog

Produced by Sprint 9.5/10 (Backlog, Technical Debt & Release Scope Review). This is the authoritative pre-freeze backlog. See `docs/pip-release-scope-v1.md` for the narrative definition of what v1 is and why, and `docs/arriyia-product-roadmap.md` for where deferred strategic items go next.

Baseline audited: `dingbee/personal-intelligence-platform`, branch `main`, HEAD `ca16138beedcf4b106be6c93081e0f831186a354` (Sprint 9/10, verified clean and passing before this audit began).

## Release Definition

ARRIYIA Personal v1 is a personal knowledge platform: a user brings in documents, notes, images, and spreadsheets; the platform extracts, indexes, and connects that knowledge into a graph; the user asks questions in natural language and gets answers grounded in their own material, personalized by what the platform has learned about them, with honest handling when it doesn't know something. See `docs/pip-release-scope-v1.md`'s "What ARRIYIA Personal v1 includes" for the full, validated feature list.

## P0 — Release Blockers

**None identified.** Nine prior sprints (4-9) each specifically audited for correctness, security, reliability, and performance defects at increasing depth and closed every P0-severity issue found along the way (the ARRIYIA-in-article retrieval failure, the image-context integration gap, the memory over-injection gap, the notes-unreachable-from-chat gap, six silent failure paths, three reliability defects, seven performance defects). This audit's own fresh pass — full backlog-marker search, every prior sprint's own "known limitations" reconciled against current code, and a fresh end-to-end trace of the user journey — found nothing at that severity that survived to this point.

## P1 — Release Quality

| Item | Current State | Decision | Reason |
|---|---|---|---|
| Full account deletion | Individual content (documents/notes/images/memories/conversations) is deletable; a single "delete my account and everything" action does not exist | **DEFER — human decision required** | Two reasonable, materially different designs exist (immediate hard delete vs. grace-period soft delete); touches every user-owned table plus Storage; getting it wrong is worse than shipping without it. Recommended as the top pre-general-availability priority, not a freeze blocker. |

No other P1 items were found. Every other issue uncovered in this audit was either already closed by a prior sprint, genuinely low-severity, or a deliberate architectural deferral with a documented reason.

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

**Nothing must happen before Sprint 10.** No P0 exists. The one P1 (account deletion) is explicitly a pre-general-availability item, not a freeze blocker — ARRIYIA Personal v1 can be validated and frozen without it, provided it is prioritized before the product is opened beyond its current beta-invite gate. Every other item has an explicit destination (P2/Business/Enterprise/Future/Obsolete) and none require resolution to proceed to Sprint 10.
