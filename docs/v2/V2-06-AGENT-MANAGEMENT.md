# ARRIYIA V2-06 — Agent Management

## Objective

Make agents first-class, durable ARRIYIA Enterprise control-plane resources without creating a competing execution runtime.

## Implemented

- Durable `v2_agents` resource scoped to an active ARRIYIA Business Space.
- Durable monotonic `v2_agent_versions` definitions.
- Existing `workspace_members` / `has_workspace_role` authorization reused.
- Agent creation and mutation use server-authorized RPCs; direct client writes are not exposed.
- Definition validation requires purpose, capabilities, tool references, memory scopes, policy references and a canonical autonomy ceiling.
- Lifecycle: draft, validated, active, paused, archived.
- Definition changes create a new version and return the agent to Draft.
- Business Space owner controls activation.
- Active version is explicit and recorded on the agent.
- V2 UI supports create, inspect, version, validate, activate, pause/resume and archive.
- Existing V2 domain contracts remain the conceptual authority; the new Supabase layer provides durable persistence for the control-plane resource.

## Canonical definition

- `systemPurpose`
- `capabilities[]`
- `toolIds[]`
- `memoryScopes[]`
- `policyIds[]`
- `autonomyCeiling`: `inform | recommend | prepare | bounded`

## Boundary

`V2 Space → Agent Control Plane → V2 runtime contract → NoVA Core`

V2 owns agent identity, Space scope, definition, versioning, lifecycle and governance references.

NoVA Core owns execution, runtime orchestration, tool invocation, worker execution, workflow execution and runtime authorization.

Agent definitions are inert until the later runtime-contract work binds them to NoVA Core.

## Acceptance

- [x] Durable agent resource exists.
- [x] Agent definitions are versioned.
- [x] Business Space boundary is explicit.
- [x] Existing workspace membership authorization is reused.
- [x] Business Space activation is owner-controlled.
- [x] Definition changes return the agent to Draft.
- [x] Canonical V2 autonomy contract is reused.
- [x] No second agent runtime introduced.
- [x] No localStorage introduced.
- [x] No vertical product dependency introduced.
- [x] No production deployment.
- [ ] Live Supabase migration/security certification.
- [ ] NoVA Core runtime E2E certification.

## Next

V2-07 Workflow Studio will compose governed agents, tools, conditions, approvals and actions into declarative workflows.