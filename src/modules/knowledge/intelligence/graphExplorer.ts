import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import type { KnowledgeNodeSourceRef } from '@/modules/knowledge/intelligence/relationshipStrength'
import type { DocumentRef } from '@/modules/knowledge/intelligence/graphInsights'

export interface ConnectionExplanation {
  nodeAId: string
  nodeBTitle: string
  nodeATitle: string
  nodeBId: string
  connected: boolean
  directRelationship: { relationshipType: string; confidence: number | null } | null
  sharedDocuments: { id: string; title: string }[]
  explanation: string
}

function findDirectEdge(nodeAId: string, nodeBId: string, edges: KnowledgeLink[]): KnowledgeLink | null {
  return (
    edges.find(
      (edge) =>
        Boolean(edge.generated_by) &&
        ((edge.source_id === nodeAId && edge.target_id === nodeBId) ||
          (edge.source_id === nodeBId && edge.target_id === nodeAId)),
    ) ?? null
  )
}

function findSharedDocuments(
  nodeAId: string,
  nodeBId: string,
  nodeSources: KnowledgeNodeSourceRef[],
  documents: DocumentRef[],
): { id: string; title: string }[] {
  const aDocIds = new Set(
    nodeSources.filter((s) => s.nodeId === nodeAId && s.sourceType === 'document').map((s) => s.sourceId),
  )
  const bDocIds = nodeSources.filter((s) => s.nodeId === nodeBId && s.sourceType === 'document').map((s) => s.sourceId)
  const documentsById = new Map(documents.map((d) => [d.id, d.title]))
  return [...new Set(bDocIds.filter((id) => aDocIds.has(id)))]
    .map((id) => ({ id, title: documentsById.get(id) }))
    .filter((d): d is { id: string; title: string } => Boolean(d.title))
}

/**
 * UX-10 Phase 4 — "Why are these connected?" answered purely from graph
 * topology and shared provenance, never the LLM. Of the brief's five listed
 * bases (shared edges, shared documents, shared conversations, shared
 * memories, shared notes), only the first two have real backing data today:
 * knowledge_node_sources only ever records source_type 'document' (see the
 * extraction/reconciliation pipeline audit) — nothing links a knowledge
 * node to a conversation, memory, or note, so those three are not
 * fabricated here. See the phase report's Deferred items for the concrete
 * schema gap.
 */
export function explainConnection(
  nodeA: KnowledgeNode,
  nodeB: KnowledgeNode,
  edges: KnowledgeLink[],
  nodeSources: KnowledgeNodeSourceRef[],
  documents: DocumentRef[],
): ConnectionExplanation {
  const directEdge = findDirectEdge(nodeA.id, nodeB.id, edges)
  const sharedDocuments = findSharedDocuments(nodeA.id, nodeB.id, nodeSources, documents)
  const connected = Boolean(directEdge) || sharedDocuments.length > 0

  const sentences: string[] = []
  if (directEdge) {
    sentences.push(
      `"${nodeA.title}" and "${nodeB.title}" are directly related (${(directEdge.relationship_type ?? 'related_to').replace(/_/g, ' ')})${
        directEdge.confidence !== null ? ` with ${Math.round(directEdge.confidence * 100)}% confidence` : ''
      }.`,
    )
  }
  if (sharedDocuments.length > 0) {
    sentences.push(
      `They both appear in ${sharedDocuments.length} shared document${sharedDocuments.length === 1 ? '' : 's'}: ${sharedDocuments
        .map((d) => d.title)
        .join(', ')}.`,
    )
  }
  if (sentences.length === 0) {
    sentences.push(`No known connection between "${nodeA.title}" and "${nodeB.title}" yet.`)
  }

  return {
    nodeAId: nodeA.id,
    nodeATitle: nodeA.title,
    nodeBId: nodeB.id,
    nodeBTitle: nodeB.title,
    connected,
    directRelationship: directEdge
      ? { relationshipType: directEdge.relationship_type ?? 'related_to', confidence: directEdge.confidence }
      : null,
    sharedDocuments,
    explanation: sentences.join(' '),
  }
}
