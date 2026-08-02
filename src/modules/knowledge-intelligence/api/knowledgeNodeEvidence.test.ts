import { describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => {
  const knowledgeNodeSourcesRows: { node_id: string }[] = [{ node_id: 'node-1' }, { node_id: 'node-2' }, { node_id: 'node-1' }]
  const knowledgeNodesRows = [
    { id: 'node-1', title: 'Occupancy Rate' },
    { id: 'node-2', title: 'Revenue Model' },
  ]

  const fromMock = vi.fn((table: string) => {
    if (table === 'knowledge_node_sources') {
      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({ data: knowledgeNodeSourcesRows, error: null }),
          }),
        }),
      }
    }
    if (table === 'knowledge_nodes') {
      return {
        select: () => ({
          in: async () => ({ data: knowledgeNodesRows, error: null }),
        }),
      }
    }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { getRelatedKnowledgeForNote } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

describe('getRelatedKnowledgeForNote', () => {
  it('returns the deduplicated knowledge nodes that cite this note, shaped for SourceReference', async () => {
    const result = await getRelatedKnowledgeForNote('note-1')

    expect(fromMock).toHaveBeenCalledWith('knowledge_node_sources')
    expect(fromMock).toHaveBeenCalledWith('knowledge_nodes')
    expect(result).toEqual([
      { type: 'knowledge_node', id: 'node-1', label: 'Occupancy Rate' },
      { type: 'knowledge_node', id: 'node-2', label: 'Revenue Model' },
    ])
  })

  it('returns an empty array without a second query when the note has no related knowledge', async () => {
    fromMock.mockImplementationOnce((table: string) => {
      if (table !== 'knowledge_node_sources') throw new Error(`Unexpected table: ${table}`)
      return { select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) }
    })

    const result = await getRelatedKnowledgeForNote('note-with-no-links')
    expect(result).toEqual([])
  })
})
