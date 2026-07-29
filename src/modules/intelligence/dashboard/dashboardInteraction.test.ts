import { describe, expect, it, vi } from 'vitest'
import type { CommandContext } from '@/modules/commands/types'

const mocks = vi.hoisted(() => ({
  listDocumentsMock: vi.fn(async () => [] as { id: string; created_at: string; collection_id: string | null; tags: { id: string; name: string }[] }[]),
  listNotesMock: vi.fn(async () => [] as { created_at: string }[]),
  listConversationsMock: vi.fn(async () => [] as { created_at: string; title: string }[]),
  listMemoriesMock: vi.fn(async () => [] as { content: string; is_active: boolean; created_at: string; updated_at: string; source: string | null; memory_type: string }[]),
  listWorkspacesMock: vi.fn(async () => [] as { id: string; name: string }[]),
  getWorkspaceStatsMock: vi.fn(async () => null as unknown),
  listKnowledgeNodesMock: vi.fn(async () => [] as { id: string; created_at: string }[]),
  listKnowledgeNodeSourcesForNodesMock: vi.fn(async () => [] as { nodeId: string; sourceType: string; sourceId: string }[]),
  listKnowledgeLinksMock: vi.fn(async () => [] as { generated_by: string | null; created_at: string; source_id: string; target_id: string }[]),
  listRecentChapterSummariesMock: vi.fn(async () => [] as { updated_at: string }[]),
  listRecentHighlightsMock: vi.fn(async () => [] as { note: string | null }[]),
  listAllFlashcardsMock: vi.fn(async () => [] as { created_at: string }[]),
  listReadingProgressForWorkspaceMock: vi.fn(async () => [] as { updated_at: string }[]),
  getMostRecentReadingProgressMock: vi.fn(async () => null as { id: string; title: string; updatedAt: string } | null),
  getReadingProgressMock: vi.fn(async () => null as { scroll_fraction: number } | null),
  listAiRequestsSinceMock: vi.fn(async () => [] as { feature: string; created_at: string }[]),
}))

vi.mock('@/modules/library/api/documents', () => ({ listDocuments: mocks.listDocumentsMock }))
vi.mock('@/modules/notes/api/notes', () => ({ listNotes: mocks.listNotesMock }))
vi.mock('@/modules/ai/chat/api/conversations', () => ({ listConversations: mocks.listConversationsMock }))
vi.mock('@/modules/ai/memory/api/memory', () => ({ listMemories: mocks.listMemoriesMock }))
vi.mock('@/modules/workspaces/api/workspaces', () => ({
  listWorkspaces: mocks.listWorkspacesMock,
  getWorkspaceStats: mocks.getWorkspaceStatsMock,
}))
vi.mock('@/modules/knowledge-intelligence/api/knowledgeNodes', () => ({
  listKnowledgeNodes: mocks.listKnowledgeNodesMock,
  listKnowledgeNodeSourcesForNodes: mocks.listKnowledgeNodeSourcesForNodesMock,
}))
vi.mock('@/modules/knowledge-graph/api/graph', () => ({ listKnowledgeLinks: mocks.listKnowledgeLinksMock }))
vi.mock('@/modules/knowledge/api/dashboard', () => ({
  listRecentChapterSummaries: mocks.listRecentChapterSummariesMock,
  listRecentHighlights: mocks.listRecentHighlightsMock,
  listAllFlashcards: mocks.listAllFlashcardsMock,
}))
vi.mock('@/modules/reader/api/readingProgress', () => ({
  listReadingProgressForWorkspace: mocks.listReadingProgressForWorkspaceMock,
  getMostRecentReadingProgress: mocks.getMostRecentReadingProgressMock,
  getReadingProgress: mocks.getReadingProgressMock,
}))
vi.mock('@/modules/ai/observability/api/aiRequests', () => ({ listAiRequestsSince: mocks.listAiRequestsSinceMock }))

import { buildDashboardState } from '@/modules/intelligence/dashboard/dashboardInteraction'

function commandContext(): CommandContext {
  return {
    userId: 'user-1',
    workspaceId: null,
    workspaceName: null,
    pathname: '/dashboard',
    documentId: null,
    inProgressDocument: null,
  }
}

describe('buildDashboardState', () => {
  it('returns a fully-shaped, empty DashboardState with no data anywhere', async () => {
    const state = await buildDashboardState({ workspaceId: null, commandContext: commandContext() })
    expect(state.scores).toHaveLength(5)
    expect(state.growth).toHaveLength(7)
    expect(state.insights).toEqual([])
    expect(state.attention).toEqual([])
    expect(state.workspaceSummaries).toEqual([])
    expect(state.recommendations.length).toBeGreaterThan(0)
  })

  it('reflects fetched documents in the knowledge growth metrics', async () => {
    mocks.listDocumentsMock.mockResolvedValueOnce([
      { id: 'doc-1', created_at: new Date().toISOString(), collection_id: null, tags: [] },
    ])
    const state = await buildDashboardState({ workspaceId: null, commandContext: commandContext() })
    expect(state.growth.find((m) => m.type === 'documents_added')!.last7Days).toBe(1)
  })

  it('composes workspace summaries from listWorkspaces + getWorkspaceStats + listKnowledgeLinks', async () => {
    mocks.listWorkspacesMock.mockResolvedValueOnce([{ id: 'w1', name: 'Research' }])
    mocks.getWorkspaceStatsMock.mockResolvedValueOnce({
      documents: 24,
      collections: 1,
      notes: 0,
      conversations: 0,
      knowledgeNodes: 184,
      highlights: 0,
      flashcards: 0,
      chapterSummaries: 0,
      storageBytes: 0,
      lastActivityAt: '2026-07-28T00:00:00.000Z',
    })
    // buildDashboardState calls listKnowledgeLinks twice in this scenario:
    // once for the current ("All workspaces") scope, once again
    // per-workspace when resolving workspace summaries — queue the same
    // response for both without leaking a persistent mock into later tests.
    const workspaceLinks = [{ generated_by: 'ai:test', created_at: new Date().toISOString(), source_id: 'a', target_id: 'b' }]
    mocks.listKnowledgeLinksMock.mockResolvedValueOnce(workspaceLinks).mockResolvedValueOnce(workspaceLinks)
    const state = await buildDashboardState({ workspaceId: null, commandContext: commandContext() })
    expect(state.workspaceSummaries).toEqual([
      { workspaceId: 'w1', workspaceName: 'Research', documentCount: 24, conceptCount: 184, connectionCount: 1, lastActivityAt: '2026-07-28T00:00:00.000Z' },
    ])
  })

  it('surfaces an unfinished-book attention item when a document is in progress', async () => {
    mocks.getMostRecentReadingProgressMock.mockResolvedValueOnce({ id: 'doc-1', title: 'Deep Work', updatedAt: new Date().toISOString() })
    mocks.getReadingProgressMock.mockResolvedValueOnce({ scroll_fraction: 0.3 })
    const state = await buildDashboardState({ workspaceId: null, commandContext: commandContext() })
    expect(state.attention.some((item) => item.type === 'unfinished_book')).toBe(true)
  })

  it('degrades gracefully when every underlying fetch fails', async () => {
    mocks.listDocumentsMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listNotesMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listConversationsMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listMemoriesMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listWorkspacesMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listKnowledgeNodesMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listKnowledgeLinksMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listRecentChapterSummariesMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listAllFlashcardsMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listReadingProgressForWorkspaceMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listRecentHighlightsMock.mockRejectedValueOnce(new Error('boom'))
    mocks.getMostRecentReadingProgressMock.mockRejectedValueOnce(new Error('boom'))
    mocks.listAiRequestsSinceMock.mockRejectedValueOnce(new Error('boom'))

    const state = await buildDashboardState({ workspaceId: null, commandContext: commandContext() })
    expect(state.scores).toHaveLength(5)
    expect(state.growth).toHaveLength(7)
    expect(state.workspaceSummaries).toEqual([])
  })
})
