# IF-06 — Intelligence Contract Final Certification

Status: IF-06 implementation and repository certification are tracked against the current `feat/if-06-intelligence-certification` head, stacked on the verified IF-05 head. This milestone is repository-level certification and closure, not a production release.

## Audit scope

- IF-02 shared domain-output contract and canonical database write boundary.
- IF-03 domain-capability API validation and mandatory recommendation approval.
- IF-04 cross-domain output validation, provenance/citation enforcement, and canonical-ledger persistence.
- IF-05 Intelligence Centre filters, Space scoping, legacy-record semantics, and evidence coverage.
- SQL adversarial fixtures and the CI certification workflow path/branch filters.

## Finding and remediation

The IF-02 TypeScript validator and database RPC accepted empty `evidenceIds` arrays for findings and recommendations. IF-04 already rejected empty citations, leaving the shared single-domain boundary weaker than the cross-domain boundary.

IF-06 closes that gap at both layers:
- Require at least one citation for each finding and recommendation in the TypeScript contract.
- Require at least one citation in the IF-02 SQL RPC before canonical ledger persistence.
- Add adversarial SQL regression fixtures for empty-citation findings and recommendations.
- Harden the IF-04 SQL array-length guard so malformed non-array citation values are rejected without relying on unsafe evaluation order.
- Route the IF-06 branch through CI, ARRIYIA V2 gate, ARRIYIA V2 certification, and isolated SQL certification.

## Invariants retained

- All writes use the existing canonical intelligence ledger.
- The eight canonical domains and cross-domain explicit marker remain unchanged.
- Evidence identifiers must resolve within the same output.
- Recommendations require explicit approval; no action execution is introduced.
- Space/workspace authorization and RLS boundaries are not weakened.
- Legacy records remain unclassified unless explicit domain/cross-domain metadata exists.
- No production deployment, production migration, or merge is part of this milestone.

## Closure criteria

1. Typecheck and lint pass.
2. Domain-contract and Intelligence Centre targeted tests pass.
3. Full repository suite passes.
4. Production build and bundle verification pass.
5. Isolated PostgreSQL harness passes IF-02 and IF-04 adversarial fixtures.
6. ARRIYIA V2 gate and certification pass on the IF-06 head.
7. Changed branch head and workflow results are recorded in the closure report.
