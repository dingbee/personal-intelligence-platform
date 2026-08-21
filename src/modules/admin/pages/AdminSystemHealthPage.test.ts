import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * #21 Phase 5 — Unified Admin Intelligence / Error Centre. Covers: events
 * render with severity/category/status; filters are forwarded to the data
 * hook; selecting a row shows the detail panel; acknowledge/resolve/reopen
 * call their own dedicated RPC-backed mutation with exactly the selected
 * event's id, never a hardcoded or wrong one; a reopen action is only
 * offered once an event is resolved/ignored, never while open.
 */
const {
  useAdminSystemHealthEventsMock,
  useAdminSystemHealthSummaryMock,
  useAdminUsersMock,
  useAdminAcknowledgeSystemHealthEventMock,
  useAdminResolveSystemHealthEventMock,
  useAdminReopenSystemHealthEventMock,
  useAdminIgnoreSystemHealthEventMock,
} = vi.hoisted(() => ({
  useAdminSystemHealthEventsMock: vi.fn(),
  useAdminSystemHealthSummaryMock: vi.fn(),
  useAdminUsersMock: vi.fn(),
  useAdminAcknowledgeSystemHealthEventMock: vi.fn(),
  useAdminResolveSystemHealthEventMock: vi.fn(),
  useAdminReopenSystemHealthEventMock: vi.fn(),
  useAdminIgnoreSystemHealthEventMock: vi.fn(),
}))

vi.mock('@/modules/admin/hooks/useAdminData', () => ({
  useAdminSystemHealthEvents: useAdminSystemHealthEventsMock,
  useAdminSystemHealthSummary: useAdminSystemHealthSummaryMock,
  useAdminUsers: useAdminUsersMock,
  useAdminAcknowledgeSystemHealthEvent: useAdminAcknowledgeSystemHealthEventMock,
  useAdminResolveSystemHealthEvent: useAdminResolveSystemHealthEventMock,
  useAdminReopenSystemHealthEvent: useAdminReopenSystemHealthEventMock,
  useAdminIgnoreSystemHealthEvent: useAdminIgnoreSystemHealthEventMock,
}))

import { AdminSystemHealthPage } from '@/modules/admin/pages/AdminSystemHealthPage'

const openEvent = {
  id: 'evt-1',
  created_at: '2026-08-01T00:00:00Z',
  severity: 'error',
  category: 'billing',
  operation: 'apply_subscription_event',
  error_code: null,
  message: 'apply_subscription_event failed: unknown plan code',
  diagnosis: null,
  status: 'open',
  user_id: 'user-a',
  workspace_id: null,
  related_entity_type: null,
  related_entity_id: null,
  provider: 'pesapal',
  metadata: {},
  occurrence_count: 3,
  last_occurred_at: '2026-08-02T00:00:00Z',
  dedup_key: 'billing:apply_subscription_event::user-a:',
  acknowledged_at: null,
  acknowledged_by: null,
  resolved_at: null,
  resolved_by: null,
}

const resolvedEvent = { ...openEvent, id: 'evt-2', status: 'resolved', resolved_at: '2026-08-03T00:00:00Z', resolved_by: 'admin-1' }

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(AdminSystemHealthPage)))
}

afterEach(cleanup)

describe('AdminSystemHealthPage', () => {
  let acknowledgeMock: ReturnType<typeof vi.fn>
  let resolveMock: ReturnType<typeof vi.fn>
  let reopenMock: ReturnType<typeof vi.fn>
  let ignoreMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    acknowledgeMock = vi.fn().mockResolvedValue(undefined)
    resolveMock = vi.fn().mockResolvedValue(undefined)
    reopenMock = vi.fn().mockResolvedValue(undefined)
    ignoreMock = vi.fn().mockResolvedValue(undefined)

    useAdminSystemHealthEventsMock.mockReturnValue({ data: [openEvent], isLoading: false })
    useAdminSystemHealthSummaryMock.mockReturnValue({ data: { open_critical: 0, open_error: 1, open_warning: 0, events_today: 1, unresolved: 1 } })
    useAdminUsersMock.mockReturnValue({ data: [{ id: 'user-a', email: 'a@example.com' }] })
    useAdminAcknowledgeSystemHealthEventMock.mockReturnValue({ mutateAsync: acknowledgeMock, isPending: false })
    useAdminResolveSystemHealthEventMock.mockReturnValue({ mutateAsync: resolveMock, isPending: false })
    useAdminReopenSystemHealthEventMock.mockReturnValue({ mutateAsync: reopenMock, isPending: false })
    useAdminIgnoreSystemHealthEventMock.mockReturnValue({ mutateAsync: ignoreMock, isPending: false })
  })

  it('renders summary tiles from admin_system_health_summary', () => {
    renderPage()

    const tile = screen.getByText('Open errors').closest('div')!.parentElement!
    expect(within(tile).getByText('1')).toBeTruthy()
  })

  it('renders the event row with its severity, category, and resolved email for the affected user', () => {
    renderPage()

    const row = screen.getByText('apply_subscription_event').closest('tr')!
    expect(within(row).getByText('error')).toBeTruthy()
    expect(within(row).getByText('Billing')).toBeTruthy()
    expect(within(row).getByText('a@example.com')).toBeTruthy()
  })

  it('forwards the category/severity/status filters to the data hook', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'billing' } })

    expect(useAdminSystemHealthEventsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'billing' }),
    )
  })

  it('clicking a row opens the detail panel with the full message and no reopen action for an open event', () => {
    renderPage()

    fireEvent.click(screen.getByText('apply_subscription_event'))

    expect(screen.getByText('Event detail')).toBeTruthy()
    expect(screen.getAllByText(/apply_subscription_event failed/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull()
  })

  it('acknowledging calls the mutation with exactly the selected event id', async () => {
    renderPage()
    fireEvent.click(screen.getByText('apply_subscription_event'))

    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }))

    expect(acknowledgeMock).toHaveBeenCalledWith('evt-1')
  })

  it('resolving forwards the selected event id and the typed resolution note', async () => {
    renderPage()
    fireEvent.click(screen.getByText('apply_subscription_event'))

    fireEvent.change(screen.getByLabelText('Resolution note'), { target: { value: 'Retried, confirmed fixed.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))

    expect(resolveMock).toHaveBeenCalledWith({ eventId: 'evt-1', resolutionNote: 'Retried, confirmed fixed.' })
  })

  it('a resolved event offers Reopen instead of Acknowledge/Resolve/Ignore', () => {
    useAdminSystemHealthEventsMock.mockReturnValue({ data: [resolvedEvent], isLoading: false })
    renderPage()

    fireEvent.click(screen.getByText('apply_subscription_event'))

    expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull()
  })

  it('reopening calls the mutation with exactly the selected (resolved) event id', () => {
    useAdminSystemHealthEventsMock.mockReturnValue({ data: [resolvedEvent], isLoading: false })
    renderPage()
    fireEvent.click(screen.getByText('apply_subscription_event'))

    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))

    expect(reopenMock).toHaveBeenCalledWith('evt-2')
  })

  it('shows an empty state when no events match the current filters', () => {
    useAdminSystemHealthEventsMock.mockReturnValue({ data: [], isLoading: false })
    renderPage()

    expect(screen.getByText('No matching events')).toBeTruthy()
  })
})
