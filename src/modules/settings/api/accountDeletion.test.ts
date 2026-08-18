import { describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const { functionsInvokeMock } = vi.hoisted(() => ({ functionsInvokeMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { functions: { invoke: functionsInvokeMock } } }))

import { deleteMyAccount } from '@/modules/settings/api/accountDeletion'

/**
 * P1-3 — a real `FunctionsHttpError` (thrown by `@supabase/functions-js`
 * for any non-2xx response) carries the raw `Response` on `.context`, not
 * a pre-parsed body. `jsonBody` fakes just enough of that `Response` shape
 * (`.json()`) for `deleteMyAccount`'s own error extraction to read from,
 * without needing a real fetch Response in this test environment — same
 * helper shape as workspaceMembers.test.ts's own `fakeHttpError`.
 */
function fakeHttpError(jsonBody: unknown | (() => Promise<unknown>)): FunctionsHttpError {
  const context = {
    json: () => (typeof jsonBody === 'function' ? (jsonBody as () => Promise<unknown>)() : Promise.resolve(jsonBody)),
  }
  return new FunctionsHttpError(context as unknown as Response)
}

describe('deleteMyAccount', () => {
  it('invokes the delete-account edge function with no body — self-service only, no target id to pass', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: { deleted: true }, error: null })

    const result = await deleteMyAccount()

    expect(functionsInvokeMock).toHaveBeenCalledWith('delete-account')
    expect(result).toEqual({ error: null })
  })

  it('reads the real diagnostic reason out of a structured FunctionsHttpError response body, instead of the generic SDK message', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError({
        error:
          'Platform admin accounts cannot be deleted through self-service account deletion. Contact another administrator to revoke admin status first.',
      }),
    })

    const result = await deleteMyAccount()

    expect(result.error).toMatch(/admin accounts cannot be deleted/)
  })

  it('surfaces a Storage cleanup failure the same way', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError({ error: 'Failed to remove documents storage objects: network error' }),
    })

    const result = await deleteMyAccount()

    expect(result).toEqual({ error: 'Failed to remove documents storage objects: network error' })
  })

  it('falls back to the generic SDK message when the response body is not valid JSON', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError(() => Promise.reject(new Error('Unexpected token < in JSON'))),
    })

    const result = await deleteMyAccount()

    expect(result).toEqual({ error: 'Edge Function returned a non-2xx status code' })
  })

  it('falls back to the generic SDK message when the JSON body has no usable error field', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: fakeHttpError({ status: 'failed' }),
    })

    const result = await deleteMyAccount()

    expect(result).toEqual({ error: 'Edge Function returned a non-2xx status code' })
  })

  it('still returns a message for a non-FunctionsHttpError rejection (e.g. a network failure)', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') })

    const result = await deleteMyAccount()

    expect(result).toEqual({ error: 'Failed to fetch' })
  })
})
