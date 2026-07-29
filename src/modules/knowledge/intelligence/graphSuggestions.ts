import type { Command } from '@/modules/commands/types'
import { buildOpenDocumentDetailCommand, buildOpenReaderCommand } from '@/modules/commands/commands/knowledgeGraphCommands'
import type { GraphInsight } from '@/modules/knowledge/intelligence/graphInsights'
import type { Cluster } from '@/modules/knowledge/intelligence/conceptClusters'
import type { KnowledgeNodeSourceRef } from '@/modules/knowledge/intelligence/relationshipStrength'
import type { DocumentRef } from '@/modules/knowledge/intelligence/graphInsights'

export type LocalGraphSuggestionId = 'explore-cluster' | 'expand-topic' | 'open-timeline'

export type GraphSuggestion =
  | { kind: 'local'; id: 'explore-cluster'; clusterId: string; label: string }
  | { kind: 'local'; id: 'expand-topic'; nodeId: string; nodeTitle: string; label: string }
  | { kind: 'local'; id: 'open-timeline'; label: string }
  | { kind: 'command'; command: Command; label: string }

export interface GenerateGraphSuggestionsInput {
  clusters: Cluster[]
  insights: GraphInsight[]
  nodeSources: KnowledgeNodeSourceRef[]
  documents: DocumentRef[]
}

function findSourceDocument(
  nodeId: string,
  nodeSources: KnowledgeNodeSourceRef[],
  documents: DocumentRef[],
): DocumentRef | null {
  const sourceId = nodeSources.find((s) => s.nodeId === nodeId && s.sourceType === 'document')?.sourceId
  if (!sourceId) return null
  return documents.find((d) => d.id === sourceId) ?? null
}

function insightByType(insights: GraphInsight[], type: GraphInsight['type']): GraphInsight | null {
  return insights.find((i) => i.type === type) ?? null
}

/**
 * UX-10 Phase 7 — every suggestion either mutates local graph-view state
 * (handled by the consuming UI, same split as UX-9's ChapterSuggestion) or
 * wraps an existing route via the existing command pattern
 * (buildOpenDocumentDetailCommand/buildOpenReaderCommand, mirroring
 * buildContinueReadingCommand). "Review Connected Memory" from the brief's
 * example list is deliberately omitted — knowledge_nodes has no
 * association with ai_memory in the schema, and inventing one here would
 * mean either a schema change (out of scope) or AI/text-similarity
 * classification (explicitly disallowed for this phase). See the phase
 * report's Deferred items.
 */
export function generateGraphSuggestions(input: GenerateGraphSuggestionsInput): GraphSuggestion[] {
  const { clusters, insights, nodeSources, documents } = input
  const suggestions: GraphSuggestion[] = []

  const topCluster = clusters[0]
  if (topCluster) {
    suggestions.push({ kind: 'local', id: 'explore-cluster', clusterId: topCluster.id, label: `Explore ${topCluster.label} cluster` })
  }

  const weak = insightByType(insights, 'weakly_connected_concept') ?? insightByType(insights, 'isolated_concept')
  if (weak) {
    const nodeTitle = weak.value.split(' has')[0]!
    suggestions.push({ kind: 'local', id: 'expand-topic', nodeId: weak.nodeId, nodeTitle, label: `Expand topic: ${nodeTitle}` })

    const sourceDoc = findSourceDocument(weak.nodeId, nodeSources, documents)
    if (sourceDoc) {
      suggestions.push({
        kind: 'command',
        command: buildOpenReaderCommand(sourceDoc.id, sourceDoc.title, `Continue learning: ${sourceDoc.title}`),
        label: `Continue learning: ${sourceDoc.title}`,
      })
    }
  }

  const referenced = insightByType(insights, 'frequently_referenced_concept') ?? insightByType(insights, 'most_connected_concept')
  if (referenced) {
    const sourceDoc = findSourceDocument(referenced.nodeId, nodeSources, documents)
    if (sourceDoc) {
      suggestions.push({
        kind: 'command',
        command: buildOpenDocumentDetailCommand(sourceDoc.id, sourceDoc.title),
        label: `Open ${sourceDoc.title}`,
      })
    }
  }

  const recent = insightByType(insights, 'recently_expanded_knowledge')
  if (recent) {
    const sourceDoc = findSourceDocument(recent.nodeId, nodeSources, documents)
    if (sourceDoc) {
      suggestions.push({
        kind: 'command',
        command: buildOpenReaderCommand(sourceDoc.id, sourceDoc.title),
        label: `Read ${sourceDoc.title}`,
      })
    }
  }

  if (insights.length > 0 || clusters.length > 0) {
    suggestions.push({ kind: 'local', id: 'open-timeline', label: 'View knowledge timeline' })
  }

  return suggestions
}
