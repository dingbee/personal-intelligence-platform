# ARRIYIA V2 Canonical Domain Model

## Enterprise hierarchy

```
Organization
  └─ Workspace
      ├─ Business Unit
      ├─ Team
      ├─ User
      ├─ Role
      ├─ Permission
      ├─ Policy
      ├─ Project
      └─ Objective
```

## Intelligence and execution entities

```
Agent
Task
Workflow
Tool
Context
Memory
Event
Signal
Insight
Recommendation
Prediction
Action
Outcome
Approval
Run
```

## Ownership rules

- Organization is the tenant boundary.
- Workspace is the primary operational context.
- Project groups work toward objectives.
- Agent is a versioned intelligence/execution definition.
- Workflow is a versioned orchestration definition.
- Run is an instance of agent/workflow execution.
- Tool is a governed executable capability.
- Memory is scoped persistent context with provenance and lifecycle.
- Event is an immutable runtime or system occurrence.
- Signal is an observed change.
- Insight is an interpreted signal.
- Recommendation is a proposed decision/action.
- Action is an authorized execution intent.
- Outcome records what actually happened.
- Approval is an explicit human/governance gate.

## Traceability

```
Source → Context → Signal → Insight → Recommendation
       → Decision/Approval → Action → Run/Event → Outcome → Feedback
```

## Required metadata for consequential resources
- id
- organization/workspace scope
- owner
- created_at / updated_at
- status
- provenance where applicable
- version where definition changes
- audit/execution linkage where applicable
