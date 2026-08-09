import { describe, expect, it, vi } from 'vitest'

const { functionsInvokeMock } = vi.hoisted(() => ({ functionsInvokeMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { functions: { invoke: functionsInvokeMock } } }))

import { deleteMyAccount } from '@/modules/settings/api/accountDeletion'

describe('deleteMyAccount', () => {
  it('invokes the delete-account edge function with no body — self-service only, no target id to pass', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: { deleted: true }, error: null })

    const result = await deleteMyAccount()

    expect(functionsInvokeMock).toHaveBeenCalledWith('delete-account')
    expect(result).toEqual({ error: null })
  })

  it('returns the error message rather than throwing when the edge function rejects the request', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: null,
      error: new Error('Platform admin accounts cannot be deleted through self-service account deletion. Contact another administrator to revoke admin status first.'),
    })

    const result = await deleteMyAccount()

    expect(result.error).toMatch(/admin accounts cannot be deleted/)
  })

  it('surfaces a Storage cleanup failure as an error rather than throwing', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('Failed to remove documents storage objects: network error') })

    const result = await deleteMyAccount()

    expect(result).toEqual({ error: 'Failed to remove documents storage objects: network error' })
  })
})
