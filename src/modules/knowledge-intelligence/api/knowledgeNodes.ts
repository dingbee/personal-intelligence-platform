import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeNode, KnowledgeNodeType } from '@/shared/types/database'
import { resolveCanonicalNode } from '@/modules/knowledge-intelligence/api/knowledgeNodeResolution'

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
 * Phase 9A: routes each node through resolveCanonicalNode instead of a raw
 * upsert — the same document re-extracting still refreshes its node's
 * content exactly as before, but a concept/entity that already exists
 * under a *different* document is now reused (with its provenance
 * recorded in knowledge_node_sources) instead of creating a disconnected
 * duplicate. Callers are unaffected: same function name, same input/output
 * shape, still never deletes anything.
 */
export async function upsertKnowledgeNodes(nodes: UpsertKnowledgeNodeInput[]): Promise<KnowledgeNode[]> {
  if (nodes.length === 0) return []
  const resolved = await Promise.all(
    nodes.map((node) =>
      resolveCanonicalNode({
        userId: node.userId,
        workspaceId: node.workspaceId,
        nodeType: node.nodeType,
        title: node.title,
        description: node.description,
        sourceType: node.sourceType,
        sourceId: node.sourceId,
        sourceChunkIds: node.sourceChunkIds,
        generationMetadata: node.generationMetadata,
        metadata: node.metadata,
      }),
    ),
  )
  return resolved.map((result) => result.node)
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
