# EIF-04 — Enterprise Knowledge and Memory Context

**Status:** Implementation candidate; CI certification pending  
**Branch:** `feat/eif-04-enterprise-knowledge-memory` → `v2-development`  
**Base:** EIF-03 merge `12e933033cf9c26fa64bb400dd1045cfe044f418`  
**Production:** `main` remains frozen; no production deployment or migration

## 1. Where we came from

- EIF-01 established read-only enterprise source contracts and snapshot freshness/provenance validation.
- EIF-02 established deterministic enterprise identity reconciliation without automatic merges.
- EIF-03 composed governance, source validation and identity reconciliation before candidate identities can be loaded.
- The existing ARRIYIA substrate already includes knowledge graph/source resolution, vector retrieval, memory confidence decay, memory lifecycle logic, shared provenance and the Intelligence Ledger.

## 2. Audit finding

The repository had mature personal/workspace memory and retrieval components, but no EIF boundary that assembles a bounded enterprise context packet with explicit organization/Business Space scope, memory visibility, sensitivity ceiling, expiry/lifecycle filtering and preserved source evidence. Adding another memory store or retrieval stack would duplicate existing capabilities.

## 3. Implemented

Added `src/modules/v2/integrations/enterpriseKnowledgeMemory.ts`:

- Defines typed enterprise memory references with explicit organization, Business Space, owner/visibility, lifecycle, sensitivity, confidence, expiry and source evidence.
- Composes a read-time context packet from candidates supplied by the existing authorized knowledge/memory/retrieval adapter.
- Calls existing V2 governance for `enterprise_knowledge.read` **before** invoking the candidate loader.
- Requires explicit authenticated user and matching organization/Business Space scope.
- Fails closed for cross-scope candidates and duplicate canonical memory IDs.
- Excludes archived/revoked, expired, out-of-owner private, over-classified, malformed and future-dated evidence.
- Preserves source IDs, source-record IDs, source-system identity, observed timestamps and locators in the context packet.
- Reuses the existing `computeEffectiveConfidence` read-time decay function; it does not mutate stored confidence.
- Applies explicit item-count and character budgets and returns omission counts for observability.
- Does not persist context, write memory, create graph nodes, create ledger entries, fetch sources, embed content, or execute agents.

Added `enterpriseKnowledgeMemory.test.ts` to cover evidence retention, tenant/workspace isolation, duplicate IDs, lifecycle/expiry, private visibility, sensitivity ceiling, invalid/future provenance, confidence-decay ranking, context budgets, governance-before-load ordering and user/context mismatch.

## 4. Security and ownership boundaries

- Candidate loading must remain in a trusted server-side adapter that uses authenticated credentials and preserves existing database RLS.
- This contract is defense in depth; it does not replace RLS or existing authorization.
- Existing retrieval and memory modules remain responsible for finding candidates. EIF-04 composes already-authorized candidates into context; it does not add a second retrieval algorithm.
- Existing provenance and Intelligence Ledger remain authoritative; evidence references are carried forward, not copied into a new ledger.
- NoVA Core remains the execution plane. This milestone does not implement agent execution or runtime memory persistence.
- No production migration or deployment is included.

## 5. Acceptance criteria

1. Context requires an authenticated user and explicit organization/Business Space scope.
2. Governance passes before the candidate loader is invoked.
3. Cross-scope records and duplicate canonical IDs fail closed.
4. Private, inactive, expired, over-classified, malformed or future-dated records cannot enter context.
5. Evidence lineage is preserved in every selected item.
6. Existing read-time memory confidence decay is reused without mutating stored memory.
7. Item and character budgets are enforced deterministically.
8. Targeted tests, TypeScript, lint, full CI, V2 Gate and V2 Certification pass on the exact PR head and after merge.
9. Production `main` remains unchanged; no production deployment or migration occurs.

## 6. Next milestone

After EIF-04 passes full post-merge certification, EIF-05 can address cross-domain reconciliation using the existing EIF contracts, knowledge substrate and Intelligence Ledger. Do not advance before EIF-04 closure.
