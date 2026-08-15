import { supabase } from '@/shared/lib/supabase'
import { toIntelligenceJourney, toIntelligenceRecord } from '@/modules/intelligence-ledger/api/mappers'
import type { IntelligenceJourney, IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'

/** History: reverse-chronological across every record type, RLS-scoped to the caller's own rows and workspaces they can view. */
export async function listIntelligenceRecords(workspaceId: string | null): Promise<IntelligenceRecord[]> {
  let query = supabase.from('intelligence_records').select('*').order('created_at', { ascending: false })
  query = workspaceId ? query.eq('workspace_id', workspaceId) : query.is('workspace_id', null)
  const { data, error } = await query
  if (error) throw error
  return data.map(toIntelligenceRecord)
}

export async function getIntelligenceRecord(id: string): Promise<IntelligenceRecord> {
  const { data, error } = await supabase.from('intelligence_records').select('*').eq('id', id).single()
  if (error) throw error
  return toIntelligenceRecord(data)
}

/** Every record grouped under one journey, in creation order — the ordered chain a future Journey UI would walk. */
export async function listJourneyRecords(journeyId: string): Promise<IntelligenceRecord[]> {
  const { data, error } = await supabase.from('intelligence_records').select('*').eq('journey_id', journeyId).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toIntelligenceRecord)
}

/** What was derived from a specific record — the reverse-lineage query "what came after this." */
export async function listChildRecords(parentRecordId: string): Promise<IntelligenceRecord[]> {
  const { data, error } = await supabase.from('intelligence_records').select('*').eq('parent_record_id', parentRecordId).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toIntelligenceRecord)
}

export async function getIntelligenceJourney(id: string): Promise<IntelligenceJourney> {
  const { data, error } = await supabase.from('intelligence_journeys').select('*').eq('id', id).single()
  if (error) throw error
  return toIntelligenceJourney(data)
}

export async function listIntelligenceJourneys(workspaceId: string | null): Promise<IntelligenceJourney[]> {
  let query = supabase.from('intelligence_journeys').select('*').order('created_at', { ascending: false })
  query = workspaceId ? query.eq('workspace_id', workspaceId) : query.is('workspace_id', null)
  const { data, error } = await query
  if (error) throw error
  return data.map(toIntelligenceJourney)
}
