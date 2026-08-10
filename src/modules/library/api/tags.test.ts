import { beforeEach, describe, expect, it, vi } from 'vitest'

function makeQuery(result: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = []
  const promise = Promise.resolve(result) as Promise<typeof result> & Record<string, (...args: unknown[]) => unknown> & { calls: typeof calls }
  const methods = ['select', 'order', 'eq', 'insert', 'update', 'delete', 'single', 'maybeSingle']
  for (const method of methods) {
    ;(promise as Record<string, unknown>)[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return promise
    }
  }
  promise.calls = calls
  return promise
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { addTagToDocument, ensureTag, removeTagFromDocument } from '@/modules/library/api/tags'

describe('ensureTag', () => {
  beforeEach(() => fromMock.mockClear())

  it('returns the existing tag when a matching normalized name is found', async () => {
    const query = makeQuery({ data: { id: 'tag-1', name: 'work' }, error: null })
    fromMock.mockReturnValueOnce(query)

    const tag = await ensureTag('  Work  ', 'user-1')

    expect(query.calls).toContainEqual({ method: 'eq', args: ['name', 'work'] })
    expect(tag).toEqual({ id: 'tag-1', name: 'work' })
    // Only the lookup query was needed — no insert attempted for an existing tag.
    expect(query.calls.some((c) => c.method === 'insert')).toBe(false)
  })

  it('creates a new tag, normalized to trimmed lowercase, when none exists', async () => {
    const selectQuery = makeQuery({ data: null, error: null })
    const insertQuery = makeQuery({ data: { id: 'tag-2', name: 'personal' }, error: null })
    fromMock.mockReturnValueOnce(selectQuery).mockReturnValueOnce(insertQuery)

    const tag = await ensureTag('Personal', 'user-1')

    const insertCall = insertQuery.calls.find((c) => c.method === 'insert')
    expect(insertCall?.args[0]).toEqual({ name: 'personal', user_id: 'user-1' })
    expect(tag).toEqual({ id: 'tag-2', name: 'personal' })
  })

  it('propagates a lookup error rather than treating it as "not found"', async () => {
    const selectQuery = makeQuery({ data: null, error: new Error('lookup failed') })
    fromMock.mockReturnValueOnce(selectQuery)
    await expect(ensureTag('work', 'user-1')).rejects.toThrow('lookup failed')
  })
})

describe('addTagToDocument', () => {
  beforeEach(() => fromMock.mockClear())

  it('finds-or-creates the tag, then links it to the document', async () => {
    const selectQuery = makeQuery({ data: { id: 'tag-1', name: 'work' }, error: null })
    const linkQuery = makeQuery({ data: null, error: null })
    fromMock.mockReturnValueOnce(selectQuery).mockReturnValueOnce(linkQuery)

    const tag = await addTagToDocument({ documentId: 'doc-1', tagName: 'Work', userId: 'user-1' })

    const insertCall = linkQuery.calls.find((c) => c.method === 'insert')
    expect(insertCall?.args[0]).toEqual({ document_id: 'doc-1', tag_id: 'tag-1' })
    expect(tag).toEqual({ id: 'tag-1', name: 'work' })
  })

  it('silently ignores a duplicate-attach error (Postgres unique-violation 23505) — the tag is already on the document', async () => {
    const selectQuery = makeQuery({ data: { id: 'tag-1', name: 'work' }, error: null })
    const linkQuery = makeQuery({ data: null, error: { code: '23505', message: 'duplicate key' } })
    fromMock.mockReturnValueOnce(selectQuery).mockReturnValueOnce(linkQuery)

    await expect(
      addTagToDocument({ documentId: 'doc-1', tagName: 'Work', userId: 'user-1' }),
    ).resolves.toEqual({ id: 'tag-1', name: 'work' })
  })

  it('propagates a non-duplicate link error', async () => {
    const selectQuery = makeQuery({ data: { id: 'tag-1', name: 'work' }, error: null })
    const linkQuery = makeQuery({ data: null, error: { code: '42501', message: 'permission denied' } })
    fromMock.mockReturnValueOnce(selectQuery).mockReturnValueOnce(linkQuery)

    await expect(
      addTagToDocument({ documentId: 'doc-1', tagName: 'Work', userId: 'user-1' }),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('removeTagFromDocument', () => {
  it('deletes the exact document-tag pairing, not every tag on the document', async () => {
    const query = makeQuery({ data: null, error: null })
    fromMock.mockReturnValueOnce(query)

    await removeTagFromDocument('doc-1', 'tag-1')

    expect(query.calls).toContainEqual({ method: 'eq', args: ['document_id', 'doc-1'] })
    expect(query.calls).toContainEqual({ method: 'eq', args: ['tag_id', 'tag-1'] })
  })
})
