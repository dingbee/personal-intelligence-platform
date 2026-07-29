import { supabase } from '@/shared/lib/supabase'
import type { DocumentChunk } from '@/shared/types/database'
import type { Chunk } from '@/modules/processing/chunking/types'

/** Replaces all chunks for a document (delete + insert) so reprocessing never leaves stale rows. */
export async function replaceDocumentChunks(params: {
  documentId: string
  userId: string
  workspaceId: string | null
  chunks: Chunk[]
}): Promise<DocumentChunk[]> {
  const { documentId, userId, workspaceId, chunks } = params

  const { error: deleteError } = await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId)
  if (deleteError) throw deleteError

  if (chunks.length === 0) return []

  const { data, error: insertError } = await supabase
    .from('document_chunks')
    .insert(
      chunks.map((chunk) => ({
        document_id: documentId,
        user_id: userId,
        workspace_id: workspaceId,
        chunk_index: chunk.index,
        content: chunk.content,
        char_start: chunk.charStart,
        char_end: chunk.charEnd,
        token_count: chunk.tokenCount,
        chapter_index: chunk.chapterIndex,
        chapter_title: chunk.chapterTitle,
      })),
    )
    .select()
  if (insertError) throw insertError
  return data
}

export async function listDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
  const { data, error } = await supabase
    .from('document_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
  if (error) throw error
  return data
}

export async function countDocumentChunks(documentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
  if (error) throw error
  return count ?? 0
}

export interface ChunkLocation {
  id: string
  document_id: string
  chapter_index: number | null
  chapter_title: string | null
}

/** UX-7 Phase 2: resolves which chapter each already-retrieved chunk belongs to — a plain ID lookup against columns chunking already writes (chapter_index/chapter_title), no AI/embedding involved. */
export async function getChunkLocations(chunkIds: string[]): Promise<ChunkLocation[]> {
  if (chunkIds.length === 0) return []
  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, document_id, chapter_index, chapter_title')
    .in('id', chunkIds)
  if (error) throw error
  return data
}
