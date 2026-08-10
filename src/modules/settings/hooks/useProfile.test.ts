import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

const { getProfileMock, updateProfileMock, updateDefaultChatProviderMock } = vi.hoisted(() => ({
  getProfileMock: vi.fn(),
  updateProfileMock: vi.fn(),
  updateDefaultChatProviderMock: vi.fn(),
}))

vi.mock('@/modules/settings/api/profile', () => ({
  getProfile: getProfileMock,
  updateProfile: updateProfileMock,
  updateDefaultChatProvider: updateDefaultChatProviderMock,
}))
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))

import { useProfile } from '@/modules/settings/hooks/useProfile'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useProfile', () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    updateProfileMock.mockReset()
    updateDefaultChatProviderMock.mockReset()
  })

  it('loads the current user\'s profile', async () => {
    getProfileMock.mockResolvedValueOnce({ id: 'user-1', display_name: 'Ada' })
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getProfileMock).toHaveBeenCalledWith('user-1')
    expect(result.current.data?.display_name).toBe('Ada')
  })

  it('re-fetches the profile after a display name update succeeds, so the UI reflects the persisted value', async () => {
    getProfileMock.mockResolvedValueOnce({ id: 'user-1', display_name: 'Old Name' })
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    updateProfileMock.mockResolvedValueOnce({ id: 'user-1', display_name: 'New Name' })
    getProfileMock.mockResolvedValueOnce({ id: 'user-1', display_name: 'New Name' })

    result.current.updateDisplayName.mutate('New Name')

    await waitFor(() => expect(result.current.updateDisplayName.isSuccess).toBe(true))
    expect(updateProfileMock).toHaveBeenCalledWith('user-1', 'New Name')
    await waitFor(() => expect(getProfileMock).toHaveBeenCalledTimes(2))
  })

  it('does not invalidate the profile query when the display name update fails', async () => {
    getProfileMock.mockResolvedValueOnce({ id: 'user-1', display_name: 'Old Name' })
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    updateProfileMock.mockRejectedValueOnce(new Error('network error'))
    result.current.updateDisplayName.mutate('New Name')

    await waitFor(() => expect(result.current.updateDisplayName.isError).toBe(true))
    expect(getProfileMock).toHaveBeenCalledTimes(1)
  })

  it('persists a default provider change scoped to the current user', async () => {
    getProfileMock.mockResolvedValueOnce({ id: 'user-1', display_name: null })
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    updateDefaultChatProviderMock.mockResolvedValueOnce({ id: 'user-1', default_chat_provider_id: 'anthropic' })
    result.current.updateDefaultProvider.mutate('anthropic')

    await waitFor(() => expect(result.current.updateDefaultProvider.isSuccess).toBe(true))
    expect(updateDefaultChatProviderMock).toHaveBeenCalledWith('user-1', 'anthropic')
  })
})
