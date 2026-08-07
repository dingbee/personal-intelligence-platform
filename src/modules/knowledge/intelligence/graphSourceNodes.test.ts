import { describe, expect, it } from 'vitest'
import { buildSourceGraphAdditions, mergeGraphLayers, type ConceptSourceRef } from '@/modules/knowledge/intelligence/graphSourceNodes'

describe('buildSourceGraphAdditions', () => {
  it('returns empty for no sources', () => {
    expect(buildSourceGraphAdditions([])).toEqual({ nodes: [], edges: [] })
  })

  it('creates a node and an evidenced_by edge for a resolved source', () => {
    const sources: ConceptSourceRef[] = [{ conceptNodeId: 'c1', sourceType: 'document', sourceId: 'd1', title: 'Marketing Plan' }]
    const result = buildSourceGraphAdditions(sources)
    expect(result.nodes).toEqual([{ id: 'd1', type: 'document', label: 'Marketing Plan' }])
    expect(result.edges).toEqual([{ id: 'evidence-c1-document-d1', sourceId: 'c1', targetId: 'd1', relationshipLabel: 'evidenced_by' }])
  })

  it('drops a source with no resolved title rather than rendering a broken label', () => {
    const sources: ConceptSourceRef[] = [{ conceptNodeId: 'c1', sourceType: 'document', sourceId: 'd1', title: null }]
    expect(buildSourceGraphAdditions(sources)).toEqual({ nodes: [], edges: [] })
  })

  it('drops an unrecognized source type', () => {
    const sources: ConceptSourceRef[] = [{ conceptNodeId: 'c1', sourceType: 'knowledge_collection', sourceId: 'k1', title: 'Q1 Planning' }]
    expect(buildSourceGraphAdditions(sources)).toEqual({ nodes: [], edges: [] })
  })

  it('creates one node with multiple edges when the same source evidences multiple concepts', () => {
    const sources: ConceptSourceRef[] = [
      { conceptNodeId: 'c1', sourceType: 'document', sourceId: 'd1', title: 'Marketing Plan' },
      { conceptNodeId: 'c2', sourceType: 'document', sourceId: 'd1', title: 'Marketing Plan' },
    ]
    const result = buildSourceGraphAdditions(sources)
    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toHaveLength(2)
  })

  it('supports asset and conversation source types', () => {
    const sources: ConceptSourceRef[] = [
      { conceptNodeId: 'c1', sourceType: 'asset', sourceId: 'a1', title: 'Dashboard screenshot' },
      { conceptNodeId: 'c1', sourceType: 'conversation', sourceId: 'conv1', title: 'Planning chat' },
    ]
    const result = buildSourceGraphAdditions(sources)
    expect(result.nodes.map((n) => n.type).sort()).toEqual(['asset', 'conversation'])
  })
})

describe('mergeGraphLayers', () => {
  it('concatenates nodes and edges from both layers', () => {
    const base = { nodes: [{ id: 'c1', type: 'concept' as const, label: 'Marketing' }], edges: [] }
    const additions = { nodes: [{ id: 'd1', type: 'document' as const, label: 'Plan' }], edges: [{ id: 'e1', sourceId: 'c1', targetId: 'd1', relationshipLabel: 'evidenced_by' }] }
    const result = mergeGraphLayers(base, additions)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })
})
