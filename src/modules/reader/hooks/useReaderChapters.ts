import { useQuery } from '@tanstack/react-query'
import { getDocument } from '@/modules/library/api/documents'
import { listDocumentChunks } from '@/modules/processing/api/chunks'

export interface ReaderChapter {
  index: number
  title: string
  content: string
  /** Ids of the document_chunks this chapter's content is made of — lets note-taking populate source_chunk_ids for provenance. */
  chunkIds: string[]
}

function groupChunksIntoChapters(chunks: Awaited<ReturnType<typeof listDocumentChunks>>): ReaderChapter[] {
  const byChapter = new Map<number, { title: string; parts: string[]; chunkIds: string[] }>()
  const noChapterParts: string[] = []
  const noChapterChunkIds: string[] = []

  for (const chunk of chunks) {
    if (chunk.chapter_index === null) {
      noChapterParts.push(chunk.content)
      noChapterChunkIds.push(chunk.id)
      continue
    }
    const existing = byChapter.get(chunk.chapter_index)
    if (existing) {
      existing.parts.push(chunk.content)
      existing.chunkIds.push(chunk.id)
    } else {
      byChapter.set(chunk.chapter_index, {
        title: chunk.chapter_title ?? `Chapter ${chunk.chapter_index + 1}`,
        parts: [chunk.content],
        chunkIds: [chunk.id],
      })
    }
  }

  const chapters: ReaderChapter[] = Array.from(byChapter.entries())
    .sort(([a], [b]) => a - b)
    .map(([index, { title, parts, chunkIds }]) => ({ index, title, content: parts.join('\n\n'), chunkIds }))

  if (noChapterParts.length > 0) {
    chapters.push({
      index: chapters.length,
      title: 'Full text',
      content: noChapterParts.join('\n\n'),
      chunkIds: noChapterChunkIds,
    })
  }

  return chapters
}

export function useReaderChapters(documentId: string) {
  const documentQuery = useQuery({ queryKey: ['document', documentId], queryFn: () => getDocument(documentId) })
  const chunksQuery = useQuery({
    queryKey: ['document-chunks', documentId],
    queryFn: () => listDocumentChunks(documentId),
  })

  return {
    document: documentQuery.data,
    chapters: chunksQuery.data ? groupChunksIntoChapters(chunksQuery.data) : undefined,
    isLoading: documentQuery.isLoading || chunksQuery.isLoading,
    isError: documentQuery.isError || chunksQuery.isError,
  }
}
