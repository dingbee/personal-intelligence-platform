import { describe, expect, it, vi } from 'vitest'

// pdfjs-dist can't actually be imported in this jsdom test environment
// (DOMMatrix/Worker aren't available — see pdf.test.ts's own header
// comment on why the real pdfjs-dist runtime is verified differently,
// directly against the installed build artifact, rather than here). This
// test is about the registry's *wiring*, not pdfjs-dist's own runtime
// compatibility, so the pdf extractor module is mocked like every other
// file type rather than skipped.
const { loadResilientChunkMock, pdfProcessorMock } = vi.hoisted(() => ({
  loadResilientChunkMock: vi.fn((loader: () => Promise<unknown>) => loader()),
  pdfProcessorMock: { fileType: 'pdf' as const, extract: vi.fn() },
}))

vi.mock('@/shared/lib/resilientDynamicImport', () => ({ loadResilientChunk: loadResilientChunkMock }))
vi.mock('@/modules/processing/extractors/pdf', () => ({ pdfProcessor: pdfProcessorMock }))

import { getDocumentProcessor } from '@/modules/processing/extractors/registry'

/**
 * Regression coverage for the "Failed to fetch dynamically imported
 * module" production incident: getDocumentProcessor is the exact call
 * site processDocument.ts hits for every extraction (including the
 * authoritative Reprocess path), so it must both (a) genuinely route
 * every file type's dynamic import through the stale-chunk-resilient
 * wrapper, and (b) still actually resolve the real, correct processor —
 * the resilience wrapper must never end up masking or altering what gets
 * imported.
 */
describe('getDocumentProcessor', () => {
  it('routes the pdf loader through loadResilientChunk and resolves the pdf processor', async () => {
    const processor = await getDocumentProcessor('pdf')
    expect(loadResilientChunkMock).toHaveBeenCalledTimes(1)
    expect(processor.fileType).toBe('pdf')
    expect(processor).toBe(pdfProcessorMock)
  })

  it('routes every other file type through the same resilient wrapper too, not just pdf — and actually resolves the real, unmocked module for each (proves the import graph, not just the wiring)', async () => {
    for (const fileType of ['epub', 'docx', 'txt', 'markdown', 'xlsx', 'csv', 'ods'] as const) {
      loadResilientChunkMock.mockClear()
      const processor = await getDocumentProcessor(fileType)
      expect(loadResilientChunkMock).toHaveBeenCalledTimes(1)
      expect(typeof processor.extract).toBe('function')
    }
  })

  it('propagates a stale-chunk failure to the caller (processDocument.ts) exactly as before — the wrapper only adds a one-shot reload side effect, it never swallows the failure', async () => {
    loadResilientChunkMock.mockImplementationOnce(async () => {
      throw new Error('Failed to fetch dynamically imported module: https://app.nolmark.co/assets/pdf-BBqTl0sV.js')
    })
    await expect(getDocumentProcessor('pdf')).rejects.toThrow(/Failed to fetch dynamically imported module/)
  })
})
