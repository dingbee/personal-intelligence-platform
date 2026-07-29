import { describe, expect, it } from 'vitest'
import { detectSignals } from '@/modules/intelligence/signals/signalDetector'
import type { NovaContext } from '@/modules/intelligence/context/types'

const EMPTY: NovaContext = {
  workspaceContext: null,
  activityContext: null,
  knowledgeContext: null,
  memoryContext: null,
  userContext: null,
  attentionContext: null,
  evolutionContext: null,
}

describe('detectSignals', () => {
  it('returns no signals for a plain, well-matched, short response with no other context', () => {
    expect(detectSignals({ context: EMPTY, matchCount: 2, documentId: null, responseLength: 50 })).toEqual([])
  })

  it('detects reading_resumed when the chat is scoped to the in-progress document', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: {
        inProgressDocument: { id: 'doc-1', title: 'Deep Work', updatedAt: new Date().toISOString() },
        recentConversations: [],
      },
    }
    const signals = detectSignals({ context, matchCount: 1, documentId: 'doc-1', responseLength: 50 })
    expect(signals).toContainEqual({ type: 'reading_resumed', message: 'Reading resumed: "Deep Work".' })
  })

  it('does not detect reading_resumed for a different document', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: {
        inProgressDocument: { id: 'doc-1', title: 'Deep Work', updatedAt: new Date().toISOString() },
        recentConversations: [],
      },
    }
    const signals = detectSignals({ context, matchCount: 1, documentId: 'doc-2', responseLength: 50 })
    expect(signals.some((s) => s.type === 'reading_resumed')).toBe(false)
  })

  it('detects knowledge_gap_detected when nothing matched', () => {
    const signals = detectSignals({ context: EMPTY, matchCount: 0, documentId: null, responseLength: 50 })
    expect(signals.some((s) => s.type === 'knowledge_gap_detected')).toBe(true)
  })

  it('detects repeated_topic_detected when the workspace name reappears in recent conversations', () => {
    const context: NovaContext = {
      ...EMPTY,
      workspaceContext: { workspaceId: 'w1', workspaceName: 'Research Notes', documentCount: 1, lastActivityAt: null },
      activityContext: { inProgressDocument: null, recentConversations: [{ id: 'conv-1', title: 'Research Notes' }] },
    }
    const signals = detectSignals({ context, matchCount: 1, documentId: null, responseLength: 50 })
    expect(signals.some((s) => s.type === 'repeated_topic_detected')).toBe(true)
  })

  it('detects possible_note_creation only for substantive, well-matched responses', () => {
    const short = detectSignals({ context: EMPTY, matchCount: 1, documentId: null, responseLength: 50 })
    expect(short.some((s) => s.type === 'possible_note_creation')).toBe(false)

    const long = detectSignals({ context: EMPTY, matchCount: 1, documentId: null, responseLength: 500 })
    expect(long.some((s) => s.type === 'possible_note_creation')).toBe(true)
  })

  it('detects related_concept_discovered when knowledge context is present', () => {
    const context: NovaContext = { ...EMPTY, knowledgeContext: { graphSummary: 'text', nodeCount: 2 } }
    const signals = detectSignals({ context, matchCount: 1, documentId: null, responseLength: 50 })
    expect(signals.some((s) => s.type === 'related_concept_discovered')).toBe(true)
  })
})
