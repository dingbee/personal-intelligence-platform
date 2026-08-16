import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

const { listNotificationsMock, markNotificationReadMock, markAllNotificationsReadMock, useAuthMock } = vi.hoisted(() => ({
  listNotificationsMock: vi.fn(),
  markNotificationReadMock: vi.fn(),
  markAllNotificationsReadMock: vi.fn(),
  useAuthMock: vi.fn((): { user: { id: string } | null } => ({ user: { id: 'user-1' } })),
}))

vi.mock('@/modules/notifications/api/notifications', () => ({
  listNotifications: listNotificationsMock,
  markNotificationRead: markNotificationReadMock,
  markAllNotificationsRead: markAllNotificationsReadMock,
}))
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))

import { useNotifications } from '@/modules/notifications/hooks/useNotifications'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

function notification(overrides: Partial<{ id: string; read_at: string | null }> = {}) {
  return {
    id: 'notif-1',
    recipient_user_id: 'user-1',
    type: 'collaboration_invitation',
    payload: {},
    created_at: '2026-01-01T00:00:00.000Z',
    read_at: null,
    ...overrides,
  }
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('starts loading, then resolves with the fetched notifications', async () => {
    listNotificationsMock.mockResolvedValueOnce([notification()])

    const { result } = renderHook(() => useNotifications(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(1)
  })

  it('derives unread count from read_at being null, not a stored field', async () => {
    listNotificationsMock.mockResolvedValueOnce([
      notification({ id: 'notif-1', read_at: null }),
      notification({ id: 'notif-2', read_at: '2026-01-01T00:00:00.000Z' }),
      notification({ id: 'notif-3', read_at: null }),
    ])

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.unreadCount).toBe(2)
  })

  it('reports zero unread and an empty list when there are no notifications', async () => {
    listNotificationsMock.mockResolvedValueOnce([])

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.unreadCount).toBe(0)
    expect(result.current.data).toEqual([])
  })

  it('surfaces a fetch error', async () => {
    listNotificationsMock.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('markRead calls the API with the notification id and refetches', async () => {
    listNotificationsMock.mockResolvedValueOnce([notification()])
    markNotificationReadMock.mockResolvedValueOnce(undefined)
    listNotificationsMock.mockResolvedValueOnce([notification({ read_at: '2026-01-01T00:00:00.000Z' })])

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    result.current.markRead.mutate('notif-1')
    await waitFor(() => expect(result.current.markRead.isSuccess).toBe(true))

    expect(markNotificationReadMock).toHaveBeenCalledWith('notif-1')
    await waitFor(() => expect(result.current.unreadCount).toBe(0))
  })

  it('markAllRead calls the API with no arguments', async () => {
    listNotificationsMock.mockResolvedValueOnce([notification()])
    markAllNotificationsReadMock.mockResolvedValueOnce(undefined)
    listNotificationsMock.mockResolvedValueOnce([notification({ read_at: '2026-01-01T00:00:00.000Z' })])

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    result.current.markAllRead.mutate()
    await waitFor(() => expect(result.current.markAllRead.isSuccess).toBe(true))

    expect(markAllNotificationsReadMock).toHaveBeenCalledWith()
  })

  it('does not fetch when there is no authenticated user', async () => {
    useAuthMock.mockReturnValue({ user: null })

    const { result } = renderHook(() => useNotifications(), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(listNotificationsMock).not.toHaveBeenCalled()
  })

  it('fetches once a user becomes authenticated (auth transition)', async () => {
    useAuthMock.mockReturnValue({ user: null })
    listNotificationsMock.mockResolvedValueOnce([notification()])

    const { result, rerender } = renderHook(() => useNotifications(), { wrapper })
    expect(listNotificationsMock).not.toHaveBeenCalled()

    useAuthMock.mockReturnValue({ user: { id: 'user-1' } })
    rerender()

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(listNotificationsMock).toHaveBeenCalled()
    expect(result.current.data).toHaveLength(1)
  })

  it('refetch recovers from a transient query failure', async () => {
    listNotificationsMock.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))

    listNotificationsMock.mockResolvedValueOnce([notification()])
    await result.current.refetch()

    await waitFor(() => expect(result.current.isError).toBe(false))
    expect(result.current.data).toHaveLength(1)
  })
})
