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
 * `scope`/`context` optionality.
 */

export type InformationOrigin = 'known' | 'assumed' | 'unknown' | 'requires_user_input'

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
  sequence: number
  dependsOnMilestoneIds: string[]
}

export type PlanTaskStatus = 'not_started'
export type PlanPriority = 'low' | 'medium' | 'high'

export interface PlanTask {
  id: string
  title: string
  description: string
  /** A freshly generated plan has no progress yet — always 'not_started'. The field exists (rather than being omitted) so a future execution phase can update task state without a type migration. */
  status: PlanTaskStatus
  priority: PlanPriority
  sequence: number
  dependsOnTaskIds: string[]
  milestoneId: string | null
  /** Free-text effort estimate (e.g. "a few hours", "2-3 days") — null when the planner has no honest basis to estimate one. Never a fabricated number. */
  estimatedEffort: string | null
  requiredResources: string[]
}

export type PlanRiskLevel = 'low' | 'medium' | 'high'

export interface PlanRisk {
  id: string
  risk: string
  /** null when the planner has no honest basis to assess likelihood — never defaulted to a guessed value. */
  probability: PlanRiskLevel | null
  impact: PlanRiskLevel
  mitigation: string | null
}

export interface PlanDecisionOption {
  option: string
  tradeoff: string | null
}

export interface PlanDecision {
  id: string
  decision: string
  options: PlanDecisionOption[]
  /** Populated only when the planner has a genuine, justified basis for a recommendation — mirrors decisionFrameworkBuilder.ts's own DecisionFramework.recommendation nullability. */
  recommendation: string | null
  /** True when this decision blocks part of the plan until the user resolves it — surfaced distinctly in the UI, never silently defaulted. */
  unresolved: boolean
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
  milestones: PlanMilestone[]
  tasks: PlanTask[]
  risks: PlanRisk[]
  decisions: PlanDecision[]
  outputs: PlanOutput[]
  successCriteria: string[]
  /** Real passages retrieved from the user's own library that informed generation — see PlanContextSource's own doc comment. Empty when nothing relevant was found, never a fabricated citation. */
  contextEvidence: PlanContextSource[]
  workspaceId: string | null
  createdAt: string
  /** Structural problems a deterministic pass found (circular dependencies, dangling references) — see validatePlan.ts. The plan is still returned as-is; nothing is silently repaired. */
  validationIssues: PlanValidationIssue[]
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
  | 'missing_objective'
  | 'no_actionable_tasks'

export interface PlanValidationIssue {
  kind: PlanValidationIssueKind
  message: string
  /** The task/milestone id(s) involved, when applicable — empty for plan-level issues like missing_objective. */
  affectedIds: string[]
}
