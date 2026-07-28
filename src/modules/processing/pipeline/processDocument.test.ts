import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { DocumentChunk } from '@/shared/types/database'

const embedMock = vi.fn()
const upsertMock = vi.fn()

// processDocument.ts transitively imports the real Supabase client (via the
// library/processing api modules) purely for its module-level side effects
// on import — these tests exercise only the in-memory retry logic and never
// call through to Supabase, so a stub avoids requiring real env vars.
vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }))

vi.mock('@/modules/ai/embeddings/OpenAIEmbeddingProvider', () => ({
  OpenAIEmbeddingProvider: class {
    modelName = 'text-embedding-3-small'
    embed = embedMock
  },
}))

vi.mock('@/modules/ai/retrieval/SupabaseVectorStore', () => ({
  supabaseVectorStore: { upsert: upsertMock, query: vi.fn() },
}))

const { embedBatchWithRetry, isRateLimitError } = await import('@/modules/processing/pipeline/processDocument')

function rateLimitError(): FunctionsHttpError {
  return new FunctionsHttpError({
    json: async () => ({ error: 'OpenAI embeddings error: 429 {"error":{"type":"rate_limit_exceeded"}}' }),
  } as Response)
}

function makeChunk(id: string, content: string): DocumentChunk {
  return {
    id,
    document_id: 'doc-1',
    user_id: 'user-1',
    workspace_id: null,
    chunk_index: 0,
    content,
    char_start: 0,
    char_end: content.length,
    token_count: 10,
    chapter_index: null,
    chapter_title: null,
    created_at: new Date().toISOString(),
  }
}

describe('isRateLimitError', () => {
  it('detects a 429 embedded in the ai-chat error body', async () => {
    await expect(isRateLimitError(rateLimitError())).resolves.toBe(true)
  })

  it('returns false for a non-429 FunctionsHttpError', async () => {
    const err = new FunctionsHttpError({
      json: async () => ({ error: 'OpenAI embeddings error: 400 bad request' }),
    } as Response)
    await expect(isRateLimitError(err)).resolves.toBe(false)
  })

  it('returns false for a plain error', async () => {
    await expect(isRateLimitError(new Error('network down'))).resolves.toBe(false)
  })
})

describe('embedBatchWithRetry', () => {
  beforeEach(() => {
    embedMock.mockReset()
    upsertMock.mockReset()
    vi.useRealTimers()
  })

  it('retries a rate-limited batch and succeeds without duplicate writes', async () => {
    vi.useFakeTimers()
    const batch = [makeChunk('chunk-1', 'hello'), makeChunk('chunk-2', 'world')]

    embedMock
      .mockRejectedValueOnce(rateLimitError())
      .mockRejectedValueOnce(rateLimitError())
      .mockResolvedValueOnce([
        [0.1, 0.2],
        [0.3, 0.4],
      ])

    const promise = embedBatchWithRetry(batch, { userId: 'user-1', workspaceId: null })
    await vi.runAllTimersAsync()
    await promise

    expect(embedMock).toHaveBeenCalledTimes(3)
    // Only the final, successful attempt writes embeddings — failed
    // attempts never reach upsert, so retrying can't create duplicates.
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock).toHaveBeenCalledWith([
      { chunkId: 'chunk-1', embedding: [0.1, 0.2], model: 'text-embedding-3-small' },
      { chunkId: 'chunk-2', embedding: [0.3, 0.4], model: 'text-embedding-3-small' },
    ])
  })

  it('does not retry a non-rate-limit failure', async () => {
    const batch = [makeChunk('chunk-1', 'hello')]
    embedMock.mockRejectedValueOnce(new Error('OPENAI_API_KEY is not configured'))

    await expect(embedBatchWithRetry(batch, { userId: 'user-1', workspaceId: null })).rejects.toThrow(
      'OPENAI_API_KEY is not configured',
    )
    expect(embedMock).toHaveBeenCalledTimes(1)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('gives up after the max retry budget and preserves prior progress (caller-level)', async () => {
    vi.useFakeTimers()
    const batch = [makeChunk('chunk-1', 'hello')]
    embedMock.mockRejectedValue(rateLimitError())

    const promise = embedBatchWithRetry(batch, { userId: 'user-1', workspaceId: null })
    const assertion = expect(promise).rejects.toThrow(/rate-limited after 5 retries/)
    await vi.runAllTimersAsync()
    await assertion

    // 1 initial attempt + 5 retries = 6 total calls, then it gives up.
    expect(embedMock).toHaveBeenCalledTimes(6)
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
