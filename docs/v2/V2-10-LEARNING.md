# V2-10 — Learning Loop

## Status

Implemented control-plane learning layer on `v2-development`.

## Purpose

V2-10 closes the feedback loop around governed intelligence:

**Recommendation → Intervention → Outcome → Effectiveness → Learning Signal**

ARRIYIA interprets evidence and produces learning signals. NoVA remains responsible for execution.

## Resources

### Feedback
Captures explicit human response to a recommendation, action, outcome or run:
- accepted
- rejected
- corrected
- irrelevant
- positive
- negative

Optional rating, comment and correction data are preserved.

### Intervention
Records human intervention around a recommendation/action/run:
- accepted
- modified
- rejected
- overridden
- cancelled

Interventions are explicitly traceable to at least one recommendation, action or run.

### Outcome

Existing V2 outcome resources remain the authoritative control-plane representation of observed result facts.

### Recommendation effectiveness

The learning service derives:
- intervention count
- acceptance rate
- rejection count
- modification/override count
- outcome count
- successful outcome rate
- feedback count
- positive feedback rate
- effectiveness score

The score is an explicit control-plane metric composed from observed evidence. It is not represented as causal proof.

### Learning Signal

A learning signal contains:
- tenant/workspace scope
- signal type
- source type and source ID
- subject type and subject ID
- numeric value
- optional confidence
- evidence IDs

Evidence references are mandatory.

## Security

- Resources are organization/workspace scoped.
- Recommendation effectiveness is workspace-bound.
- Cross-workspace evaluation fails closed.
- No learning operation executes an action.
- No learning operation invokes a tool.
- No learning operation advances a workflow.
- No learning operation creates a runtime worker or scheduler.
- No parallel event fabric is introduced.

## Architecture

`ARRIYIA intelligence/governance → learning evidence → learning signal → future intelligence`

Execution remains:

`ARRIYIA decision → NoVA Runtime Adapter → NoVA Core`

Learning may inform later recommendations and policy evolution, but V2-10 does not autonomously modify policies, agents or workflows.

## Verification

Repository tests cover:
- feedback capture
- intervention traceability
- recommendation effectiveness calculation
- workspace boundary enforcement
- evidence-backed learning signals

Local Vitest execution remains environment-constrained; tests are implemented but are not represented as locally executed.

## Next

V2-11 — Integrations.
