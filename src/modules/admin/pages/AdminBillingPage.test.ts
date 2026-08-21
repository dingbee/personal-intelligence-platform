import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * #21 Phase 4.3 — Admin Billing & Subscription Operations. This page has no
 * mutation hooks at all (see adminApi.ts's own header comment) — there is
 * deliberately no test asserting a client-side subscription write, because
 * no such call site exists. Coverage here is: subscription visibility,
 * failed/inconsistent billing event visibility, and that filters are
 * forwarded to the read RPCs unchanged.
 */
const { useAdminCommercialOverviewMock, useAdminSubscriptionsMock, useAdminSubscriptionEventsMock } = vi.hoisted(() => ({
  useAdminCommercialOverviewMock: vi.fn(),
  useAdminSubscriptionsMock: vi.fn(),
  useAdminSubscriptionEventsMock: vi.fn(),
}))

vi.mock('@/modules/admin/hooks/useAdminData', () => ({
  useAdminCommercialOverview: useAdminCommercialOverviewMock,
  useAdminSubscriptions: useAdminSubscriptionsMock,
  useAdminSubscriptionEvents: useAdminSubscriptionEventsMock,
}))

import { AdminBillingPage } from '@/modules/admin/pages/AdminBillingPage'

const subscriptionRow = {
  user_id: 'user-a',
  email: 'a@example.com',
  display_name: 'User A',
  plan_code: 'pro',
  plan_name: 'Pro',
  subscription_status: 'active',
  billing_provider: 'pesapal',
  provider_subscription_id: 'sub-1',
  latest_order_reference: 'pip-pro-abc',
  latest_order_status: 'completed',
  current_period_start: '2026-08-01T00:00:00Z',
  current_period_end: '2026-09-01T00:00:00Z',
  cancel_at_period_end: false,
  started_at: '2026-08-01T00:00:00Z',
  last_event_at: '2026-08-01T00:05:00Z',
  founding_pro_transition_status: null,
}

const failedEvent = {
  id: 'evt-1',
  provider: 'pesapal',
  event_type: 'pesapal.transaction.status_2',
  processing_status: 'failed',
  received_at: '2026-08-01T00:00:00Z',
  processed_at: null,
  user_id: 'user-a',
  email: 'a@example.com',
  plan_code: 'pro',
}

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(AdminBillingPage)))
}

afterEach(cleanup)

describe('AdminBillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAdminCommercialOverviewMock.mockReturnValue({
      data: {
        active_subscriptions: 12,
        past_due_subscriptions: 1,
        cancelled_subscriptions: 2,
        pending_checkout_orders: 3,
        failed_checkout_orders_30d: 4,
        founding_pro_active: 5,
        founding_pro_expiring_30d: 1,
        recent_transitions_30d: 0,
        failed_subscription_events_30d: 2,
      },
    })
    useAdminSubscriptionsMock.mockReturnValue({ data: [subscriptionRow], isLoading: false })
    useAdminSubscriptionEventsMock.mockReturnValue({ data: [failedEvent], isLoading: false })
  })

  it('renders the summary tiles from admin_commercial_overview', () => {
    renderPage()

    const tile = screen.getByText('Active subscriptions').closest('div')!.parentElement!
    expect(within(tile).getByText('12')).toBeTruthy()
  })

  it('renders a subscription row with plan, status, provider, and Founding Pro column', () => {
    renderPage()

    const row = screen.getAllByText('a@example.com')[0]!.closest('tr')!
    expect(within(row).getByText('Pro')).toBeTruthy()
    expect(within(row).getByText('Active')).toBeTruthy()
    expect(within(row).getByText('pesapal')).toBeTruthy()
    expect(within(row).getByText('pip-pro-abc')).toBeTruthy()
  })

  it('forwards the status and plan filters to useAdminSubscriptions unchanged', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } })
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'student' } })

    expect(useAdminSubscriptionsMock).toHaveBeenLastCalledWith({ status: 'active', planCode: 'student' })
  })

  it('shows failed billing/subscription events distinctly, so inconsistencies are visible without reading Supabase logs', () => {
    renderPage()

    const row = screen.getByText('pesapal.transaction.status_2').closest('tr')!
    expect(within(row).getByText('failed')).toBeTruthy()
  })

  it('the events filter defaults to Failed and can be forwarded as All', () => {
    renderPage()

    expect(useAdminSubscriptionEventsMock).toHaveBeenLastCalledWith({ processingStatus: 'failed' })

    fireEvent.change(screen.getByDisplayValue('Failed'), { target: { value: '' } })

    expect(useAdminSubscriptionEventsMock).toHaveBeenLastCalledWith({ processingStatus: null })
  })

  it('has no client-side mutation affordance for subscription state — the page only reads', () => {
    renderPage()

    expect(screen.queryByRole('button')).toBeNull()
  })
})
