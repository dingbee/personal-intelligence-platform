/**
 * ARRIYIA — I8 Learning / Adaptive Intelligence.
 *
 * Closes the loop:
 *
 *   DECISION / PLAN / ACTION -> EXPECTED OUTCOME -> ACTUAL OUTCOME
 *     -> OUTCOME DIFFERENCE -> LEARNING SIGNAL -> VALIDATED LEARNING
 *     -> FUTURE INTELLIGENCE INPUT
 *
 * This is explicitly NOT memory (see ai_memory, a separate, pre-existing
 * chat-personalization system this module never touches) and NOT an LLM
 * saying "next time, do X" — every fact here traces back to a real,
 * already-computed outcome (see recordIntelligenceOutcome.ts's own doc
 * comment on exactly what counts as "real"). See migration
 * 0087_learning_intelligence_foundation.sql for the full architecture
 * rationale and the SECURITY DEFINER RPCs this module's types mirror —
 * every server-side invariant described there is enforced by Postgres,
 * not re-implemented here.
 */

import type {
  LearningSignalDirection,
  LearningSignalStatus,
  LearningSignalStrength,
  OutcomeComparisonResult,
  OutcomeEvaluationSource,
} from '@/shared/types/database'
import type { IntelligenceRecordType } from '@/modules/intelligence-ledger/ledger'

export type { LearningSignalDirection, LearningSignalStatus, LearningSignalStrength, OutcomeComparisonResult, OutcomeEvaluationSource }

/**
 * One evaluated outcome (expected vs actual) for an existing
 * IntelligenceRecord. Append-only — see the migration's own doc comment
 * on why a later evaluation of the same record never overwrites an
 * earlier one (I8.9's own "system outcome: SUCCESS, user feedback: 'not
 * useful' — stored separately" requirement).
 */
export interface OutcomeEvaluation {
  id: string
  userId: string
  workspaceId: string | null
  recordId: string
  source: OutcomeEvaluationSource
  expectedOutcome: string
  actualOutcome: string
  comparisonResult: OutcomeComparisonResult
  /** I8.3 — execution success and outcome success are distinct facts. Null when the record type has no separate "did it run at all" fact. */
  executionSucceeded: boolean | null
  /** Populated only when source = 'user_feedback'. */
  feedbackNote: string | null
  patternKey: string
  createdAt: string
}

/**
 * A durable, evidence-grounded pattern: "things matching patternKey tend
 * to {match/miss} their expected outcome." Never created or reinforced
 * from a single 'unknown' comparison (I8.18's own "do not learn from
 * unverified execution claims"). `strength` is a pure function of
 * `evidenceCount` (see the migration's own record_intelligence_outcome()
 * for the exact thresholds) — never a fabricated statistical claim.
 */
export interface LearningSignal {
  id: string
  userId: string
  workspaceId: string | null
  recordType: IntelligenceRecordType
  patternKey: string
  direction: LearningSignalDirection
  statement: string
  strength: LearningSignalStrength
  status: LearningSignalStatus
  evidenceCount: number
  /** Set only when this signal was created because it genuinely contradicted an existing one (I8.7) — that existing signal's own status becomes 'contested', never overwritten or deleted. */
  contradictsSignalId: string | null
  revokedReason: string | null
  revokedAt: string | null
  firstEvidenceAt: string
  lastEvidenceAt: string
  createdAt: string
  updatedAt: string
}

export interface LearningEvidenceLink {
  id: string
  signalId: string
  evaluationId: string
  createdAt: string
}

export interface RecordIntelligenceOutcomeParams {
  recordId: string
  source: OutcomeEvaluationSource
  expectedOutcome: string
  actualOutcome: string
  comparisonResult: OutcomeComparisonResult
  patternKey: string
  executionSucceeded?: boolean | null
  feedbackNote?: string | null
}
