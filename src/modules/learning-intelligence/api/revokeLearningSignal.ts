import { supabase } from '@/shared/lib/supabase'
import { toLearningSignal } from '@/modules/learning-intelligence/api/mappers'
import type { LearningSignal } from '@/modules/learning-intelligence/learning'

/** I8.21 — the only user-controllable mutation on a learning signal. Terminal: see revoke_learning_signal()'s own doc comment in the migration for why a revoked signal can never be un-revoked. */
export async function revokeLearningSignal(signalId: string, reason?: string | null): Promise<LearningSignal> {
  const { data, error } = await supabase.rpc('revoke_learning_signal', { p_signal_id: signalId, p_reason: reason ?? null })
  if (error) throw error
  return toLearningSignal(data)
}
