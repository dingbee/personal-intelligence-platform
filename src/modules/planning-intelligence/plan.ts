/**
 * ARRIYIA Professional Intelligence — Planning Intelligence.
 *
 * The structured-plan contract: "the structured plan is the source of
 * truth; the rendered UI is a projection of it" (sprint brief). Shaped
 * after Research Intelligence's own ResearchInvestigation precedent — a
 * flat set of id-referenced records, not a general-purpose agent
 * framework or a dependency graph library — with the same
 * immutable-update orchestration style (runPlanningIntelligence.ts
 * builds the object once, never mutates it in place).
 *
 * Every field distinguishes what the planner actually knows from what it
 * assumed or could not determine (Phase 4 of the brief: KNOWN / ASSUMED /
 * UNKNOWN / REQUIRES USER INPUT) via `InformationOrigin` — the planner is
 * explicitly instructed (see buildPlanningPrompt in module.ts) never to
 * invent a deadline, budget, resource, or person the user never
 * supplied; anything not stated is tagged 'unknown' or
 * 'requires_user_input', never silently asserted as fact.
 *
 * No `title`/`target`/deadline-style date field is ever fabricated by
 * the model when the user didn't supply the underlying fact — where the
 * brief's own field list implies a date (milestone `target`), it is
 * modeled as a nullable free-text field populated only when the user
 * explicitly provided timing, exactly like ResearchInvestigation's own
 * `scope`/`context` optionality. Where a REAL calendar date was
 * explicitly stated (not just a vague phrase), it is additionally
 * captured in a nullable structured ISO field (`targetDate`/`deadline`)
 * so deterministic code — never the model — can check chronological
 * feasibility (see computePlanSchedule.ts, validatePlan.ts).
 *
 * I6 addendum (Planning Intelligence completion sprint) — three
 * additions beyond the original brief, each closing a genuine gap found
 * on inspection rather than new invented scope:
 *
 *   1. `objectives`/`workstreams` — the brief's own stated flow is GOAL ->
 *      OBJECTIVES -> WORKSTREAMS -> TASKS, but only Goal and Tasks
 *      existed as real fields. Added as their own flat, id-referenced
 *      records (same pattern as milestones/tasks), never conflated with
 *      the pre-existing, unrelated `activeWorkspaceObjectives` context
 *      (workspace-level goals the plan is aware of, not this plan's own
 *      decomposition of its own goal).
 *   2. `resources`/`PlanTask.resourceRequirements` — `requiredResources`
 *      (free text) already existed but nothing could ever be checked
 *      against it. A resource is only added when the user stated a real
 *      available quantity; a task's `resourceRequirements` only
 *      reference a resource the plan actually declared. This is what
 *      lets computePlanSchedule.ts perform genuine resource arithmetic
 *      rather than fabricating a capacity check against prose.
 *   3. `PlanTaskStatus` — was a single-value union (`'not_started'`)
 *      with a doc comment saying a real state machine was future work.
 *      Extended to the exact NOT_STARTED/IN_PROGRESS/BLOCKED/COMPLETED/
 *      CANCELLED shape ActionStatus (action-intelligence/action.ts)
 *      already established for the same purpose — the existing
 *      equivalent, not a second invented machine.
 *   4. `PlanDecision.decisionIntelligence` — a plan's own "decision
 *      points" were previously a free-text `recommendation` the SAME
 *      one-shot planning call fabricated. Genuine decisions now delegate
 *      to the real Decision Intelligence engine (its own operation, its
 *      own quota, its own deterministic weighted scoring) — see
 *      runPlanningIntelligence.ts. `recommendation` is kept as the
 *      honest fallback for when delegation is unavailable/declines, not
 *      as the primary source of truth for a resolved decision.
 *   5. `revisionOf`/`revisionReason` — Plan Revision (I6.19) needed a way
 *      to mark a Plan as the successor of an earlier one; both null on a
 *      freshly generated plan (see revisePlanningIntelligence.ts).
 */

import type { Decision } from '@/modules/decision-intelligence/decision'

export type InformationOrigin = 'known' | 'assumed' | 'unknown' | 'requires_user_input'

/** A concrete sub-objective decomposing the plan's overall goal — "what must be true for the goal to be achieved," distinct from the free-text `desiredOutcome` narrative and from the unrelated pre-existing workspace-level `activeWorkspaceObjectives` context. */
export interface PlanObjective {
  id: string
  statement: string
  origin: Extract<InformationOrigin, 'known' | 'assumed'>
}

/** A named thread of related work (e.g. "Design", "Engineering", "Marketing") that groups tasks above the individual-task level and below milestones — tasks reference a workstream via `PlanTask.workstreamId`. */
export interface PlanWorkstream {
  id: string
  title: string
  description: string
}

export interface PlanAssumption {
  id: string
  statement: string
  origin: InformationOrigin
  confidence: 'low' | 'medium' | 'high'
}

export type PlanConstraintType = 'time' | 'budget' | 'resource' | 'technical' | 'organizational' | 'other'
export type PlanConstraintSeverity = 'hard' | 'soft'

export interface PlanConstraint {
  id: string
  constraint: string
  type: PlanConstraintType
  severity: PlanConstraintSeverity
  /** 'known' when the user actually stated this constraint; 'assumed' when the planner inferred it from context. Never 'unknown'/'requires_user_input' — a constraint the planner isn't sure about isn't a constraint yet, it's an open decision (see PlanDecision) or a gap the user should be asked about. */
  origin: Extract<InformationOrigin, 'known' | 'assumed'>
}

export interface PlanMilestone {
  id: string
  title: string
  description: string
  /** Free-text target (e.g. "end of Q2", "before the client demo") — null unless the user explicitly supplied timing. Never a fabricated calendar date. */
  target: string | null
  /** A real ISO-8601 date (YYYY-MM-DD), set only when the user explicitly stated an actual calendar date for this milestone — never inferred from `target`'s prose. Lets validatePlan.ts check chronological feasibility deterministically. */
  targetDate: string | null
  sequence: number
  dependsOnMilestoneIds: string[]
}

/** The single task-progress state machine — deliberately the exact shape ActionStatus (action-intelligence/action.ts) already established for the same purpose, not a second invented machine. A freshly generated plan's tasks are always 'not_started'; the other states exist for this plan to be tracked forward (see PlanningPage.tsx's status control). */
export type PlanTaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
export type PlanPriority = 'low' | 'medium' | 'high'

/** A quantity of a declared PlanResource a task actually needs — only present when the model tied a real number to a resource the plan declared (see parsePlanningResponse.ts's localId resolution); never a guessed amount. */
export interface PlanResourceRequirement {
  resourceId: string
  amount: number
}

export interface PlanTask {
  id: string
  title: string
  description: string
  /** A freshly generated plan has no progress yet — always 'not_started'. */
  status: PlanTaskStatus
  priority: PlanPriority
  sequence: number
  dependsOnTaskIds: string[]
  milestoneId: string | null
  /** A workstream this task belongs to, or null when the plan is too small to warrant grouping (see validatePlan.ts's dangling-reference check for an invalid reference). */
  workstreamId: string | null
  /** Free-text effort estimate (e.g. "a few hours", "2-3 days") — null when the planner has no honest basis to estimate one. Never a fabricated number. */
  estimatedEffort: string | null
  requiredResources: string[]
  /** Structured, arithmetic-checkable resource demand — see PlanResourceRequirement's own doc comment. Empty when the plan declared no resources or the model gave no honest numeric basis. */
  resourceRequirements: PlanResourceRequirement[]
}

export type PlanRiskLevel = 'low' | 'medium' | 'high'

export interface PlanRisk {
  id: string
  risk: string
  /** null when the planner has no honest basis to assess likelihood — never defaulted to a guessed value. */
  probability: PlanRiskLevel | null
  impact: PlanRiskLevel
  /** Preventive action taken up front to reduce likelihood/impact — distinct from `contingency`, the fallback plan for if the risk happens anyway. */
  mitigation: string | null
  /** What to actually do if this risk materializes despite mitigation — distinct from `mitigation`. Null when the planner has no honest basis to propose one. */
  contingency: string | null
}

/** A resource the plan draws on — a person/role, a budget, a material, or a tool. Only added when the user stated a real available quantity; `capacity`/`unit` stay null when the user named the resource but gave no honest quantity to check against (see computePlanSchedule.ts). */
export type PlanResourceKind = 'person' | 'budget' | 'material' | 'tool' | 'other'

export interface PlanResource {
  id: string
  name: string
  kind: PlanResourceKind
  capacity: number | null
  unit: string | null
  origin: Extract<InformationOrigin, 'known' | 'assumed'>
}

export interface PlanDecisionOption {
  option: string
  tradeoff: string | null
}

export interface PlanDecision {
  id: string
  decision: string
  options: PlanDecisionOption[]
  /** The one-shot planning call's own proposed recommendation — kept only as an honest fallback for when real Decision Intelligence delegation is unavailable, declined, or budget-exhausted (see runPlanningIntelligence.ts). Once `decisionIntelligence` is populated, THAT is the source of truth, not this field. */
  recommendation: string | null
  /** True when this decision blocks part of the plan until the user resolves it — surfaced distinctly in the UI, never silently defaulted. */
  unresolved: boolean
  /** The real Decision Intelligence outcome when this decision point was actually delegated (see runPlanningIntelligence.ts) — its own operation, its own deterministic weighted scoring, never rebuilt inline. Null when not delegated (e.g. not `unresolved`, Decision Intelligence unavailable/not entitled/declined/budget-exhausted) — in which case `recommendation` above is the only, honestly-weaker signal. */
  decisionIntelligence: Decision | null
}

export interface PlanOutput {
  id: string
  deliverable: string
  completionCriteria: string
}

export type PlanStatus = 'complete' | 'declined' | 'failed'

export type PlanContextSourceType = 'document' | 'note' | 'asset'

/** One real, retrieved passage the planner actually saw (via buildPlanningContext.ts's own gatherEvidence call) — never fabricated. Kept on the Plan itself (mirroring ResearchInvestigation.steps[].evidence living on the investigation) so the provenance adapter has real material to cite rather than needing a side-channel. */
export interface PlanContextSource {
  id: string
  type: PlanContextSourceType
  title: string
  excerpt: string
}

export interface Plan {
  id: string
  /** A short, planner-generated label distinct from the user's raw objective text — e.g. objective "help me launch our new pricing page" -> title "Pricing Page Launch Plan". */
  title: string
  /** The user's own objective text, verbatim — never rewritten. */
  objective: string
  description: string | null
  status: PlanStatus
  currentState: string | null
  desiredOutcome: string | null
  gapAnalysis: string | null
  assumptions: PlanAssumption[]
  constraints: PlanConstraint[]
  /** Sub-objectives decomposing `objective`/`desiredOutcome` — see PlanObjective's own doc comment. Distinct from `activeWorkspaceObjectives` (pre-existing workspace goals fed in as context, never this plan's own decomposition). */
  objectives: PlanObjective[]
  /** Named threads of related work grouping tasks — see PlanWorkstream's own doc comment. */
  workstreams: PlanWorkstream[]
  milestones: PlanMilestone[]
  tasks: PlanTask[]
  risks: PlanRisk[]
  decisions: PlanDecision[]
  outputs: PlanOutput[]
  successCriteria: string[]
  /** Resources the plan draws on and can be checked against — see PlanResource's own doc comment. */
  resources: PlanResource[]
  /** A real ISO-8601 date (YYYY-MM-DD) the user explicitly stated as the plan's own hard deadline — never inferred. Distinct from a free-text 'time' PlanConstraint, which stays honest prose when no real date was given. */
  deadline: string | null
  /** The longest dependency chain through `tasks`, by task id, computed deterministically by computePlanSchedule.ts (earliest-start "wave" scheduling, since no numeric task durations exist to do true CPM). Empty when the plan has no tasks, or the dependency graph is cyclic (see validationIssues for the cycle itself — a cyclic graph has no valid critical path to report). */
  criticalPath: string[]
  /** Real passages retrieved from the user's own library that informed generation — see PlanContextSource's own doc comment. Empty when nothing relevant was found, never a fabricated citation. */
  contextEvidence: PlanContextSource[]
  workspaceId: string | null
  createdAt: string
  /** Structural problems a deterministic pass found (circular dependencies, dangling references, infeasible timeline, over-committed resources) — see validatePlan.ts/computePlanSchedule.ts. The plan is still returned as-is; nothing is silently repaired. */
  validationIssues: PlanValidationIssue[]
  /** The id of the Plan this one revises, or null for a freshly generated plan (see revisePlanningIntelligence.ts). */
  revisionOf: string | null
  /** The free-text description of what changed, for a revision — null for a freshly generated plan. */
  revisionReason: string | null
  /** True when the operation's AI-call budget was exhausted before generation completed — mirrors ResearchInvestigation.budgetExhausted. */
  budgetExhausted: boolean
  /** True when the plan-generation capability responded but the response couldn't be parsed as a valid plan — mirrors ResearchInvestigation.synthesisFailed. */
  generationFailed: boolean
  /** Populated only when status is 'declined' or 'failed'. */
  declineReason: string | null
}

export type PlanValidationIssueKind =
  | 'circular_task_dependency'
  | 'circular_milestone_dependency'
  | 'dangling_task_dependency'
  | 'dangling_milestone_dependency'
  | 'dangling_milestone_reference'
  | 'dangling_workstream_reference'
  | 'dangling_resource_reference'
  | 'missing_objective'
  | 'no_actionable_tasks'
  /** A milestone's real targetDate falls after the plan's own real deadline. */
  | 'impossible_deadline'
  /** A milestone's real targetDate falls before a milestone it depends on — an internally inconsistent timeline. */
  | 'milestone_timeline_inconsistency'
  /** A wave of concurrently-schedulable tasks (see computePlanSchedule.ts) demands more of a resource than its declared capacity. */
  | 'resource_capacity_exceeded'
  /** A task with no milestone, no workstream, no dependencies, and nothing depending on it — structurally disconnected from the rest of the plan. Only meaningful when the plan has more than one task (a single-task plan is trivially "disconnected" from nothing). */
  | 'orphan_task'
  /** A milestone no task actually references — nothing in the plan will ever complete it. */
  | 'unreachable_milestone'

export interface PlanValidationIssue {
  kind: PlanValidationIssueKind
  message: string
  /** The task/milestone id(s) involved, when applicable — empty for plan-level issues like missing_objective. */
  affectedIds: string[]
}
