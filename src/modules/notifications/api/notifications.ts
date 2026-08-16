import { supabase } from '@/shared/lib/supabase'
import type { Notification } from '@/shared/types/database'

/**
 * Notification Foundation Phase 1 — a recipient's own notifications,
 * newest first. Self-scoped by the table's own SELECT RLS
 * (`recipient_user_id = auth.uid()`), so no RPC is needed here, matching
 * `listMyPendingInvitations`' own reasoning (workspaceMembers.ts).
 */
export async function listNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

/**
 * Marks one notification read via the `mark_notification_read`
 * security-definer RPC (`0068_notifications.sql`) rather than a plain
 * client-side UPDATE — there is no client UPDATE policy on `notifications`
 * at all (every write goes through a SECURITY DEFINER function), matching
 * `respond_to_workspace_invitation`'s own precedent.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId })
  if (error) throw error
}

/** Marks every unread notification for the current user read in one call, via the matching security-definer RPC. */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read')
  if (error) throw error
}
