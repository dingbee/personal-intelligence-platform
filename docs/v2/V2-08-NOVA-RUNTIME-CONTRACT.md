# V2-08 — NoVA Runtime Contract

## Purpose

V2-08 connects the ARRIYIA V2 control plane to NoVA Core without absorbing NoVA Core into ARRIYIA.

### Control plane
ARRIYIA owns intent, intelligence, workspace scope, agent definitions, workflow definitions, governance, approvals, tool governance, provenance, outcomes and learning.

### Execution plane
NoVA Core owns agent execution, workflow execution, tool invocation, model/provider runtime, durable execution state, jobs, scheduling, retries/timeouts, runtime events, execution history and runtime failures.

## Sub-steps

### V2-08A — Contract Discovery
**Status: complete**

Produced `docs/v2/NOVA-INTEGRATION-CONTRACT.md` with the ownership map, execution flow, correlation/provenance rules, approval boundary, workflow/agent/tool boundaries, failure semantics, idempotency, tenant isolation, version/capability negotiation, current NoVA constraints and explicit non-goals.

### V2-08B — Thin Contract Implementation
**Status: next**

Target:
- execution request contracts
- workflow execution request contracts
- governed tool invocation contracts
- runtime event contracts
- approval contracts
- result/outcome contracts
- correlation/provenance envelope
- contract versioning
- mock NoVA adapter
- mapping and validation functions
- contract tests

### V2-08C — Boundary Verification
**Status: pending**

Verify:
- tenant scope cannot cross
- unsupported capabilities fail closed
- malformed requests fail closed
- correlation survives mapping
- provenance survives mapping
- approval references remain correlated
- execution acknowledgement is not treated as success
- unknown runtime state remains unknown
- mock adapter conforms to the same contract
- no V2 runtime duplication has been introduced

## Safety constraints
- `v2-development` only
- no production Supabase migration
- no `main` changes
- no NoVA Core implementation duplicated inside ARRIYIA
- no second scheduler/queue/workflow engine/runtime
- preview deployment only
- local test results must not be claimed unless actually executed

## Architectural destination

ARRIYIA V2 Control Plane → NoVA Runtime Contract → NoVA Core Execution Plane.

V2-08 establishes the stable boundary through which ARRIYIA governs and consumes NoVA execution. It does not build NoVA Core.