import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * #21 Phase 4.4 — Admin Usage & Quota Operations. Covers: effective quota
 * display (coalesce(override, plan_default)), setting/removing a per-user
 * override for a NON-ai_messages key (proving this page is not limited to
 * the single key AdminUsersPage already handles inline), usage percentage
 * display, and that an override is visibly distinct from the plan default
 * rather than silently replacing it.
 */
const {
  useAdminUsersMock,
  useAdminUsageOverviewMock,
  useAdminPlanQuotaPopulationMock,
  useAdminUserQuotaBreakdownMock,
  useAdminSetUserQuotaOverrideMock,
  useAdminRemoveUserQuotaOverrideMock,
} = vi.hoisted(() => ({
  useAdminUsersMock: vi.fn(),
  useAdminUsageOverviewMock: vi.fn(),
  useAdminPlanQuotaPopulationMock: vi.fn(),
  useAdminUserQuotaBreakdownMock: vi.fn(),
  useAdminSetUserQuotaOverrideMock: vi.fn(),
  useAdminRemoveUserQuotaOverrideMock: vi.fn(),
}))

vi.mock('@/modules/admin/hooks/useAdminData', () => ({
  useAdminUsers: useAdminUsersMock,
  useAdminUsageOverview: useAdminUsageOverviewMock,
  useAdminPlanQuotaPopulation: useAdminPlanQuotaPopulationMock,
  useAdminUserQuotaBreakdown: useAdminUserQuotaBreakdownMock,
  useAdminSetUserQuotaOverride: useAdminSetUserQuotaOverrideMock,
  useAdminRemoveUserQuotaOverride: useAdminRemoveUserQuotaOverrideMock,
}))

import { AdminUsageQuotasPage } from '@/modules/admin/pages/AdminUsageQuotasPage'

const userA = { id: 'user-a', email: 'a@example.com', plan_name: 'Pro' }

const breakdownRow = {
  quota_key: 'research_intelligence_operations',
  plan_limit: 100,
  override_limit: null,
  effective_limit: 100,
  usage_count: 80,
  percent_used: 80,
  period_start: '2026-08-01T00:00:00Z',
  period_end: '2026-09-01T00:00:00Z',
}

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(AdminUsageQuotasPage)))
}

afterEach(cleanup)

describe('AdminUsageQuotasPage', () => {
  let setOverrideMock: ReturnType<typeof vi.fn>
  let removeOverrideMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    setOverrideMock = vi.fn().mockResolvedValue(undefined)
    removeOverrideMock = vi.fn().mockResolvedValue(undefined)

    useAdminUsersMock.mockReturnValue({ data: [userA] })
    useAdminUsageOverviewMock.mockReturnValue({ data: { exhausted_count: 0, over_90_count: 0, over_75_count: 1 } })
    useAdminPlanQuotaPopulationMock.mockReturnValue({
      data: [{ plan_id: 'plan-pro', plan_code: 'pro', plan_name: 'Pro', quota_key: 'ai_messages', quota_limit: 5000, user_count: 3 }],
      isLoading: false,
    })
    useAdminUserQuotaBreakdownMock.mockReturnValue({ data: [breakdownRow], isLoading: false })
    useAdminSetUserQuotaOverrideMock.mockReturnValue({ mutateAsync: setOverrideMock, isPending: false })
    useAdminRemoveUserQuotaOverrideMock.mockReturnValue({ mutateAsync: removeOverrideMock, isPending: false })
  })

  it('does not fetch a breakdown until a user is selected', () => {
    renderPage()

    expect(useAdminUserQuotaBreakdownMock).toHaveBeenCalledWith(null)
  })

  it('selecting a user requests that user\'s quota breakdown', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Select a user'), { target: { value: 'user-a' } })

    expect(useAdminUserQuotaBreakdownMock).toHaveBeenLastCalledWith('user-a')
  })

  it('renders a human label (never the raw quota_key) with plan default, effective limit, usage, and percentage', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Select a user'), { target: { value: 'user-a' } })

    const row = screen.getByText('Research Intelligence').closest('tr')!
    expect(within(row).queryByText('research_intelligence_operations')).toBeNull()
    expect(within(row).getAllByText('100')).toHaveLength(2) // plan default + effective limit
    expect(within(row).getByText('80')).toBeTruthy() // usage
    expect(within(row).getByText('80%')).toBeTruthy()
    expect(within(row).getByText('None')).toBeTruthy() // no override yet
  })

  it('setting an override for a non-ai_messages key forwards exactly that quota_key, not a hardcoded ai_messages', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Select a user'), { target: { value: 'user-a' } })

    fireEvent.change(screen.getByLabelText('Research Intelligence override'), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(setOverrideMock).toHaveBeenCalledWith({ userId: 'user-a', quotaKey: 'research_intelligence_operations', quotaLimit: 150 })
  })

  it('an active override is shown as visibly distinct from the plan default, and offers Remove', () => {
    useAdminUserQuotaBreakdownMock.mockReturnValue({
      data: [{ ...breakdownRow, override_limit: 150, effective_limit: 150 }],
      isLoading: false,
    })
    renderPage()
    fireEvent.change(screen.getByLabelText('Select a user'), { target: { value: 'user-a' } })

    const row = screen.getByText('Research Intelligence').closest('tr')!
    expect(within(row).getByText(/150.*override/)).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Remove' })).toBeTruthy()
  })

  it('removing an override forwards exactly the target user and quota key', () => {
    useAdminUserQuotaBreakdownMock.mockReturnValue({
      data: [{ ...breakdownRow, override_limit: 150, effective_limit: 150 }],
      isLoading: false,
    })
    renderPage()
    fireEvent.change(screen.getByLabelText('Select a user'), { target: { value: 'user-a' } })

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(removeOverrideMock).toHaveBeenCalledWith({ userId: 'user-a', quotaKey: 'research_intelligence_operations' })
  })

  it('highlights consumption at or above 75% distinctly from normal usage', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Select a user'), { target: { value: 'user-a' } })

    const percentCell = screen.getByText('80%')
    expect(percentCell.className).toMatch(/color-(danger|warning|accent)/)
  })

  it('renders plan-level quota population grouped by plan, distinct from per-user overrides', () => {
    renderPage()

    expect(screen.getByText(/3 users/)).toBeTruthy()
    expect(screen.getByText(/AI messages: 5000/)).toBeTruthy()
  })
})
