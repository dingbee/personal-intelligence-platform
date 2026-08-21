import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminCommercialOverview, useAdminSubscriptionEvents, useAdminSubscriptions } from '@/modules/admin/hooks/useAdminData'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  expired: 'Expired',
  free: 'Free',
  none: 'No subscription',
}

const STATUS_FILTER_OPTIONS = ['active', 'past_due', 'cancelled', 'expired', 'free', 'none']
const PLAN_FILTER_OPTIONS = ['free', 'student', 'pro', 'founding_pro', 'enterprise']
const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  student: 'Student',
  pro: 'Pro',
  founding_pro: 'Founding Pro',
  enterprise: 'Enterprise',
}

/**
 * #21 Phase 4.3 — Admin Billing & Subscription Operations. Entirely
 * read-only: this page has no mutation of its own by design (see
 * adminApi.ts's admin_list_subscriptions/admin_list_subscription_events
 * header comment) — subscriptions, pesapal_checkout_orders, and
 * subscription_events stay exclusively owned by apply_subscription_event()
 * and the pesapal-checkout/pesapal-ipn Edge Functions. This surfaces that
 * existing state; it never bypasses it.
 *
 * `subscription_status` distinguishes 'free' (a Free-plan user, no
 * subscription row expected) from 'none' (a paid-plan assignment with no
 * subscription row yet — e.g. a checkout order still pending/failed before
 * any webhook applied) from the real Pesapal-driven statuses. "Pending" and
 * "Failed" checkout outcomes are shown per-row via Latest order status
 * rather than folded into this filter, since they describe
 * pesapal_checkout_orders, a different table from subscriptions.status —
 * conflating the two would misrepresent what each column actually means.
 */
export function AdminBillingPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [eventsFilter, setEventsFilter] = useState<'failed' | 'ignored_stale' | ''>('failed')

  const { data: overview } = useAdminCommercialOverview()
  const { data: subscriptions = [], isLoading } = useAdminSubscriptions({
    status: statusFilter || null,
    planCode: planFilter || null,
  })
  const { data: events = [], isLoading: eventsLoading } = useAdminSubscriptionEvents({
    processingStatus: eventsFilter || null,
  })

  const summaryTiles = useMemo(
    () => [
      { label: 'Active subscriptions', value: overview?.active_subscriptions ?? '–' },
      { label: 'Past due', value: overview?.past_due_subscriptions ?? '–' },
      { label: 'Cancelled', value: overview?.cancelled_subscriptions ?? '–' },
      { label: 'Pending checkout orders', value: overview?.pending_checkout_orders ?? '–' },
      { label: 'Failed checkouts (30d)', value: overview?.failed_checkout_orders_30d ?? '–' },
      { label: 'Founding Pro active', value: overview?.founding_pro_active ?? '–' },
      { label: 'Founding Pro expiring (30d)', value: overview?.founding_pro_expiring_30d ?? '–' },
    ],
    [overview],
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Billing & Subscriptions</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Read-only view over the existing Pesapal subscription architecture. No mutation happens here — every write still goes through
          apply_subscription_event() via the pesapal-checkout/pesapal-ipn Edge Functions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {summaryTiles.map((tile) => (
          <StatCard key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </div>

      <SurfaceCard>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
            >
              <option value="">All</option>
              {STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            Plan
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
            >
              <option value="">All</option>
              {PLAN_FILTER_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <Spinner size="sm" />
        ) : subscriptions.length === 0 ? (
          <EmptyState title="No matching users" description="No user matches the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 pr-4 font-medium">Latest order</th>
                  <th className="pb-2 pr-4 font-medium">Period</th>
                  <th className="pb-2 pr-4 font-medium">Started</th>
                  <th className="pb-2 pr-4 font-medium">Last event</th>
                  <th className="pb-2 font-medium">Founding Pro</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((row) => (
                  <tr key={row.user_id} className="border-t border-[var(--color-border)] align-top">
                    <td className="py-2 pr-4">
                      <div className="text-[var(--color-ink)]">{row.display_name ?? '—'}</div>
                      <div className="text-[var(--color-ink-muted)]">{row.email ?? '—'}</div>
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{PLAN_LABELS[row.plan_code] ?? row.plan_code}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{STATUS_LABELS[row.subscription_status] ?? row.subscription_status}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{row.billing_provider ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {row.latest_order_reference ? (
                        <>
                          <div>{row.latest_order_reference}</div>
                          <div className={row.latest_order_status === 'failed' ? 'text-[var(--color-danger)]' : ''}>{row.latest_order_status}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {row.current_period_start ? `${formatDate(row.current_period_start)} → ${formatDate(row.current_period_end)}` : '—'}
                      {row.cancel_at_period_end && <div className="text-[var(--color-danger)]">Cancels at period end</div>}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(row.started_at)}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(row.last_event_at)}</td>
                    <td className="py-2 text-[var(--color-ink-muted)]">{row.founding_pro_transition_status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Billing inconsistencies</h2>
            <p className="text-xs text-[var(--color-ink-muted)]">
              subscription_events rows where processing_status is not a clean "processed" — surfaces the exact webhook-level failures the
              apply_subscription_event() function records, without reading Supabase logs.
            </p>
          </div>
          <select
            value={eventsFilter}
            onChange={(e) => setEventsFilter(e.target.value as typeof eventsFilter)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
          >
            <option value="failed">Failed</option>
            <option value="ignored_stale">Ignored (stale)</option>
            <option value="">All events</option>
          </select>
        </div>

        {eventsLoading ? (
          <Spinner size="sm" />
        ) : events.length === 0 ? (
          <EmptyState title="No matching billing events" description="Nothing in subscription_events matches this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">Received</th>
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 pr-4 font-medium">Event type</th>
                  <th className="pb-2 pr-4 font-medium">Processing status</th>
                  <th className="pb-2 font-medium">User</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-[var(--color-border)] align-top">
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(event.received_at)}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{event.provider}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{event.event_type}</td>
                    <td className={`py-2 pr-4 ${event.processing_status === 'failed' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'}`}>
                      {event.processing_status}
                    </td>
                    <td className="py-2 text-[var(--color-ink-muted)]">{event.email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}
