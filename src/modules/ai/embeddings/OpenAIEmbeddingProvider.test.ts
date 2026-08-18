import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const { invokeAiEmbedMock, logAiRequestMock } = vi.hoisted(() => ({
  invokeAiEmbedMock: vi.fn(),
  logAiRequestMock: vi.fn(),
}))
vi.mock('@/modules/ai/providers/edgeFunctionClient', () => ({ invokeAiEmbed: invokeAiEmbedMock }))
vi.mock('@/modules/ai/observability/api/aiRequests', () => ({ logAiRequest: logAiRequestMock }))

import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'

const context = { userId: 'user-1', workspaceId: 'workspace-1', feature: 'processing' }

describe('OpenAIEmbeddingProvider', () => {
  beforeEach(() => {
    invokeAiEmbedMock.mockReset()
    logAiRequestMock.mockReset()
  })

  it('logs success with the real model/token usage and returns the embeddings', async () => {
    invokeAiEmbedMock.mockResolvedValueOnce({ embeddings: [[0.1, 0.2]], model: 'text-embedding-3-small', promptTokens: 12 })

    const provider = new OpenAIEmbeddingProvider()
    const result = await provider.embed(['hello'], context)

    expect(result).toEqual([[0.1, 0.2]])
    expect(logAiRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', model: 'text-embedding-3-small', tokensInput: 12 }),
    )
  })

  // P1-3 (Edge Function diagnostic error-swallowing) — the exact bug this
  // module was flagged for: invokeAiEmbed's own fix (edgeFunctionClient.ts)
  // now extracts the real backend text from a FunctionsHttpError before it
  // ever reaches here, so this catch block's `err.message` read (unchanged
  // by this fix) picks up that real text instead of the generic
  // "Edge Function returned a non-2xx status code" — this is what feeds
  // ai_requests.error_message, which AI Health's normalizeAiError later
  // re-reads for categorization. A regression here would silently corrupt
  // that observability data again.
  it('logs the real backend error message (not the generic SDK wrapper) when the embed call fails, then rethrows', async () => {
    const err = new FunctionsHttpError({} as Response)
    err.message = 'OpenAI embeddings error: 429 {"error":{"type":"rate_limit_exceeded"}}'
    invokeAiEmbedMock.mockRejectedValueOnce(err)

    const provider = new OpenAIEmbeddingProvider()
    await expect(provider.embed(['hello'], context)).rejects.toThrow('OpenAI embeddings error: 429')

    expect(logAiRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        errorMessage: 'OpenAI embeddings error: 429 {"error":{"type":"rate_limit_exceeded"}}',
      }),
    )
  })

  it('does not log when no context is provided, but still rethrows', async () => {
    invokeAiEmbedMock.mockRejectedValueOnce(new Error('network down'))

    const provider = new OpenAIEmbeddingProvider()
    await expect(provider.embed(['hello'])).rejects.toThrow('network down')

    expect(logAiRequestMock).not.toHaveBeenCalled()
  })
})
