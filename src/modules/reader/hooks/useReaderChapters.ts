import { useQuery } from '@tanstack/react-query'
import { getDocument } from '@/modules/library/api/documents'
import { listDocumentChunks } from '@/modules/processing/api/chunks'

export interface ReaderChapter {
  index: number
  title: string
  content: string
}

function groupChunksIntoChapters(chunks: Awaited<ReturnType<typeof listDocumentChunks>>): ReaderChapter[] {
  const byChapter = new Map<number, { title: string; parts: string[] }>()
  const noChapterParts: string[] = []

  for (const chunk of chunks) {
    if (chunk.chapter_index === null) {
      noChapterParts.push(chunk.content)
      continue
    }
    const existing = byChapter.get(chunk.chapter_index)
    if (existing) existing.parts.push(chunk.content)
    else byChapter.set(chunk.chapter_index, { title: chunk.chapter_title ?? `Chapter ${chunk.chapter_index + 1}`, parts: [chunk.content] })
  }

  const chapters: ReaderChapter[] = Array.from(byChapter.entries())
    .sort(([a], [b]) => a - b)
    .map(([index, { title, parts }]) => ({ index, title, content: parts.join('\n\n') }))

  if (noChapterParts.length > 0) {
    chapters.push({ index: chapters.length, title: 'Full text', content: noChapterParts.join('\n\n') })
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
