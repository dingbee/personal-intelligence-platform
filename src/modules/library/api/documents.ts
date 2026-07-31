import { supabase } from '@/shared/lib/supabase'
import type { DocumentRow, DocumentStatus } from '@/shared/types/database'
import { fileTypeFromName, sanitizeStorageFilename } from '@/modules/library/utils/fileTypes'

export type DocumentSort = 'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'largest' | 'smallest'

const SORT_COLUMNS: Record<DocumentSort, { column: 'created_at' | 'title' | 'file_size'; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  'title-asc': { column: 'title', ascending: true },
  'title-desc': { column: 'title', ascending: false },
  largest: { column: 'file_size', ascending: false },
  smallest: { column: 'file_size', ascending: true },
}

export interface DocumentFilters {
  collectionId?: string | null
  tagId?: string | null
  search?: string
  /** null/omitted = "All" (backward compatible: no workspace filter applied). */
  workspaceId?: string | null
  /** Defaults to 'newest' (previous hardcoded behavior) when omitted. */
  sort?: DocumentSort
}

export interface DocumentWithTags extends DocumentRow {
  tags: { id: string; name: string }[]
}

export async function listDocuments(filters: DocumentFilters = {}): Promise<DocumentWithTags[]> {
  const { column, ascending } = SORT_COLUMNS[filters.sort ?? 'newest']
  let query = supabase
    .from('documents')
    .select('*, document_tags(tags(id, name))')
    .order(column, { ascending })

  if (filters.collectionId !== undefined) {
    query =
      filters.collectionId === null
        ? query.is('collection_id', null)
        : query.eq('collection_id', filters.collectionId)
  }
  if (filters.workspaceId) {
    query = query.eq('workspace_id', filters.workspaceId)
  }
  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  const documents = (data as unknown as (DocumentRow & {
    document_tags: { tags: { id: string; name: string } }[]
  })[]).map((doc) => ({
    ...doc,
    tags: doc.document_tags.map((dt) => dt.tags),
  }))

  if (filters.tagId) {
    return documents.filter((doc) => doc.tags.some((tag) => tag.id === filters.tagId))
  }
  return documents
}

export async function uploadDocument(params: {
  file: File
  userId: string
  collectionId: string | null
  workspaceId: string | null
}): Promise<DocumentRow> {
  const { file, userId, collectionId, workspaceId } = params
  const fileType = fileTypeFromName(file.name)
  if (!fileType) {
    throw new Error(`Unsupported file type: ${file.name}`)
  }

  const storagePath = `${userId}/${crypto.randomUUID()}-${sanitizeStorageFilename(file.name)}`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { upsert: false })
  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      collection_id: collectionId,
      workspace_id: workspaceId,
      title: file.name.replace(/\.[^/.]+$/, ''),
      file_name: file.name,
      file_path: storagePath,
      file_type: fileType,
      file_size: file.size,
    })
    .select()
    .single()

  if (insertError) {
    await supabase.storage.from('documents').remove([storagePath])
    throw insertError
  }

  return data
}

export async function getDocument(id: string): Promise<DocumentRow> {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

/** UX-7 Phase 2: batch title lookup for reference resolution — a plain ID lookup, no search/embedding involved. */
export async function getDocumentTitles(ids: string[]): Promise<{ id: string; title: string }[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('documents').select('id, title').in('id', ids)
  if (error) throw error
  return data
}

export async function getDocumentWithTags(id: string): Promise<DocumentWithTags> {
  const { data, error } = await supabase
    .from('documents')
    .select('*, document_tags(tags(id, name))')
    .eq('id', id)
    .single()
  if (error) throw error

  const doc = data as unknown as DocumentRow & { document_tags: { tags: { id: string; name: string } }[] }
  return { ...doc, tags: doc.document_tags.map((dt) => dt.tags) }
}

export async function updateDocumentStatus(id: string, status: DocumentStatus): Promise<void> {
  const { error } = await supabase.from('documents').update({ status }).eq('id', id)
  if (error) throw error
}

export async function renameDocument(id: string, title: string): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from('documents')
    .update({ title })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function moveDocument(id: string, collectionId: string | null): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from('documents')
    .update({ collection_id: collectionId })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDocument(id: string, filePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from('documents').remove([filePath])
  if (storageError) throw storageError

  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}
