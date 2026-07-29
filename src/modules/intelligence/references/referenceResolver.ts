import { getChunkLocations } from '@/modules/processing/api/chunks'
import { getDocumentTitles } from '@/modules/library/api/documents'
import type { ChapterReference, DocumentReference, Reference } from '@/modules/intelligence/references/referenceTypes'

export interface ResolveReferencesParams {
  /** The minimal shape referenceResolver needs from AIService's retrieveContext matches. */
  matches: { chunkId: string; documentId: string }[]
}

interface ChunkLocationInput {
  id: string
  document_id: string
  chapter_index: number | null
  chapter_title: string | null
}

/**
 * Pure grouping logic, exported separately for direct unit testing without
 * a Supabase mock. Groups chunk locations by document; a document with any
 * chapter-tagged chunk yields chapter references (deduped by chapter
 * index) instead of a document reference — a chapter chip is strictly more
 * useful, and this is the exact rule the UX-7 brief's own example
 * ("Chapter 4" not "the document") calls for. Documents with no chapter
 * data (non-epub, or the "Full text" bucket) fall back to a document
 * reference.
 */
export function groupChunkLocationsIntoReferences(
  locations: ChunkLocationInput[],
  documentTitles: Map<string, string>,
): Reference[] {
  const byDocument = new Map<string, ChunkLocationInput[]>()
  for (const location of locations) {
    const existing = byDocument.get(location.document_id)
    if (existing) existing.push(location)
    else byDocument.set(location.document_id, [location])
  }

  const references: Reference[] = []
  for (const [documentId, chunkLocations] of byDocument) {
    const documentTitle = documentTitles.get(documentId) ?? 'Untitled document'
    const chapters = chunkLocations.filter(
      (location): location is ChunkLocationInput & { chapter_index: number } => location.chapter_index !== null,
    )

    if (chapters.length === 0) {
      const documentReference: DocumentReference = { type: 'document', id: documentId, title: documentTitle }
      references.push(documentReference)
      continue
    }

    const seenChapters = new Set<number>()
    for (const chapter of chapters) {
      if (seenChapters.has(chapter.chapter_index)) continue
      seenChapters.add(chapter.chapter_index)
      const chapterReference: ChapterReference = {
        type: 'chapter',
        documentId,
        documentTitle,
        chapterIndex: chapter.chapter_index,
        chapterTitle: chapter.chapter_title ?? `Chapter ${chapter.chapter_index + 1}`,
      }
      references.push(chapterReference)
    }
  }

  return references
}

/**
 * UX-7 Phase 2 — resolves references purely from IDs already produced by
 * this turn's RAG retrieval (matches' chunkId/documentId). No AI call, no
 * embedding search: getChunkLocations/getDocumentTitles are plain ID
 * lookups against columns the processing pipeline already writes.
 */
export async function resolveReferences(params: ResolveReferencesParams): Promise<Reference[]> {
  const { matches } = params
  if (matches.length === 0) return []

  const chunkIds = [...new Set(matches.map((match) => match.chunkId))]
  const documentIds = [...new Set(matches.map((match) => match.documentId))]

  const [locations, titles] = await Promise.all([getChunkLocations(chunkIds), getDocumentTitles(documentIds)])
  const titleMap = new Map(titles.map((doc) => [doc.id, doc.title]))

  return groupChunkLocationsIntoReferences(locations, titleMap)
}
