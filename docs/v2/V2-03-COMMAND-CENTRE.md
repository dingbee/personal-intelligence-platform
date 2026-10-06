# ARRIYIA V2-03 — Command Centre

## Objective

Make the V2 root route a real operational control surface rather than a static dashboard.

## Implemented

- Command Centre is scoped to the active V2 Space.
- Business Space execution reads use the Business Space/workspace id as the existing RLS boundary.
- Personal Space continues to use the caller's personal execution scope.
- Existing execution requests are surfaced as governed requests rather than duplicated into a second V2 execution engine.
- Approval queue exposes explicit approve/reject decisions through the existing server-authorized execution boundary.
- Recent execution audit events are surfaced for the latest governed requests.
- Active, approval, success and attention states are derived from real execution records.
- Agent Management and Workflow Studio remain separate V2 control-plane resources.
- NoVA Core remains the execution authority; no runtime is embedded in ARRIYIA.

## Boundary

The Command Centre coordinates control state. It does not create a second execution engine, bypass authorization, execute tools, or invoke agents directly.

The mapping is:

`V2 Space → existing workspace/RLS boundary → governed execution request → authorization → runtime`

The final runtime remains external to ARRIYIA and crosses the NoVA Core plugin contract.

## Acceptance

- [x] Root V2 route displays real governed execution state.
- [x] Active Space scopes Command Centre queries.
- [x] Approval decisions reuse server-side authorization.
- [x] Audit events are traceable to execution requests.
- [x] No duplicate execution engine introduced.
- [x] No localStorage introduced.
- [x] No vertical-product dependency introduced.
- [x] No production deployment.
- [ ] Live Supabase certification for V2-02 Business Space migration.
- [ ] NoVA Core runtime E2E certification.
