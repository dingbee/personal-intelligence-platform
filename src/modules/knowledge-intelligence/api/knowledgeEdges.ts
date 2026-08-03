import { supabase } from '@/shared/lib/supabase'

export interface UpsertKnowledgeEdgeInput {
  userId: string
  workspaceId: string | null
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  relationshipType: string
  confidence: number | null
  generatedBy: string
  /** UX-14.5.10.4 — optional; omitted by every pre-existing caller (extraction/reconciliation), which leaves this column at its default. Knowledge Link Exchange's importer is the first caller that sets it, to record `importedFrom` provenance the same way Notes'/Knowledge Nodes' `generation_metadata.importedFrom` already does. */
  metadata?: Record<string, unknown> | null
}

/**
 * Writes into the same knowledge_links table Phase 6C reads
 * (listKnowledgeLinks) — see the Phase 7A migration for why this extends
 * that table instead of adding a separate edges table.
 *
 * `metadata` is only included in the upserted row when a caller actually
 * provides it: Supabase's `.upsert()` updates every column present in
 * the payload on conflict, so unconditionally sending `metadata: null`
 * would silently clobber an existing row's metadata (e.g. an imported
 * link's `importedFrom` provenance) the next time extraction/
 * reconciliation re-upserts that same edge. Omitting the key entirely
 * for callers that don't pass it (every pre-existing caller) leaves an
 * existing row's `metadata` untouched on conflict — the same "don't
 * clobber what you didn't mean to touch" behavior those callers already
 * had before this field existed.
 */
export async function upsertKnowledgeEdges(edges: UpsertKnowledgeEdgeInput[]): Promise<void> {
  if (edges.length === 0) return
  const { error } = await supabase.from('knowledge_links').upsert(
    edges.map((edge) => ({
      user_id: edge.userId,
      workspace_id: edge.workspaceId,
      source_type: edge.sourceType,
      source_id: edge.sourceId,
      target_type: edge.targetType,
      target_id: edge.targetId,
      relationship_type: edge.relationshipType,
      confidence: edge.confidence,
      generated_by: edge.generatedBy,
      ...(edge.metadata !== undefined ? { metadata: edge.metadata } : {}),
    })),
    { onConflict: 'source_type,source_id,target_type,target_id' },
  )
  if (error) throw error
}
