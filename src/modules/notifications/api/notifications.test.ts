import { describe, expect, it, vi } from 'vitest'

const { orderMock, limitMock, selectMock, rpcMock, fromMock } = vi.hoisted(() => {
  const orderMock = vi.fn(() => ({ limit: limitMock }))
  const limitMock = vi.fn<() => Promise<{ data: unknown[] | null; error: Error | null }>>()
  const selectMock = vi.fn(() => ({ order: orderMock }))
  const rpcMock = vi.fn<() => Promise<{ data: unknown; error: Error | null }>>()
  const fromMock = vi.fn(() => ({ select: selectMock }))
  return { orderMock, limitMock, selectMock, rpcMock, fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}))

import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/modules/notifications/api/notifications'

describe('listNotifications', () => {
  it('selects the current user\'s notifications newest first, default-limited to 50', async () => {
    limitMock.mockResolvedValueOnce({ data: [{ id: 'notif-1' }], error: null })

    const result = await listNotifications()

    expect(fromMock).toHaveBeenCalledWith('notifications')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limitMock).toHaveBeenCalledWith(50)
    expect(result).toEqual([{ id: 'notif-1' }])
  })

  it('honors a custom limit', async () => {
    limitMock.mockResolvedValueOnce({ data: [], error: null })

    await listNotifications(10)

    expect(limitMock).toHaveBeenCalledWith(10)
  })

  it('propagates an error', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    await expect(listNotifications()).rejects.toThrow(/boom/)
  })
})

describe('markNotificationRead', () => {
  it('calls the mark_notification_read RPC with the notification id', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await markNotificationRead('notif-1')

    expect(rpcMock).toHaveBeenCalledWith('mark_notification_read', { p_notification_id: 'notif-1' })
  })

  it('propagates an error', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    await expect(markNotificationRead('notif-1')).rejects.toThrow(/boom/)
  })
})

describe('markAllNotificationsRead', () => {
  it('calls the mark_all_notifications_read RPC with no arguments', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await markAllNotificationsRead()

    expect(rpcMock).toHaveBeenCalledWith('mark_all_notifications_read')
  })

  it('propagates an error', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    await expect(markAllNotificationsRead()).rejects.toThrow(/boom/)
  })
})
