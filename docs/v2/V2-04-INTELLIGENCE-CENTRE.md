# ARRIYIA V2-04 — Intelligence Centre

## Objective

Turn the V2 Intelligence Centre from a static concept page into a Space-scoped intelligence surface while preserving the existing intelligence ledger and learning infrastructure.

## Implemented

- Intelligence Centre is scoped to the active V2 Space.
- Existing `intelligence_records` are surfaced as evidence rather than copied into a second V2 ledger.
- Existing learning signals are surfaced as the Learn-stage continuity layer.
- Six-stage control model remains explicit: Observe → Understand → Reason → Recommend → Act → Learn.
- Canonical V2 resources remain conceptually distinct from legacy ledger record types.
- Command Centre remains the operational surface for governed actions and execution state.
- No NoVA runtime or second intelligence engine is introduced.

## Deliberate boundary

The existing ledger records are not renamed or silently reclassified as V2 Signal, Insight, Recommendation or Prediction resources. The Centre maps them into an evidence view only.

That avoids corrupting established semantics while giving V2 a real intelligence surface today.

A later persistence sprint can introduce canonical V2 intelligence resources when their write paths and security model are fully defined.

## Acceptance

- [x] Active Space scopes intelligence evidence.
- [x] Existing intelligence ledger reused.
- [x] Existing learning signals reused.
- [x] Six-stage intelligence loop represented.
- [x] No duplicate intelligence engine.
- [x] No duplicate provenance system.
- [x] No localStorage introduced.
- [x] No vertical-product dependency introduced.
- [x] No production deployment.
- [ ] Live Supabase certification for V2-02 Business Space migration.
- [ ] Canonical V2 intelligence-resource persistence/write paths.
