import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { useNotificationsMock, navigateMock } = vi.hoisted(() => ({
  useNotificationsMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('@/modules/notifications/hooks/useNotifications', () => ({ useNotifications: useNotificationsMock }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

import { NotificationBell } from '@/modules/notifications/components/NotificationBell'

function renderBell() {
  return render(createElement(MemoryRouter, null, createElement(NotificationBell)))
}

function notification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'notif-1',
    recipient_user_id: 'user-1',
    type: 'collaboration_invitation',
    payload: { workspace_id: 'ws-1', workspace_name: 'Research Workspace', inviter_user_id: 'user-2', inviter_name: 'Ding' },
    created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    read_at: null,
    ...overrides,
  }
}

const markReadMutate = vi.fn()

afterEach(cleanup)

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows no unread badge and an empty state when there are no notifications', () => {
    useNotificationsMock.mockReturnValue({ data: [], isLoading: false, unreadCount: 0, markRead: { mutate: markReadMutate } })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.queryByText(/^\d+$/)).toBeNull()
    expect(screen.getByText('No notifications yet.')).not.toBeNull()
  })

  it('shows an unread count badge when there are unread notifications', () => {
    useNotificationsMock.mockReturnValue({
      data: [notification(), notification({ id: 'notif-2' })],
      isLoading: false,
      unreadCount: 2,
      markRead: { mutate: markReadMutate },
    })

    renderBell()

    expect(screen.getByText('2')).not.toBeNull()
  })

  it('caps the badge at 9+ for large unread counts', () => {
    useNotificationsMock.mockReturnValue({ data: [], isLoading: false, unreadCount: 12, markRead: { mutate: markReadMutate } })

    renderBell()

    expect(screen.getByText('9+')).not.toBeNull()
  })

  it('shows a spinner while loading', () => {
    useNotificationsMock.mockReturnValue({ data: undefined, isLoading: true, unreadCount: 0, markRead: { mutate: markReadMutate } })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByRole('status')).not.toBeNull()
  })

  it('renders a Collaboration notification with its message and relative time, distinguished as unread', () => {
    useNotificationsMock.mockReturnValue({
      data: [notification()],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Ding invited you to join Research Workspace')).not.toBeNull()
    expect(screen.getByText(/ago|just now/)).not.toBeNull()
  })

  it('clicking an unread notification marks it read and navigates to /settings/workspaces', () => {
    useNotificationsMock.mockReturnValue({
      data: [notification()],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    fireEvent.click(screen.getByText('Ding invited you to join Research Workspace'))

    expect(markReadMutate).toHaveBeenCalledWith('notif-1')
    expect(navigateMock).toHaveBeenCalledWith('/settings/workspaces')
  })

  it('clicking an already-read notification navigates but does not call markRead again', () => {
    useNotificationsMock.mockReturnValue({
      data: [notification({ read_at: '2026-01-01T00:00:00.000Z' })],
      isLoading: false,
      unreadCount: 0,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    fireEvent.click(screen.getByText('Ding invited you to join Research Workspace'))

    expect(markReadMutate).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith('/settings/workspaces')
  })
})
