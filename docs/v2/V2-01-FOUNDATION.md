# ARRIYIA V2 — Sprint V2-01 Foundation

## Baseline
- Production branch: `main`
- Production baseline: `555fed78e268f4fcc6a4cebd1b679204696e3d73`
- V2 branch: `v2-development`
- V2 database rule: no schema migrations against V1 production during V2 foundation.

## Sprint status
- Branch verification: complete
- Architecture documentation: complete
- Module boundaries: complete
- Canonical domain model: complete
- Existing-code inventory: complete
- Technical-debt inventory: complete
- V2 application shell: implemented
- First-class V2 Space context: implemented
- V2 Space switcher: implemented
- V1 localStorage workspace preference: explicitly excluded from V2 context state

## V2 principle
ARRIYIA V2 extends the existing V1 intelligence foundation. It does not rewrite the AI, knowledge, memory, workspace, or intelligence modules merely to introduce a new architecture.

## Runtime boundary
ARRIYIA is the control plane. NoVA Core is the execution plane.

ARRIYIA defines:
- organizations and workspaces
- agents and workflows
- knowledge and memory scope
- tools and permissions
- policies and approvals
- intelligence and outcomes
- audit and observability

NoVA Core executes:
- agent runs
- workflow runs
- tool invocations
- durable execution state
- runtime events

## Deployment boundary
`v2-development` is Preview-only. V1 production remains on `main`. A V2 change reaches production only after explicit certification and approval.

## Sprint acceptance
V2-01 is accepted when the branch contains the foundation documentation and a navigable V2 shell that can evolve without changing V1 route behavior.

## V2 Space context

V2 treats Space as an operating context attached to one ARRIYIA identity. Personal and Business spaces are distinct context kinds; the active Space governs subscription tier and, as later phases are implemented, the knowledge, memory, intelligence, agents, tools and permissions available to that context.

The V2 shell owns its active Space context and does not reuse the V1 WorkspaceProvider localStorage selection. The V1 workspace selector remains a legacy library-filter mechanism until V2-02 replaces it with persistent Business Space lifecycle and membership data.
