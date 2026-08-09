import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// jsdom does not implement <dialog>'s showModal()/close() — ConfirmDialog
// (used here for the plan-wide confirmation) calls them imperatively.
// Polyfilled with the plain attribute toggle real browsers do internally,
// just enough for tests to open/close it without a runtime crash.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

/**
 * ARRIYIA Quota Administration Remediation. This page edits a PLAN's
 * quota — a change here affects every user on that plan, which is exactly
 * the ambiguity the incident this remediates was about. Every edit must
 * show the plan-wide warning, the live affected-user count, and require
 * confirmation before saving; a failed save must never look like an
 * unchanged, silently-reverted screen.
 */
const { useAdminPlansAndQuotasMock, useAdminUpdatePlanQuotaMock, useAdminUsersMock } = vi.hoisted(() => ({
  useAdminPlansAndQuotasMock: vi.fn(),
  useAdminUpdatePlanQuotaMock: vi.fn(),
  useAdminUsersMock: vi.fn(),
}))

vi.mock('@/modules/admin/hooks/useAdminData', () => ({
  useAdminPlansAndQuotas: useAdminPlansAndQuotasMock,
  useAdminUpdatePlanQuota: useAdminUpdatePlanQuotaMock,
  useAdminUsers: useAdminUsersMock,
}))

import { AdminPlansPage } from '@/modules/admin/pages/AdminPlansPage'

const betaPlan = { id: 'plan-beta', code: 'beta', name: 'Beta', description: null, active: true }
const betaQuota = { id: 'quota-1', plan_id: 'plan-beta', quota_key: 'ai_messages', quota_limit: 100, quota_period: 'monthly' }
const betaUsers = [
  { id: 'u1', plan_code: 'beta' },
  { id: 'u2', plan_code: 'beta' },
  { id: 'u3', plan_code: 'beta' },
]

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(AdminPlansPage)))
}

afterEach(cleanup)

describe('AdminPlansPage', () => {
  let updateQuotaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    updateQuotaMock = vi.fn()

    useAdminPlansAndQuotasMock.mockReturnValue({ data: { plans: [betaPlan], quotas: [betaQuota] }, isLoading: false })
    useAdminUsersMock.mockReturnValue({ data: betaUsers })
    useAdminUpdatePlanQuotaMock.mockReturnValue({ mutateAsync: updateQuotaMock, isPending: false })
  })

  it('shows the number of users currently on the plan', () => {
    renderPage()

    expect(screen.getByText('beta · 3 users')).not.toBeNull()
  })

  it('editing a quota shows the plan-wide warning with the live affected-user count', () => {
    renderPage()

    fireEvent.click(screen.getByText('100 / monthly — edit'))

    expect(screen.getByText(/Plan-wide setting/)).not.toBeNull()
    expect(screen.getByText(/Currently affects 3 users/)).not.toBeNull()
  })

  it('saving requires confirmation before calling the RPC — the mutation is not called on Save alone', () => {
    renderPage()

    fireEvent.click(screen.getByText('100 / monthly — edit'))
    fireEvent.change(screen.getByLabelText('Quota limit'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateQuotaMock).not.toHaveBeenCalled()
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true)
    expect(screen.getByText(/all 3 users/)).not.toBeNull()
  })

  it('confirming the change calls the RPC with the plan-scoped params and reports it affected everyone on the plan', async () => {
    updateQuotaMock.mockResolvedValueOnce(undefined)
    renderPage()

    fireEvent.click(screen.getByText('100 / monthly — edit'))
    fireEvent.change(screen.getByLabelText('Quota limit'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change for everyone' }))

    expect(updateQuotaMock).toHaveBeenCalledWith({ planId: 'plan-beta', quotaKey: 'ai_messages', quotaLimit: 500 })
    expect(await screen.findByText('Quota limit updated for every user on this plan.')).not.toBeNull()
  })

  it('rejects a negative quota limit without opening the confirmation dialog', () => {
    renderPage()

    fireEvent.click(screen.getByText('100 / monthly — edit'))
    fireEvent.change(screen.getByLabelText('Quota limit'), { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Enter a non-negative number.')).not.toBeNull()
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(false)
  })

  it('a failed save keeps the edit form open and shows the error, not a false success', async () => {
    updateQuotaMock.mockRejectedValueOnce(new Error('Not authorized'))
    renderPage()

    fireEvent.click(screen.getByText('100 / monthly — edit'))
    fireEvent.change(screen.getByLabelText('Quota limit'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change for everyone' }))

    expect(await screen.findByText('Not authorized')).not.toBeNull()
    expect(screen.queryByText('Quota limit updated for every user on this plan.')).toBeNull()
    // The edit input is still open with the draft value, not silently reverted.
    expect(screen.getByLabelText('Quota limit')).not.toBeNull()
  })
})
