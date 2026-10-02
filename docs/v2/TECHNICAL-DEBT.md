# ARRIYIA V2 Technical Debt Inventory

## TD-01 — Control plane vs execution plane coupling
Current orchestration and workspace-action code contains execution behavior inside application modules. V2 needs a stable runtime adapter so UI/domain code does not become the runtime.

**Priority:** P0

## TD-02 — Domain model is distributed
Workspace, intelligence, execution, provenance and memory concepts exist across multiple modules without one canonical V2 domain contract.

**Priority:** P0

## TD-03 — Existing intelligence is feature-oriented
Research, planning, decision and action capabilities are mature but are not yet represented consistently as governed agent/workflow capabilities.

**Priority:** P0

## TD-04 — Authorization is not yet a unified V2 policy model
Existing workspace/admin permissions exist, but agent/tool/data/action autonomy requires a unified enterprise policy layer.

**Priority:** P0

## TD-05 — Runtime state model needs consolidation
Execution-foundation and intelligence-ledger capabilities exist, but V2 requires one coherent run/event/outcome model.

**Priority:** P0

## TD-06 — Production database is not an isolated V2 environment
Supabase branching is currently unavailable on the connected plan. Until an isolated database is available, V2 must avoid schema migrations and destructive writes against production.

**Priority:** P0 operational constraint

## TD-07 — Observability needs runtime-level semantics
Existing AI health and execution/provenance facilities should be extended to agent/workflow/tool runs and policy decisions.

**Priority:** P1

## TD-08 — Existing registries are extensible but not yet runtime contracts
The core registry pattern is useful, but agent/workflow/tool registries need versioning, schemas, ownership and governance metadata.

**Priority:** P1

## TD-09 — Enterprise tenant isolation requires explicit verification
Workspace functionality exists, but V2 resources need systematic organization/workspace scoping and authorization tests.

**Priority:** P0 security gate

## TD-10 — Integration surface is not yet a governed tool plane
External integrations should be exposed through typed, permissioned tools rather than direct feature-specific calls.

**Priority:** P1

## Debt policy
V2 must reduce architectural debt while adding capabilities. New code should not introduce a second competing abstraction for an existing concept.
