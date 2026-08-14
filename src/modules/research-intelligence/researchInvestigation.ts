/**
 * ARRIYIA Professional Intelligence — Research Intelligence (P2).
 *
 * The investigation contract, deliberately shaped after Analysis
 * Intelligence's own AnalysisInvestigation (see
 * analysis-intelligence/analysisInvestigation.ts's doc comment): a flat
 * ordered list of ResearchSteps, not a dependency graph or a general-
 * purpose agent framework.
 *
 * Source integrity (non-negotiable per the P2 brief): a ResearchSource
 * only ever names something that genuinely exists in the caller's own
 * library/notes/dataset — 'document' and 'note' ids come straight from
 * retrieveContext/retrieveNoteContext's real query results (see
 * gatherEvidence.ts), never invented. 'asset' (Multimodal Evidence
 * Integration sprint) comes identically from retrieveAssetContext's own
 * real, already-analyzed matches — never a filename, URL, page number,
 * region, or OCR confidence invented on its behalf; if the underlying
 * asset has no analysis yet, retrieveAssetContext simply excludes it
 * (see that function's own "never fabricates content for an unanalyzed
 * image" contract), so gatherEvidence.ts has nothing further to guard
 * here. 'dataset_investigation' wraps an actual, unmodified Analysis
 * Intelligence AnalysisInvestigation. There is currently no external
 * web/URL source mechanism anywhere in this
 * codebase (architecture audit, P2) — a 'web' source type is
 * deliberately absent from this union rather than added and left unable
 * to ever be populated honestly. See BACKLOG in the final report.
 */

import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'

export type ResearchSourceType = 'document' | 'note' | 'asset' | 'dataset_investigation'

export interface ResearchSource {
  type: ResearchSourceType
  id: string
  title: string
}

/**
 * One retrieved passage — the SOURCE (research-intelligence-brief
 * terminology) is `source`; `excerpt` is the actual retrieved text,
 * verbatim from retrieveContext/retrieveNoteContext, never paraphrased
 * or invented. `similarity` is the retrieval engine's own score (null
 * for evidence synthesized from a dataset investigation, which has no
 * embedding-similarity concept).
 */
export interface ResearchEvidence {
  id: string
  source: ResearchSource
  excerpt: string
  similarity: number | null
}

/**
 * The EVIDENCE -> OBSERVATION step in the P2 brief's epistemic
 * hierarchy: a supported statement, always traceable to one or more
 * real ResearchEvidence ids from the same investigation. `evidenceIds`
 * is never empty — an interpretation step that can't ground a claim in
 * cited evidence produces no observation at all (see
 * parseResearchObservationsResponse.ts).
 */
export interface ResearchObservation {
  id: string
  stepId: string
  statement: string
  evidenceIds: string[]
}

/** An explicitly-labeled, untested explanation — never presented as verified. Mirrors Analysis Intelligence's Hypothesis exactly; 'status' stays 'untested' for the same reason (see that type's doc comment). */
export interface ResearchHypothesis {
  id: string
  statement: string
  supportingObservationIds: string[]
  status: 'untested' | 'supported' | 'unsupported' | 'inconclusive'
}

/**
 * Why a research gap was flagged — a closed set the synthesis
 * capability must choose from (see parseResearchSynthesisResponse.ts),
 * so a gap is always a specific, evidence-grounded reason rather than
 * free-form text manufactured to "look academic" (P2 brief, Research Gap
 * Intelligence section).
 */
export type ResearchGapReason =
  | 'insufficient_evidence'
  | 'conflicting_findings'
  | 'methodological_limitation'
  | 'missing_variable'
  | 'unanswered_question'
  | 'outdated_evidence'

export interface ResearchGap {
  id: string
  description: string
  reason: ResearchGapReason
}

/**
 * How two (or more) sources relate — the P2 brief's own required
 * vocabulary ("agrees with", "differs from", ...), deliberately not
 * "contradicts": see detectContradictions.ts's precedent in Analysis
 * Intelligence and this phase's own "do not build a general pairwise
 * contradiction engine" instruction. `cannot_be_directly_compared` is a
 * first-class outcome, not a fallback failure — methodological
 * differences (P2 brief) can make two sources genuinely incomparable.
 */
export type SourceRelationship = 'agrees_with' | 'differs_from' | 'provides_additional_evidence' | 'uses_different_methodology' | 'cannot_be_directly_compared'

export interface SourceComparison {
  id: string
  sourceIds: string[]
  relationship: SourceRelationship
  description: string
}

export type ResearchStepKind = 'evidence_gathering' | 'dataset_investigation'

export interface ResearchStep {
  id: string
  index: number
  kind: ResearchStepKind
  /** Why the planner proposed this step (e.g. "baseline evidence gathering", "quantify the pattern via the uploaded dataset"). */
  purpose: string
  /** The prior step's id that motivated this one; null for the first step. */
  triggeredBy: string | null
  /** The retrieval query actually executed (evidence_gathering) or the sub-question handed to Analysis Intelligence (dataset_investigation) — always the real query, never a paraphrase after the fact. */
  query: string
  /** Empty when nothing relevant was found — a step that finds nothing contributes no evidence, never a fabricated one. */
  evidence: ResearchEvidence[]
  observations: ResearchObservation[]
  /** Populated only when kind === 'dataset_investigation' — the real, unmodified AnalysisInvestigation this step delegated to (see runResearchInvestigation.ts). Exposed so the UI/provenance can show the underlying AnalyticalPlan/AnalyticalResult chain directly, never re-derived. */
  datasetInvestigation: AnalysisInvestigation | null
}

export type ResearchInvestigationStatus = 'in_progress' | 'complete' | 'declined' | 'failed'

export interface ResearchInvestigation {
  id: string
  question: string
  /** Optional researcher-supplied scope/objective — informational context for the planner, never a filter Research Intelligence enforces deterministically. */
  scope: string | null
  /** Optional researcher-supplied background context. */
  context: string | null
  workspaceId: string | null
  /** Optional single-document restriction — when set and that document has a structured dataset, dataset delegation (Data/Analysis Intelligence) becomes available to the planner. */
  documentId: string | null
  steps: ResearchStep[]
  hypotheses: ResearchHypothesis[]
  comparisons: SourceComparison[]
  gaps: ResearchGap[]
  /** Each a specific, evidence-grounded finding — populated alongside synthesis. */
  keyFindings: string[]
  /** Final synthesis prose, populated only once status becomes 'complete' and synthesis succeeded. */
  synthesis: string | null
  /** Limitations/uncertainty prose, populated alongside synthesis. */
  limitations: string | null
  followUpQuestions: string[]
  status: ResearchInvestigationStatus
  /** True when the step loop stopped because MAX_RESEARCH_STEPS was reached, not because the planner chose to stop naturally. Synthesis is still attempted — see runResearchInvestigation.ts. */
  stepLimitReached: boolean
  /**
   * True when the investigation itself completed (real evidence was
   * gathered) but the final research-synthesis capability's response
   * could not be parsed — the P2 brief's explicit "AI synthesis
   * failure" case. `status` stays 'complete' (the gathered steps/
   * evidence/observations below are real and shown as-is); `synthesis`/
   * `limitations`/`keyFindings` stay empty rather than being fabricated
   * from an unparseable response.
   */
  synthesisFailed: boolean
  /** Populated only when status is 'declined' or 'failed'. */
  declineReason: string | null
}
