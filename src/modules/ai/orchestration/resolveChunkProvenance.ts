import { getChunkLocations } from '@/modules/processing/api/chunks'
import { getDocumentTitles } from '@/modules/library/api/documents'

/**
 * PIP Sprint 4/10 — the model-facing counterpart of what
 * referenceResolver.ts already computes for the UI's reference chips
 * (same getChunkLocations/getDocumentTitles calls, same data), but
 * resolved before the LLM call instead of after, so the label can be
 * threaded into buildSystemPrompt's own context text — "Test B: where is
 * X mentioned?" has no honest answer if the model was never told which
 * document or page each excerpt came from. Reuses the exact chapter_title
 * column PDF extraction already writes as "Page N" (see pdf.ts) — no
 * fabricated page numbers, and a document with no chapter/page data
 * (docx/txt, or an un-paginated upload) just gets labeled with its title
 * alone.
 *
 * Never throws — a lookup failure here must not turn a working chat
 * answer into a broken one, same contract every other optional context
 * source in this pipeline already follows.
 */
export async function resolveChunkProvenance(matches: { chunkId: string; documentId: string }[]): Promise<Map<string, string>> {
  if (matches.length === 0) return new Map()

  try {
    const chunkIds = [...new Set(matches.map((match) => match.chunkId))]
    const documentIds = [...new Set(matches.map((match) => match.documentId))]
    const [locations, titles] = await Promise.all([getChunkLocations(chunkIds), getDocumentTitles(documentIds)])
    const titleByDocumentId = new Map(titles.map((doc) => [doc.id, doc.title]))

    const provenance = new Map<string, string>()
    for (const location of locations) {
      const title = titleByDocumentId.get(location.document_id) ?? 'Untitled document'
      provenance.set(location.id, location.chapter_title ? `${title} — ${location.chapter_title}` : title)
    }
    return provenance
  } catch {
    return new Map()
  }
}
