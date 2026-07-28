import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { listDocuments } from '@/modules/library/api/documents'
import { listNotes } from '@/modules/notes/api/notes'
import { listRecentHighlights } from '@/modules/knowledge/api/dashboard'
import { listTags } from '@/modules/library/api/tags'
import { listKnowledgeLinks } from '@/modules/knowledge-graph/api/graph'
import type { GraphEdge, GraphNode, GraphNodeType, KnowledgeGraphData } from '@/modules/knowledge-graph/api/types'

const NODE_LIMIT = 100

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function deriveRelationshipLabel(sourceType: GraphNodeType, targetType: GraphNodeType): string {
  const pair = [sourceType, targetType].sort().join('-')
  if (pair === 'highlight-note') return 'derived_from'
  if (pair === 'document-note') return 'attached_to'
  return 'related_to'
}

export function useKnowledgeGraph() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()

  return useQuery({
    queryKey: ['knowledge-graph', currentWorkspaceId],
    queryFn: async (): Promise<KnowledgeGraphData> => {
      const [documents, notes, highlights, tags, links] = await Promise.all([
        listDocuments({ workspaceId: currentWorkspaceId }),
        listNotes({ workspaceId: currentWorkspaceId, limit: NODE_LIMIT }),
        listRecentHighlights(currentWorkspaceId, NODE_LIMIT),
        listTags(),
        listKnowledgeLinks(currentWorkspaceId, NODE_LIMIT * 2),
      ])

      const nodes: GraphNode[] = [
        ...documents.map((doc) => ({ id: doc.id, type: 'document' as const, label: doc.title })),
        ...notes.map((note) => ({ id: note.id, type: 'note' as const, label: note.title || 'Untitled note' })),
        ...highlights.map((highlight) => ({
          id: highlight.id,
          type: 'highlight' as const,
          label: truncate(highlight.quote),
          documentId: highlight.document_id,
        })),
        ...tags.map((tag) => ({ id: tag.id, type: 'tag' as const, label: tag.name })),
      ]

      const nodesById = new Map(nodes.map((node) => [node.id, node]))

      const edges: GraphEdge[] = links
        .filter((link) => nodesById.has(link.source_id) && nodesById.has(link.target_id))
        .map((link) => {
          const source = nodesById.get(link.source_id)!
          const target = nodesById.get(link.target_id)!
          return {
            id: link.id,
            sourceId: link.source_id,
            targetId: link.target_id,
            relationshipLabel: deriveRelationshipLabel(source.type, target.type),
          }
        })

      return { nodes, edges }
    },
    enabled: Boolean(user),
  })
}
