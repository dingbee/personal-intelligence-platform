import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeAiEmbedMock, rpcMock, fromMock } = vi.hoisted(() => ({
  invokeAiEmbedMock: vi.fn(async () => ({ embeddings: [[0.1, 0.2, 0.3]], model: 'text-embedding-3-small', promptTokens: 10 })),
  rpcMock: vi.fn(async () => ({ data: [] as { asset_id: string; similarity: number }[], error: null as unknown })),
  fromMock: vi.fn(),
}))

vi.mock('@/modules/ai/providers/edgeFunctionClient', () => ({ invokeAiEmbed: invokeAiEmbedMock }))
vi.mock('@/modules/ai/observability/api/aiRequests', () => ({ logAiRequest: vi.fn(async () => {}) }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock, from: fromMock } }))

import { retrieveAssetContext } from '@/modules/ai/orchestration/retrieveAssetContext'

function baseParams(overrides: Partial<Parameters<typeof retrieveAssetContext>[0]> = {}) {
  return { query: 'What is in the whiteboard photo?', userId: 'user-1', workspaceId: 'workspace-1', ...overrides }
}

describe('retrieveAssetContext', () => {
  beforeEach(() => {
    invokeAiEmbedMock.mockClear()
  })

  it('returns no matches when match_assets finds nothing, without a second query for asset rows', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })
    const result = await retrieveAssetContext(baseParams())
    expect(result).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('skips a matched asset that has no analysis yet — never fabricates content for an unanalyzed image', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ asset_id: 'asset-1', similarity: 0.8 }], error: null })
    fromMock.mockReturnValueOnce({
      select: () => ({ in: async () => ({ data: [{ id: 'asset-1', title: 'IMG_1', metadata: null }], error: null }) }),
    })
    const result = await retrieveAssetContext(baseParams())
    expect(result).toEqual([])
  })

  // PIP Sprint 9/10 — AIService now embeds the query once and shares it
  // across retrieveContext/retrieveAssetContext/retrieveNoteContext
  // instead of each independently re-embedding the same text.
  it('reuses a precomputed embedding instead of calling the embedding provider again when one is passed', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })
    await retrieveAssetContext(baseParams({ embedding: [0.9, 0.8, 0.7] }))
    expect(invokeAiEmbedMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledWith('match_assets', expect.objectContaining({ query_embedding: [0.9, 0.8, 0.7] }))
  })

  it('still embeds internally when no precomputed embedding is passed, unchanged from before', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })
    await retrieveAssetContext(baseParams())
    expect(invokeAiEmbedMock).toHaveBeenCalledTimes(1)
  })
})
