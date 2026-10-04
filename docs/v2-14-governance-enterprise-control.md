# V2-14 — Governance & Enterprise Control

**Status:** OPEN  
**Branch:** `v2-development`  
**Execution authority:** NoVA Core  
**Production:** V1 remains frozen; V2 remains Preview-only

## Gate objective

Establish the enterprise governance layer that constrains agentic intelligence before any future runtime execution is permitted.

V2-14 builds on the bounded-autonomy contract established in V2-13. It does not introduce execution.

## Entry conditions

V2-13 established:

- canonical autonomy levels: `inform | recommend | prepare | bounded`;
- agent autonomy ceilings;
- policy autonomy ceilings;
- authoritative consequential-tool approval metadata;
- explicit least-privilege vertical context;
- NoVA Core as the sole execution authority;
- ARRIYIA execution disabled.

Formal unit-test execution remains verification debt because the available environment cannot currently run the repository's Vitest suite directly. Vercel Preview build verification is available and must remain separate from the unit-test gate.

## V2-14 scope

1. **Governance model**
   - formalise organization, workspace, agent, tool, policy, and action governance relationships;
   - preserve workspace and organization isolation;
   - make governance decisions auditable and attributable.

2. **Authorization envelope**
   - define the canonical authorization result passed toward NoVA Core;
   - bind requested autonomy, agent ceiling, policy ceiling, tool approval metadata, approval reference, context scope, and provenance;
   - fail closed when any required governance component is absent or inconsistent.

3. **Approval lifecycle**
   - distinguish approval request, pending state, approval decision, rejection, expiry, and execution reference;
   - prevent stale or unrelated approvals from authorizing another action.

4. **Policy evaluation**
   - make policy evaluation deterministic;
   - preserve deny-overrides-allow semantics where applicable;
   - ensure policy scope cannot cross organization/workspace boundaries.

5. **Auditability**
   - establish immutable logical audit references for consequential governance decisions;
   - preserve correlation, causation, provenance, and approval references for runtime handoff.

6. **Enterprise control surface**
   - expose governance state through the V2 control plane;
   - do not expose direct execution controls inside ARRIYIA;
   - keep future NoVA Core execution behind the runtime contract.

## Acceptance gates

V2-14 cannot close until:

- [ ] authorization envelope is deterministic and typed;
- [ ] every consequential action carries an approval reference;
- [ ] approval subject/action identity is validated;
- [ ] stale, rejected, or mismatched approvals fail closed;
- [ ] policy evaluation is deterministic and scope-safe;
- [ ] organization/workspace isolation is enforced;
- [ ] provenance, correlation, and causation references survive handoff;
- [ ] ARRIYIA still performs no direct tool execution;
- [ ] NoVA Core remains the sole execution authority;
- [ ] V2 Preview verification succeeds;
- [ ] repository unit-test execution is independently verified when the CI/runtime path is available;
- [ ] V1 production code remains unchanged;
- [ ] production Supabase schema remains unchanged.

## Explicit non-goals

V2-14 does not:

- promote V2 to Production;
- modify the V1 production baseline;
- modify the production Supabase schema;
- implement a NoVA Core worker;
- add autonomous execution;
- bypass approval or governance;
- introduce provider credentials into ARRIYIA;
- reopen the V2-13 autonomy vocabulary.

## Gate discipline

All implementation is additive on `v2-development`. Changes are batched before Preview verification. No production promotion is permitted as part of this gate.
