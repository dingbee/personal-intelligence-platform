import type { Reference } from '@/modules/intelligence/references/referenceTypes'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import { generateKnowledgeMap } from '@/modules/knowledge-intelligence/api/knowledgeMap'
import { listKnowledgeNodeSourcesForNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { listDocuments } from '@/modules/library/api/documents'
import { computeGraphInsights, type DocumentRef, type GraphInsight } from '@/modules/knowledge/intelligence/graphInsights'
import { computeConceptClusters, type Cluster } from '@/modules/knowledge/intelligence/conceptClusters'
import { detectGraphSignals } from '@/modules/knowledge/intelligence/graphSignals'
import { generateGraphSuggestions, type GraphSuggestion } from '@/modules/knowledge/intelligence/graphSuggestions'
import { computeRelationshipStrengths, type RelationshipStrength } from '@/modules/knowledge/intelligence/relationshipStrength'

export interface GraphInteractionState {
  clusters: Cluster[]
  insights: GraphInsight[]
  signals: IntelligenceSignal[]
  suggestions: GraphSuggestion[]
  relationships: RelationshipStrength[]
  references: Reference[]
}

const MAX_REFERENCES = 5

export interface BuildGraphInteractionStateParams {
  workspaceId: string | null
}

/**
 * UX-10 Phase 8 — the single fetch-and-compose point for Knowledge Graph
 * Intelligence, mirroring readerInteraction.ts/orchestrator.ts: every fetch
 * reuses an existing API function (generateKnowledgeMap,
 * listKnowledgeNodeSourcesForNodes, listDocuments), and every decision is
 * delegated to a pure function in this same directory. No AI call, no
 * schema change. `listDocuments({})` is called unfiltered (not scoped to
 * `workspaceId`) because a node's sources can point at documents outside
 * its own workspace_id (a node can be reused across documents via
 * resolveCanonicalNode) — the lookup needs to resolve any source id.
 */
export async function buildGraphInteractionState(params: BuildGraphInteractionStateParams): Promise<GraphInteractionState> {
  const map = await generateKnowledgeMap(params.workspaceId).catch(() => ({ nodes: [], edges: [] }))
  const nodeIds = map.nodes.map((n) => n.id)

  const [nodeSources, documentsWithTags] = await Promise.all([
    listKnowledgeNodeSourcesForNodes(nodeIds).catch(() => []),
    listDocuments({}).catch(() => []),
  ])
  const documents: DocumentRef[] = documentsWithTags.map((d) => ({ id: d.id, title: d.title, workspace_id: d.workspace_id }))

  const clusters = computeConceptClusters(map.nodes, map.edges)
  const insights = computeGraphInsights({ nodes: map.nodes, edges: map.edges, nodeSources, documents })
  const signals = detectGraphSignals({ nodes: map.nodes, edges: map.edges, clusters, nodeSources })
  const suggestions = generateGraphSuggestions({ clusters, insights, nodeSources, documents })
  const relationships = computeRelationshipStrengths(map.nodes, map.edges, nodeSources)

  const documentsById = new Map(documents.map((d) => [d.id, d]))
  const referenceDocIds = [...new Set(insights.map((i) => nodeSources.find((s) => s.nodeId === i.nodeId && s.sourceType === 'document')?.sourceId).filter((id): id is string => Boolean(id)))]
  const references: Reference[] = referenceDocIds
    .slice(0, MAX_REFERENCES)
    .map((id) => documentsById.get(id))
    .filter((d): d is DocumentRef => Boolean(d))
    .map((d) => ({ type: 'document', id: d.id, title: d.title }))

  return { clusters, insights, signals, suggestions, relationships, references }
}
