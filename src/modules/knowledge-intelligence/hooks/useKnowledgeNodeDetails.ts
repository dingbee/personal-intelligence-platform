import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { KnowledgeNode } from '@/shared/types/database'
import { useKnowledgeNodes, useKnowledgeEdges } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { listKnowledgeNodeSourcesForNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import type { SourceReferenceItem } from '@/shared/components/knowledge/SourceReference'

export interface KnowledgeConnection {
  nodeId: string
  title: string
  relationshipType: string
  confidence: number | null
}

export interface KnowledgeNodeDetail {
  node: KnowledgeNode
  sources: SourceReferenceItem[]
  connections: KnowledgeConnection[]
}

/**
 * Composes existing queries (nodes, edges, documents, node sources) into
 * display-ready view models — reused by the Dashboard insights panel and
 * the Knowledge Explorer so neither duplicates this join. Mirrors the
 * Phase 6C useKnowledgeGraph pattern: compose existing list functions
 * client-side rather than adding a joined query.
 *
 * Phase 9C: `sources` now comes from knowledge_node_sources rather than a
 * node's own source_id, so a node merged across documents (9A/9B) shows
 * every document it came from, not just the one it was first extracted from.
 */
export function useKnowledgeNodeDetails(documentId?: string) {
  const nodesQuery = useKnowledgeNodes(documentId)
  const edgesQuery = useKnowledgeEdges()
  const documentsQuery = useDocuments({})
  const nodeIds = useMemo(() => (nodesQuery.data ?? []).map((node) => node.id), [nodesQuery.data])
  const sourcesQuery = useQuery({
    queryKey: ['knowledge-node-sources', nodeIds],
    queryFn: () => listKnowledgeNodeSourcesForNodes(nodeIds),
    enabled: nodeIds.length > 0,
  })

  const isLoading = nodesQuery.isLoading || edgesQuery.isLoading || documentsQuery.isLoading || sourcesQuery.isLoading
  const isError = nodesQuery.isError || edgesQuery.isError || documentsQuery.isError || sourcesQuery.isError

  const details = useMemo<KnowledgeNodeDetail[]>(() => {
    const nodes = nodesQuery.data ?? []
    const edges = edgesQuery.data ?? []
    const documents = documentsQuery.data ?? []
    const nodeSources = sourcesQuery.data ?? []
    if (nodes.length === 0) return []

    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    const documentTitleById = new Map(documents.map((doc) => [doc.id, doc.title]))
    const sourcesByNodeId = new Map<string, SourceReferenceItem[]>()
    for (const source of nodeSources) {
      if (source.sourceType !== 'document') continue
      const label = documentTitleById.get(source.sourceId)
      if (!label) continue
      const list = sourcesByNodeId.get(source.nodeId) ?? []
      list.push({ type: 'document', id: source.sourceId, label })
      sourcesByNodeId.set(source.nodeId, list)
    }

    return nodes.map((node) => {
      const connections: KnowledgeConnection[] = edges
        .filter((edge) => Boolean(edge.generated_by) && (edge.source_id === node.id || edge.target_id === node.id))
        .flatMap((edge) => {
          const otherId = edge.source_id === node.id ? edge.target_id : edge.source_id
          const other = nodesById.get(otherId)
          if (!other) return []
          return [
            {
              nodeId: other.id,
              title: other.title,
              relationshipType: edge.relationship_type ?? 'related_to',
              confidence: edge.confidence,
            },
          ]
        })

      return {
        node,
        sources: sourcesByNodeId.get(node.id) ?? [],
        connections,
      }
    })
  }, [nodesQuery.data, edgesQuery.data, documentsQuery.data, sourcesQuery.data])

  return { details, isLoading, isError }
}
