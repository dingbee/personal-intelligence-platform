import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/modules/notifications/hooks/useNotifications'
import { DropdownMenu } from '@/shared/components/ui/DropdownMenu'
import { Spinner } from '@/shared/components/ui/Spinner'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import type { CollaborationInvitationPayload, Notification } from '@/shared/types/database'

/** Every notification `type` this phase produces routes to a fixed destination and renders a fixed message — a small lookup, not a generic template engine, since there is exactly one type today (Phase 1 scope). */
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
