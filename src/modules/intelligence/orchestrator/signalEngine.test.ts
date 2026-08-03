import { describe, expect, it } from 'vitest'
import { detectOrchestratorSignals, hasMemoryNeedingReview } from '@/modules/intelligence/orchestrator/signalEngine'
import type { AiMemory } from '@/shared/types/database'

function makeMemory(overrides: Partial<AiMemory> & { id: string }): AiMemory {
  return {
    user_id: 'user-1',
    workspace_id: null,
    memory_type: 'learned_preference',
    content: 'content',
    source: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    confidence: null,
    ...overrides,
  }
}

const BASE: Parameters<typeof detectOrchestratorSignals>[0] = {
  retrievedChunks: 2,
  inProgressDocument: null,
  memories: [],
  workspaceLastActivityAt: null,
  conversationTitle: null,
  userQuery: 'Hello',
  messageCount: 1,
  now: new Date('2026-06-01T00:00:00.000Z'),
}

describe('detectOrchestratorSignals', () => {
  it('returns nothing when nothing applies', () => {
    expect(detectOrchestratorSignals(BASE)).toEqual([])
  })

  it('detects contradictory_memory', () => {
    const signals = detectOrchestratorSignals({
      ...BASE,
      memories: [
        makeMemory({ id: 'm1', content: 'User prefers dark mode.' }),
        makeMemory({ id: 'm2', content: 'User dislikes dark mode.' }),
      ],
    })
    expect(signals.some((s) => s.type === 'contradictory_memory')).toBe(true)
  })

  it('detects reading_opportunity for an unfinished in-progress document', () => {
    const signals = detectOrchestratorSignals({ ...BASE, inProgressDocument: { scrollFraction: 0.4 } })
    expect(signals.some((s) => s.type === 'reading_opportunity')).toBe(true)
  })

  it('does not detect reading_opportunity for a finished document', () => {
    const signals = detectOrchestratorSignals({ ...BASE, inProgressDocument: { scrollFraction: 0.99 } })
    expect(signals.some((s) => s.type === 'reading_opportunity')).toBe(false)
  })

  it('detects unreviewed_memory for an untouched conversation-sourced memory', () => {
    const signals = detectOrchestratorSignals({
      ...BASE,
      memories: [makeMemory({ id: 'm1', source: 'conversation', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })],
    })
    expect(signals.some((s) => s.type === 'unreviewed_memory')).toBe(true)
  })

  it('does not detect unreviewed_memory once a memory has been edited', () => {
    const signals = detectOrchestratorSignals({
      ...BASE,
      memories: [makeMemory({ id: 'm1', source: 'conversation', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-05T00:00:00.000Z' })],
    })
    expect(signals.some((s) => s.type === 'unreviewed_memory')).toBe(false)
  })

  it('detects inactive_workspace past the threshold', () => {
    const signals = detectOrchestratorSignals({ ...BASE, workspaceLastActivityAt: '2026-05-01T00:00:00.000Z' })
    expect(signals.some((s) => s.type === 'inactive_workspace')).toBe(true)
  })

  it('detects large_context at or above the retrieval max', () => {
    const signals = detectOrchestratorSignals({ ...BASE, retrievedChunks: 8 })
    expect(signals.some((s) => s.type === 'large_context')).toBe(true)
  })

  it('does not detect large_context below the threshold', () => {
    const signals = detectOrchestratorSignals({ ...BASE, retrievedChunks: 3 })
    expect(signals.some((s) => s.type === 'large_context')).toBe(false)
  })

  it('detects conversation_drift for a long conversation with no topic overlap', () => {
    const signals = detectOrchestratorSignals({
      ...BASE,
      conversationTitle: 'Marketing strategy',
      messageCount: 8,
      userQuery: 'What should I cook for dinner tonight?',
    })
    expect(signals.some((s) => s.type === 'conversation_drift')).toBe(true)
  })

  it('does not detect conversation_drift for a short conversation', () => {
    const signals = detectOrchestratorSignals({
      ...BASE,
      conversationTitle: 'Marketing strategy',
      messageCount: 2,
      userQuery: 'What should I cook for dinner tonight?',
    })
    expect(signals.some((s) => s.type === 'conversation_drift')).toBe(false)
  })

  it('does not detect conversation_drift when the topic still overlaps', () => {
    const signals = detectOrchestratorSignals({
      ...BASE,
      conversationTitle: 'Marketing strategy',
      messageCount: 8,
      userQuery: 'More detail on marketing please',
    })
    expect(signals.some((s) => s.type === 'conversation_drift')).toBe(false)
  })
})

describe('hasMemoryNeedingReview', () => {
  it('is false when there is nothing to review', () => {
    expect(hasMemoryNeedingReview([])).toBe(false)
  })

  it('is true for an unreviewed conversation-sourced memory', () => {
    const memory = makeMemory({ id: 'm1', source: 'conversation', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })
    expect(hasMemoryNeedingReview([memory])).toBe(true)
  })

  it('is true for a contradictory pair even with no unreviewed memory', () => {
    const memories: AiMemory[] = [
      makeMemory({ id: 'm1', content: 'User prefers dark mode interfaces.', updated_at: '2026-01-02T00:00:00.000Z' }),
      makeMemory({ id: 'm2', content: 'User dislikes dark mode interfaces.', updated_at: '2026-01-02T00:00:00.000Z' }),
    ]
    expect(hasMemoryNeedingReview(memories)).toBe(true)
  })
})
