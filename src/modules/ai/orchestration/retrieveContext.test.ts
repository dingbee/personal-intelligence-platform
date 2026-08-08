import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeAiEmbedMock, vectorStoreQueryMock, lexicalSearchMock } = vi.hoisted(() => ({
  invokeAiEmbedMock: vi.fn(async () => ({ embeddings: [[0.1, 0.2, 0.3]], model: 'text-embedding-3-small', promptTokens: 10 })),
  vectorStoreQueryMock: vi.fn(async () => [] as { chunkId: string; documentId: string; content: string; similarity: number }[]),
  lexicalSearchMock: vi.fn(async () => [] as { chunkId: string; documentId: string; content: string }[]),
}))

vi.mock('@/modules/ai/providers/edgeFunctionClient', () => ({ invokeAiEmbed: invokeAiEmbedMock }))
vi.mock('@/modules/ai/observability/api/aiRequests', () => ({ logAiRequest: vi.fn(async () => {}) }))
vi.mock('@/modules/ai/retrieval/SupabaseVectorStore', () => ({ supabaseVectorStore: { query: vectorStoreQueryMock } }))
vi.mock('@/modules/ai/orchestration/lexicalChunkSearch', () => ({ searchChunksByLexicalTerms: lexicalSearchMock }))

import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'

function baseParams(overrides: Partial<Parameters<typeof retrieveContext>[0]> = {}) {
  return { query: 'What has been mentioned about ARRIYIA in this article?', userId: 'user-1', workspaceId: 'workspace-1', ...overrides }
}

/**
 * PIP Sprint 4/10 — the ARRIYIA failure's root cause: retrieveContext was
 * pure vector similarity with no lexical fallback, so a rare proper noun
 * mentioned once in a long document could be entirely absent from the
 * top-K semantic matches. These tests pin the hybrid contract at the
 * retrieval-function boundary (not an LLM's wording) per Phase 8's own
 * instruction.
 */
describe('retrieveContext — hybrid semantic + lexical', () => {
  // PIP Sprint 9/10 — the two "embeds internally"/"reuses a precomputed
  // embedding" tests below assert on invokeAiEmbedMock's call count; every
  // other test in this file also triggers an internal embed call, so
  // without clearing between tests those counts would leak across them.
  beforeEach(() => {
    invokeAiEmbedMock.mockClear()
  })

  it('returns semantic matches unchanged when the query has no entity-like terms to search lexically', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'd1', content: 'general passage', similarity: 0.5 }])
    const result = await retrieveContext(baseParams({ query: 'what is the summary here' }))
    expect(result).toEqual([{ chunkId: 'c1', documentId: 'd1', content: 'general passage', similarity: 0.5 }])
    expect(lexicalSearchMock).not.toHaveBeenCalled()
  })

  it('boosts a chunk found both semantically and lexically', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'd1', content: 'Mentions ARRIYIA once.', similarity: 0.4 }])
    lexicalSearchMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'd1', content: 'Mentions ARRIYIA once.' }])

    const result = await retrieveContext(baseParams())
    expect(result).toHaveLength(1)
    expect(result[0]!.similarity).toBeGreaterThan(0.4)
  })

  it('includes a chunk found ONLY lexically — the ARRIYIA case: a rare term the embedding model missed entirely', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([{ chunkId: 'unrelated', documentId: 'd1', content: 'Something else entirely.', similarity: 0.6 }])
    lexicalSearchMock.mockResolvedValueOnce([{ chunkId: 'c-arriyia', documentId: 'd1', content: 'ARRIYIA was discussed in the third section.' }])

    const result = await retrieveContext(baseParams())
    const arriyiaMatch = result.find((m) => m.chunkId === 'c-arriyia')
    expect(arriyiaMatch).toBeDefined()
    expect(arriyiaMatch?.content).toContain('ARRIYIA')
    // A lexical-only match must never silently outrank a genuine semantic
    // hit — it supplements, it doesn't compete.
    expect(arriyiaMatch!.similarity).toBeLessThan(0.6)
  })

  it('extracts and searches for the literal ALL-CAPS entity in a full question', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([])
    lexicalSearchMock.mockResolvedValueOnce([])
    await retrieveContext(baseParams({ query: 'What has been mentioned about ARRIYIA in this article?' }))
    expect(lexicalSearchMock).toHaveBeenCalledWith(['ARRIYIA'], expect.anything())
  })

  it('never throws when the lexical search fails — falls back to semantic-only results', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'd1', content: 'passage', similarity: 0.7 }])
    lexicalSearchMock.mockRejectedValueOnce(new Error('db error'))
    const result = await retrieveContext(baseParams())
    expect(result).toEqual([{ chunkId: 'c1', documentId: 'd1', content: 'passage', similarity: 0.7 }])
  })

  it('scopes the semantic query to a single document, omitting workspaceId, when documentId is given', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([])
    await retrieveContext(baseParams({ documentId: 'doc-42', query: 'plain question' }))
    expect(vectorStoreQueryMock).toHaveBeenCalledWith(expect.anything(), { documentId: 'doc-42', workspaceId: undefined, matchCount: 8 })
  })

  // PIP Sprint 9/10 — AIService now embeds the query once and shares it
  // across retrieveContext/retrieveAssetContext/retrieveNoteContext
  // instead of each independently re-embedding the same text.
  it('reuses a precomputed embedding instead of calling the embedding provider again when one is passed', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([])
    await retrieveContext(baseParams({ query: 'plain question', embedding: [0.9, 0.8, 0.7] }))
    expect(invokeAiEmbedMock).not.toHaveBeenCalled()
    expect(vectorStoreQueryMock).toHaveBeenCalledWith([0.9, 0.8, 0.7], expect.anything())
  })

  it('still embeds internally when no precomputed embedding is passed, unchanged from before', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([])
    await retrieveContext(baseParams({ query: 'plain question' }))
    expect(invokeAiEmbedMock).toHaveBeenCalledTimes(1)
  })
})
