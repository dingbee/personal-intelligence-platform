import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

/**
 * The one place this package type does real I/O before building its
 * (otherwise pure/synchronous) package — mirrors `assetFileTransfer.ts`/
 * `documentPackageArchive.ts`'s own role for their package types.
 *
 * `KnowledgeNodeDetailPage` already has the *current* node fully loaded
 * (`evidence.node`), but its `relatedNodes` list (from
 * `getKnowledgeNodeEvidence`) only carries the other node's `id`/`title`
 * — not its `node_type`/`description`, and not the underlying
 * `knowledge_links` row itself (`relationship_type`/`confidence`/
 * `generated_by`, and critically which side is `source` vs `target` —
 * direction is semantic, e.g. "causes" reads differently reversed). This
 * fetches exactly those three missing pieces, given the current node
 * (already in hand) and the id of the related node the user clicked
 * "Export" next to.
 */
export async function fetchKnowledgeLinkForExport(params: {
  currentNode: KnowledgeNode
  relatedNodeId: string
}): Promise<{ link: KnowledgeLink; sourceNode: KnowledgeNode; targetNode: KnowledgeNode }> {
  const { currentNode, relatedNodeId } = params

  const [outgoing, incoming, relatedNodeResult] = await Promise.all([
    supabase
      .from('knowledge_links')
      .select('*')
      .eq('source_type', 'knowledge_node')
      .eq('source_id', currentNode.id)
      .eq('target_type', 'knowledge_node')
      .eq('target_id', relatedNodeId)
      .maybeSingle(),
    supabase
      .from('knowledge_links')
      .select('*')
      .eq('source_type', 'knowledge_node')
      .eq('source_id', relatedNodeId)
      .eq('target_type', 'knowledge_node')
      .eq('target_id', currentNode.id)
      .maybeSingle(),
    supabase.from('knowledge_nodes').select('*').eq('id', relatedNodeId).single(),
  ])
  if (outgoing.error) throw outgoing.error
  if (incoming.error) throw incoming.error
  if (relatedNodeResult.error) throw relatedNodeResult.error

  const link = outgoing.data ?? incoming.data
  if (!link) throw new Error('This relationship no longer exists.')

  const relatedNode = relatedNodeResult.data
  const isCurrentNodeTheSource = link.source_id === currentNode.id

  return {
    link,
    sourceNode: isCurrentNodeTheSource ? currentNode : relatedNode,
    targetNode: isCurrentNodeTheSource ? relatedNode : currentNode,
  }
}
