# V2-13 — Bounded Autonomy

**Status:** OPEN  
**Branch:** `v2-development`  
**Execution authority:** NoVA Core  
**Production:** V1 remains frozen; V2 remains Preview-only

## Objective

Establish a deterministic bounded-autonomy contract for ARRIYIA V2 agents.

Bounded autonomy means an agent may request and prepare work only within its declared autonomy ceiling, policy ceiling, tool permissions, governance rules, and approval requirements. Autonomy is a control-plane constraint; it is not execution authority.

## Canonical contract

The phase builds on the V2-12 hardening commit:

- `AutonomyLevel`: `inform | recommend | prepare | bounded`
- `AgentDefinition.autonomyCeiling` is the agent's maximum requested autonomy.
- `Policy.maximumAutonomy` may not exceed the agent ceiling.
- Approval is a separate governance gate and is never an autonomy level.
- NoVA Core remains the sole execution authority.
- ARRIYIA V2 must not execute tools or actions directly.

## V2-13 scope

1. **Autonomy evaluation**
   - Deterministically compare requested autonomy against the agent ceiling.
   - Reject requests above the ceiling.
   - Preserve policy ceilings as an independent upper bound.

2. **Consequential-action gating**
   - Consequential actions require authoritative approval metadata.
   - Approval must be satisfied before an action can cross into NoVA Core execution.
   - Remove reliance on tool-name heuristics as the long-term authority for consequential classification.

3. **Least-privilege context**
   - Replace broad/fallback vertical context inference with explicit, deterministic context contracts where practical.
   - Prevent an agent from receiving entities, signals, tools, or memory outside its declared contract.

4. **Agent/tool compatibility**
   - Validate that requested tools belong to the agent's declared tool surface.
   - Preserve workspace and vertical boundaries.
   - Reject cross-boundary bindings before runtime handoff.

5. **Runtime boundary**
   - ARRIYIA remains a control plane.
   - No worker, scheduler, executor, provider credential, or direct tool invocation is introduced.
   - Runtime requests crossing to NoVA Core must carry the required governance and scope information.

## Acceptance gates

V2-13 cannot close until all of the following are deterministic and tested:

- [ ] Requested autonomy above agent ceiling is rejected.
- [ ] Policy maximum above agent ceiling is rejected.
- [ ] Consequential action without required approval is rejected.
- [ ] Approved consequential action may be represented for NoVA Core without ARRIYIA executing it.
- [ ] Tool approval classification comes from authoritative metadata, not naming convention alone.
- [ ] Vertical and workspace boundaries remain enforced.
- [ ] Agent tool surface and binding remain compatible.
- [ ] Context exposure follows least-privilege declarations.
- [ ] V2 execution remains disabled inside ARRIYIA.
- [ ] Existing V2-12 tests remain green.
- [ ] No V1 production code or production Supabase schema is changed.

## Explicit non-goals

V2-13 does **not**:

- promote V2 to Production;
- modify the V1 production baseline;
- create or modify the production Supabase schema;
- implement a NoVA Core worker/runtime;
- introduce autonomous execution;
- reopen the canonical autonomy vocabulary.

## Phase exit condition

V2-13 closes only after the contract, implementation, deterministic tests, and Preview verification demonstrate that autonomy is bounded by **agent ceiling + policy + governance + approval + tool/context scope**, with execution remaining exclusively under NoVA Core.
