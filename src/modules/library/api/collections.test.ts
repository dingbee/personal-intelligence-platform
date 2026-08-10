import { beforeEach, describe, expect, it, vi } from 'vitest'

function makeQuery(result: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = []
  const promise = Promise.resolve(result) as Promise<typeof result> & Record<string, (...args: unknown[]) => unknown> & { calls: typeof calls }
  const methods = ['select', 'order', 'eq', 'insert', 'update', 'delete', 'single']
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

import { createCollection, deleteCollection, listCollections, renameCollection } from '@/modules/library/api/collections'

describe('listCollections', () => {
  beforeEach(() => fromMock.mockClear())

  it('orders alphabetically by name and applies no workspace filter when omitted', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listCollections()
    expect(query.calls).toContainEqual({ method: 'order', args: ['name', { ascending: true }] })
    expect(query.calls.some((c) => c.method === 'eq')).toBe(false)
  })

  it('scopes to a workspace when one is provided', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listCollections('ws-1')
    expect(query.calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'ws-1'] })
  })

  it('applies no workspace filter for a falsy workspaceId ("All")', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listCollections(null)
    expect(query.calls.some((c) => c.method === 'eq')).toBe(false)
  })

  it('throws the underlying Supabase error', async () => {
    const query = makeQuery({ data: null, error: new Error('connection reset') })
    fromMock.mockReturnValueOnce(query)
    await expect(listCollections()).rejects.toThrow('connection reset')
  })
})

describe('createCollection', () => {
  beforeEach(() => fromMock.mockClear())

  it('inserts with the exact name, parent, user, and workspace given', async () => {
    const query = makeQuery({ data: { id: 'col-1' }, error: null })
    fromMock.mockReturnValueOnce(query)
    await createCollection({ name: 'Research', parentId: 'parent-1', userId: 'user-1', workspaceId: 'ws-1' })
    const insertCall = query.calls.find((c) => c.method === 'insert')
    expect(insertCall?.args[0]).toEqual({
      name: 'Research',
      parent_id: 'parent-1',
      user_id: 'user-1',
      workspace_id: 'ws-1',
    })
  })

  it('allows a null parent for a top-level collection', async () => {
    const query = makeQuery({ data: { id: 'col-1' }, error: null })
    fromMock.mockReturnValueOnce(query)
    await createCollection({ name: 'Top Level', parentId: null, userId: 'user-1', workspaceId: null })
    const insertCall = query.calls.find((c) => c.method === 'insert')
    expect(insertCall?.args[0]).toMatchObject({ parent_id: null, workspace_id: null })
  })
})

describe('renameCollection', () => {
  it('updates only the name for the given id', async () => {
    const query = makeQuery({ data: { id: 'col-1', name: 'New Name' }, error: null })
    fromMock.mockReturnValueOnce(query)
    await renameCollection('col-1', 'New Name')
    expect(query.calls).toContainEqual({ method: 'update', args: [{ name: 'New Name' }] })
    expect(query.calls).toContainEqual({ method: 'eq', args: ['id', 'col-1'] })
  })
})

describe('deleteCollection', () => {
  it('deletes by id and propagates errors instead of swallowing them', async () => {
    const query = makeQuery({ data: null, error: new Error('foreign key violation') })
    fromMock.mockReturnValueOnce(query)
    await expect(deleteCollection('col-1')).rejects.toThrow('foreign key violation')
  })
})
