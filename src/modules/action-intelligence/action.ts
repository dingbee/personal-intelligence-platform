/**
 * ARRIYIA Professional Intelligence — Action Intelligence.
 *
 * Answers "the decision has been made (or the plan exists, or the user
 * said so directly) — what needs to happen now, in what order, by whom,
 * with what dependencies, and what's still missing before it's safe to
 * act?" This is explicitly NOT execution: an Action here is a structured,
 * traceable proposal an execution layer could later consume — nothing in
 * this module sends an email, books anything, or calls an external API.
 * See runActionIntelligence.ts's own doc comment for the "trust
 * boundary" this exists to enforce: the engine must be able to say "I
 * know what should happen, but I cannot safely execute it yet" rather
 * than silently presenting an unready action as actionable.
 *
 * Mirrors Plan (plan.ts) and Decision (decision.ts)'s own conventions:
 * id-referenced flat records, an InformationOrigin-flavored honesty
 * discipline, immutable-update orchestration, and a status/validation
 * taxonomy that never collapses "structurally uncertain" into "ready."
 * Deliberately its own domain model rather than Plan's Task or
 * Decision's anything — an Action's core differentiator (a deterministic
 * READY/BLOCKED/NEEDS_INFORMATION/NEEDS_DECISION readiness state,
 * computed by this application, never trusted from the model) has no
 * equivalent in either sibling engine.
 */

export type InformationOrigin = 'known' | 'assumed' | 'unknown' | 'requires_user_input'

/** Distinguishes what kind of thing an Action actually is — an information request and a decision-required item are not "work to do," they're gaps that block work until resolved. */
export type ActionType = 'action' | 'task' | 'follow_up' | 'information_request' | 'decision_required'

export type ActionStatus = 'proposed' | 'ready' | 'blocked' | 'in_progress' | 'completed' | 'cancelled'

export type ActionPriority = 'low' | 'medium' | 'high'

/**
 * The deterministic readiness state — the sprint's own core
 * differentiator. Never set from the model's own "ready": true claim;
 * always computed by computeActionReadiness.ts from real structural
 * facts (dependency graph state, actor assignment, decision gaps).
 */
export type ActionReadinessState = 'ready' | 'partially_ready' | 'blocked' | 'needs_information' | 'needs_decision'

export interface ActionReadiness {
  state: ActionReadinessState
  /** Human-readable, real reasons this action isn't fully ready — never empty when state isn't 'ready'. */
  blockers: string[]
  /** Concrete missing facts (e.g. "No responsible actor identified") — distinct from blockers, which are about OTHER actions/decisions this one depends on. */
  missingInformation: string[]
}

/**
 * What an action depends on. 'action' dependencies are internal
 * (resolved to a real Action.id within the same ActionSet, exactly like
 * Plan's milestone/task dependsOn resolution). 'decision' dependencies
 * have no persisted id to reference — neither Plan nor Decision persist
 * beyond one request — so `targetId` stays null and `description` is
 * the only record of what's blocking; this is what routes an action to
 * `needs_decision` readiness. 'objective' dependencies resolve to a real
 * `workspace_objectives.id` when the model references one from the
 * numbered context list (see buildActionContext.ts), exactly like
 * evidence-number resolution elsewhere in this codebase — never a
 * fabricated id.
 */
export type ActionDependencyKind = 'action' | 'decision' | 'objective'

export interface ActionDependency {
  id: string
  kind: ActionDependencyKind
  targetId: string | null
  description: string
}

/**
 * Who/what is responsible. 'user' is the only identity this platform
 * can actually resolve today (ARRIYIA is a personal intelligence
 * platform — there is no cross-user task assignment infrastructure to
 * plug into here); 'described' is a free-text mention (e.g. "the
 * marketing team", "IT office") the model proposed without ARRIYIA being
 * able to verify it names a real person — never upgraded to a fabricated
 * specific identity. 'unassigned' is the honest default when nothing was
 * proposed.
 */
export type ActionActorType = 'user' | 'described' | 'unassigned'

export interface ActionActor {
  type: ActionActorType
  label: string | null
}

/** What produced this action — an honest label identifying the source, always. */
export type ActionSourceKind = 'plan' | 'decision' | 'user_instruction' | 'evidence'

/**
 * I7 addition: `planId`/`decisionId` carry the REAL, real id the upstream
 * Plan/Decision actually had at generation time (I6/I5 both mint a real
 * `crypto.randomUUID()` for `Plan.id`/`Decision.id`, even though neither
 * persists beyond one request unless the user explicitly saves it to a
 * Note) — this is what makes PLAN -> ACTION and DECISION -> ACTION
 * genuinely traceable within one generation arc, not just a human-
 * readable label. Both null whenever the corresponding upstream object
 * wasn't the (one, batch-level) source — see runActionIntelligence.ts's
 * own determineSource(), which already picks ONE source for the whole
 * generated batch; this only adds the id neither field previously kept,
 * it does not add new per-action attribution (a deliberate, unrelated,
 * already-justified design decision — see parseActionResponse.ts's own
 * doc comment on why per-action source attribution isn't asked of the
 * model). Never fabricated: only ever set from a real upstream id this
 * request actually saw, never guessed or invented.
 */
export interface ActionSource {
  kind: ActionSourceKind
  label: string
  planId?: string | null
  decisionId?: string | null
}

export interface ActionExpectedOutput {
  outcome: string
  completionCriteria: string | null
}

export type ActionContextSourceType = 'document' | 'note' | 'asset'

/** One real, retrieved passage the engine actually saw — identical contract to Plan/Decision's own *ContextSource types, defined separately per-module by established convention (see decision.ts's own doc comment on why). */
export interface ActionContextSource {
  id: string
  type: ActionContextSourceType
  title: string
  excerpt: string
}

export interface Action {
  id: string
  title: string
  description: string
  type: ActionType
  /** Always 'proposed' at generation time — the other statuses exist for a future execution/tracking phase to update, exactly like Plan's PlanTaskStatus being 'not_started'-only today. */
  status: ActionStatus
  priority: ActionPriority
  sequence: number
  readiness: ActionReadiness
  dependencies: ActionDependency[]
  actor: ActionActor
  source: ActionSource
  expectedOutput: ActionExpectedOutput
  /** Free-text timing the model actually saw stated (a constraint, a plan milestone target) — null unless genuinely supplied; never a fabricated deadline. Used only as a non-quantitative signal in prioritization (see computeActionPriorities.ts) — there is no real date to compute "days remaining" from. */
  dueHint: string | null
  /** Real ActionContextSource ids this action's description/rationale draws on. */
  evidenceIds: string[]
}

export type ActionSetStatus = 'complete' | 'declined' | 'failed'

export type ActionValidationIssueKind =
  | 'missing_actions'
  | 'missing_title'
  | 'missing_actor'
  | 'dangling_action_dependency'
  | 'dangling_objective_dependency'
  | 'circular_dependency'
  | 'contradictory_readiness'
  | 'missing_objective_or_context'
  | 'duplicate_id'

export interface ActionValidationIssue {
  kind: ActionValidationIssueKind
  message: string
  affectedIds: string[]
}

export interface ActionSet {
  id: string
  title: string
  /** The objective this action set serves, when known — from an originating Plan/Decision or explicit user context. */
  objective: string | null
  status: ActionSetStatus
  actions: Action[]
  contextEvidence: ActionContextSource[]
  validationIssues: ActionValidationIssue[]
  budgetExhausted: boolean
  generationFailed: boolean
  declineReason: string | null
  workspaceId: string | null
  createdAt: string
}
