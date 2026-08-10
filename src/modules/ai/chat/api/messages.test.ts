import { describe, expect, it, vi } from 'vitest'
import type { Message } from '@/shared/types/database'

/** A chainable `.select().eq().order().limit()[.lt()|.gte()]` stub that's itself awaitable, mirroring Supabase's real query builder (thenable + chainable at once) closely enough for these two query shapes. */
function makeQuery(result: { data: unknown; error: Error | null }) {
  const calls: { method: string; args: unknown[] }[] = []
  const promise = Promise.resolve(result) as Promise<typeof result> & {
    select: (...args: unknown[]) => typeof promise
    eq: (...args: unknown[]) => typeof promise
    order: (...args: unknown[]) => typeof promise
    limit: (...args: unknown[]) => typeof promise
    lt: (...args: unknown[]) => typeof promise
    gte: (...args: unknown[]) => typeof promise
    calls: typeof calls
  }
  for (const method of ['select', 'eq', 'order', 'limit', 'lt', 'gte'] as const) {
    promise[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return promise
    }
  }
  promise.calls = calls
  return promise
}

function msg(id: string, createdAt: string): Message {
  return { id, conversation_id: 'conv-1', user_id: 'user-1', role: 'user', content: id, context_chunk_ids: [], created_at: createdAt }
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { listMessagesPage, listMessagesSince, MESSAGES_PAGE_SIZE } from '@/modules/ai/chat/api/messages'

/**
 * ARRIYIA Product Completion Phase 2 — the actual pagination math behind
 * the Hub-adjacent chat-history fix: fetching newest-first with a LIMIT of
 * PAGE_SIZE+1 to detect "is there more" without a separate count query,
 * then reversing back to the ascending order every renderer expects.
 */
describe('listMessagesPage', () => {
  it('fetches the newest-first page with limit PAGE_SIZE+1 and reverses it to ascending order', async () => {
    const query = makeQuery({
      data: [msg('m2', '2026-01-01T00:00:02Z'), msg('m1', '2026-01-01T00:00:01Z')], // desc, as Supabase would return
      error: null,
    })
    fromMock.mockReturnValueOnce({ select: () => query })

    const page = await listMessagesPage('conv-1')

    expect(query.calls).toContainEqual({ method: 'order', args: ['created_at', { ascending: false }] })
    expect(query.calls).toContainEqual({ method: 'limit', args: [MESSAGES_PAGE_SIZE + 1] })
    expect(page.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('reports hasMore: false for a conversation shorter than the page size', async () => {
    const query = makeQuery({ data: [msg('m1', '2026-01-01T00:00:01Z')], error: null })
    fromMock.mockReturnValueOnce({ select: () => query })

    const page = await listMessagesPage('conv-1')

    expect(page.hasMore).toBe(false)
    expect(page.messages).toHaveLength(1)
  })

  it('reports hasMore: false for a conversation exactly PAGE_SIZE long', async () => {
    const rows = Array.from({ length: MESSAGES_PAGE_SIZE }, (_, i) => msg(`m${i}`, `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`)).reverse()
    const query = makeQuery({ data: rows, error: null })
    fromMock.mockReturnValueOnce({ select: () => query })

    const page = await listMessagesPage('conv-1')

    expect(page.hasMore).toBe(false)
    expect(page.messages).toHaveLength(MESSAGES_PAGE_SIZE)
  })

  it('reports hasMore: true and trims the extra row for a conversation longer than PAGE_SIZE', async () => {
    const rows = Array.from({ length: MESSAGES_PAGE_SIZE + 1 }, (_, i) => msg(`m${i}`, `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`)).reverse()
    const query = makeQuery({ data: rows, error: null })
    fromMock.mockReturnValueOnce({ select: () => query })

    const page = await listMessagesPage('conv-1')

    expect(page.hasMore).toBe(true)
    expect(page.messages).toHaveLength(MESSAGES_PAGE_SIZE)
    // The extra row trimmed is the oldest one fetched (index 0 — the tail
    // end of the desc-ordered batch), not an arbitrary one.
    expect(page.messages.map((m) => m.id)).not.toContain('m0')
    expect(page.messages.map((m) => m.id)[0]).toBe('m1')
  })

  it('applies an exclusive lt(created_at) filter when a beforeCreatedAt cursor is given (loadOlder\'s own pagination)', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce({ select: () => query })

    await listMessagesPage('conv-1', '2026-01-01T00:00:05Z')

    expect(query.calls).toContainEqual({ method: 'lt', args: ['created_at', '2026-01-01T00:00:05Z'] })
  })

  it('throws the underlying Supabase error rather than silently returning an empty page', async () => {
    const query = makeQuery({ data: null, error: new Error('connection reset') })
    fromMock.mockReturnValueOnce({ select: () => query })

    await expect(listMessagesPage('conv-1')).rejects.toThrow('connection reset')
  })
})

describe('listMessagesSince', () => {
  it('fetches ascending with an inclusive gte(created_at) lower bound and no upper bound', async () => {
    const query = makeQuery({ data: [msg('m1', '2026-01-01T00:00:01Z'), msg('m2', '2026-01-01T00:00:02Z')], error: null })
    fromMock.mockReturnValueOnce({ select: () => query })

    const messages = await listMessagesSince('conv-1', '2026-01-01T00:00:01Z')

    expect(query.calls).toContainEqual({ method: 'gte', args: ['created_at', '2026-01-01T00:00:01Z'] })
    expect(query.calls).toContainEqual({ method: 'order', args: ['created_at', { ascending: true }] })
    expect(messages.map((m) => m.id)).toEqual(['m1', 'm2'])
  })
})
