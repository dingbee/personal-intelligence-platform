# ARRIYIA V2 ↔ NoVA Core Integration Contract

## Status
- Sprint: V2-08 — NoVA Runtime Contract
- Sub-step: V2-08A — Contract Discovery
- State: specification / ownership boundary
- Branch: `v2-development`
- Production branch: `main`
- Production database/schema: unchanged

This document defines the boundary between ARRIYIA V2 and NoVA Core. It is a contract specification, not a second runtime design.

## 1. Ownership boundary

ARRIYIA V2 owns the control plane: intent, intelligence, workspace scope, agent definitions, workflow definitions, governance, approvals, tool governance, provenance, outcomes and learning.

NoVA Core owns the execution plane: agent execution, workflow execution, tool execution, model/provider runtime, durable execution state, background jobs, scheduling, retries/timeouts, runtime events, execution history and runtime failures.

ARRIYIA must not recreate those NoVA mechanisms.

## 2. Resource mapping

| ARRIYIA resource | ARRIYIA owns | NoVA owns |
| --- | --- | --- |
| Organization | identity/scope reference | execution tenant scope |
| Workspace | workspace context/governance | execution context |
| Agent | purpose, capabilities, tools, policies, version | agent execution |
| Workflow | declarative graph, version, activation intent | progression, waits, retries, scheduling, history |
| Tool | governed capability, permissions, approval requirement | actual invocation/effect |
| Policy | governance/autonomy rules | execution-side enforcement |
| Approval | requirement, decision, provenance | execution pause/release mechanics |
| Run | control-plane correlation/reference | durable execution state |
| Context | selected intelligence/execution context | runtime materialization |
| Memory | scope/reference/governance | runtime memory provider |
| Event | interpretation/intelligence | durable event fabric |
| Outcome | interpretation/learning | execution result/effect facts |

## 3. Canonical execution flow

ARRIYIA intent → intelligence/recommendation → policy/approval evaluation → execution request → NoVA Core → execution → runtime events/result → ARRIYIA → outcome/learning.

An execution request is not proof that execution occurred. NoVA is authoritative for execution state.

## 4. Correlation and provenance

Cross-plane requests must preserve, where available: organizationId, workspaceId, runId, agentId, workflowId, taskId, approvalId, correlationId, causationId, idempotencyKey, provenance references and contract/resource/definition versions.

The adapter must fail closed when required tenant or correlation scope is missing.

## 5. Event semantics

NoVA Core is the execution-side event authority. The adapter must preserve NoVA event semantics rather than create a parallel event fabric.

Preserve organization scope, schema version, correlation ID, causation ID, idempotency key, severity/classification, immutable facts, consumption identity, retry/dispatch state and retention semantics.

## 6. Approval boundary

ARRIYIA may determine that an action requires approval and maintain the control-plane approval reference. NoVA owns execution-side pause/release mechanics.

Approval ↔ Action/execution request ↔ Run ↔ NoVA execution state.

Approval is not proof of execution.

## 7. Workflow boundary

ARRIYIA Workflow Studio defines identity, version, trigger intent, graph topology, governed agent/tool references and activation state.

NoVA executes trigger delivery, run creation, node progression, waits, retries, timeouts, scheduling, failure handling and execution history.

ARRIYIA V2-07 therefore remains declarative.

## 8. Agent boundary

ARRIYIA Agent Management defines identity, system purpose, capabilities, tool references, memory scopes, policies, version and lifecycle intent.

NoVA executes the agent.

ARRIYIA must not introduce model execution loops, agent workers, durable agent state machines, retry workers or scheduler logic.

## 9. Tool boundary

ARRIYIA owns the governed tool reference: capability, schemas, permissions, approval requirement, scope and lifecycle state.

NoVA owns actual invocation and effect execution. ARRIYIA must not build a competing MCP/runtime implementation.

## 10. Failure semantics

The adapter must distinguish: request rejected; request accepted; queued; running; waiting for approval; succeeded; failed; cancelled; and unknown/unreconciled state.

An acknowledgement must never be converted into a successful outcome.

## 11. Idempotency

Consequential cross-plane requests require a stable idempotency key. NoVA remains authoritative for durable idempotent execution. ARRIYIA must not create a second durable idempotency ledger.

## 12. Transactional outbox constraint

The current NoVA status identifies transactional outbox as an open hardening item. Until closed, ARRIYIA must distinguish command acknowledgement, execution state, event observation and confirmed outcome.

## 13. Tenant isolation

The adapter must require organization scope, require workspace scope for workspace-bound resources, reject organization/workspace mismatches, never infer a tenant from an untrusted browser hint, and never fall back to an arbitrary tenant.

NoVA remains authoritative for execution-side tenant isolation.

## 14. Version and capability negotiation

Contracts should expose contractVersion, resourceVersion and definitionVersion, with capabilityVersion where applicable.

Unknown or incompatible versions/capabilities must fail closed. A V2 capability declaration is not proof that NoVA can execute that capability.

## 15. Current NoVA constraint

Current NoVA Core already provides identity/authorization, tenant isolation, durable events, workflows, jobs, scheduling, approvals, AI runtime primitives, tool execution, knowledge/memory providers, observability and control-plane administration.

Therefore V2-08 is an adapter/contract problem, not a rebuild of those subsystems.

Future NoVA Core 05/06 work remains outside this implementation step: plugin lifecycle/capability governance and the full agentic/delegated execution layer.

## 16. Explicit non-goals

- second workflow engine
- second agent execution engine
- second tool execution engine
- second scheduler
- second durable job queue
- second runtime event fabric
- second durable idempotency system
- MCP runtime
- model/provider runtime
- NoVA plugin lifecycle
- NoVA database schema ownership

## 17. Adapter target

ARRIYIA control-plane contracts → NoVA Runtime Adapter → NoVA Core.

The adapter translates and validates contracts. It does not execute the work.

## 18. V2-08A acceptance

- ownership boundaries explicit
- resource mapping explicit
- execution direction explicit
- tenant/correlation/provenance requirements explicit
- approval, workflow, agent and tool boundaries explicit
- failure and idempotency semantics explicit
- version/capability negotiation explicit
- current NoVA gaps represented as constraints
- duplicate runtime responsibilities explicitly prohibited

Next: V2-08B — thin TypeScript contracts, mapping functions, mock adapter and contract tests.