import { describe, expect, it } from 'vitest'
import { rankAttentionItems, buildAttentionCenter } from '@/modules/intelligence/dashboard/dashboardSignals'
import type { AttentionItem } from '@/modules/intelligence/orchestrator/types'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

function item(type: AttentionItem['type'], priority: AttentionItem['priority']): AttentionItem {
  return { type, message: `${type} message`, priority }
}

describe('rankAttentionItems', () => {
  it('sorts high priority items before medium and low', () => {
    const items = [item('inactive_workspace', 'low'), item('contradictory_memories', 'high'), item('unfinished_book', 'medium')]
    expect(rankAttentionItems(items).map((i) => i.priority)).toEqual(['high', 'medium', 'low'])
  })

  it('does not mutate the input array', () => {
    const items = [item('inactive_workspace', 'low'), item('contradictory_memories', 'high')]
    const copy = [...items]
    rankAttentionItems(items)
    expect(items).toEqual(copy)
  })

  it('preserves relative order within the same priority', () => {
    const items = [item('unfinished_book', 'medium'), item('stopped_midway', 'medium')]
    expect(rankAttentionItems(items).map((i) => i.type)).toEqual(['unfinished_book', 'stopped_midway'])
  })

  it('returns an empty array for no items', () => {
    expect(rankAttentionItems([])).toEqual([])
  })
})

describe('buildAttentionCenter', () => {
  it('returns the attention items unchanged when there are no relevant graph signals', () => {
    const attentionItems = [item('unfinished_book', 'medium')]
    const result = buildAttentionCenter({ attentionItems, graphSignals: [] })
    expect(result).toEqual(attentionItems)
  })

  it('folds a disconnected_concept graph signal in as a high-priority attention item', () => {
    const graphSignals: IntelligenceSignal[] = [{ type: 'disconnected_concept', message: 'Concept X is disconnected.' }]
    const result = buildAttentionCenter({ attentionItems: [], graphSignals })
    expect(result).toEqual([{ type: 'disconnected_concept', message: 'Concept X is disconnected.', priority: 'high' }])
  })

  it('folds a knowledge_island graph signal in as a high-priority attention item', () => {
    const graphSignals: IntelligenceSignal[] = [{ type: 'knowledge_island', message: 'Cluster Y is isolated.' }]
    const result = buildAttentionCenter({ attentionItems: [], graphSignals })
    expect(result.some((i) => i.type === 'knowledge_island' && i.priority === 'high')).toBe(true)
  })

  it('ignores graph signal types that are not attention-relevant', () => {
    const graphSignals: IntelligenceSignal[] = [{ type: 'emerging_topic', message: 'Topic Z is emerging.' }]
    const result = buildAttentionCenter({ attentionItems: [], graphSignals })
    expect(result).toEqual([])
  })

  it('ranks the combined list by priority', () => {
    const graphSignals: IntelligenceSignal[] = [{ type: 'disconnected_concept', message: 'Disconnected.' }]
    const attentionItems = [item('asked_before', 'low')]
    const result = buildAttentionCenter({ attentionItems, graphSignals })
    expect(result[0]!.priority).toBe('high')
  })

  it('returns an empty list when there is nothing on either side', () => {
    expect(buildAttentionCenter({ attentionItems: [], graphSignals: [] })).toEqual([])
  })

  it('folds in multiple attention-relevant graph signals', () => {
    const graphSignals: IntelligenceSignal[] = [
      { type: 'disconnected_concept', message: 'A is disconnected.' },
      { type: 'knowledge_island', message: 'Cluster B is isolated.' },
    ]
    const result = buildAttentionCenter({ attentionItems: [], graphSignals })
    expect(result).toHaveLength(2)
    expect(result.every((i) => i.priority === 'high')).toBe(true)
  })
})
