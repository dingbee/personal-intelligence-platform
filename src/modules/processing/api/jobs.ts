import { supabase } from '@/shared/lib/supabase'
import type { ProcessingJob, ProcessingStatus } from '@/shared/types/database'

export async function createProcessingJob(params: {
  documentId: string
  userId: string
}): Promise<ProcessingJob> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .insert({
      document_id: params.documentId,
      user_id: params.userId,
      status: 'queued',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProcessingJob(
  id: string,
  updates: Partial<Pick<ProcessingJob, 'status' | 'error_message' | 'completed_at'>>,
): Promise<void> {
  const { error } = await supabase.from('processing_jobs').update(updates).eq('id', id)
  if (error) throw error
}

export async function getLatestProcessingJob(documentId: string): Promise<ProcessingJob | null> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export const TERMINAL_STATUSES: ProcessingStatus[] = ['completed', 'failed']
