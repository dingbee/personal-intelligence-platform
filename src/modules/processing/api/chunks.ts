import { supabase } from '@/shared/lib/supabase'
import type { DocumentChunk } from '@/shared/types/database'
import type { Chunk } from '@/modules/processing/chunking/types'

/** Replaces all chunks for a document (delete + insert) so reprocessing never leaves stale rows. */
export async function replaceDocumentChunks(params: {
  documentId: string
  userId: string
  chunks: Chunk[]
}): Promise<DocumentChunk[]> {
  const { documentId, userId, chunks } = params

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
