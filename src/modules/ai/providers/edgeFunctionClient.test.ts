import { describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const { functionsInvokeMock } = vi.hoisted(() => ({ functionsInvokeMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { functions: { invoke: functionsInvokeMock }, auth: { getSession: vi.fn() } } }))

import { invokeAiEmbed } from '@/modules/ai/providers/edgeFunctionClient'

/**
 * P1-3 (Edge Function diagnostic error-swallowing) — a real
 * `FunctionsHttpError` (thrown by `@supabase/functions-js` for any
 * non-2xx response) carries the raw `Response` on `.context`, not a
 * pre-parsed body. `jsonBody` fakes just enough of that `Response` shape
 * (`.json()`) for `invokeAiEmbed`'s own error extraction to read from —
 * same helper shape as workspaceMembers.test.ts's own `fakeHttpError`.
 */
function fakeHttpError(jsonBody: unknown | (() => Promise<unknown>)): FunctionsHttpError {
  const context = {
    json: () => (typeof jsonBody === 'function' ? (jsonBody as () => Promise<unknown>)() : Promise.resolve(jsonBody)),
  }
  return new FunctionsHttpError(context as unknown as Response)
}

describe('invokeAiEmbed', () => {
  it('invokes the ai-chat edge function with the embed action and returns the result on success', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: { embeddings: [[0.1, 0.2]], model: 'text-embedding-3-small', promptTokens: 12 },
      error: null,
    })

    const result = await invokeAiEmbed(['hello world'])

    expect(functionsInvokeMock).toHaveBeenCalledWith('ai-chat', { body: { action: 'embed', input: ['hello world'] } })
    expect(result).toEqual({ embeddings: [[0.1, 0.2]], model: 'text-embedding-3-small', promptTokens: 12 })
  })

  it('throws with the real backend error message extracted from a structured FunctionsHttpError body, instead of the generic SDK message — this is what feeds AI Health observability and OpenAIEmbeddingProvider logging', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError({ error: 'OpenAI embeddings error: 429 {"error":{"type":"rate_limit_exceeded"}}' }),
    })

    await expect(invokeAiEmbed(['hello'])).rejects.toThrow('OpenAI embeddings error: 429 {"error":{"type":"rate_limit_exceeded"}}')
  })

  it('surfaces a configuration failure with its real message', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError({ error: 'OPENAI_API_KEY is not configured' }),
    })

    await expect(invokeAiEmbed(['hello'])).rejects.toThrow('OPENAI_API_KEY is not configured')
  })

  it('the thrown error is still a FunctionsHttpError instance — downstream consumers (e.g. processDocument.ts isRateLimitError) rely on this to detect a rate limit', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError({ error: 'OpenAI embeddings error: 429 too many requests' }),
    })

    await expect(invokeAiEmbed(['hello'])).rejects.toBeInstanceOf(FunctionsHttpError)
  })

  it('falls back to the generic SDK message when the response body is not valid JSON', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError(() => Promise.reject(new Error('Unexpected token < in JSON'))),
    })

    await expect(invokeAiEmbed(['hello'])).rejects.toThrow('Edge Function returned a non-2xx status code')
  })

  it('falls back to the generic SDK message when the JSON body has no usable error field', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError({ status: 'failed' }),
    })

    await expect(invokeAiEmbed(['hello'])).rejects.toThrow('Edge Function returned a non-2xx status code')
  })

  it('still throws a usable error for a non-FunctionsHttpError rejection (e.g. a network failure)', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') })

    await expect(invokeAiEmbed(['hello'])).rejects.toThrow('Failed to fetch')
  })
})
