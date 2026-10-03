# Pre-Build Audit — V2-01 through V2-07

## Audit purpose

Before V2-08B implementation, the preceding V2 phases were re-inspected against the current `v2-development` branch. This audit is a gate: V2-08B must not build on top of an unresolved contract or fixture discrepancy.

## Scope inspected

- V2 canonical domain model and explicit scope model
- V2 control-plane store and relationship invariants
- workspace lifecycle and authorization
- knowledge/memory bridge contracts
- agent management and its activation/dependency fixes
- workflow studio and activation/dependency validation
- V2 routing and protected surfaces
- branch delta from the production baseline
- latest GitHub/Vercel status

## Findings

### A-01 — Canonical organization scope fixture mismatch

**Severity: P1 test integrity**

The canonical `Organization` model extends `ResourceMetadata`, which requires `organizationId`. Two preceding-phase test fixtures (`agents/service.test.ts` and `workflows/service.test.ts`) instantiated `Organization` without `organizationId`.

This is a contract/fixture discrepancy, not a runtime design change. It has been corrected before V2-08B.

Fixed by commits:
- `36158cadade0b3acc8dd5f0cc7ad096e805073dc`
- `2f80535b775674cdb8746e3a34dc0bb135a64105`

### A-02 — Runtime duplication risk

**Status: clear**

V2-06 and V2-07 remain declarative/control-plane services. Agent activation validates dependencies; Workflow Studio validates graph references and active agent/tool/approval dependencies. No agent worker, workflow executor, scheduler, queue or tool execution engine was found in the inspected V2 implementation.

### A-03 — Scope model

**Status: structurally consistent**

V2 resources carry organization scope, workspace-bound resources carry workspace scope, and scoped reads fail closed. Parent relationships are checked for organization/workspace consistency in the control-plane store.

### A-04 — Authorization boundary

**Status: structurally consistent; governance remains V2-09 work**

Workspace authorization resolves membership → role → permission. The underlying lifecycle services are persistence/domain services rather than the final governance enforcement plane. This is consistent with the roadmap: comprehensive governance/policy enforcement remains V2-09.

### A-05 — Knowledge/memory boundary

**Status: clear**

V2-05 uses an adapter boundary and does not introduce a competing persistence or retrieval engine. Existing V1 knowledge/retrieval/memory implementations remain the source of truth.

### A-06 — Workflow boundary

**Status: clear**

V2-07 is declarative. Runtime retries, waits, scheduling, execution history and durable execution remain outside ARRIYIA and map to NoVA Core.

### A-07 — NoVA boundary

**Status: clear**

V2-08A now explicitly prohibits duplicate runtime responsibilities and establishes the ARRIYIA → NoVA contract boundary.

## Verification limitation

Local Vitest/typecheck/build execution is not claimed in this environment. GitHub confirms the current branch commits and Vercel confirms successful preview deployment for the branch. The test fixtures above were corrected by source inspection before V2-08B.

## Gate decision

**PRE-BUILD GATE: PASS**

V2-08B may proceed with thin contract implementation, subject to the existing constraints:

- `v2-development` only
- no production database/schema changes
- no `main` changes
- no duplicate NoVA runtime mechanics
- mock adapter must be replaceable by the real NoVA adapter
- contract tests must cover scope, correlation, provenance, capability negotiation, approval correlation and acknowledgement-vs-outcome semantics.