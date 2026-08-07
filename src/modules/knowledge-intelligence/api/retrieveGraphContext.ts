import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeNodeType } from '@/shared/types/database'

const MAX_NODES = 10
const MAX_RELATIONSHIPS = 10

export interface GraphContextNode {
  id: string
  title: string
  node_type: KnowledgeNodeType
}

export interface GraphContextLink {
  source_id: string
  target_id: string
  relationship_type: string | null
}

/**
 * Formats already-fetched nodes/links/source titles into the compact block
 * appended to the system prompt — pure, no I/O, so it's unit-testable
 * without a Supabase mock (same split as buildEdgeInputsFromRelationships/
 * decideResolutionAction elsewhere in this module).
 */
export function buildGraphContextText(nodes: GraphContextNode[], links: GraphContextLink[], sourceTitles: string[]): string | null {
  if (nodes.length === 0) return null

  const titleById = new Map(nodes.map((node) => [node.id, node.title]))
  const lines: string[] = ['Knowledge connections:', '']

  for (const node of nodes) {
    const related = links
      .filter((link) => link.source_id === node.id || link.target_id === node.id)
      .map((link) => titleById.get(link.source_id === node.id ? link.target_id : link.source_id))
      .filter((title): title is string => Boolean(title))

    lines.push(`${node.node_type === 'concept' ? 'Concept' : 'Entity'}: ${node.title}`)
    if (related.length > 0) {
      lines.push('Related to:')
      for (const title of related) lines.push(`- ${title}`)
    }
    lines.push('')
  }

  const uniqueSources = [...new Set(sourceTitles)]
  if (uniqueSources.length > 0) {
    lines.push('Sources:')
    for (const title of uniqueSources) lines.push(`- ${title}`)
  }

  return lines.join('\n').trim()
}

export interface RetrieveGraphContextParams {
  documentIds: string[]
  /**
   * PIP Stabilization v1 (P0, root cause B) — the asset-sourced counterpart
   * of documentIds. Kept as a separate, optional field rather than folding
   * assets into documentIds: the two ids live in different tables
   * (documents vs. assets), and this preserves every existing caller's
   * behavior exactly (an omitted assetIds is a no-op, not a behavior
   * change) while extending the same polymorphic source_type convention
   * knowledge_node_sources/knowledge_links already use everywhere else.
   */
  assetIds?: string[]
  userId: string
  workspaceId: string | null
}

/**
 * Phase 9D: given the documents a vector search already retrieved chunks
 * from, looks up the AI-extracted concepts/entities and relationships
 * among them (knowledge_node_sources -> knowledge_nodes -> knowledge_links,
 * all built in Phase 7A-9C) and formats them for the system prompt. Never
 * changes which chunks were retrieved — additive context only, bounded to
 * MAX_NODES/MAX_RELATIONSHIPS so it can't grow into a large graph
 * neighborhood. `userId`/`workspaceId` aren't used in the queries (RLS
 * already scopes every table here to auth.uid()) but are kept in the
 * signature to match the rest of this module's call shape and leave room
 * for an explicit workspace filter later without changing callers again.
 *
 * Swallows every error and returns null — a failure here (empty graph
 * tables, a query error, anything) must never break chat.
 */
export async function retrieveGraphContext(params: RetrieveGraphContextParams): Promise<string | null> {
  try {
    const { documentIds, assetIds = [] } = params
    if (documentIds.length === 0 && assetIds.length === 0) return null

    const sourceQueries = []
    if (documentIds.length > 0) {
      sourceQueries.push(supabase.from('knowledge_node_sources').select('node_id').eq('source_type', 'document').in('source_id', documentIds))
    }
    if (assetIds.length > 0) {
      sourceQueries.push(supabase.from('knowledge_node_sources').select('node_id').eq('source_type', 'asset').in('source_id', assetIds))
    }
    const sourceResults = await Promise.all(sourceQueries)
    for (const result of sourceResults) if (result.error) throw result.error

    const nodeIds = [...new Set(sourceResults.flatMap((result) => result.data!.map((row) => row.node_id)))]
    if (nodeIds.length === 0) return null

    const { data: nodes, error: nodesError } = await supabase
      .from('knowledge_nodes')
      .select('id, title, node_type')
      .in('id', nodeIds)
      .order('created_at', { ascending: false })
      .limit(MAX_NODES)
    if (nodesError) throw nodesError
    if (nodes.length === 0) return null

    const boundedNodeIds = nodes.map((node) => node.id)
    const { data: links, error: linksError } = await supabase
      .from('knowledge_links')
      .select('source_id, target_id, relationship_type')
      .eq('source_type', 'knowledge_node')
      .eq('target_type', 'knowledge_node')
      .in('source_id', boundedNodeIds)
      .in('target_id', boundedNodeIds)
      .limit(MAX_RELATIONSHIPS)
    if (linksError) throw linksError

    const [documentsResult, assetsResult] = await Promise.all([
      documentIds.length > 0 ? supabase.from('documents').select('id, title').in('id', documentIds) : Promise.resolve({ data: [], error: null }),
      assetIds.length > 0 ? supabase.from('assets').select('id, title').in('id', assetIds) : Promise.resolve({ data: [], error: null }),
    ])
    if (documentsResult.error) throw documentsResult.error
    if (assetsResult.error) throw assetsResult.error

    const sourceTitles = [...documentsResult.data!.map((doc) => doc.title), ...assetsResult.data!.map((asset) => asset.title)]

    return buildGraphContextText(nodes, links ?? [], sourceTitles)
  } catch {
    return null
  }
}
