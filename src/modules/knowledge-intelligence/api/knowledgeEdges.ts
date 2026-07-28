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
}

/** Writes into the same knowledge_links table Phase 6C reads (listKnowledgeLinks) — see the Phase 7A migration for why this extends that table instead of adding a separate edges table. */
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
    })),
    { onConflict: 'source_type,source_id,target_type,target_id' },
  )
  if (error) throw error
}
