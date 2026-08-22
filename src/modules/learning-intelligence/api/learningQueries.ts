import { supabase } from '@/shared/lib/supabase'
import { toLearningEvidenceLink, toLearningSignal, toOutcomeEvaluation } from '@/modules/learning-intelligence/api/mappers'
import type { LearningEvidenceLink, LearningSignal, LearningSignalStatus, OutcomeEvaluation } from '@/modules/learning-intelligence/learning'

/** RLS scopes every one of these to the caller's own rows — see the SELECT policies in 0087_learning_intelligence_foundation.sql. */
export async function listOutcomeEvaluations(recordId: string): Promise<OutcomeEvaluation[]> {
  const { data, error } = await supabase.from('intelligence_outcome_evaluations').select('*').eq('record_id', recordId).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toOutcomeEvaluation)
}

export async function listLearningSignals(filters: { status?: LearningSignalStatus } = {}): Promise<LearningSignal[]> {
  let query = supabase.from('intelligence_learning_signals').select('*').order('updated_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  const { data, error } = await query
  if (error) throw error
  return data.map(toLearningSignal)
}

export async function getLearningSignal(id: string): Promise<LearningSignal> {
  const { data, error } = await supabase.from('intelligence_learning_signals').select('*').eq('id', id).single()
  if (error) throw error
  return toLearningSignal(data)
}

/** I8.19/I8.20 — every evaluation that ever contributed to (or contested) this signal, the actual reconstructable audit trail (see 0087's own migration header on why no separate audit-event table was built). */
export async function listEvidenceForSignal(signalId: string): Promise<LearningEvidenceLink[]> {
  const { data, error } = await supabase.from('intelligence_learning_evidence').select('*').eq('signal_id', signalId).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toLearningEvidenceLink)
}

export async function listOutcomeEvaluationsByIds(ids: string[]): Promise<OutcomeEvaluation[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('intelligence_outcome_evaluations').select('*').in('id', ids)
  if (error) throw error
  return data.map(toOutcomeEvaluation)
}

/** The signal(s) this one contradicts or was contradicted by — reverse lookup for the UI's own "see the conflicting evidence" affordance (I8.7). */
export async function listContradictingSignals(signalId: string): Promise<LearningSignal[]> {
  const { data, error } = await supabase.from('intelligence_learning_signals').select('*').eq('contradicts_signal_id', signalId)
  if (error) throw error
  return data.map(toLearningSignal)
}

/** I8.14 Calibration's own read path — every evaluation whose pattern_key starts with the given prefix (e.g. 'decision:confidence:'), for computeConfidenceCalibration.ts's own deterministic aggregation. */
export async function listOutcomeEvaluationsByPatternPrefix(patternPrefix: string): Promise<OutcomeEvaluation[]> {
  const { data, error } = await supabase.from('intelligence_outcome_evaluations').select('*').like('pattern_key', `${patternPrefix}%`).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toOutcomeEvaluation)
}

/**
 * I8.12 Adaptation's own read path — 'active' (evidence_count >= 2, not
 * contested/revoked) signals for a given pattern-key PREFIX, e.g.
 * 'execution:capability:' to fetch every execution-derived signal
 * regardless of which specific capability. Deliberately a narrow,
 * explicit lookup (never a full-table retrieval) — see
 * gatherRelevantLearningSignals.ts, the one caller of this function.
 */
export async function listActiveSignalsByPatternPrefix(patternPrefix: string): Promise<LearningSignal[]> {
  const { data, error } = await supabase
    .from('intelligence_learning_signals')
    .select('*')
    .eq('status', 'active')
    .like('pattern_key', `${patternPrefix}%`)
    .order('evidence_count', { ascending: false })
  if (error) throw error
  return data.map(toLearningSignal)
}
