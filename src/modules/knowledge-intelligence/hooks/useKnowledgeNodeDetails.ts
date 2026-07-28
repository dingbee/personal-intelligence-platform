import { useMemo } from 'react'
import type { KnowledgeNode } from '@/shared/types/database'
import { useKnowledgeNodes, useKnowledgeEdges } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { useDocuments } from '@/modules/library/hooks/useDocuments'

export interface KnowledgeConnection {
  nodeId: string
  title: string
  relationshipType: string
  confidence: number | null
}

export interface KnowledgeNodeDetail {
  node: KnowledgeNode
  documentId: string | null
  documentTitle: string | null
  connections: KnowledgeConnection[]
}

/**
 * Composes three existing queries (nodes, edges, documents) into
 * display-ready view models — reused by the Dashboard insights panel and
 * the Knowledge Explorer so neither duplicates this join. Mirrors the
 * Phase 6C useKnowledgeGraph pattern: compose existing list functions
 * client-side rather than adding a joined query.
 */
export function useKnowledgeNodeDetails(documentId?: string) {
  const nodesQuery = useKnowledgeNodes(documentId)
  const edgesQuery = useKnowledgeEdges()
  const documentsQuery = useDocuments({})

  const isLoading = nodesQuery.isLoading || edgesQuery.isLoading || documentsQuery.isLoading
  const isError = nodesQuery.isError || edgesQuery.isError || documentsQuery.isError

  const details = useMemo<KnowledgeNodeDetail[]>(() => {
    const nodes = nodesQuery.data ?? []
    const edges = edgesQuery.data ?? []
    const documents = documentsQuery.data ?? []
    if (nodes.length === 0) return []

    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    const documentTitleById = new Map(documents.map((doc) => [doc.id, doc.title]))

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
        documentId: node.source_type === 'document' ? node.source_id : null,
        documentTitle: node.source_type === 'document' ? (documentTitleById.get(node.source_id) ?? null) : null,
        connections,
      }
    })
  }, [nodesQuery.data, edgesQuery.data, documentsQuery.data])

  return { details, isLoading, isError }
}
