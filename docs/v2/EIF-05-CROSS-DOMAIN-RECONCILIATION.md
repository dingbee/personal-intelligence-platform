# EIF-05 — Cross-Domain Reconciliation

**Status:** Implementation in progress on `feat/eif-05-cross-domain-reconciliation`  
**Base:** EIF-04 merge `f5790f4fecc92b7f18a53eb7dc611f198ab6a985`  
**Target:** `v2-development`  
**Production:** `main` remains frozen; no deployment or database migration

## Objective

Compare evidence-backed facts about the same EIF-02 canonical entity across independently managed business domains. Surface agreement and discrepancies with source lineage intact; never silently choose a winning operational system.

## Implemented boundary

`src/modules/v2/integrations/enterpriseCrossDomainReconciliation.ts` provides a deterministic, persistence-agnostic reconciliation contract:

- Requires explicit organization and Business Space scope and existing canonical entity IDs.
- Accepts typed observations from finance, procurement, sales, customers, inventory, HR, operations, compliance, projects, and other domains.
- Groups on canonical entity ID plus a stable attribute key; it does not infer entity identity from names.
- Compares strings with conservative case/whitespace normalization, numbers exactly, booleans exactly, and dates by normalized instant.
- Returns `single_source`, `consistent`, or `conflict`; a single observation is not presented as cross-domain agreement.
- Preserves each observation's domain, raw value, source ID, source record ID, source system, observed timestamp, and optional locator.
- Rejects cross-scope observations, malformed values, future-dated/untraceable evidence, and duplicate evidence rather than producing a partial result.
- Produces deterministic group ordering and conflict summaries. It does not pick a winner or mutate data.

## Architecture and security boundaries

- Callers must perform V2 governance and load candidates through an authenticated server-side adapter before invoking this pure comparison boundary.
- Database RLS and existing authorization remain authoritative.
- EIF-02 remains the canonical identity contract; no second identity graph is introduced.
- Existing operational systems remain authoritative for their records.
- Existing Intelligence Ledger remains the durable lineage/history path; EIF-05 does not add a parallel ledger or write ledger entries.
- No automatic record merge, operational-system write, live connector, production endpoint, migration, or production deployment is included.

## Acceptance checklist

- [x] Pure cross-domain comparison contract and explicit scope validation.
- [x] Conflict/consistency/single-source outcomes with provenance retention.
- [x] Deterministic normalization and ordering.
- [x] Unit coverage for agreement, conflicts, scope isolation, malformed/future evidence, duplicate evidence, typed values, and stable ordering.
- [ ] Run targeted tests, TypeScript, lint, full CI, bundle verification, V2 Gate, and V2 Certification on the exact PR head.
- [ ] Fix any failures and rerun affected checks.
- [ ] Merge only after certification; verify `main` remains unchanged.

## Next

Complete CI certification, fix any defects, merge the EIF-05 implementation into `v2-development`, and only then plan EIF-06.
