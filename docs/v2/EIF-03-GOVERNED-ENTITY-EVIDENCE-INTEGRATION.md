# EIF-03 — Governed Entity/Evidence Integration

**Status:** Implementation candidate; CI certification pending  
**Branch:** `feat/eif-03-governed-evidence-integration` → `v2-development`  
**Production:** No changes to `main`, no production deployment, and no production migration

## 1. Where we came from

- EIF-01 established read-only enterprise source contracts and source-snapshot freshness/provenance validation.
- EIF-02 established deterministic enterprise identity reconciliation without auto-merges or a second graph.
- The existing V2 control plane supplies scoped RBAC and governance decisions.
- The Intelligence Ledger remains the durable intelligence record/lineage path; existing knowledge graph and source-resolution helpers remain the evidence substrate.

## 2. Audit finding: missing integration boundary

The relevant pieces existed independently, but no EIF-specific orchestration boundary required this sequence:

1. Verify authenticated user identity and explicit organization/Business Space scope.
2. Obtain a V2 governance decision for the entity-reconciliation operation.
3. Validate the read-only source contract and snapshot freshness/provenance.
4. Only then load candidate identities through an authorized server-side adapter.
5. Fail closed if the adapter returns cross-scope identities or duplicate canonical IDs.
6. Reconcile using EIF-02 and return the validated source evidence alongside the result.

EIF-02's pure reconciler correctly expected already-authorized candidates, but did not enforce the order in which a caller authorized access and loaded them. The missing boundary was orchestration, not another identity graph, ledger, or authorization system.

## 3. Implemented

Added `src/modules/v2/integrations/enterpriseEvidenceBoundary.ts`:

- Composes the existing `govern` authorization/governance path with EIF-01 snapshot validation and EIF-02 reconciliation.
- Requires an explicit user, organization, and Business Space; rejects caller/context user mismatch.
- Does not invoke the candidate loader until governance passes and the source snapshot validates.
- Supplies only the active organization, Business Space, and user to the candidate-loader interface.
- Fails closed on candidate scope leakage and duplicate canonical identity IDs.
- Returns the validated observation, including source ID, source-record ID, source-system identity, observation timestamp, and locator, with the reconciliation result.
- Does not create graph nodes, persist entities, write Intelligence Ledger records, mutate operational systems, or bypass database RLS.

Added focused tests in `enterpriseEvidenceBoundary.test.ts` for authorization ordering, source lineage retention, RBAC denial, caller/context mismatch, stale evidence, cross-workspace leakage, and duplicate IDs.

## 4. Boundary and limitations

This is a tested application orchestration contract, **not yet a production HTTP endpoint or live database adapter**. The candidate loader must be implemented at a trusted server-side boundary that derives its database session from authenticated credentials and retains existing RLS. The current V2 control-plane store is explicitly persistence-agnostic/in-memory; this milestone does not claim it is a production authentication service.

The existing Intelligence Ledger is not written during reconciliation. A future integration should persist a completed intelligence result only through the existing ledger RPC/path and only when a real derived intelligence record is produced; do not create a parallel entity-history table.

## 5. Acceptance criteria

- Governance happens before candidate loading.
- Invalid, stale, or out-of-scope source evidence never reaches reconciliation.
- Candidate-loader scope violations fail closed.
- EIF-02 remains the only identity reconciliation contract; exact identifier matching and name-only review rules remain unchanged.
- Source provenance is returned with the reconciliation outcome.
- Tests, TypeScript, lint, full suite, production build/bundle verification, ARRIYIA V2 Gate, and V2 Certification pass on the exact PR head.
- Production `main` and production data remain untouched.

## 6. Next milestone

After EIF-03 is certified, EIF-04 can implement a concrete trusted server-side candidate adapter and connect derived enterprise findings to the existing Intelligence Ledger, but only after auditing the current authenticated server transport and RLS contract. No live connector or operational write path should be invented to make a demo pass.
