# V2-06 — Agent Management

## Objective
Establish agents as first-class ARRIYIA control-plane resources without creating a competing execution runtime.

## Implemented
- Agent definition validation.
- Workspace-scoped tool and policy dependency validation.
- Agent lifecycle: draft, active, paused, archived.
- Monotonically increasing agent definition versions.
- Agent catalogue backed by the existing src/modules/core/registry.ts abstraction.
- Dependency resolution for referenced tools and policies.
- Dedicated Agent Management control-plane surface.

## Acceptance boundary
An agent can be defined, validated, versioned and activated as a control-plane resource.

Agent execution, tool invocation, scheduling, workers, model/provider runtime and MCP execution remain outside V2 and are reserved for the V2-08 NoVA Runtime Contract.

## Next
V2-07 Workflow Studio will compose governed agents, tools, conditions, approvals and actions into declarative workflows.
