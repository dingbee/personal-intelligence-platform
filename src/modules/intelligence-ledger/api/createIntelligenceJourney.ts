import { supabase } from '@/shared/lib/supabase'
import { toIntelligenceJourney } from '@/modules/intelligence-ledger/api/mappers'
import type { CreateIntelligenceJourneyParams, IntelligenceJourney } from '@/modules/intelligence-ledger/ledger'

/** The only way an intelligence_journeys row can be created — see create_intelligence_journey() in 0066_intelligence_ledger.sql. user_id is always set server-side from auth.uid(), never client-supplied. */
export async function createIntelligenceJourney(params: CreateIntelligenceJourneyParams): Promise<IntelligenceJourney> {
  const { workspaceId, objectiveId = null, title } = params
  const { data, error } = await supabase.rpc('create_intelligence_journey', {
    p_workspace_id: workspaceId,
    p_objective_id: objectiveId,
    p_title: title,
  })
  if (error) throw error
  return toIntelligenceJourney(data)
}
