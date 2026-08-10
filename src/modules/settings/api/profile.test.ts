import { beforeEach, describe, expect, it, vi } from 'vitest'

function makeQuery(result: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = []
  const promise = Promise.resolve(result) as Promise<typeof result> & Record<string, (...args: unknown[]) => unknown> & { calls: typeof calls }
  const methods = ['select', 'eq', 'update', 'single']
  for (const method of methods) {
    ;(promise as Record<string, unknown>)[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return promise
    }
  }
  promise.calls = calls
  return promise
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { getProfile, updateDefaultChatProvider, updateProfile } from '@/modules/settings/api/profile'

describe('getProfile', () => {
  beforeEach(() => fromMock.mockClear())

  it('looks up the profile by user id', async () => {
    const query = makeQuery({ data: { id: 'user-1', display_name: 'Ada' }, error: null })
    fromMock.mockReturnValueOnce(query)

    const profile = await getProfile('user-1')

    expect(query.calls).toContainEqual({ method: 'eq', args: ['id', 'user-1'] })
    expect(profile).toEqual({ id: 'user-1', display_name: 'Ada' })
  })

  it('throws the underlying Supabase error rather than returning undefined', async () => {
    const query = makeQuery({ data: null, error: new Error('row not found') })
    fromMock.mockReturnValueOnce(query)
    await expect(getProfile('missing-user')).rejects.toThrow('row not found')
  })
})

describe('updateProfile', () => {
  beforeEach(() => fromMock.mockClear())

  it('persists the display name scoped to the exact user id, and no other field', async () => {
    const query = makeQuery({ data: { id: 'user-1', display_name: 'Grace' }, error: null })
    fromMock.mockReturnValueOnce(query)

    const profile = await updateProfile('user-1', 'Grace')

    expect(query.calls).toContainEqual({ method: 'update', args: [{ display_name: 'Grace' }] })
    expect(query.calls).toContainEqual({ method: 'eq', args: ['id', 'user-1'] })
    expect(profile.display_name).toBe('Grace')
  })

  it('throws on a failed persistence rather than silently discarding the change', async () => {
    const query = makeQuery({ data: null, error: new Error('permission denied') })
    fromMock.mockReturnValueOnce(query)
    await expect(updateProfile('user-1', 'Grace')).rejects.toThrow('permission denied')
  })
})

describe('updateDefaultChatProvider', () => {
  beforeEach(() => fromMock.mockClear())

  it('persists a chosen provider override', async () => {
    const query = makeQuery({ data: { id: 'user-1', default_chat_provider_id: 'anthropic' }, error: null })
    fromMock.mockReturnValueOnce(query)

    await updateDefaultChatProvider('user-1', 'anthropic')

    expect(query.calls).toContainEqual({ method: 'update', args: [{ default_chat_provider_id: 'anthropic' }] })
  })

  it('clears the override back to the platform default when given null', async () => {
    const query = makeQuery({ data: { id: 'user-1', default_chat_provider_id: null }, error: null })
    fromMock.mockReturnValueOnce(query)

    const profile = await updateDefaultChatProvider('user-1', null)

    expect(query.calls).toContainEqual({ method: 'update', args: [{ default_chat_provider_id: null }] })
    expect(profile.default_chat_provider_id).toBeNull()
  })
})
