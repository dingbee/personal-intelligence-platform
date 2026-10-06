# ARRIYIA V2-05 — Knowledge + Memory

## Objective

Create one governed context boundary for knowledge retrieval and memory retrieval that future Intelligence, Agents and Workflows can consume without reaching directly into unrelated V1 stores.

## Implemented

- Space-scoped Knowledge + Memory surface.
- Existing document, note and asset retrieval paths are composed into one read-only V2 context adapter.
- Existing `ai_memory` retrieval is composed into the same adapter.
- Personal Space explicitly retrieves only `workspace_id IS NULL` active memory.
- Business Space explicitly retrieves memory for the active Business Space.
- Conversation memory remains relevance-filtered; durable profile/preferences remain available according to the established memory contract.
- Knowledge nodes and collections are surfaced from the existing knowledge substrate.
- One embedding is generated for a context probe and reused by document/note/asset retrieval.
- No second vector store, knowledge graph, memory database, provenance ledger or execution runtime is introduced.

## Boundary

V2 owns the context contract and Space selection. Existing ARRIYIA V1 modules remain authoritative for storage and retrieval implementation.

The context adapter is read-only:

`V2 Space → context adapter → existing knowledge retrieval + existing memory retrieval`

No context result grants execution authority. Command Centre and NoVA Core remain responsible for governed action and runtime execution.

## Acceptance

- [x] Context surface is scoped to the active V2 Space.
- [x] Existing retrieval mechanisms are reused.
- [x] Personal memory cannot be widened into Business Space memory.
- [x] Business Space retrieval uses the active workspace boundary.
- [x] Conversation memory remains relevance-aware.
- [x] No duplicate knowledge/memory persistence introduced.
- [x] No localStorage introduced.
- [x] No vertical-product dependency introduced.
- [x] No production deployment.
- [ ] Live Supabase certification of V2-02 migration/security.
- [ ] NoVA runtime E2E certification.