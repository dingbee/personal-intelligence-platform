import { describe, expect, it, vi } from 'vitest'

const { retrieveContextMock, retrieveNoteContextMock, fetchTitlesByIdsMock } = vi.hoisted(() => ({
  retrieveContextMock: vi.fn(),
  retrieveNoteContextMock: vi.fn(),
  fetchTitlesByIdsMock: vi.fn(),
}))

vi.mock('@/modules/ai/orchestration/retrieveContext', () => ({ retrieveContext: retrieveContextMock }))
vi.mock('@/modules/ai/orchestration/retrieveNoteContext', () => ({ retrieveNoteContext: retrieveNoteContextMock }))
vi.mock('@/modules/knowledge-intelligence/api/sourceResolution', () => ({ fetchTitlesByIds: fetchTitlesByIdsMock }))

import { gatherEvidence } from '@/modules/research-intelligence/gatherEvidence'

describe('gatherEvidence', () => {
  it('combines real document and note retrieval results into ResearchEvidence, never inventing a source', async () => {
    retrieveContextMock.mockResolvedValue([{ chunkId: 'chunk-1', documentId: 'doc-1', content: 'Returns must be processed within 30 days.', similarity: 0.91 }])
    retrieveNoteContextMock.mockResolvedValue([{ noteId: 'note-1', title: 'Ops notes', content: 'South region flagged.', similarity: 0.7 }])
    fetchTitlesByIdsMock.mockResolvedValue([{ id: 'doc-1', title: 'Returns Policy' }])

    const evidence = await gatherEvidence({ query: 'return policy', userId: 'user-1', workspaceId: 'workspace-1' })

    expect(evidence).toHaveLength(2)
    expect(evidence[0]).toEqual({ id: 'chunk-1', source: { type: 'document', id: 'doc-1', title: 'Returns Policy' }, excerpt: 'Returns must be processed within 30 days.', similarity: 0.91 })
    expect(evidence[1]).toEqual({ id: 'note-1', source: { type: 'note', id: 'note-1', title: 'Ops notes' }, excerpt: 'South region flagged.', similarity: 0.7 })
  })

  it('returns an empty array when nothing relevant is found — never fabricates a placeholder source', async () => {
    retrieveContextMock.mockResolvedValue([])
    retrieveNoteContextMock.mockResolvedValue([])
    fetchTitlesByIdsMock.mockResolvedValue([])

    expect(await gatherEvidence({ query: 'nonexistent topic', userId: 'user-1', workspaceId: null })).toEqual([])
  })

  it('falls back to a generic title when a document title cannot be resolved', async () => {
    retrieveContextMock.mockResolvedValue([{ chunkId: 'chunk-1', documentId: 'doc-deleted', content: 'x', similarity: 0.5 }])
    retrieveNoteContextMock.mockResolvedValue([])
    fetchTitlesByIdsMock.mockResolvedValue([])

    const evidence = await gatherEvidence({ query: 'q', userId: 'user-1', workspaceId: null })
    expect(evidence[0]!.source.title).toBe('Untitled document')
  })

  it('sorts by similarity and caps at 6 items total', async () => {
    retrieveContextMock.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ chunkId: `c${i}`, documentId: 'doc-1', content: 'x', similarity: i / 10 })))
    retrieveNoteContextMock.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ noteId: `n${i}`, title: 't', content: 'y', similarity: (i + 5) / 10 })))
    fetchTitlesByIdsMock.mockResolvedValue([{ id: 'doc-1', title: 'Doc' }])

    const evidence = await gatherEvidence({ query: 'q', userId: 'user-1', workspaceId: null })
    expect(evidence).toHaveLength(6)
    expect(evidence[0]!.similarity).toBe(0.9)
    expect(evidence.every((e, i) => i === 0 || e.similarity! <= evidence[i - 1]!.similarity!)).toBe(true)
  })

  it('truncates a very long excerpt rather than sending it verbatim in full', async () => {
    retrieveContextMock.mockResolvedValue([{ chunkId: 'c1', documentId: 'doc-1', content: 'x'.repeat(1000), similarity: 0.5 }])
    retrieveNoteContextMock.mockResolvedValue([])
    fetchTitlesByIdsMock.mockResolvedValue([{ id: 'doc-1', title: 'Doc' }])

    const evidence = await gatherEvidence({ query: 'q', userId: 'user-1', workspaceId: null })
    expect(evidence[0]!.excerpt.length).toBeLessThan(700)
    expect(evidence[0]!.excerpt.endsWith('…')).toBe(true)
  })

  it('passes documentId through to retrieveContext for document-scoped research', async () => {
    retrieveContextMock.mockResolvedValue([])
    retrieveNoteContextMock.mockResolvedValue([])
    await gatherEvidence({ query: 'q', userId: 'user-1', workspaceId: 'workspace-1', documentId: 'doc-42' })
    expect(retrieveContextMock).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-42' }))
  })
})
