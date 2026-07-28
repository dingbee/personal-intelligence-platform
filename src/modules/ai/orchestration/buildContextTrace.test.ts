import { describe, expect, it } from 'vitest'
import { buildContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import { buildGraphContextText, type GraphContextLink, type GraphContextNode } from '@/modules/knowledge-intelligence/api/retrieveGraphContext'
import { formatMemoriesForPrompt } from '@/modules/ai/memory/formatMemoriesForPrompt'
import type { AiMemory } from '@/shared/types/database'

let counter = 0
function makeMemory(overrides: Partial<AiMemory> = {}): AiMemory {
  counter += 1
  return {
    id: `memory-${counter}`,
    user_id: 'user-1',
    workspace_id: null,
    memory_type: 'explicit_profile',
    content: `Content ${counter}`,
    source: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildContextTrace', () => {
  it('reports zero for every field when nothing was retrieved', () => {
    expect(buildContextTrace(0, null, null)).toEqual({ retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 })
  })

  it('reports retrievedChunks exactly, independent of the other two', () => {
    expect(buildContextTrace(8, null, null)).toEqual({ retrievedChunks: 8, graphNodes: 0, memoriesUsed: 0 })
  })

  it('counts graph nodes correctly against real buildGraphContextText output', () => {
    const nodes: GraphContextNode[] = [
      { id: 'n1', title: 'Relativity Theory', node_type: 'concept' },
      { id: 'n2', title: 'Einstein', node_type: 'entity' },
      { id: 'n3', title: 'Gravity', node_type: 'concept' },
    ]
    const links: GraphContextLink[] = [{ source_id: 'n1', target_id: 'n3', relationship_type: 'relates_to' }]
    const graphContext = buildGraphContextText(nodes, links, ['Physics Handbook'])

    const trace = buildContextTrace(0, graphContext, null)
    expect(trace.graphNodes).toBe(3)
  })

  it('does not miscount related/source bullets as nodes', () => {
    const nodes: GraphContextNode[] = [{ id: 'n1', title: 'Relativity Theory', node_type: 'concept' }]
    const links: GraphContextLink[] = []
    const graphContext = buildGraphContextText(nodes, links, ['Physics Handbook', 'Einstein Notes'])

    const trace = buildContextTrace(0, graphContext, null)
    expect(trace.graphNodes).toBe(1)
  })

  it('counts memories correctly against real formatMemoriesForPrompt output, across types', () => {
    const memories = [
      makeMemory({ memory_type: 'explicit_profile', content: 'Runs a boutique hotel' }),
      makeMemory({ memory_type: 'learned_preference', content: 'Likes concise answers' }),
      makeMemory({ memory_type: 'conversation_memory', content: 'Mentioned writing a book' }),
    ]
    const memoryContext = formatMemoriesForPrompt(memories)

    const trace = buildContextTrace(0, null, memoryContext)
    expect(trace.memoriesUsed).toBe(3)
  })

  it('combines all three counts in one call', () => {
    const graphContext = buildGraphContextText(
      [{ id: 'n1', title: 'Relativity Theory', node_type: 'concept' }],
      [],
      [],
    )
    const memoryContext = formatMemoriesForPrompt([makeMemory(), makeMemory()])

    expect(buildContextTrace(8, graphContext, memoryContext)).toEqual({
      retrievedChunks: 8,
      graphNodes: 1,
      memoriesUsed: 2,
    })
  })
})
