import { describe, expect, it } from 'vitest'
import { generateGraphSuggestions } from '@/modules/knowledge/intelligence/graphSuggestions'
import type { Cluster } from '@/modules/knowledge/intelligence/conceptClusters'
import type { GraphInsight } from '@/modules/knowledge/intelligence/graphInsights'
import type { KnowledgeNodeSourceRef } from '@/modules/knowledge/intelligence/relationshipStrength'

const CLUSTER: Cluster = { id: 'a', label: 'Machine Learning', nodeIds: ['a', 'b'], size: 2, density: 1 }

describe('generateGraphSuggestions', () => {
  it('returns no suggestions for an empty graph', () => {
    expect(generateGraphSuggestions({ clusters: [], insights: [], nodeSources: [], documents: [] })).toEqual([])
  })

  it('suggests exploring the top cluster when clusters exist', () => {
    const suggestions = generateGraphSuggestions({ clusters: [CLUSTER], insights: [], nodeSources: [], documents: [] })
    const explore = suggestions.find((s) => s.kind === 'local' && s.id === 'explore-cluster')
    expect(explore).toBeDefined()
    expect(explore).toMatchObject({ clusterId: 'a' })
  })

  it('suggests expanding a weakly connected topic', () => {
    const insights: GraphInsight[] = [{ type: 'weakly_connected_concept', label: 'x', value: 'A has only one connection', nodeId: 'a' }]
    const suggestions = generateGraphSuggestions({ clusters: [], insights, nodeSources: [], documents: [] })
    const expand = suggestions.find((s) => s.kind === 'local' && s.id === 'expand-topic')
    expect(expand).toMatchObject({ nodeId: 'a' })
  })

  it('suggests continuing learning via the source document of a weak concept', () => {
    const insights: GraphInsight[] = [{ type: 'isolated_concept', label: 'x', value: 'A has no connections', nodeId: 'a' }]
    const nodeSources: KnowledgeNodeSourceRef[] = [{ nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' }]
    const documents = [{ id: 'doc-1', title: 'Deep Work', workspace_id: null }]
    const suggestions = generateGraphSuggestions({ clusters: [], insights, nodeSources, documents })
    const continueLearning = suggestions.find((s) => s.kind === 'command' && s.command.id.includes('reader'))
    expect(continueLearning?.label).toContain('Deep Work')
  })

  it('suggests opening the related document behind the most connected concept', () => {
    const insights: GraphInsight[] = [{ type: 'most_connected_concept', label: 'x', value: 'A (3 connections)', nodeId: 'a' }]
    const nodeSources: KnowledgeNodeSourceRef[] = [{ nodeId: 'a', sourceType: 'document', sourceId: 'doc-2' }]
    const documents = [{ id: 'doc-2', title: 'Atomic Habits', workspace_id: null }]
    const suggestions = generateGraphSuggestions({ clusters: [], insights, nodeSources, documents })
    const openDoc = suggestions.find((s) => s.kind === 'command' && s.command.id.includes('open-document'))
    expect(openDoc?.label).toContain('Atomic Habits')
  })

  it('does not suggest opening a document when no source document is known', () => {
    const insights: GraphInsight[] = [{ type: 'most_connected_concept', label: 'x', value: 'A (3 connections)', nodeId: 'a' }]
    const suggestions = generateGraphSuggestions({ clusters: [], insights, nodeSources: [], documents: [] })
    expect(suggestions.find((s) => s.kind === 'command')).toBeUndefined()
  })

  it('offers a timeline suggestion whenever there is something to review', () => {
    const suggestions = generateGraphSuggestions({
      clusters: [CLUSTER],
      insights: [],
      nodeSources: [],
      documents: [],
    })
    expect(suggestions.some((s) => s.kind === 'local' && s.id === 'open-timeline')).toBe(true)
  })

  it('never suggests reviewing a connected memory (no schema association exists)', () => {
    const insights: GraphInsight[] = [{ type: 'most_connected_concept', label: 'x', value: 'A (3 connections)', nodeId: 'a' }]
    const suggestions = generateGraphSuggestions({ clusters: [CLUSTER], insights, nodeSources: [], documents: [] })
    expect(suggestions.some((s) => s.label.toLowerCase().includes('memory'))).toBe(false)
  })
})
