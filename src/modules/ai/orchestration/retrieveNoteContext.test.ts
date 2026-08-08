import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeAiEmbedMock, rpcMock, fromMock } = vi.hoisted(() => ({
  invokeAiEmbedMock: vi.fn(async () => ({ embeddings: [[0.1, 0.2, 0.3]], model: 'text-embedding-3-small', promptTokens: 10 })),
  rpcMock: vi.fn(async () => ({ data: [] as { note_id: string; title: string; content: string; similarity: number }[] | null, error: null as unknown })),
  fromMock: vi.fn(),
}))

vi.mock('@/modules/ai/providers/edgeFunctionClient', () => ({ invokeAiEmbed: invokeAiEmbedMock }))
vi.mock('@/modules/ai/observability/api/aiRequests', () => ({ logAiRequest: vi.fn(async () => {}) }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock, from: fromMock } }))

import { retrieveNoteContext } from '@/modules/ai/orchestration/retrieveNoteContext'

function baseParams(overrides: Partial<Parameters<typeof retrieveNoteContext>[0]> = {}) {
  return { query: 'What does the article say about ARRIYIA?', userId: 'user-1', workspaceId: 'workspace-1', ...overrides }
}

function lexicalQueryChain(result: { data: { id: string; title: string; content: string }[]; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    eq: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  }
  return chain
}

/**
 * PIP Sprint 7/10 — the discovery sprint's central finding: notes have had
 * full hybrid semantic+lexical search (Universal Search's
 * notesSearchProvider) for two sprints, but chat's own retrieval path
 * never queried them at all. These tests pin the hybrid contract at the
 * retrieval-function boundary, same discipline retrieveContext.test.ts
 * (Sprint 4) established for the analogous document gap.
 */
describe('retrieveNoteContext — hybrid semantic + lexical', () => {
  // PIP Sprint 9/10 — the embedding-reuse tests below assert on
  // invokeAiEmbedMock's call count; every other test in this file also
  // triggers an internal embed call, so clear between tests.
  beforeEach(() => {
    invokeAiEmbedMock.mockClear()
  })

  it('returns semantic matches unchanged when the query has no entity-like terms to search lexically', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ note_id: 'n1', title: 'Meeting Notes', content: 'general passage', similarity: 0.5 }], error: null })
    const result = await retrieveNoteContext(baseParams({ query: 'what is the summary here' }))
    expect(result).toEqual([{ noteId: 'n1', title: 'Meeting Notes', content: 'general passage', similarity: 0.5 }])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('boosts a note found both semantically and lexically', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ note_id: 'n1', title: 'Project Notes', content: 'Mentions ARRIYIA once.', similarity: 0.4 }], error: null })
    fromMock.mockReturnValueOnce(lexicalQueryChain({ data: [{ id: 'n1', title: 'Project Notes', content: 'Mentions ARRIYIA once.' }], error: null }))

    const result = await retrieveNoteContext(baseParams())
    expect(result).toHaveLength(1)
    expect(result[0]!.similarity).toBeGreaterThan(0.4)
  })

  it('includes a note found ONLY lexically — a rare term the embedding model missed entirely', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ note_id: 'unrelated', title: 'Other', content: 'Something else entirely.', similarity: 0.6 }], error: null })
    fromMock.mockReturnValueOnce(lexicalQueryChain({ data: [{ id: 'n-arriyia', title: 'Article Thoughts', content: 'ARRIYIA was discussed here.' }], error: null }))

    const result = await retrieveNoteContext(baseParams())
    const arriyiaMatch = result.find((m) => m.noteId === 'n-arriyia')
    expect(arriyiaMatch).toBeDefined()
    expect(arriyiaMatch!.content).toBe('ARRIYIA was discussed here.')
  })

  it('never surfaces the same note twice when it matches both semantically and lexically', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ note_id: 'n1', title: 'Notes', content: 'ARRIYIA content.', similarity: 0.5 }], error: null })
    fromMock.mockReturnValueOnce(lexicalQueryChain({ data: [{ id: 'n1', title: 'Notes', content: 'ARRIYIA content.' }], error: null }))

    const result = await retrieveNoteContext(baseParams())
    expect(result).toHaveLength(1)
  })

  it('falls back gracefully to semantic-only results when the lexical search itself fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ note_id: 'n1', title: 'Notes', content: 'ARRIYIA content.', similarity: 0.5 }], error: null })
    fromMock.mockImplementationOnce(() => {
      throw new Error('db error')
    })

    const result = await retrieveNoteContext(baseParams())
    expect(result).toEqual([{ noteId: 'n1', title: 'Notes', content: 'ARRIYIA content.', similarity: 0.5 }])
  })

  it('labels an untitled note honestly rather than leaving an empty title', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ note_id: 'n1', title: '', content: 'Some content.', similarity: 0.5 }], error: null })
    const result = await retrieveNoteContext(baseParams({ query: 'what is the summary here' }))
    expect(result[0]!.title).toBe('Untitled note')
  })

  it('throws when the semantic RPC itself errors — the never-throws contract lives at the call site, matching retrieveAssetContext', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('rpc failed') })
    await expect(retrieveNoteContext(baseParams())).rejects.toThrow()
  })

  // PIP Sprint 9/10 — AIService now embeds the query once and shares it
  // across retrieveContext/retrieveAssetContext/retrieveNoteContext
  // instead of each independently re-embedding the same text.
  it('reuses a precomputed embedding instead of calling the embedding provider again when one is passed', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })
    await retrieveNoteContext(baseParams({ query: 'what is the summary here', embedding: [0.9, 0.8, 0.7] }))
    expect(invokeAiEmbedMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledWith(
      'match_notes',
      expect.objectContaining({ query_embedding: [0.9, 0.8, 0.7] }),
    )
  })

  it('still embeds internally when no precomputed embedding is passed, unchanged from before', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })
    await retrieveNoteContext(baseParams({ query: 'what is the summary here' }))
    expect(invokeAiEmbedMock).toHaveBeenCalledTimes(1)
  })
})
