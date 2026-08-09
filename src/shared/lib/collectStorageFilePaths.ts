export interface StorageListEntry {
  name: string
  /** Supabase Storage's own convention: a folder pseudo-entry has `id: null`; a real file has a real id. */
  id: string | null
}

export type StorageLister = (path: string, offset: number) => Promise<StorageListEntry[]>

/** Matches Supabase Storage's own default/max page size for `.list()`. */
export const STORAGE_LIST_PAGE_SIZE = 100

/**
 * PIP Sprint 10/10 (account deletion) — Supabase Storage's `.list(path)`
 * is not recursive: a "folder" is really just an entry with `id: null`
 * grouping deeper entries under `${path}/${name}`, and each call is
 * paginated at 100 entries. A caller that lists once and removes what it
 * sees would silently leave nested files behind — real risk here, since
 * the `assets` bucket nests one level deeper (`${userId}/${uuid}/
 * original.ext`) than the flat `documents` bucket (`${userId}/${uuid}-
 * name.ext`). This walks every page of every directory under `prefix`
 * and returns only real file paths, never a folder pseudo-entry.
 *
 * Framework-agnostic (a plain lister callback, not a Supabase client) so
 * it's fully testable without a real Storage backend; the delete-account
 * edge function wires it to `(path, offset) => supabase.storage.from(bucket).list(path, { limit: 100, offset })`.
 */
export async function collectStorageFilePaths(list: StorageLister, prefix: string): Promise<string[]> {
  const filePaths: string[] = []
  let offset = 0

  for (;;) {
    const entries = await list(prefix, offset)
    for (const entry of entries) {
      const fullPath = `${prefix}/${entry.name}`
      if (entry.id === null) {
        filePaths.push(...(await collectStorageFilePaths(list, fullPath)))
      } else {
        filePaths.push(fullPath)
      }
    }
    if (entries.length < STORAGE_LIST_PAGE_SIZE) break
    offset += STORAGE_LIST_PAGE_SIZE
  }

  return filePaths
}
