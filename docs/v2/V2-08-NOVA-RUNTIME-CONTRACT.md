# V2-08 — NoVA Runtime Contract

## Purpose

Connect the ARRIYIA V2 control plane to NoVA Core without absorbing NoVA Core into ARRIYIA.

### Control plane

ARRIYIA owns:
- intent
- intelligence
- organization/workspace scope
- agent definitions
- workflow definitions
- governance
- approvals
- tool governance
- provenance
- outcomes
- learning

### Execution plane

NoVA Core owns:
- agent execution
- workflow execution
- tool invocation
- model/provider runtime
- durable execution state where supported
- jobs
- scheduling
- retries/timeouts
- runtime events
- execution history
- runtime failures

ARRIYIA must not recreate those mechanisms.

## V2-08A — Contract Discovery

**Status: complete**

`docs/v2/NOVA-INTEGRATION-CONTRACT.md` defines:
- ownership and resource mapping
- canonical execution flow
- tenant scope
- correlation and causation
- provenance
- idempotency
- approval boundary
- workflow boundary
- agent boundary
- tool boundary
- failure semantics
- version/capability negotiation
- explicit non-goals

## V2-08B — Thin Contract Implementation

**Status: implemented and hardened**

Implemented:
- execution request contracts
- workflow execution request contracts
- governed tool invocation contracts
- runtime event contracts
- approval contracts
- result/outcome contracts
- correlation/provenance envelope
- actor identity propagation
- contract version enforcement
- capability negotiation
- validating adapter boundary
- contract-only mock adapter
- NoVA Core gateway transport
- runtime state normalization
- acknowledgement-versus-success separation

### P0-4 gateway alignment

The transport now targets the actual NoVA Core P0-4 gateway:

`/api/public/core/plugin-gateway`

using its action protocol:
- `register`
- `negotiate`
- `agent.run`
- `workflow.run`
- `tool.invoke`

The transport supplies organization/plugin identity through the gateway header contract. Gateway credentials are supplied by the host; ARRIYIA does not embed or discover secrets.

### Important execution rule

A response from `agent.run`, `workflow.run` or `tool.invoke` is treated as an **execution acknowledgement**, not as proof of success.

The adapter returns:

`accepted → runtime lookup → observed terminal state`

where terminal state can be:
- succeeded
- failed
- cancelled

Unknown/unmapped state remains `unknown`.

## V2-08C — Boundary Verification

**Status: code-side verification implemented; live NoVA verification pending**

Verified in the V2 contract layer:
- unsupported contract versions fail closed
- missing organization scope fails closed
- missing correlation fails closed
- missing idempotency fails closed
- empty workspace scope fails closed
- agent/workflow identifiers are required
- tool authorization cannot cross organization scope
- tool authorization cannot cross workspace scope
- tool identity must match invocation identity
- correlation must match authorization
- consequential tools require an approval reference
- non-authorized governance envelopes are rejected
- correlation, tenant scope and idempotency survive the adapter boundary
- acknowledgement is never converted to success
- unsupported capabilities are rejected
- unknown runtime states remain unknown
- missing runtime state is unresolved rather than fabricated as failure

### Current NoVA Core limitation

The P0-4 `core.run.read` gateway implementation currently reads the durable `workflow_runs` store. Agent runtime execution is currently in-memory and tool execution does not yet expose a generic durable run-read endpoint through the gateway.

Therefore V2-08 does **not** claim generic live run reconciliation for agent/tool executions.

This is intentionally fail-closed:
- ARRIYIA does not invent an execution result.
- ARRIYIA does not create a second runtime state store.
- unresolved agent/tool state remains unresolved until NoVA Core exposes an authoritative read path.

### Live certification still required

Authorized NoVA Core environment access is required to certify:
1. plugin registration
2. capability negotiation
3. enabled-integration authentication
4. agent execution handoff
5. workflow execution handoff
6. tool invocation handoff
7. organization isolation
8. runtime event/provenance correlation
9. idempotency behavior
10. authoritative run reconciliation

## Safety constraints

- `v2-development` only
- no production Supabase migration
- no `main` changes
- no NoVA Core implementation duplicated inside ARRIYIA
- no second scheduler/queue/workflow engine/runtime
- preview deployment only
- tests must be executed before claiming verification

## Architectural destination

`ARRIYIA V2 Control Plane → NoVA Runtime Contract → NoVA Core Execution Plane`

V2-08 establishes and hardens the boundary. It does not build NoVA Core.