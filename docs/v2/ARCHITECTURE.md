# ARRIYIA V2 Architecture

## System model

```
ARRIYIA Control Plane
  ├─ Organization / Workspace
  ├─ Governance / Policies
  ├─ Knowledge / Memory
  ├─ Intelligence
  ├─ Agents
  ├─ Workflows
  ├─ Tools
  ├─ Approvals
  └─ Observability
          │
          │ Runtime Contract
          ▼
      NoVA Core
  ├─ Agent execution
  ├─ Workflow execution
  ├─ Tool execution
  ├─ Durable state
  └─ Runtime events
```

## Design rules
1. V1 intelligence capabilities are reused before new equivalents are created.
2. UI modules do not directly own runtime execution.
3. Agent definitions are control-plane resources; execution is a runtime concern.
4. Tools are governed capabilities, not arbitrary frontend functions.
5. Every consequential action must have provenance and an auditable execution record.
6. Workspace and tenant scope must be explicit on enterprise resources.
7. V2 application code must not require a production Supabase migration to render or develop.
8. Runtime integration begins behind a contract and mock adapter.

## Intelligence loop

```
Observe → Understand → Reason → Recommend → Act → Learn
```

The V2 model adds explicit traceability between each stage.
