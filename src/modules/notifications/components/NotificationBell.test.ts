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

  it('shows a spinner and loading text while loading', () => {
    useNotificationsMock.mockReturnValue({ data: undefined, isLoading: true, unreadCount: 0, markRead: { mutate: markReadMutate } })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByRole('status')).not.toBeNull()
    expect(screen.getByText('Loading notifications…')).not.toBeNull()
  })

  it('shows a distinct error state, never "No notifications yet.", when the query fails', () => {
    const refetchMock = vi.fn()
    useNotificationsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
      unreadCount: 0,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Unable to load notifications.')).not.toBeNull()
    expect(screen.queryByText('No notifications yet.')).toBeNull()
  })

  it('the error state\'s Retry button calls refetch', () => {
    const refetchMock = vi.fn()
    useNotificationsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
      unreadCount: 0,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(refetchMock).toHaveBeenCalled()
  })

  it('shows the genuine empty state (not the error state) when the query succeeds with zero rows', () => {
    useNotificationsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      unreadCount: 0,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('No notifications yet.')).not.toBeNull()
    expect(screen.queryByText('Unable to load notifications.')).toBeNull()
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

  it('renders a quota_threshold notification with a human label, never the raw quota_key, and routes to /settings', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-quota',
          type: 'quota_threshold',
          payload: { quota_key: 'research_intelligence_operations', threshold: 90, usage_count: 45, quota_limit: 50, period_end: '2026-09-01T00:00:00Z' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText(/close to your Research Intelligence limit/)).not.toBeNull()
    expect(screen.queryByText(/research_intelligence_operations/)).toBeNull()

    fireEvent.click(screen.getByText(/close to your Research Intelligence limit/))
    expect(navigateMock).toHaveBeenCalledWith('/settings')
  })

  it('never implies every capability is exhausted when only one quota hit 100%', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-quota-100',
          type: 'quota_threshold',
          payload: { quota_key: 'data_intelligence_operations', threshold: 100, usage_count: 50, quota_limit: 50, period_end: '2026-09-01T00:00:00Z' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText("You've reached your Data Intelligence limit for this period. Upgrade for more capacity.")).not.toBeNull()
  })

  it('renders a founding_pro_expiry_warning notification and routes to /pricing', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-fp-warn',
          type: 'founding_pro_expiry_warning',
          payload: { member_id: 'member-1', threshold_days: 7, founding_expires_at: '2026-09-01T00:00:00Z' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText(/Founding Pro term ends in 7 days/)).not.toBeNull()

    fireEvent.click(screen.getByText(/Founding Pro term ends in 7 days/))
    expect(navigateMock).toHaveBeenCalledWith('/pricing')
  })

  it('renders a founding_pro_transition (expired_to_free) notification distinct from a conversion notification', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-fp-expired',
          type: 'founding_pro_transition',
          payload: { member_id: 'member-1', transition_status: 'expired_to_free' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText(/now on the Free plan/)).not.toBeNull()
    expect(screen.queryByText(/moved to standard Pro/)).toBeNull()
  })

  it('renders a founding_pro_transition (converted_to_pro) notification distinct from an expiry notification', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-fp-converted',
          type: 'founding_pro_transition',
          payload: { member_id: 'member-1', transition_status: 'converted_to_pro' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText(/moved to standard Pro/)).not.toBeNull()
    expect(screen.queryByText(/now on the Free plan/)).toBeNull()
  })

  it('renders an execution_succeeded notification with a human capability label, never the raw id, and routes to /executions', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-exec-succeeded',
          type: 'execution_succeeded',
          payload: { execution_request_id: 'req-1', capability: 'save_action_to_notes' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Save action to Notes completed successfully.')).not.toBeNull()
    expect(screen.queryByText(/save_action_to_notes/)).toBeNull()

    fireEvent.click(screen.getByText('Save action to Notes completed successfully.'))
    expect(navigateMock).toHaveBeenCalledWith('/executions')
  })

  it('renders an execution_failed notification distinct from a success', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-exec-failed',
          type: 'execution_failed',
          payload: { execution_request_id: 'req-1', capability: 'add_action_as_workspace_objective', failure_kind: 'permanent' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Add action as Workspace Objective failed to complete.')).not.toBeNull()
  })

  it('renders an execution_authorization_rejected notification distinct from a failure', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-exec-rejected',
          type: 'execution_authorization_rejected',
          payload: { execution_request_id: 'req-1', capability: 'save_action_to_notes' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Save action to Notes was rejected — nothing was run.')).not.toBeNull()
  })

  it('renders an execution_cancelled notification distinct from the other three execution states', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        notification({
          id: 'notif-exec-cancelled',
          type: 'execution_cancelled',
          payload: { execution_request_id: 'req-1', capability: 'save_action_to_notes', reason: 'No longer needed' },
        }),
      ],
      isLoading: false,
      unreadCount: 1,
      markRead: { mutate: markReadMutate },
    })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Save action to Notes was cancelled.')).not.toBeNull()
  })
})
