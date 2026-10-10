# IF-05 — Intelligence Centre UX

Status: implementation in progress on `feat/if-05-intelligence-centre-ux`, stacked on the audited IF-04 branch. No production deployment or migration is part of this milestone.

## Objective
Turn the existing Space-scoped ARRIYIA V2 Intelligence Centre into a domain-aware evidence surface without creating a second ledger, silently reclassifying legacy records, or conflating intelligence with execution.

## Reuse and constraints
- Read evidence from the existing `intelligence_records` ledger and existing learning-signal queries.
- Respect the active Space and existing RLS-backed query boundary.
- Expose Finance, Marketing, Sales, Operations, HR, Legal, Customer, and Risk.
- Identify cross-domain analyses only when structured output explicitly carries `crossDomain: true`; do not infer cross-domain status from a missing `domain_key`.
- Preserve legacy record types and show unclassified legacy records as unclassified.
- Keep the six-stage model: Observe → Understand → Reason → Recommend → Act → Learn.
- No tables, retrieval systems, local storage, duplicate provenance, or second intelligence engine.
- Recommendations remain governed proposals; the Intelligence Centre does not execute actions.

## Delivered in IF-05
- Domain coverage cards count persisted records by explicit `domain_key`.
- Cross-domain coverage counts only records with the explicit IF-04 output marker.
- Evidence feed filters for all records, each domain, and cross-domain analyses.
- Empty-filter, loading, and error states explain actual state without fabricating data.
- Model tests cover all eight filters, domain isolation, cross-domain identification, and legacy semantics.
- IF-04 SQL persistence rejects findings and recommendations with empty evidence citations, backed by adversarial SQL fixtures.

## Acceptance criteria
1. Domain counts derive from the existing Space-scoped canonical ledger.
2. Filters do not reclassify legacy records or treat every `domain_key = NULL` row as cross-domain.
3. Active Space remains the query scope; no client-side persistence or new store.
4. Loading, error, and empty states remain explicit.
5. Six-stage model, provenance boundary, approval requirements, and execution boundary remain unchanged.
6. IF-04 database persistence rejects empty citations for findings and recommendations.
7. Typecheck, lint, targeted tests, full suite, build/bundle verification, isolated SQL certification, and ARRIYIA V2 gates pass before closure.
8. No production deployment or production migration is part of IF-05.

## Files
- `src/modules/v2/pages/V2IntelligenceCentrePage.tsx`
- `src/modules/v2/intelligenceCentreModel.ts`
- `src/modules/v2/intelligenceCentreModel.test.ts`
- `supabase/migrations/0089_if04_cross_domain_intelligence.sql`
- `supabase/tests/if04_cross_domain_intelligence_test.sql`
