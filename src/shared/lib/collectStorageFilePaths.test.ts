import { describe, expect, it, vi } from 'vitest'
import { collectStorageFilePaths, STORAGE_LIST_PAGE_SIZE, type StorageListEntry } from '@/shared/lib/collectStorageFilePaths'

describe('collectStorageFilePaths', () => {
  it('returns an empty array for an empty prefix', async () => {
    const list = vi.fn(async () => [] as StorageListEntry[])
    expect(await collectStorageFilePaths(list, 'user-1')).toEqual([])
  })

  it('returns real files at the top level, unchanged', async () => {
    const list = vi.fn(async (path: string) =>
      path === 'user-1' ? [{ name: 'a.pdf', id: 'id-a' }, { name: 'b.pdf', id: 'id-b' }] : [],
    )
    const result = await collectStorageFilePaths(list, 'user-1')
    expect(result.sort()).toEqual(['user-1/a.pdf', 'user-1/b.pdf'])
  })

  // The exact shape the `assets` bucket uses: userId/uuid/original.ext,
  // one level deeper than the flat `documents` bucket.
  it('recurses into a nested folder pseudo-entry (id: null) and returns the real file paths beneath it', async () => {
    const list = vi.fn(async (path: string) => {
      if (path === 'user-1') return [{ name: 'asset-uuid', id: null }]
      if (path === 'user-1/asset-uuid') {
        return [
          { name: 'original.jpg', id: 'id-1' },
          { name: 'thumbnail.jpg', id: 'id-2' },
        ]
      }
      return []
    })
    const result = await collectStorageFilePaths(list, 'user-1')
    expect(result.sort()).toEqual(['user-1/asset-uuid/original.jpg', 'user-1/asset-uuid/thumbnail.jpg'])
  })

  it('recurses through multiple levels of nested folders', async () => {
    const list = vi.fn(async (path: string) => {
      if (path === 'root') return [{ name: 'a', id: null }]
      if (path === 'root/a') return [{ name: 'b', id: null }]
      if (path === 'root/a/b') return [{ name: 'file.txt', id: 'id-1' }]
      return []
    })
    const result = await collectStorageFilePaths(list, 'root')
    expect(result).toEqual(['root/a/b/file.txt'])
  })

  it('pages through a directory with more entries than one page', async () => {
    const list = vi.fn(async (path: string, offset: number) => {
      if (path !== 'user-1') return []
      if (offset === 0) return Array.from({ length: STORAGE_LIST_PAGE_SIZE }, (_, i) => ({ name: `f${i}.pdf`, id: `id-${i}` }))
      if (offset === STORAGE_LIST_PAGE_SIZE) return [{ name: 'last.pdf', id: 'id-last' }]
      return []
    })
    const result = await collectStorageFilePaths(list, 'user-1')
    expect(result).toHaveLength(STORAGE_LIST_PAGE_SIZE + 1)
    expect(result).toContain('user-1/last.pdf')
    expect(list).toHaveBeenCalledWith('user-1', 0)
    expect(list).toHaveBeenCalledWith('user-1', STORAGE_LIST_PAGE_SIZE)
  })

  it('stops paging as soon as a page comes back under the page size, without an extra call', async () => {
    const list = vi.fn(async () => [{ name: 'only.pdf', id: 'id-1' }])
    await collectStorageFilePaths(list, 'user-1')
    expect(list).toHaveBeenCalledTimes(1)
  })
})
