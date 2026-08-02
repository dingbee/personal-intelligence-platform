import { supabase } from '@/shared/lib/supabase'
import type { KnowledgeNode } from '@/shared/types/database'
import type { SourceReferenceItem } from '@/shared/components/knowledge/SourceReference'
import { computeKnowledgeConfidence } from '@/modules/knowledge-intelligence/confidence/knowledgeConfidence'
import { fetchTitlesByIds, resolveSourceItems } from '@/modules/knowledge-intelligence/api/sourceResolution'

export interface EvidenceItem extends SourceReferenceItem {
  createdAt: string
}

export interface RelatedConceptRef {
  nodeId: string
  title: string
  relationshipType: string
  confidence: number | null
}

export interface KnowledgeNodeEvidence {
  node: KnowledgeNode
  /** Counts only what's actually resolvable today — a source row whose document/note/conversation was since deleted (they're never cascade-removed, see knowledge_node_sources) doesn't inflate the count. */
  countsBySourceType: Record<string, number>
  evidence: EvidenceItem[]
  relatedNodes: RelatedConceptRef[]
  /** UX-13 roadmap Phase 2 — 0-1, see computeKnowledgeConfidence. Deterministic, computed from the same evidence/relatedNodes already fetched here — no extra query. */
  confidence: number
}

/**
 * UX-13.11 Phase 2B — a node's "why do you exist" answer: every source
 * that's ever referenced it (grouped by source type, with counts), plus
 * every other node it's connected to via knowledge_links. This is the one
 * genuinely new read query the audit found missing — everything it reads
 * from (knowledge_node_sources, knowledge_links) already existed.
 */
export async function getKnowledgeNodeEvidence(nodeId: string): Promise<KnowledgeNodeEvidence> {
  const [nodeResult, sourcesResult, outgoingLinksResult, incomingLinksResult] = await Promise.all([
    supabase.from('knowledge_nodes').select('*').eq('id', nodeId).single(),
    supabase.from('knowledge_node_sources').select('*').eq('node_id', nodeId),
    supabase.from('knowledge_links').select('*').eq('source_type', 'knowledge_node').eq('source_id', nodeId),
    supabase.from('knowledge_links').select('*').eq('target_type', 'knowledge_node').eq('target_id', nodeId),
  ])
  if (nodeResult.error) throw nodeResult.error
  if (sourcesResult.error) throw sourcesResult.error
  if (outgoingLinksResult.error) throw outgoingLinksResult.error
  if (incomingLinksResult.error) throw incomingLinksResult.error

  const sources = sourcesResult.data
  const documentIds = sources.filter((s) => s.source_type === 'document').map((s) => s.source_id)
  const noteIds = sources.filter((s) => s.source_type === 'note').map((s) => s.source_id)
  const conversationIds = sources.filter((s) => s.source_type === 'conversation').map((s) => s.source_id)

  const [documents, notes, conversations] = await Promise.all([
    fetchTitlesByIds('documents', documentIds),
    fetchTitlesByIds('notes', noteIds),
    fetchTitlesByIds('conversations', conversationIds),
  ])

  const titleById = new Map<string, string>()
  for (const row of [...documents, ...notes, ...conversations]) titleById.set(row.id, row.title)

  const evidence = resolveSourceItems(
    sources.map((source) => ({ type: source.source_type, id: source.source_id, createdAt: source.created_at })),
    (_type, id) => titleById.get(id),
  )
  evidence.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const countsBySourceType: Record<string, number> = {}
  for (const item of evidence) countsBySourceType[item.type] = (countsBySourceType[item.type] ?? 0) + 1

  const otherNodeIds = new Set<string>()
  for (const link of outgoingLinksResult.data) if (link.target_type === 'knowledge_node') otherNodeIds.add(link.target_id)
  for (const link of incomingLinksResult.data) if (link.source_type === 'knowledge_node') otherNodeIds.add(link.source_id)

  let relatedNodes: RelatedConceptRef[] = []
  if (otherNodeIds.size > 0) {
    const { data: otherNodes, error: otherNodesError } = await supabase
      .from('knowledge_nodes')
      .select('id, title')
      .in('id', Array.from(otherNodeIds))
    if (otherNodesError) throw otherNodesError
    const otherTitleById = new Map(otherNodes.map((n) => [n.id, n.title]))

    relatedNodes = [
      ...outgoingLinksResult.data
        .filter((link) => link.target_type === 'knowledge_node')
        .map((link) => ({
          nodeId: link.target_id,
          title: otherTitleById.get(link.target_id),
          relationshipType: link.relationship_type ?? 'related_to',
          confidence: link.confidence,
        })),
      ...incomingLinksResult.data
        .filter((link) => link.source_type === 'knowledge_node')
        .map((link) => ({
          nodeId: link.source_id,
          title: otherTitleById.get(link.source_id),
          relationshipType: link.relationship_type ?? 'related_to',
          confidence: link.confidence,
        })),
    ].filter((ref): ref is RelatedConceptRef => Boolean(ref.title))
  }

  const confidence = computeKnowledgeConfidence({
    sourceCounts: countsBySourceType,
    mostRecentEvidenceAt: evidence[0]?.createdAt ?? null,
    relatedConceptCount: relatedNodes.length,
  })

  return { node: nodeResult.data, countsBySourceType, evidence, relatedNodes, confidence }
}

/**
 * UX-14.4.4 — the reverse of `getKnowledgeNodeEvidence`'s node->sources
 * lookup: given a note, which knowledge nodes already cite it as evidence?
 * `linkKnownConceptsToSource` has written this relationship (via
 * `knowledge_node_sources`) for every saved note since Phase 2B — this is
 * the first function that reads it back in that direction. Reuses the
 * exact same table, no new query pattern; returns `SourceReferenceItem[]`
 * so callers can hand the result straight to the existing `SourceReference`
 * chip component, same as every other provenance surface already does.
 */
export async function getRelatedKnowledgeForNote(noteId: string): Promise<SourceReferenceItem[]> {
  const { data: sources, error } = await supabase
    .from('knowledge_node_sources')
    .select('node_id')
    .eq('source_type', 'note')
    .eq('source_id', noteId)
  if (error) throw error

  const nodeIds = Array.from(new Set(sources.map((s) => s.node_id)))
  if (nodeIds.length === 0) return []

  const nodes = await fetchTitlesByIds('knowledge_nodes', nodeIds)
  return nodes.map((node) => ({ type: 'knowledge_node', id: node.id, label: node.title }))
}
