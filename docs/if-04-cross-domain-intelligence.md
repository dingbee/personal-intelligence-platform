# IF-04 — Cross-domain Intelligence

Status: implementation started. This branch is intentionally stacked on IF-03, which itself is stacked on IF-02. GitHub CI for IF-03 is green; Vercel preview is an external deployment-rate-limit blocker and does not block continued implementation. No production deployment or migration is authorized by this milestone.

## Objective

Add governed cross-domain analysis over the eight IF-03 domain capabilities using the existing shared intelligence substrate. Cross-domain analysis must reconcile incompatible measures and periods before drawing conclusions, preserve evidence lineage, and prevent joins from exposing data the caller is not authorized to access.

## Architectural invariants

- Reuse existing capability/prompt registries, the `domain_intelligence` entitlement, IF-02 output contract, canonical intelligence ledger, and shared provenance types/adapters.
- Do not create per-domain or cross-domain history tables, a parallel retrieval stack, a competing provenance ontology, or a second authorization model.
- Do not broaden access to source records. Any cross-domain context must already be authorized for the requesting user/workspace; joins must preserve source-level permissions and omit or aggregate restricted inputs safely.
- Evidence precedes assertions. Every material cross-domain finding must cite compatible source evidence and retain traceable source references.
- Recommendations remain proposals and require explicit human approval. No autonomous execution or business-system mutation.
- Missing, stale, incompatible, or restricted evidence must be surfaced as a limitation, never silently normalized into a confident conclusion.
- Keep implementation isolated on the V2 feature branch. Do not deploy to production or apply production migrations.

## Cross-domain compatibility contract

Before combining evidence, evaluate and retain:
1. Metric identity and definition (including numerator/denominator where relevant).
2. Unit and currency compatibility; conversions require explicit, evidenced conversion inputs and method.
3. Time-period boundaries, timezone, aggregation grain, and comparability.
4. Source identity, provenance, freshness/as-of time, and evidence quality.
5. Authorization scope for every input and join; restricted rows/fields must not leak through derived output.
6. Contradictions, missing values, and assumptions; incompatible evidence is rejected or reported as non-comparable rather than force-joined.

## Acceptance criteria

1. A single shared cross-domain capability is registered through existing platform registries and gated by `domain_intelligence`.
2. Inputs are constrained to authorized, provenance-bearing evidence; no unscoped source retrieval is introduced.
3. A compatibility evaluator returns explicit compatible, incompatible, or insufficient-evidence outcomes with reasons for metric, unit/currency, period/grain, freshness, and source conflicts.
4. Permission-preserving composition cannot reveal restricted source values through direct output, derived findings, citations, or error details.
5. Every output retains source-level provenance and citations that resolve to evidence included in the authorized input set.
6. Unsupported joins, fabricated conversions, ungrounded causality, and cross-domain conclusions without evidence are rejected or represented as limitations.
7. All recommendations require approval; no execution is performed.
8. Tests cover compatible joins, incompatible metric definitions, unit/currency mismatch, period mismatch, stale/conflicting sources, restricted-data isolation, dangling provenance, malformed output, entitlement denial, and persistence failure.
9. Typecheck, lint, targeted tests, full repository suite, production build/bundle verification, IF-02 SQL certification, and ARRIYIA V2 gates pass.
10. No production deployment or production migration is part of IF-04 implementation verification.

## Delivery sequence

Inspect existing evidence and provenance contracts → define compatibility types and deterministic evaluator → implement the cross-domain capability using authorized supplied context → add adversarial tests for compatibility and authorization boundaries → run targeted checks and full CI → report closure with any external preview limitation explicitly separated from code verification.