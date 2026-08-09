import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * ARRIYIA Quota Administration Remediation. Covers the incident this page
 * redesign closes: "Reset Usage" must only ever affect the clicked user's
 * usage (never the quota limit), a personal quota override must affect
 * only the targeted user, and every mutation here must surface a real
 * error instead of silently reverting to an apparently-unchanged screen
 * on failure.
 */
const {
  useAdminUsersMock,
  useAdminPlansAndQuotasMock,
  useAdminChangeUserPlanMock,
  useAdminResetUserQuotaMock,
  useAdminSetUserQuotaOverrideMock,
  useAdminRemoveUserQuotaOverrideMock,
  useAdminSetUserDisabledMock,
} = vi.hoisted(() => ({
  useAdminUsersMock: vi.fn(),
  useAdminPlansAndQuotasMock: vi.fn(),
  useAdminChangeUserPlanMock: vi.fn(),
  useAdminResetUserQuotaMock: vi.fn(),
  useAdminSetUserQuotaOverrideMock: vi.fn(),
  useAdminRemoveUserQuotaOverrideMock: vi.fn(),
  useAdminSetUserDisabledMock: vi.fn(),
}))

vi.mock('@/modules/admin/hooks/useAdminData', () => ({
  useAdminUsers: useAdminUsersMock,
  useAdminPlansAndQuotas: useAdminPlansAndQuotasMock,
  useAdminChangeUserPlan: useAdminChangeUserPlanMock,
  useAdminResetUserQuota: useAdminResetUserQuotaMock,
  useAdminSetUserQuotaOverride: useAdminSetUserQuotaOverrideMock,
  useAdminRemoveUserQuotaOverride: useAdminRemoveUserQuotaOverrideMock,
  useAdminSetUserDisabled: useAdminSetUserDisabledMock,
}))

import { AdminUsersPage } from '@/modules/admin/pages/AdminUsersPage'

const userA = {
  id: 'user-a',
  email: 'a@example.com',
  display_name: 'User A',
  created_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: null,
  plan_code: 'beta',
  plan_name: 'Beta',
  plan_quota_limit: 100,
  quota_override: null,
  effective_quota_limit: 100,
  quota_used: 37,
  beta_status: 'accepted',
  is_disabled: false,
}

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(AdminUsersPage)))
}

afterEach(cleanup)

describe('AdminUsersPage', () => {
  let resetUsageMock: ReturnType<typeof vi.fn>
  let setOverrideMock: ReturnType<typeof vi.fn>
  let removeOverrideMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    resetUsageMock = vi.fn()
    setOverrideMock = vi.fn()
    removeOverrideMock = vi.fn()

    useAdminUsersMock.mockReturnValue({ data: [userA], isLoading: false })
    useAdminPlansAndQuotasMock.mockReturnValue({ data: { plans: [], quotas: [] } })
    useAdminChangeUserPlanMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    useAdminResetUserQuotaMock.mockReturnValue({ mutateAsync: resetUsageMock, isPending: false })
    useAdminSetUserQuotaOverrideMock.mockReturnValue({ mutateAsync: setOverrideMock, isPending: false })
    useAdminRemoveUserQuotaOverrideMock.mockReturnValue({ mutateAsync: removeOverrideMock, isPending: false })
    useAdminSetUserDisabledMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  it('shows the usage summary without an override indicator when no override is set', () => {
    renderPage()

    expect(screen.getByText('37 / 100 used')).not.toBeNull()
  })

  it('shows an override indicator and the overridden effective limit when a personal override is set', () => {
    useAdminUsersMock.mockReturnValue({ data: [{ ...userA, quota_override: 250, effective_quota_limit: 250 }], isLoading: false })

    renderPage()

    expect(screen.getByText('37 / 250 used · override')).not.toBeNull()
  })

  it('Reset Usage calls the RPC scoped to exactly this user and reports usage-only, not limit-changed', async () => {
    resetUsageMock.mockResolvedValueOnce(undefined)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Reset Usage' }))

    expect(resetUsageMock).toHaveBeenCalledWith({ userId: 'user-a', quotaKey: 'ai_messages' })
    expect(await screen.findByText(/usage was reset/i)).not.toBeNull()
    expect(screen.getByText(/quota limit is unchanged/i)).not.toBeNull()
  })

  it('Reset Usage failure surfaces the real error and shows no false success', async () => {
    resetUsageMock.mockRejectedValueOnce(new Error('Not authorized'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Reset Usage' }))

    expect(await screen.findByText('Not authorized')).not.toBeNull()
    expect(screen.queryByText(/usage was reset/i)).toBeNull()
  })

  it('Manage quota reveals plan quota, personal override, effective quota, usage, and remaining', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Manage quota' }))

    expect(screen.getByText(/Plan quota: 100/)).not.toBeNull()
    expect(screen.getByText(/Personal override: None/)).not.toBeNull()
    expect(screen.getByText(/Effective quota: 100/)).not.toBeNull()
    expect(screen.getByText(/Current usage: 37/)).not.toBeNull()
    expect(screen.getByText(/Remaining: 63/)).not.toBeNull()
    expect(screen.queryByText('Remove override')).toBeNull()
  })

  it('setting a personal override calls the RPC scoped to exactly this user and quota key', async () => {
    setOverrideMock.mockResolvedValueOnce(undefined)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Manage quota' }))
    fireEvent.change(screen.getByLabelText('Quota override'), { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(setOverrideMock).toHaveBeenCalledWith({ userId: 'user-a', quotaKey: 'ai_messages', quotaLimit: 250 })
    expect(await screen.findByText(/affects only this user/i)).not.toBeNull()
  })

  it('rejects a negative override without calling the mutation', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Manage quota' }))
    fireEvent.change(screen.getByLabelText('Quota override'), { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Enter a non-negative number.')).not.toBeNull()
    expect(setOverrideMock).not.toHaveBeenCalled()
  })

  it('a failed override save keeps the quota panel open and shows the error, not a false success', async () => {
    setOverrideMock.mockRejectedValueOnce(new Error('Not authorized'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Manage quota' }))
    fireEvent.change(screen.getByLabelText('Quota override'), { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Not authorized')).not.toBeNull()
    expect(screen.queryByText(/affects only this user/i)).toBeNull()
    // Panel is still open — the plan quota/effective quota detail text is still present.
    expect(screen.getByText(/Plan quota: 100/)).not.toBeNull()
  })

  it('offers Remove override only when an override exists, and removing it calls the RPC scoped to this user', async () => {
    useAdminUsersMock.mockReturnValue({ data: [{ ...userA, quota_override: 250, effective_quota_limit: 250 }], isLoading: false })
    removeOverrideMock.mockResolvedValueOnce(undefined)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Manage quota' }))
    expect(screen.getByRole('button', { name: 'Remove override' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Remove override' }))

    expect(removeOverrideMock).toHaveBeenCalledWith({ userId: 'user-a', quotaKey: 'ai_messages' })
    expect(await screen.findByText(/back to the plan's default quota/i)).not.toBeNull()
  })
})
