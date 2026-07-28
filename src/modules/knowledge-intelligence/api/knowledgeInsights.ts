import { supabase } from '@/shared/lib/supabase'

export interface KnowledgeInsights {
  conceptCount: number
  entityCount: number
  edgeCount: number
  documentsWithKnowledge: number
}

/** Cheap aggregate counts for a future "knowledge intelligence" summary — no per-node detail, just enough to answer "is there anything here yet." */
export async function getKnowledgeInsights(workspaceId: string | null): Promise<KnowledgeInsights> {
  let nodesQuery = supabase.from('knowledge_nodes').select('node_type, source_id')
  if (workspaceId) nodesQuery = nodesQuery.eq('workspace_id', workspaceId)
  const { data: nodes, error: nodesError } = await nodesQuery
  if (nodesError) throw nodesError

  let edgesQuery = supabase
    .from('knowledge_links')
    .select('id', { count: 'exact', head: true })
    .not('generated_by', 'is', null)
  if (workspaceId) edgesQuery = edgesQuery.eq('workspace_id', workspaceId)
  const { count: edgeCount, error: edgesError } = await edgesQuery
  if (edgesError) throw edgesError

  return {
    conceptCount: nodes.filter((node) => node.node_type === 'concept').length,
    entityCount: nodes.filter((node) => node.node_type === 'entity').length,
    edgeCount: edgeCount ?? 0,
    documentsWithKnowledge: new Set(nodes.map((node) => node.source_id)).size,
  }
}
