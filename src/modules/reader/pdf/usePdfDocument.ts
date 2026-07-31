import { useQuery } from '@tanstack/react-query'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { downloadDocumentFile } from '@/modules/processing/pipeline/downloadFile'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * UX-13.7.1 — loads the raw PDF file client-side for visual page rendering,
 * independent of document_chunks/extraction (works for any PDF, including
 * ones uploaded before per-page chapters existed). Reuses the exact same
 * pdfjs-dist import + worker setup as the upload-time extractor
 * (processing/extractors/pdf.ts) — see that file's header comment for why
 * the version is pinned to 5.4.624 and must not be bumped without
 * re-checking. Assigning GlobalWorkerOptions.workerSrc here is idempotent
 * with the extractor's own assignment (identical value); whichever module
 * runs first wins, harmlessly.
 *
 * Cached indefinitely per file path — a PDFDocumentProxy is expensive to
 * re-parse and immutable for a given file, the same "never stale" choice
 * reading library data already makes.
 */
export function usePdfDocument(filePath: string | undefined) {
  return useQuery<PDFDocumentProxy>({
    queryKey: ['pdf-document', filePath],
    queryFn: async () => {
      const blob = await downloadDocumentFile(filePath!)
      const arrayBuffer = await blob.arrayBuffer()
      return pdfjsLib.getDocument({ data: arrayBuffer }).promise
    },
    enabled: Boolean(filePath),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
