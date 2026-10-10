# EIF-02 — Enterprise Entity Intelligence

**Status:** Implementation candidate; verification required  
**Branch:** `feat/eif-02-enterprise-entity-intelligence` → `v2-development`  
**Base:** EIF-01 merge `325e4352478584d4fb76815c4104f6a5bddf701d`  
**Production:** No production deployment or production migration

## 1. Audit findings

- `src/modules/knowledge-intelligence/api/knowledgeNodes.ts` already routes knowledge extraction through `resolveCanonicalNode`. That existing resolver uses the current user/workspace identity model and normalized titles. It is valuable for knowledge-node deduplication, but it does not define enterprise business identity across independently managed source systems.
- `src/modules/knowledge-intelligence/api/knowledgeRelationships.ts` maps extracted relationships to existing node IDs and rejects missing endpoints/self-loops. It builds graph edges; it does not reconcile cross-system identities.
- `src/modules/knowledge-intelligence/api/sourceResolution.ts` resolves existing source references to labels and drops stale/unresolvable references. It is a display/source-reference helper, not an entity identity registry.
- `src/modules/knowledge-intelligence/api/retrieveNamedEntityGraphContext.ts` intentionally uses exact normalized-title matching and existing graph evidence. Its no-fuzzy-merge boundary should be preserved.
- `src/modules/intelligence-ledger/ledger.ts`, `domainContract.ts` and `api/ledgerQueries.ts` already provide intelligence records, journeys, and lineage. EIF-02 must not add an entity-history or parallel provenance ledger.
- `src/modules/v2/domain/scope.ts` and `src/modules/v2/workspace/authorization.ts` provide explicit scope, membership/RBAC and governance decisions. A string/name match never grants authorization.
- EIF-01 provides read-only source contracts and snapshot validation. It does not provide canonical enterprise identity reconciliation or live connectors.

## 2. Implemented in this milestone

`src/modules/v2/integrations/enterpriseEntityIntelligence.ts` adds a pure, persistence-agnostic contract for:
- Canonical enterprise entity identity references that can be mapped to existing knowledge-node IDs.
- Typed entity categories for organizations, suppliers, customers, invoices, payments, purchase orders, properties, vehicles, products, budgets and related business entities.
- Namespaced identifiers and source evidence references.
- Explicit organization and Business Space scope validation.
- Deterministic reconciliation outcomes: exact identifier match, review-required exact-name candidate, new-entity proposal, conflict, or rejection.
- Identifier collisions, ambiguous identity, cross-type matches and malformed evidence fail closed.
- Out-of-scope candidate identities are excluded from matching and output.
- Name-only matches are never automatic merges; this module does not persist entities or mutate source systems.

`src/modules/v2/integrations/enterpriseEntityIntelligence.test.ts` tests scope isolation, exact identifier matches, name-only review, collisions, cross-type mismatch, invalid evidence, new-entity proposals and malformed candidates.

## 3. Architecture boundary

- Existing knowledge graph remains the graph/evidence substrate.
- Existing source-resolution remains the source-label/reference helper.
- Existing Intelligence Ledger remains the durable intelligence history and lineage.
- Existing V2 authorization/governance and database RLS remain authoritative.
- No second entity graph, source registry, provenance ontology, memory store, history table, retrieval stack, authorization model or agent runtime is introduced.
- No live connector, database write, schema migration, auto-merge, or operational-system mutation is implemented here.
- This deterministic module can only reason over candidates supplied by an already-authorized caller. A production integration must enforce authorization before loading candidates and re-check it at its server/database boundary.

## 4. Acceptance criteria

1. Source observations are explicitly scoped to the active organization and Business Space.
2. Every observation includes a source ID, source record ID, source-system identity and valid observation timestamp.
3. Exact namespaced identifiers can match only one same-type in-scope identity.
4. Name-only matches require review and never merge automatically.
5. Conflicting identifiers, cross-type collisions and ambiguous matches are surfaced as conflicts.
6. Out-of-scope candidates are neither matched nor returned.
7. New-entity outcomes are proposals, not persisted records.
8. Unit tests, TypeScript, lint, full suite, production build/bundle verification, ARRIYIA V2 Gate and V2 Certification pass on the exact PR head.
9. No production deployment or production migration occurs.

## 5. Next milestone

EIF-03 should connect this deterministic identity contract to the existing authorized evidence and domain-intelligence paths, after a separate audit of the safe server-side integration boundary. That work must retain source-level provenance and preserve the distinction between operational records, canonical identity references and derived intelligence.
