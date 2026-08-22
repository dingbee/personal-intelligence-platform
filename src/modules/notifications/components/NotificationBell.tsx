import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/modules/notifications/hooks/useNotifications'
import { getCapability } from '@/modules/execution-foundation/api/capabilityRegistry'
import { DropdownMenu } from '@/shared/components/ui/DropdownMenu'
import { Spinner } from '@/shared/components/ui/Spinner'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import type {
  CollaborationInvitationPayload,
  ExecutionNotificationPayload,
  FoundingProExpiryWarningPayload,
  FoundingProTransitionPayload,
  Notification,
  QuotaThresholdPayload,
} from '@/shared/types/database'

/**
 * Usage Intelligence — never render `quota_key` (or any other internal
 * identifier) to a user; this is the one place a raw quota_key becomes a
 * human label. Deliberately excludes 'ai_messages' from having a distinct
 * "capability" framing (it already reads naturally as "AI messages").
 */
const QUOTA_KEY_LABELS: Record<string, string> = {
  ai_messages: 'AI messages',
  data_intelligence_operations: 'Data Intelligence',
  analysis_intelligence_operations: 'Analysis Intelligence',
  research_intelligence_operations: 'Research Intelligence',
  decision_intelligence_operations: 'Decision Intelligence',
  planning_intelligence_operations: 'Planning Intelligence',
  action_intelligence_operations: 'Action Intelligence',
}

/**
 * Copy is deliberately scoped to the single capability that crossed a
 * threshold — never implies every capability is unavailable, never names
 * the raw quota_key. 50%/75% are informational; 90%/100% are actionable
 * (100% points at the upgrade path, matching BillingCard's own "Upgrade
 * to Pro" precedent).
 */
function quotaThresholdMessage(payload: Partial<QuotaThresholdPayload>): string {
  const label = (payload.quota_key && QUOTA_KEY_LABELS[payload.quota_key]) || 'a capability'
  switch (payload.threshold) {
    case 50:
      return `You've used half of your ${label} for this period.`
    case 75:
      return `You've used 75% of your ${label} for this period.`
    case 90:
      return `You're close to your ${label} limit for this period — 90% used.`
    case 100:
      return `You've reached your ${label} limit for this period. Upgrade for more capacity.`
    default:
      return `Your ${label} usage has reached ${payload.threshold ?? ''}% for this period.`
  }
}

/** Every notification `type` routes to a fixed destination and renders a fixed message — a small lookup, not a generic template engine. */
function describeNotification(notification: Notification): { icon: string; message: string; to: string } {
  if (notification.type === 'collaboration_invitation') {
    // Payload is DB-guaranteed `not null default '{}'`, but a malformed or
    // future-shaped row must not crash the whole panel — one bad row falls
    // back to a generic message instead of taking every other row down with it.
    const payload = (notification.payload ?? {}) as unknown as Partial<CollaborationInvitationPayload>
    return {
      icon: '🤝',
      message: `${payload.inviter_name ?? 'Someone'} invited you to join ${payload.workspace_name ?? 'a workspace'}`,
      to: '/settings/workspaces',
    }
  }
  if (notification.type === 'quota_threshold') {
    const payload = (notification.payload ?? {}) as unknown as Partial<QuotaThresholdPayload>
    return { icon: '📊', message: quotaThresholdMessage(payload), to: '/settings' }
  }
  if (notification.type === 'founding_pro_expiry_warning') {
    const payload = (notification.payload ?? {}) as unknown as Partial<FoundingProExpiryWarningPayload>
    const days = payload.threshold_days
    const when = days === 1 ? 'in 1 day' : `in ${days ?? 'a few'} days`
    return { icon: '⏳', message: `Your Founding Pro term ends ${when}. Continue with Pro anytime to keep full access.`, to: '/pricing' }
  }
  if (notification.type === 'founding_pro_transition') {
    const payload = (notification.payload ?? {}) as unknown as Partial<FoundingProTransitionPayload>
    const message =
      payload.transition_status === 'converted_to_pro'
        ? "You've moved to standard Pro. Your Founding Pro term has ended."
        : "Your Founding Pro term has ended and you're now on the Free plan."
    return { icon: '🎓', message, to: '/pricing' }
  }
  // I7 — the four execution-foundation notification producers (0085), reusing
  // this exact notifications table rather than a second mechanism (see
  // execution.ts's own doc comment). `capability` is the raw internal id —
  // mapped through the same capabilityRegistry.ts the Executions page itself
  // uses, never rendered raw.
  if (
    notification.type === 'execution_succeeded' ||
    notification.type === 'execution_failed' ||
    notification.type === 'execution_authorization_rejected' ||
    notification.type === 'execution_cancelled'
  ) {
    const payload = (notification.payload ?? {}) as unknown as Partial<ExecutionNotificationPayload>
    const capabilityLabel = (payload.capability && getCapability(payload.capability)?.label) || 'An action'
    const message =
      notification.type === 'execution_succeeded'
        ? `${capabilityLabel} completed successfully.`
        : notification.type === 'execution_failed'
          ? `${capabilityLabel} failed to complete.`
          : notification.type === 'execution_authorization_rejected'
            ? `${capabilityLabel} was rejected — nothing was run.`
            : `${capabilityLabel} was cancelled.`
    const icon = notification.type === 'execution_succeeded' ? '✅' : notification.type === 'execution_failed' ? '⚠️' : notification.type === 'execution_authorization_rejected' ? '🚫' : '🛑'
    return { icon, message, to: '/executions' }
  }
  return { icon: '🔔', message: notification.type, to: '/settings/workspaces' }
}

/**
 * Notification Foundation Phase 1 — replaces the previously decorative,
 * disabled bell button. Reuses the shared `DropdownMenu` (widened via its
 * additive `panelClassName` prop) rather than a bespoke popover, and
 * routes every Collaboration notification to the existing
 * `/settings/workspaces` invitation surface — there is deliberately no
 * second invitation-management UI here.
 */
export function NotificationBell() {
  const navigate = useNavigate()
  const { data: notifications, isLoading, isError, refetch, unreadCount, markRead } = useNotifications()

  function handleOpenNotification(notification: Notification) {
    if (notification.read_at === null) markRead.mutate(notification.id)
    navigate(describeNotification(notification).to)
  }

  return (
    <DropdownMenu
      panelClassName="w-80"
      trigger={
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--surface-base)] hover:text-[var(--color-ink)]">
          <span aria-hidden>🔔</span>
          <span className="sr-only">Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}</span>
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[0.6rem] font-medium leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
      }
    >
      <div className="max-h-96 overflow-y-auto">
        <p className="border-b border-[var(--color-border)] px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
          Notifications
        </p>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <Spinner size="sm" />
            <p className="text-xs text-[var(--color-ink-muted)]">Loading notifications…</p>
          </div>
        ) : isError ? (
          // A failed fetch must never look like "there are no notifications" —
          // that's exactly the failure mode that made a real production gap
          // (a stale/unapplied notifications table or a query error) silently
          // indistinguishable from "nothing to show" in this panel before.
          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
            <p className="text-sm text-[var(--color-ink-muted)]">Unable to load notifications.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-control px-2 py-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--color-ink-muted)]">No notifications yet.</p>
        ) : (
          notifications.map((notification) => {
            const { icon, message } = describeNotification(notification)
            const unread = notification.read_at === null
            return (
              <button
                key={notification.id}
                type="button"
                role="menuitem"
                onClick={() => handleOpenNotification(notification)}
                className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--surface-base)] ${
                  unread ? 'bg-[var(--color-accent)]/5' : ''
                }`}
              >
                <span aria-hidden className="mt-0.5 shrink-0">
                  {icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block ${unread ? 'font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]'}`}>{message}</span>
                  <span className="text-xs text-[var(--color-ink-muted)]">{formatRelativeTime(notification.created_at)}</span>
                </span>
                {unread && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" />}
              </button>
            )
          })
        )}
      </div>
    </DropdownMenu>
  )
}
