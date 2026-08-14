/**
 * Analysis Intelligence — the investigation contract.
 *
 * Deliberately flat: an AnalysisInvestigation is an ordered list of
 * AnalysisSteps, not a dependency graph or a general-purpose agent
 * framework (see docs/analysis-intelligence-architecture-audit.md §5,
 * §25/§26). Every step wraps an unmodified Data Intelligence
 * AnalyticalPlan/AnalyticalResult pair — this module never computes a
 * value itself; executeAnalyticalPlan (Data Intelligence) remains the
 * only code that reads dataset rows and produces numbers. What this
 * module adds is purely structural: sequencing, observation extraction,
 * a bounded stop condition, and a place for hypotheses/contradictions to
 * live without ever being treated as verified facts.
 */

import type { AnalyticalPlan, AnalyticalProvenance, AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

/**
 * A directly-computed fact pulled from one AnalyticalResult row — never
 * invented, never re-derived by an LLM. `value` is populated only when
 * the step's plan had exactly one measure (multi-measure rows are still
 * described in `statement`, but a single ambiguous `value` would invite
 * exactly the "which number does this refer to" confusion this
 * architecture exists to avoid).
 */
export interface Observation {
  id: string
  stepId: string
  statement: string
  value: number | null
  provenance: AnalyticalProvenance
}

/**
 * An explicitly-labeled, untested explanation proposed by the step
 * planner when it chooses a follow-up direction — never presented as
 * verified. `status` stays 'untested' throughout this phase: nothing in
 * this codebase yet deterministically confirms or refutes a hypothesis,
 * and claiming otherwise without a real verification mechanism would be
 * exactly the overclaiming this architecture exists to prevent (see
 * BACKLOG in the final report).
 */
export interface Hypothesis {
  id: string
  statement: string
  supportingObservationIds: string[]
  status: 'untested' | 'supported' | 'unsupported' | 'inconclusive'
}

/**
 * A flagged tension between two verified observations — e.g. two
 * measures trending in opposite directions across the same period. This
 * is a "these findings appear inconsistent" flag, never an assertion
 * that one is wrong or that a causal explanation exists (see
 * detectContradictions.ts).
 */
export interface Contradiction {
  id: string
  observationIds: [string, string]
  description: string
}

export interface AnalysisStep {
  id: string
  index: number
  /** Why the planner proposed this step (e.g. "baseline", "follow-up: breakdown by Product"). Always present, even for step 0. */
  purpose: string
  /** The prior step's id that motivated this one; null for the first step. */
  triggeredBy: string | null
  plan: AnalyticalPlan
  result: AnalyticalResult
  /** Empty when `result.status === 'error'` — a failed step contributes no evidence, never a fabricated one. */
  observations: Observation[]
}

export type InvestigationStatus = 'in_progress' | 'complete' | 'declined' | 'failed'

export interface AnalysisInvestigation {
  id: string
  question: string
  datasetId: string
  steps: AnalysisStep[]
  hypotheses: Hypothesis[]
  contradictions: Contradiction[]
  /** Final interpretation prose, populated only once status becomes 'complete'. */
  synthesis: string | null
  status: InvestigationStatus
  /** True when the step loop stopped because MAX_INVESTIGATION_STEPS was reached, not because the planner chose to stop naturally. Synthesis is still produced — see runAnalysisInvestigation.ts. */
  stepLimitReached: boolean
  /** Populated only when status is 'declined' or 'failed' — why no investigation (or no further investigation) happened. */
  declineReason: string | null
}
