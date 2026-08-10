import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useMessages } from '@/modules/ai/chat/hooks/useMessages'
import type { Message } from '@/shared/types/database'

const { listMessagesMock, listMessagesPageMock, listMessagesSinceMock } = vi.hoisted(() => ({
  listMessagesMock: vi.fn(),
  listMessagesPageMock: vi.fn(),
  listMessagesSinceMock: vi.fn(),
}))

vi.mock('@/modules/ai/chat/api/messages', () => ({
  listMessages: listMessagesMock,
  listMessagesPage: listMessagesPageMock,
  listMessagesSince: listMessagesSinceMock,
  MESSAGES_PAGE_SIZE: 50,
}))

function msg(id: string, createdAt: string): Message {
  return {
    id,
    conversation_id: 'conv-1',
    user_id: 'user-1',
    role: 'user',
    content: id,
    context_chunk_ids: [],
    created_at: createdAt,
  }
}

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

/**
 * ARRIYIA Product Completion Phase 2 — the fix for "opening a conversation
 * loads its entire history unbounded." These tests pin the bounded-window
 * + explicit loadOlder() design at the same boundary AIService's own test
 * suite uses: the actual functions called and the actual merged data
 * shape, not implementation internals.
 */
describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  it('loads a bounded initial page via listMessagesPage, never the unbounded listMessages, on first mount', async () => {
    listMessagesPageMock.mockResolvedValueOnce({
      messages: [msg('m1', '2026-01-01T00:00:03Z'), msg('m2', '2026-01-01T00:00:04Z')],
      hasMore: false,
    })
    const { result } = renderHook(() => useMessages('conv-1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(listMessagesPageMock).toHaveBeenCalledWith('conv-1')
    expect(listMessagesMock).not.toHaveBeenCalled()
    expect(result.current.data.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('does not show a Load More affordance for a conversation shorter than the page size', async () => {
    listMessagesPageMock.mockResolvedValueOnce({ messages: [msg('m1', '2026-01-01T00:00:03Z')], hasMore: false })
    const { result } = renderHook(() => useMessages('conv-1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.hasOlder).toBe(false)
  })

  it('exposes hasOlder=true when the bootstrap page reports more history exists', async () => {
    listMessagesPageMock.mockResolvedValueOnce({
      messages: [msg('m1', '2026-01-01T00:00:03Z'), msg('m2', '2026-01-01T00:00:04Z')],
      hasMore: true,
    })
    const { result } = renderHook(() => useMessages('conv-1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.hasOlder).toBe(true)
  })

  it('merges an older page in front of the current window in chronological order, with no duplicates', async () => {
    listMessagesPageMock.mockResolvedValueOnce({
      messages: [msg('m3', '2026-01-01T00:00:03Z'), msg('m4', '2026-01-01T00:00:04Z')],
      hasMore: true,
    })
    const { result } = renderHook(() => useMessages('conv-1'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasOlder).toBe(true)

    listMessagesPageMock.mockResolvedValueOnce({
      messages: [msg('m1', '2026-01-01T00:00:01Z'), msg('m2', '2026-01-01T00:00:02Z')],
      hasMore: false,
    })
    await act(async () => {
      await result.current.loadOlder()
    })

    await waitFor(() => expect(result.current.loadingOlder).toBe(false))
    expect(listMessagesPageMock).toHaveBeenLastCalledWith('conv-1', '2026-01-01T00:00:03Z')
    expect(result.current.data.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
    expect(result.current.hasOlder).toBe(false)

    // No duplicate ids anywhere in the merged, displayed history.
    const ids = result.current.data.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('refetches the window via the open-ended listMessagesSince (not a re-run of the bounded bootstrap) once established, so an invalidate after a send can never drop an already-shown message', async () => {
    listMessagesPageMock.mockResolvedValueOnce({
      messages: [msg('m1', '2026-01-01T00:00:01Z'), msg('m2', '2026-01-01T00:00:02Z')],
      hasMore: true, // establishes a real windowCursor, not the "null = show everything" shortcut
    })
    const { result } = renderHook(() => useMessages('conv-1'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    listMessagesSinceMock.mockResolvedValueOnce([
      msg('m1', '2026-01-01T00:00:01Z'),
      msg('m2', '2026-01-01T00:00:02Z'),
      msg('m3', '2026-01-01T00:00:03Z'), // the new message a send would have persisted
    ])
    await queryClient.invalidateQueries({ queryKey: ['messages', 'conv-1'] })

    await waitFor(() => expect(result.current.data.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']))
    expect(listMessagesSinceMock).toHaveBeenCalledWith('conv-1', '2026-01-01T00:00:01Z')
    expect(listMessagesPageMock).toHaveBeenCalledTimes(1) // bootstrap only — the refetch used listMessagesSince, not another bounded page
  })

  it('resets pagination state (older pages, cursors, hasOlder) when the conversation id changes', async () => {
    listMessagesPageMock.mockResolvedValueOnce({
      messages: [msg('a1', '2026-01-01T00:00:01Z')],
      hasMore: true,
    })
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useMessages(id), {
      wrapper,
      initialProps: { id: 'conv-1' },
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasOlder).toBe(true)

    listMessagesPageMock.mockResolvedValueOnce({
      messages: [msg('b1', '2026-02-01T00:00:01Z')],
      hasMore: false,
    })
    rerender({ id: 'conv-2' })

    await waitFor(() => expect(result.current.data.map((m) => m.id)).toEqual(['b1']))
    expect(result.current.hasOlder).toBe(false)
    expect(listMessagesPageMock).toHaveBeenLastCalledWith('conv-2')
  })
})
