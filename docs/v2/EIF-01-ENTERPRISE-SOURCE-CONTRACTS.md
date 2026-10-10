# EIF-01 — Enterprise Source Contracts

**Status:** Implementation candidate; verification required  
**Branch:** `feat/eif-01-enterprise-source-contracts` → `v2-development`  
**Scope:** Read-only source contract and snapshot validation only  
**Production:** No deployment and no production migration

## Audit findings

- The V2-11 integration kernel at `src/modules/v2/integrations/service.ts` is a persistence-agnostic, in-memory integration registry. It checks organization/workspace scope, active status, capability registration and governance before preparing an operation. It does not implement operational-system connectors, source snapshots, source freshness or record-level provenance.
- Existing IF-02–IF-06 cross-domain analysis already has a deterministic compatibility evaluator and requires authorized, provenance-bearing evidence. EIF-01 should provide a safe source boundary for future adapters, not replace that evaluator or the intelligence ledger.
- The V2-09 governance PR #44 is stale relative to the post-V2-08/IF baseline. The rebased PR #47 is 11 commits ahead and 2 behind `v2-development`; its Vercel check is successful, but the available status evidence does not certify the full CI/V2 gates or live Supabase security. Governance must not be assumed merged or live-certified.
- V2-14 documentation still describes release certification as in progress. Production `main` remains the V1 baseline; this work must stay preview-only.

## Implemented contract boundary

- Every source is bound to one organization and one Business Space.
- The contract is explicitly read-only and only accepts unique named capabilities ending in `.read`.
- Credentials are represented only by an opaque reference; this contract never stores or transports a secret.
- Freshness policy is explicit and validated.
- Each snapshot carries source identity, organization/workspace scope and observation time.
- Every record retains its source record ID, source-system identity and retrieval timestamp.
- Stale/future snapshots, scope mismatch, inactive sources, duplicate record IDs and invalid provenance are rejected.

## Non-goals

- No connector or live business-system integration is claimed.
- No credentials are fetched and no source data is queried by this module.
- No new database tables, memory store, event ledger, provenance ontology or runtime are introduced.
- No writes or actions are sent to operational systems.
- Existing source authorization/RLS remains authoritative; these pure validators are defense in depth, not an authorization substitute.

## Verification required before closure

1. Targeted EIF-01 Vitest tests pass.
2. TypeScript build, lint, full repository suite and bundle verification pass.
3. ARRIYIA V2 Gate and V2 Certification pass on the exact PR head.
4. No production deployment or production migration occurs.
