# ARRIYIA V2-07 — Workflow Studio

## Objective

Make workflows first-class, durable ARRIYIA Enterprise control-plane resources without creating a workflow execution engine inside V2.

## Implemented

- Durable `v2_workflows` resource scoped to an active ARRIYIA Business Space.
- Durable monotonic `v2_workflow_versions`.
- Declarative workflow definition: trigger, nodes, edges, governed agent references, tool references, approval gates, action references and verification nodes.
- Supported trigger declarations: manual, event, schedule, webhook.
- Supported node types: start, understand, agent, tool, condition, approval, action, verify.
- Existing workspace membership authorization reused.
- Workflow creation and lifecycle mutations use server-authorized RPCs.
- Graph validation verifies exactly one start node, unique node IDs, no dangling edges, no self edges, no graph cycles, supported node types, required node configuration, same-Space active-agent references.
- Lifecycle: Draft, Validated, Active, Paused, Archived.
- Definition changes create a new version and return the workflow to Draft.
- Business Space owner controls activation.
- Workflow Studio provides a functional graph-definition surface, dependency selection and version history.

## Boundary

V2 Space → Workflow Control Plane → NoVA runtime contract → NoVA Core

V2 owns workflow identity, Business Space scope, declarative graph, versioning, dependency references, approval declarations and lifecycle.

NoVA Core owns trigger execution, scheduling, graph traversal at runtime, agent execution, tool invocation, worker orchestration, runtime authorization and execution state.

Workflow Studio therefore defines what may execute and under which governed dependencies; it does not execute it.

## Relationship to existing workflow registry

The legacy `src/modules/core/workflows` registry remains unchanged. It is a static module-extension registry, not the V2 Enterprise workflow persistence or runtime.

V2-07 deliberately does not convert or duplicate that registry.

## Acceptance

- [x] Durable workflow resource.
- [x] Versioned workflow definitions.
- [x] Business Space isolation.
- [x] Existing workspace membership authorization reused.
- [x] Graph integrity validation.
- [x] Agent dependency validation.
- [x] Owner-only activation.
- [x] No workflow execution engine introduced.
- [x] No localStorage introduced.
- [x] No vertical product dependency introduced.
- [x] No production deployment.
- [ ] Live Supabase migration/security certification.
- [ ] NoVA Core workflow runtime E2E certification.

## Next

V2-08 should bind an activated workflow to the existing NoVA runtime contract and external NoVA Core gateway. It should not introduce another execution engine.