import type { Cluster } from '@/modules/knowledge/intelligence/conceptClusters'
import { mostFrequentSignificantWord } from '@/modules/intelligence/orchestrator/workspaceInsightEngine'

export type ExecutiveInsightCategory = 'knowledge' | 'learning' | 'organization' | 'memory' | 'research'

export interface ExecutiveInsight {
  category: ExecutiveInsightCategory
  message: string
  /** The concrete, traceable fact behind `message` — every insight requires evidence, per the brief. */
  evidence: string
}

export interface GenerateExecutiveInsightsInput {
  clusters: Cluster[]
  totalConceptCount: number
  unreviewedHighlightCount: number
  sampledHighlightCount: number
  documentsWithoutCollectionCount: number
  totalDocumentCount: number
  memoryContents: string[]
  recentConversationTitles: string[]
  previousConversationTitles: string[]
}

/**
 * UX-11 Phase 5 — the Executive Insight Engine. No AI, no embeddings: the
 * "Marketing"/"pricing strategy"/"automation"-style examples in the brief
 * describe semantic topic classification, which this phase's constraints
 * rule out. Memory/Research insights instead reuse
 * mostFrequentSignificantWord — the exact deterministic keyword-frequency
 * technique workspaceInsightEngine.ts already established for "most
 * queried topic" — applied to memory content and conversation titles
 * respectively, rather than inventing a second, AI-based technique.
 */
export function generateExecutiveInsights(input: GenerateExecutiveInsightsInput): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = []

  const topCluster = [...input.clusters].sort((a, b) => b.size - a.size)[0]
  if (topCluster) {
    insights.push({
      category: 'knowledge',
      message: `You have strong concentration around ${topCluster.label}.`,
      evidence: `${topCluster.size} connected concepts form this cluster, out of ${input.totalConceptCount} total.`,
    })
  }

  if (input.unreviewedHighlightCount > 0) {
    insights.push({
      category: 'learning',
      message: `You have not reviewed ${input.unreviewedHighlightCount} highlighted passage${input.unreviewedHighlightCount === 1 ? '' : 's'}.`,
      evidence: `${input.unreviewedHighlightCount} of the last ${input.sampledHighlightCount} highlights sampled have no attached note.`,
    })
  }

  if (input.documentsWithoutCollectionCount > 0) {
    insights.push({
      category: 'organization',
      message: `${input.documentsWithoutCollectionCount} document${input.documentsWithoutCollectionCount === 1 ? ' is' : 's are'} not organized into any collection.`,
      evidence: `${input.documentsWithoutCollectionCount} of ${input.totalDocumentCount} documents have no collection assigned.`,
    })
  }

  const memoryTopic = mostFrequentSignificantWord(input.memoryContents)
  if (memoryTopic) {
    insights.push({
      category: 'memory',
      message: `You frequently reference "${memoryTopic}" in your stored memories.`,
      evidence: `"${memoryTopic}" is the most common significant word across your stored memories.`,
    })
  }

  const recentTopic = mostFrequentSignificantWord(input.recentConversationTitles)
  if (recentTopic) {
    const previousTopic = mostFrequentSignificantWord(input.previousConversationTitles)
    if (recentTopic !== previousTopic) {
      insights.push({
        category: 'research',
        message: `Your AI conversations increasingly focus on "${recentTopic}".`,
        evidence: `"${recentTopic}" is the most frequent topic in conversations from the last 30 days${previousTopic ? `, compared with "${previousTopic}" before that` : ''}.`,
      })
    }
  }

  return insights
}
