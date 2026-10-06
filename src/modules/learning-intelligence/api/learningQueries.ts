import { supabase } from '@/shared/lib/supabase'
import { toLearningEvidenceLink, toLearningSignal, toOutcomeEvaluation } from '@/modules/learning-intelligence/api/mappers'
import type { LearningEvidenceLink, LearningSignal, LearningSignalStatus, OutcomeEvaluation } from '@/modules/learning-intelligence/learning'

/** RLS scopes these reads to the caller's permitted rows; workspaceId is also applied explicitly when a Space-scoped surface requests it. */
export async function listOutcomeEvaluations(recordId: string): Promise<OutcomeEvaluation[]> {
  const { data, error } = await supabase.from('intelligence_outcome_evaluations').select('*').eq('record_id', recordId).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toOutcomeEvaluation)
}

export async function listLearningSignals(filters: { status?: LearningSignalStatus; workspaceId?: string | null } = {}): Promise<LearningSignal[]> {
  let query = supabase.from('intelligence_learning_signals').select('*').order('updated_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  else if (filters.workspaceId === null) query = query.is('workspace_id', null)
  const { data, error } = await query
  if (error) throw error
  return data.map(toLearningSignal)
}

export async function getLearningSignal(id: string): Promise<LearningSignal> {
  const { data, error } = await supabase.from('intelligence_learning_signals').select('*').eq('id', id).single()
  if (error) throw error
  return toLearningSignal(data)
}

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

export async function listContradictingSignals(signalId: string): Promise<LearningSignal[]> {
  const { data, error } = await supabase.from('intelligence_learning_signals').select('*').eq('contradicts_signal_id', signalId)
  if (error) throw error
  return data.map(toLearningSignal)
}

export async function listOutcomeEvaluationsByPatternPrefix(patternPrefix: string): Promise<OutcomeEvaluation[]> {
  const { data, error } = await supabase.from('intelligence_outcome_evaluations').select('*').like('pattern_key', patternPrefix + '%').order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toOutcomeEvaluation)
}

export async function listActiveSignalsByPatternPrefix(patternPrefix: string): Promise<LearningSignal[]> {
  const { data, error } = await supabase.from('intelligence_learning_signals').select('*').eq('status', 'active').like('pattern_key', patternPrefix + '%').order('evidence_count', { ascending: false })
  if (error) throw error
  return data.map(toLearningSignal)
}