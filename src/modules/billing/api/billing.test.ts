import { describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { functions: { invoke: invokeMock } } }))

import { startProCheckout } from '@/modules/billing/api/billing'

/**
 * Regression: pesapal-checkout fails closed with a specific, useful
 * `{ error: string }` JSON body on every failure path (missing secrets ->
 * 501, Pesapal token/order failures -> 502, etc — see index.ts), but
 * supabase-js's FunctionsHttpError.message is always the same generic
 * "Edge Function returned a non-2xx status code" string regardless of what
 * the function actually said. Before this fix, that generic string was all
 * PricingPage's error UI ever showed a Free user clicking "Upgrade to Pro
 * (sandbox)" — the real reason (e.g. "Pesapal checkout is not configured
 * for this environment") was silently dropped.
 */
describe('startProCheckout', () => {
  it('surfaces the Edge Function response body\'s error message, not the generic FunctionsHttpError wrapper text', async () => {
    const context = new Response(JSON.stringify({ error: 'Pesapal checkout is not configured for this environment' }), { status: 501 })
    invokeMock.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(context) })

    await expect(startProCheckout()).rejects.toThrow('Pesapal checkout is not configured for this environment')
  })

  it('falls back to the generic FunctionsHttpError message if the response body is not valid JSON', async () => {
    const context = new Response('not json', { status: 500 })
    const httpError = new FunctionsHttpError(context)
    invokeMock.mockResolvedValueOnce({ data: null, error: httpError })

    await expect(startProCheckout()).rejects.toThrow(httpError.message)
  })

  it('rethrows a non-HTTP error (e.g. network failure) unchanged', async () => {
    const networkError = new Error('network unreachable')
    invokeMock.mockResolvedValueOnce({ data: null, error: networkError })

    await expect(startProCheckout()).rejects.toThrow('network unreachable')
  })

  it('resolves with the redirect URL and merchant reference on success', async () => {
    invokeMock.mockResolvedValueOnce({ data: { redirectUrl: 'https://cybqa.pesapal.com/redirect', merchantReference: 'pip-pro-abc' }, error: null })

    await expect(startProCheckout()).resolves.toEqual({ redirectUrl: 'https://cybqa.pesapal.com/redirect', merchantReference: 'pip-pro-abc' })
  })
})
