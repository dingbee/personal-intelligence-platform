import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { KnowledgeNode } from '@/shared/types/database'
import { useKnowledgeNodes, useKnowledgeEdges } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { listKnowledgeNodeSourcesForNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { computeKnowledgeConfidence } from '@/modules/knowledge-intelligence/confidence/knowledgeConfidence'
import type { SourceReferenceItem } from '@/shared/components/knowledge/SourceReference'
import { resolveSourceItems } from '@/modules/knowledge-intelligence/api/sourceResolution'

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
  /** Platform Integration Sprint — previously only computed for the node drill-down page and the Concept Card in Search, leaving the Explorer/Dashboard cards silently missing it. Same computeKnowledgeConfidence formula, fed from this hook's own batched queries. */
  confidence: number
}

/**
 * Composes existing queries (nodes, edges, documents, notes, conversations,
 * node sources) into display-ready view models — reused by the Dashboard
 * insights panel and the Knowledge Explorer so neither duplicates this
 * join. Mirrors the Phase 6C useKnowledgeGraph pattern: compose existing
 * list functions client-side rather than adding a joined query.
 *
 * Phase 9C: `sources` comes from knowledge_node_sources rather than a
 * node's own source_id, so a node merged across documents (9A/9B) shows
 * every document it came from, not just the one it was first extracted from.
 *
 * Platform Integration Sprint: `sources` previously silently dropped every
 * note/conversation source (filtered to `sourceType === 'document'` only),
 * a leftover from before the Phase 2B deterministic matcher started
 * recording those. A concept with note/conversation evidence but no
 * document evidence looked source-less here while showing correctly on
 * its Concept Card and drill-down page — same underlying data
 * (knowledge_node_sources), inconsistent display. Fixed by resolving
 * titles for all three source types, the same set getKnowledgeNodeEvidence
 * already handles.
 */
export function useKnowledgeNodeDetails(documentId?: string) {
  const nodesQuery = useKnowledgeNodes(documentId)
  const edgesQuery = useKnowledgeEdges()
  const documentsQuery = useDocuments({})
  const notesQuery = useNotes()
  const conversationsQuery = useConversations()
  const nodeIds = useMemo(() => (nodesQuery.data ?? []).map((node) => node.id), [nodesQuery.data])
  const sourcesQuery = useQuery({
    queryKey: ['knowledge-node-sources', nodeIds],
    queryFn: () => listKnowledgeNodeSourcesForNodes(nodeIds),
    enabled: nodeIds.length > 0,
  })

  const isLoading =
    nodesQuery.isLoading ||
    edgesQuery.isLoading ||
    documentsQuery.isLoading ||
    notesQuery.isLoading ||
    conversationsQuery.isLoading ||
    sourcesQuery.isLoading
  const isError =
    nodesQuery.isError || edgesQuery.isError || documentsQuery.isError || notesQuery.isError || conversationsQuery.isError || sourcesQuery.isError

  const details = useMemo<KnowledgeNodeDetail[]>(() => {
    const nodes = nodesQuery.data ?? []
    const edges = edgesQuery.data ?? []
    const documents = documentsQuery.data ?? []
    const notes = notesQuery.data ?? []
    const conversations = conversationsQuery.data ?? []
    const nodeSources = sourcesQuery.data ?? []
    if (nodes.length === 0) return []

    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    const titleByTypeAndId = new Map<string, string>()
    for (const doc of documents) titleByTypeAndId.set(`document:${doc.id}`, doc.title)
    for (const note of notes) titleByTypeAndId.set(`note:${note.id}`, note.title)
    for (const conversation of conversations) titleByTypeAndId.set(`conversation:${conversation.id}`, conversation.title)

    // Confidence bookkeeping counts every source regardless of whether its
    // title can still be resolved — unchanged from before this sprint's
    // resolveSourceItems extraction, kept as its own pass since it isn't
    // the duplicated "resolve a label" logic that helper unifies.
    const sourcesByNodeIdForConfidence = new Map<string, { sourceCounts: Record<string, number>; mostRecentEvidenceAt: string | null }>()
    for (const source of nodeSources) {
      const confidenceEntry = sourcesByNodeIdForConfidence.get(source.nodeId) ?? { sourceCounts: {}, mostRecentEvidenceAt: null }
      confidenceEntry.sourceCounts[source.sourceType] = (confidenceEntry.sourceCounts[source.sourceType] ?? 0) + 1
      if (!confidenceEntry.mostRecentEvidenceAt || source.createdAt > confidenceEntry.mostRecentEvidenceAt) {
        confidenceEntry.mostRecentEvidenceAt = source.createdAt
      }
      sourcesByNodeIdForConfidence.set(source.nodeId, confidenceEntry)
    }

    const resolvedSources = resolveSourceItems(
      nodeSources.map((source) => ({ type: source.sourceType, id: source.sourceId, nodeId: source.nodeId })),
      (type, id) => titleByTypeAndId.get(`${type}:${id}`),
    )
    const sourcesByNodeId = new Map<string, SourceReferenceItem[]>()
    for (const resolved of resolvedSources) {
      const list = sourcesByNodeId.get(resolved.nodeId) ?? []
      list.push({ type: resolved.type, id: resolved.id, label: resolved.label })
      sourcesByNodeId.set(resolved.nodeId, list)
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

      const confidenceInputs = sourcesByNodeIdForConfidence.get(node.id) ?? { sourceCounts: {}, mostRecentEvidenceAt: null }
      const confidence = computeKnowledgeConfidence({
        sourceCounts: confidenceInputs.sourceCounts,
        mostRecentEvidenceAt: confidenceInputs.mostRecentEvidenceAt,
        relatedConceptCount: connections.length,
      })

      return {
        node,
        sources: sourcesByNodeId.get(node.id) ?? [],
        connections,
        confidence,
      }
    })
  }, [nodesQuery.data, edgesQuery.data, documentsQuery.data, notesQuery.data, conversationsQuery.data, sourcesQuery.data])

  return { details, isLoading, isError }
}
