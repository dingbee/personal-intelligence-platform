import { describe, expect, it, vi } from 'vitest'

const { getMostRecentReadingProgressMock, getReadingProgressMock, listConversationsMock, listMemoriesMock, listWorkspacesMock, getWorkspaceStatsMock, listDocumentsMock, listNotesMock } =
  vi.hoisted(() => ({
    getMostRecentReadingProgressMock: vi.fn(async () => null as { id: string; title: string; updatedAt: string } | null),
    getReadingProgressMock: vi.fn(async () => null as { scroll_fraction: number } | null),
    listConversationsMock: vi.fn(async () => [] as { id: string; title: string }[]),
    listMemoriesMock: vi.fn(async () => [] as { id: string; memory_type: string; content: string; source: string | null; created_at: string; updated_at: string }[]),
    listWorkspacesMock: vi.fn(async () => [] as { id: string; name: string }[]),
    getWorkspaceStatsMock: vi.fn(async () => ({ documents: 0, lastActivityAt: null }) as { documents: number; lastActivityAt: string | null }),
    listDocumentsMock: vi.fn(async () => [] as { created_at: string }[]),
    listNotesMock: vi.fn(async () => [] as { id: string; title: string }[]),
  }))

vi.mock('@/modules/reader/api/readingProgress', () => ({
  getMostRecentReadingProgress: getMostRecentReadingProgressMock,
  getReadingProgress: getReadingProgressMock,
}))
vi.mock('@/modules/ai/chat/api/conversations', () => ({ listConversations: listConversationsMock }))
vi.mock('@/modules/ai/memory/api/memory', () => ({ listMemories: listMemoriesMock }))
vi.mock('@/modules/workspaces/api/workspaces', () => ({
  listWorkspaces: listWorkspacesMock,
  getWorkspaceStats: getWorkspaceStatsMock,
}))
vi.mock('@/modules/library/api/documents', () => ({ listDocuments: listDocumentsMock }))
vi.mock('@/modules/notes/api/notes', () => ({ listNotes: listNotesMock }))

import { buildInteractionState } from '@/modules/intelligence/orchestrator/orchestrator'
import type { CommandContext } from '@/modules/commands/types'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

function baseCommandContext(): CommandContext {
  return {
    userId: 'user-1',
    workspaceId: 'w1',
    workspaceName: 'Research',
    pathname: '/chat',
    documentId: null,
    inProgressDocument: null,
  }
}

function baseParams() {
  return {
    workspaceId: 'w1' as string | null,
    workspaceName: 'Research' as string | null,
    conversationTitle: 'Research chat',
    messageCount: 1,
    userQuery: 'What have I learned about hospitality?',
    commandContext: baseCommandContext(),
    contextTrace: { retrievedChunks: 2, graphNodes: 0, memoriesUsed: 0 },
    references: [] as Reference[],
    suggestions: [] as string[],
    signals: [] as IntelligenceSignal[],
  }
}

describe('buildInteractionState', () => {
  it('returns an immutable-shaped InteractionState with every field present', async () => {
    const state = await buildInteractionState(baseParams())
    expect(state).toHaveProperty('context')
    expect(state).toHaveProperty('references')
    expect(state).toHaveProperty('evidence')
    expect(state).toHaveProperty('suggestions')
    expect(state).toHaveProperty('actions')
    expect(state).toHaveProperty('attention')
    expect(state).toHaveProperty('resurfacedKnowledge')
    expect(state).toHaveProperty('workspace')
    expect(state).toHaveProperty('signals')
  })

  it('always decides genericWorkspace is present, and workspace when a name is given', async () => {
    const state = await buildInteractionState(baseParams())
    expect(state.context.map((c) => c.key)).toEqual(expect.arrayContaining(['workspace', 'genericWorkspace']))
  })

  it('passes through references/suggestions/signals from the caller unchanged', async () => {
    const params = baseParams()
    params.references = [{ type: 'document', id: 'doc-1', title: 'A Book' }]
    params.suggestions = ['Create notes from this?']
    const state = await buildInteractionState(params)
    expect(state.references).toEqual(params.references)
    expect(state.suggestions).toEqual(params.suggestions)
  })

  it('computes evidence from the given contextTrace', async () => {
    const params = baseParams()
    params.contextTrace = { retrievedChunks: 5, graphNodes: 2, memoriesUsed: 0 }
    const state = await buildInteractionState(params)
    expect(state.evidence).toBe('High')
  })

  it('surfaces reading attention/resurfaced items when a document is in progress', async () => {
    getMostRecentReadingProgressMock.mockResolvedValueOnce({ id: 'doc-1', title: 'Deep Work', updatedAt: '2026-01-01T00:00:00.000Z' })
    getReadingProgressMock.mockResolvedValueOnce({ scroll_fraction: 0.4 })

    const state = await buildInteractionState(baseParams())
    expect(state.attention).toContainEqual({
      type: 'unfinished_book',
      message: 'You haven\'t finished "Deep Work" yet.',
      priority: 'medium',
    })
    expect(state.resurfacedKnowledge).toContainEqual({ type: 'document', id: 'doc-1', title: 'Deep Work', href: '/library/doc-1/read' })
    expect(state.context.map((c) => c.key)).toContain('reading')
  })

  it('degrades gracefully when every underlying source fails', async () => {
    getMostRecentReadingProgressMock.mockRejectedValueOnce(new Error('boom'))
    listConversationsMock.mockRejectedValueOnce(new Error('boom'))
    listMemoriesMock.mockRejectedValueOnce(new Error('boom'))
    listWorkspacesMock.mockRejectedValueOnce(new Error('boom'))
    listDocumentsMock.mockRejectedValueOnce(new Error('boom'))
    listNotesMock.mockRejectedValueOnce(new Error('boom'))

    const state = await buildInteractionState(baseParams())
    expect(state.attention).toEqual([])
    expect(state.workspace).toEqual([])
    expect(state.resurfacedKnowledge).toEqual([])
  })
})
