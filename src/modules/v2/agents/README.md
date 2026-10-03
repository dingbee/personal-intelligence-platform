# V2-06 Agent Management

Agent Management defines agents as governed ARRIYIA control-plane resources.

## Implemented
- agent definition validation
- workspace-scoped tool and policy dependency validation
- agent lifecycle: draft, active, paused, archived
- monotonically increasing definition versions
- catalogue backed by the existing core Registry abstraction
- dependency resolution
- V2 Agent Management control-plane surface

## Boundary
V2 owns agent identity, definition, capabilities, memory scope declarations, tool references and policy references.

V2 does not execute agents. Execution crosses the V2-08 runtime contract into NoVA Core.
