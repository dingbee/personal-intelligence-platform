import { Link } from 'react-router-dom'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { useStorageUsage } from '@/modules/plans/hooks/useStorageUsage'
import { useSubscription } from '@/modules/billing/hooks/useSubscription'
import { UsageIndicator } from '@/modules/billing/components/UsageIndicator'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { formatFileSize } from '@/modules/library/utils/fileTypes'

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  active: { label: 'Active', variant: 'success' },
  past_due: { label: 'Payment failed', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'warning' },
  expired: { label: 'Expired', variant: 'warning' },
}

/**
 * Phase 4 Commercial Architecture — the minimum Settings billing section:
 * current plan, subscription status (if any), and storage usage. No
 * invoice history, no custom card-entry UI, no full billing dashboard —
 * "Manage billing" points at the pricing page rather than a
 * provider-hosted customer portal because no payment provider is wired
 * yet (see billing-webhook/index.ts's header comment); once one is
 * selected, this link becomes that provider's portal URL and nothing else
 * on this card changes.
 */
export function BillingCard() {
  const { data: plan } = useCurrentPlan()
  const { data: subscription } = useSubscription()
  const { data: storage } = useStorageUsage()

  const statusInfo = subscription ? STATUS_BADGE[subscription.status] : null

  return (
    <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Billing</h2>
        <Link to="/pricing" className="text-xs text-[var(--color-accent)] hover:underline">
          View plans →
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <p className="text-sm text-[var(--color-ink)]">{plan?.planName ?? '—'}</p>
        {statusInfo && <StatusBadge label={statusInfo.label} variant={statusInfo.variant} />}
      </div>

      {subscription?.status === 'past_due' && (
        <p className="mt-2 rounded-md bg-[var(--color-danger-bg)] p-2 text-xs text-[var(--color-danger-strong)]">
          Your last payment failed. Update your payment method to keep your Pro access.
        </p>
      )}

      {subscription?.cancel_at_period_end && subscription.current_period_end && (
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          Your subscription ends on {new Date(subscription.current_period_end).toLocaleDateString()}.
        </p>
      )}

      {storage && (
        <div className="mt-4">
          <UsageIndicator label="Storage" used={storage.used} limit={storage.limit} formatValue={formatFileSize} />
        </div>
      )}
    </div>
  )
}
