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

/**
 * Phase 9C: a node's own source_id is only where it was *first* extracted —
 * since Phase 9A/9B it may since have been reused (merged) into other
 * documents too, recorded in knowledge_node_sources. Filtering directly on
 * knowledge_nodes.source_id would miss those merges, so documentId now
 * resolves through knowledge_node_sources instead.
 */
export async function listKnowledgeNodes(filters: KnowledgeNodeFilters = {}): Promise<KnowledgeNode[]> {
  let nodeIds: string[] | null = null
  if (filters.documentId) {
    const { data: sources, error: sourcesError } = await supabase
      .from('knowledge_node_sources')
      .select('node_id')
      .eq('source_type', 'document')
      .eq('source_id', filters.documentId)
    if (sourcesError) throw sourcesError
    nodeIds = sources.map((row) => row.node_id)
    if (nodeIds.length === 0) return []
  }

  let query = supabase.from('knowledge_nodes').select('*').order('created_at', { ascending: false })
  if (nodeIds) query = query.in('id', nodeIds)
  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  if (filters.nodeType) query = query.eq('node_type', filters.nodeType)
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw error
  return data
}

export interface KnowledgeNodeTitle {
  id: string
  title: string
  titleNormalized: string
}

/**
 * Phase 2B — a lightweight vocabulary for the deterministic concept
 * matcher (matchKnownConcepts): just enough to detect mentions, not the
 * full row. Deliberately global (user_id only, no workspace filter) —
 * node identity itself is shared across workspaces (resolveCanonicalNode
 * dedups the same way), so a note in Workspace B should still be able to
 * match a concept first extracted in Workspace A.
 */
export async function listKnowledgeNodeTitlesForUser(userId: string): Promise<KnowledgeNodeTitle[]> {
  const { data, error } = await supabase.from('knowledge_nodes').select('id, title, title_normalized').eq('user_id', userId)
  if (error) throw error
  return data.map((row) => ({ id: row.id, title: row.title, titleNormalized: row.title_normalized }))
}

export interface KnowledgeNodeSourceRef {
  nodeId: string
  sourceType: string
  sourceId: string
  createdAt: string
}

/**
 * Phase 9C: the reverse direction of the same gap — given a set of
 * (possibly merged) nodes, look up every document each one came from, not
 * just its original source_id. Used to show all source documents on a
 * knowledge card. `createdAt` is included (Platform Integration Sprint) so
 * useKnowledgeNodeDetails can compute each node's Knowledge Confidence
 * from this same batched query instead of a per-node fetch.
 */
export async function listKnowledgeNodeSourcesForNodes(nodeIds: string[]): Promise<KnowledgeNodeSourceRef[]> {
  if (nodeIds.length === 0) return []
  const { data, error } = await supabase
    .from('knowledge_node_sources')
    .select('node_id, source_type, source_id, created_at')
    .in('node_id', nodeIds)
  if (error) throw error
  return data.map((row) => ({ nodeId: row.node_id, sourceType: row.source_type, sourceId: row.source_id, createdAt: row.created_at }))
}
