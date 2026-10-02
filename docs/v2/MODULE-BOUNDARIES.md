# ARRIYIA V2 Module Boundaries

| Domain | Responsibility | Must not own |
|---|---|---|
| Workspace | Organization, workspace, members, projects, objectives | Runtime execution |
| Governance | Roles, permissions, policies, approvals, autonomy | Business intelligence logic |
| Intelligence | Signals, insights, recommendations, predictions, outcomes | Provider-specific UI |
| Knowledge | Sources, documents, retrieval, provenance, knowledge graph | Agent execution |
| Memory | Persistent memory, scope, lifecycle, confidence | Authorization decisions |
| Agents | Agent definitions, versions, capabilities, tool bindings | Durable execution engine |
| Workflows | Workflow definitions, versions, nodes, conditions | Direct infrastructure execution |
| Tools | Tool registry, schemas, permission metadata | Unbounded access |
| Runtime adapter | Stable contract to NoVA Core | Product-specific UI |
| Observability | Runs, events, failures, audit views | Mutating business state |
| Existing V1 modules | Mature capabilities such as research/planning/action | V2 control-plane ownership |

## Reuse map

Existing V1 modules that V2 should build around include:
- `ai/orchestration`
- `ai/memory`
- `ai/retrieval`
- `knowledge-intelligence`
- `workspace-intelligence`
- `planning-intelligence`
- `decision-intelligence`
- `action-intelligence`
- `research-intelligence`
- `analysis-intelligence`
- `data-intelligence`
- `execution-foundation`
- `intelligence-ledger`
- `provenance`
- `workspaces`
- `core`

These remain implementation assets; V2 introduces clearer ownership and contracts around them.
