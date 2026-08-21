import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRow } from '@/shared/types/database'

/** A chainable Supabase-style query stub: thenable (awaitable) and chainable at once. */
function makeQuery(result: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = []
  const promise = Promise.resolve(result) as Promise<typeof result> & Record<string, (...args: unknown[]) => unknown> & { calls: typeof calls }
  const methods = ['select', 'order', 'eq', 'is', 'ilike', 'in', 'insert', 'update', 'delete', 'single', 'maybeSingle']
  for (const method of methods) {
    ;(promise as Record<string, unknown>)[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return promise
    }
  }
  promise.calls = calls
  return promise
}

function doc(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: 'doc-1',
    user_id: 'user-1',
    workspace_id: 'ws-1',
    collection_id: null,
    title: 'Sample',
    file_name: 'sample.pdf',
    file_path: 'user-1/abc-sample.pdf',
    file_type: 'pdf',
    file_size: 1000,
    status: 'ready',
    source: 'upload',
    source_file_id: null,
    source_metadata: {},
    imported_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const { fromMock, storageFromMock, uploadMock, removeMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  storageFromMock: vi.fn(),
  uploadMock: vi.fn(),
  removeMock: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: fromMock, storage: { from: storageFromMock } },
}))
storageFromMock.mockImplementation(() => ({ upload: uploadMock, remove: removeMock }))

import {
  deleteDocument,
  getDocumentTitles,
  getDocumentWithTags,
  listDocuments,
  uploadDocument,
} from '@/modules/library/api/documents'

describe('listDocuments', () => {
  beforeEach(() => fromMock.mockClear())

  it('defaults to newest-first ordering when no sort is given', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listDocuments()
    expect(query.calls).toContainEqual({ method: 'order', args: ['created_at', { ascending: false }] })
  })

  it.each([
    ['oldest', 'created_at', true],
    ['title-asc', 'title', true],
    ['title-desc', 'title', false],
    ['largest', 'file_size', false],
    ['smallest', 'file_size', true],
  ] as const)('maps sort option %s to column %s (ascending: %s)', async (sort, column, ascending) => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listDocuments({ sort })
    expect(query.calls).toContainEqual({ method: 'order', args: [column, { ascending }] })
  })

  it('applies no collection filter at all when collectionId is omitted ("All")', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listDocuments({})
    expect(query.calls.some((c) => c.method === 'is' || c.method === 'eq')).toBe(false)
  })

  it('filters to uncategorized documents with .is when collectionId is explicitly null', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listDocuments({ collectionId: null })
    expect(query.calls).toContainEqual({ method: 'is', args: ['collection_id', null] })
  })

  it('filters to a specific collection with .eq when collectionId is a string', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listDocuments({ collectionId: 'col-1' })
    expect(query.calls).toContainEqual({ method: 'eq', args: ['collection_id', 'col-1'] })
  })

  it('scopes to a workspace when workspaceId is provided', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listDocuments({ workspaceId: 'ws-1' })
    expect(query.calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'ws-1'] })
  })

  it('applies no workspace filter for a falsy workspaceId (backward-compatible "All")', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listDocuments({ workspaceId: null })
    expect(query.calls.some((c) => c.method === 'eq' && c.args[0] === 'workspace_id')).toBe(false)
  })

  it('applies a case-insensitive title search filter', async () => {
    const query = makeQuery({ data: [], error: null })
    fromMock.mockReturnValueOnce(query)
    await listDocuments({ search: 'Report' })
    expect(query.calls).toContainEqual({ method: 'ilike', args: ['title', '%Report%'] })
  })

  it('flattens the nested document_tags join into a plain tags array', async () => {
    const query = makeQuery({
      data: [{ ...doc(), document_tags: [{ tags: { id: 'tag-1', name: 'work' } }] }],
      error: null,
    })
    fromMock.mockReturnValueOnce(query)
    const result = await listDocuments()
    expect(result[0]!.tags).toEqual([{ id: 'tag-1', name: 'work' }])
  })

  it('filters client-side by tagId after fetching, since tags are a many-to-many join the query itself cannot filter', async () => {
    const query = makeQuery({
      data: [
        { ...doc({ id: 'doc-1' }), document_tags: [{ tags: { id: 'tag-1', name: 'work' } }] },
        { ...doc({ id: 'doc-2' }), document_tags: [] },
      ],
      error: null,
    })
    fromMock.mockReturnValueOnce(query)
    const result = await listDocuments({ tagId: 'tag-1' })
    expect(result.map((d) => d.id)).toEqual(['doc-1'])
  })

  it('throws the underlying Supabase error rather than swallowing it', async () => {
    const query = makeQuery({ data: null, error: new Error('db down') })
    fromMock.mockReturnValueOnce(query)
    await expect(listDocuments()).rejects.toThrow('db down')
  })
})

describe('uploadDocument', () => {
  beforeEach(() => {
    fromMock.mockClear()
    storageFromMock.mockClear()
    uploadMock.mockReset()
    removeMock.mockReset()
  })

  it('rejects an unsupported file type before touching storage or the database', async () => {
    const file = new File(['x'], 'malware.exe')
    await expect(
      uploadDocument({ file, userId: 'user-1', collectionId: null, workspaceId: 'ws-1' }),
    ).rejects.toThrow('Unsupported file type')
    expect(uploadMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('stores the file under a userId-scoped, sanitized path and strips the extension for the title', async () => {
    uploadMock.mockResolvedValueOnce({ error: null })
    const insertQuery = makeQuery({ data: doc({ file_name: 'My Report [Q1].pdf' }), error: null })
    fromMock.mockReturnValueOnce(insertQuery)

    const file = new File(['content'], 'My Report [Q1].pdf', { type: 'application/pdf' })
    await uploadDocument({ file, userId: 'user-1', collectionId: null, workspaceId: 'ws-1' })

    expect(uploadMock).toHaveBeenCalledTimes(1)
    const [storagePath] = uploadMock.mock.calls[0] as [string]
    expect(storagePath).toMatch(/^user-1\/[0-9a-f-]+-My_Report__Q1_\.pdf$/)

    const insertCall = insertQuery.calls.find((c) => c.method === 'insert')
    expect(insertCall?.args[0]).toMatchObject({
      user_id: 'user-1',
      workspace_id: 'ws-1',
      collection_id: null,
      title: 'My Report [Q1]',
      file_name: 'My Report [Q1].pdf',
      file_type: 'pdf',
    })
  })

  it('rolls back the uploaded storage object when the database insert fails', async () => {
    uploadMock.mockResolvedValueOnce({ error: null })
    const insertQuery = makeQuery({ data: null, error: new Error('insert failed') })
    fromMock.mockReturnValueOnce(insertQuery)
    removeMock.mockResolvedValueOnce({ error: null })

    const file = new File(['content'], 'notes.txt')
    await expect(
      uploadDocument({ file, userId: 'user-1', collectionId: null, workspaceId: null }),
    ).rejects.toThrow('insert failed')

    expect(removeMock).toHaveBeenCalledTimes(1)
    const [removedPaths] = removeMock.mock.calls[0] as [string[]]
    expect(removedPaths[0]).toMatch(/^user-1\//)
  })

  it('throws and never attempts the database insert when the storage upload itself fails', async () => {
    uploadMock.mockResolvedValueOnce({ error: new Error('storage quota exceeded') })
    const file = new File(['content'], 'notes.txt')
    await expect(
      uploadDocument({ file, userId: 'user-1', collectionId: null, workspaceId: null }),
    ).rejects.toThrow('storage quota exceeded')
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('getDocumentTitles', () => {
  beforeEach(() => fromMock.mockClear())

  it('returns an empty array without querying when given no ids', async () => {
    const result = await getDocumentTitles([])
    expect(result).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('looks up titles with an .in filter for the given ids', async () => {
    const query = makeQuery({ data: [{ id: 'doc-1', title: 'Sample' }], error: null })
    fromMock.mockReturnValueOnce(query)
    const result = await getDocumentTitles(['doc-1'])
    expect(query.calls).toContainEqual({ method: 'in', args: ['id', ['doc-1']] })
    expect(result).toEqual([{ id: 'doc-1', title: 'Sample' }])
  })
})

describe('getDocumentWithTags', () => {
  it('flattens the nested document_tags join the same way listDocuments does', async () => {
    const query = makeQuery({
      data: { ...doc(), document_tags: [{ tags: { id: 'tag-1', name: 'work' } }, { tags: { id: 'tag-2', name: 'urgent' } }] },
      error: null,
    })
    fromMock.mockReturnValueOnce(query)
    const result = await getDocumentWithTags('doc-1')
    expect(result.tags).toEqual([
      { id: 'tag-1', name: 'work' },
      { id: 'tag-2', name: 'urgent' },
    ])
  })
})

describe('deleteDocument', () => {
  beforeEach(() => {
    fromMock.mockClear()
    storageFromMock.mockClear()
    removeMock.mockReset()
  })

  it('removes the storage object before deleting the database row', async () => {
    removeMock.mockResolvedValueOnce({ error: null })
    const deleteQuery = makeQuery({ data: null, error: null })
    fromMock.mockReturnValueOnce(deleteQuery)

    await deleteDocument('doc-1', 'user-1/abc-sample.pdf')

    expect(removeMock).toHaveBeenCalledWith(['user-1/abc-sample.pdf'])
    expect(deleteQuery.calls).toContainEqual({ method: 'delete', args: [] })
    expect(deleteQuery.calls).toContainEqual({ method: 'eq', args: ['id', 'doc-1'] })
  })

  it('never attempts the database delete when removing the storage object fails', async () => {
    removeMock.mockResolvedValueOnce({ error: new Error('storage unavailable') })

    await expect(deleteDocument('doc-1', 'user-1/abc-sample.pdf')).rejects.toThrow('storage unavailable')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('propagates a database delete error even though the storage object was already removed', async () => {
    removeMock.mockResolvedValueOnce({ error: null })
    const deleteQuery = makeQuery({ data: null, error: new Error('row locked') })
    fromMock.mockReturnValueOnce(deleteQuery)

    await expect(deleteDocument('doc-1', 'user-1/abc-sample.pdf')).rejects.toThrow('row locked')
  })
})
