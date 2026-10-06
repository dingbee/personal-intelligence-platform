# ARRIYIA V2-09 — Enterprise Governance

## Objective
Establish governance as a first-class V2 control-plane layer for Business Spaces without moving execution authority into ARRIYIA.

## Implemented
- Space-scoped governance policies with durable lifecycle.
- Autonomy ceiling: inform, recommend, prepare, bounded.
- Approval mode: never, consequential, always.
- Tool-scope declarations.
- Server-authorized policy creation and mutation.
- Owner-gated activation, pause and archive.
- Same-Space governance binding contracts for agents and workflows.
- RLS prevents cross-Space policy visibility.
- No second execution authorization engine.

## Boundary
Business Space → Governance Policy → Agent/Workflow governance binding → NoVA Core execution boundary.

ARRIYIA defines governance intent and control-plane policy. NoVA Core remains authoritative for execution authorization and runtime enforcement.

## Acceptance
- [x] Governance policy persistence and lifecycle.
- [x] Business Space scope.
- [x] Owner-gated mutation.
- [x] Explicit autonomy ceiling.
- [x] Explicit approval mode.
- [x] Explicit tool scope.
- [x] Cross-Space binding rejection server-side.
- [x] No runtime duplicated.
- [ ] Live Supabase migration/security certification.
- [ ] V2 branch CI green.
