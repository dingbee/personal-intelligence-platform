import { supabase } from '@/shared/lib/supabase'

/**
 * #21 Phase 5 — the one client-callable producer into system_health_events.
 * Calls the narrow report_document_processing_failure RPC
 * (0081_system_health_events.sql), which re-verifies server-side that
 * p_documentId actually belongs to the caller before writing anything — it
 * cannot report an arbitrary category, severity, or user. Best-effort by
 * design: callers should treat a rejection here as non-fatal, since the
 * real failure state already lives on documents.status/
 * processing_jobs.error_message regardless of whether this succeeds.
 */
export async function reportDocumentProcessingFailure(documentId: string, errorMessage: string): Promise<void> {
  const { error } = await supabase.rpc('report_document_processing_failure', {
    p_document_id: documentId,
    p_error_message: errorMessage,
  })
  if (error) throw error
}
