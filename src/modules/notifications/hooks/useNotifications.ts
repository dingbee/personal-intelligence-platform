import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/modules/notifications/api/notifications'

/**
 * Notification Foundation Phase 1 — the bell's data source. Unread count
 * is derived from `read_at is null` on the fetched rows, not stored
 * separately, so it can never drift from the notifications themselves.
 *
 * No realtime/websocket subscription this phase (Phase 7, deliberately
 * deferred) — `queryClient`'s default `staleTime`/refetch-on-focus
 * behavior (`shared/lib/queryClient.ts`) is what makes a fresh page load
 * or tab focus pick up a new notification, the same mechanism every other
 * query in this codebase relies on.
 */
export function useNotifications() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['notifications']

  const query = useQuery({
    queryKey,
    queryFn: () => listNotifications(),
    enabled: Boolean(user),
  })

  const unreadCount = query.data?.filter((n) => n.read_at === null).length ?? 0

  const markRead = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { ...query, unreadCount, markRead, markAllRead }
}
