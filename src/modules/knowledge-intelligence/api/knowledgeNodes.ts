import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeNode, KnowledgeNodeType } from '@/shared/types/database'

export interface UpsertKnowledgeNodeInput {
  userId: string
  workspaceId: string | null
  nodeType: KnowledgeNodeType
  title: string
  description: string | null
  sourceType: string
  sourceId: string
  sourceChunkIds: string[]
  generationMetadata: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}

/**
 * Upsert rather than plain insert: re-running extraction on a document
 * should refresh an already-found concept/entity's description, not fail
 * on the (user_id, source_id, node_type, title) unique constraint or pile
 * up duplicates. Nothing is ever deleted here.
 */
export async function upsertKnowledgeNodes(nodes: UpsertKnowledgeNodeInput[]): Promise<KnowledgeNode[]> {
  if (nodes.length === 0) return []
  const { data, error } = await supabase
    .from('knowledge_nodes')
    .upsert(
      nodes.map((node) => ({
        user_id: node.userId,
        workspace_id: node.workspaceId,
        node_type: node.nodeType,
        title: node.title,
        description: node.description,
        source_type: node.sourceType,
        source_id: node.sourceId,
        source_chunk_ids: node.sourceChunkIds,
        generation_metadata: node.generationMetadata,
        metadata: node.metadata ?? null,
      })),
      { onConflict: 'user_id,source_id,node_type,title' },
    )
    .select()
  if (error) throw error
  return data
}

export interface KnowledgeNodeFilters {
  documentId?: string
  workspaceId?: string | null
  nodeType?: KnowledgeNodeType
  limit?: number
}

export async function listKnowledgeNodes(filters: KnowledgeNodeFilters = {}): Promise<KnowledgeNode[]> {
  let query = supabase.from('knowledge_nodes').select('*').order('created_at', { ascending: false })
  if (filters.documentId) query = query.eq('source_id', filters.documentId)
  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  if (filters.nodeType) query = query.eq('node_type', filters.nodeType)
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw error
  return data
}
