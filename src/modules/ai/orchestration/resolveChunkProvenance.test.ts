import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getChunkLocationsMock, getDocumentTitlesMock } = vi.hoisted(() => ({
  getChunkLocationsMock: vi.fn(async () => [] as { id: string; document_id: string; chapter_index: number | null; chapter_title: string | null }[]),
  getDocumentTitlesMock: vi.fn(async () => [] as { id: string; title: string }[]),
}))
vi.mock('@/modules/processing/api/chunks', () => ({ getChunkLocations: getChunkLocationsMock }))
vi.mock('@/modules/library/api/documents', () => ({ getDocumentTitles: getDocumentTitlesMock }))

import { resolveChunkProvenance } from '@/modules/ai/orchestration/resolveChunkProvenance'

/**
 * PIP Sprint 4/10 — Test B's requirement ("where is ARRIYIA mentioned?")
 * has no honest answer unless the model itself is told which document and
 * page each excerpt came from. This reuses the exact chunk-location data
 * referenceResolver.ts already fetches for the UI's chips — proving here
 * that the same real page/chapter data (never fabricated) is available to
 * label the model's own context.
 */
describe('resolveChunkProvenance', () => {
  beforeEach(() => {
    getChunkLocationsMock.mockClear()
    getDocumentTitlesMock.mockClear()
  })

  it('labels a chunk with "Document Title — Page N" when chapter data exists (PDF pages)', async () => {
    getChunkLocationsMock.mockResolvedValueOnce([{ id: 'chunk-1', document_id: 'doc-1', chapter_index: 4, chapter_title: 'Page 5' }])
    getDocumentTitlesMock.mockResolvedValueOnce([{ id: 'doc-1', title: 'Quarterly Report.pdf' }])

    const result = await resolveChunkProvenance([{ chunkId: 'chunk-1', documentId: 'doc-1' }])
    expect(result.get('chunk-1')).toBe('Quarterly Report.pdf — Page 5')
  })

  it('labels a chunk with just the document title when there is no chapter/page data (e.g. a .txt or .docx upload) — never fabricates a page', async () => {
    getChunkLocationsMock.mockResolvedValueOnce([{ id: 'chunk-1', document_id: 'doc-1', chapter_index: null, chapter_title: null }])
    getDocumentTitlesMock.mockResolvedValueOnce([{ id: 'doc-1', title: 'Notes.txt' }])

    const result = await resolveChunkProvenance([{ chunkId: 'chunk-1', documentId: 'doc-1' }])
    expect(result.get('chunk-1')).toBe('Notes.txt')
  })

  it('falls back to "Untitled document" for a document id with no title row, rather than throwing', async () => {
    getChunkLocationsMock.mockResolvedValueOnce([{ id: 'chunk-1', document_id: 'doc-missing', chapter_index: null, chapter_title: null }])
    getDocumentTitlesMock.mockResolvedValueOnce([])

    const result = await resolveChunkProvenance([{ chunkId: 'chunk-1', documentId: 'doc-missing' }])
    expect(result.get('chunk-1')).toBe('Untitled document')
  })

  it('returns an empty map immediately for no matches, without calling either API', async () => {
    const result = await resolveChunkProvenance([])
    expect(result.size).toBe(0)
    expect(getChunkLocationsMock).not.toHaveBeenCalled()
  })

  it('never throws — returns an empty map when the lookup fails', async () => {
    getChunkLocationsMock.mockRejectedValueOnce(new Error('network error'))
    const result = await resolveChunkProvenance([{ chunkId: 'chunk-1', documentId: 'doc-1' }])
    expect(result.size).toBe(0)
  })
})
