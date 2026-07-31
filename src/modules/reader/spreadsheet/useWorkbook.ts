import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import type { WorkBook } from 'xlsx'
import { downloadDocumentFile } from '@/modules/processing/pipeline/downloadFile'

/**
 * UX-13 Phase B — loads the raw spreadsheet file client-side for the grid
 * view, independent of document_chunks/processing status, same reasoning
 * as usePdfDocument: works immediately after upload, and the interactive
 * grid needs real per-cell structure a chunked-text summary can't give it.
 * Cached indefinitely per file path — a parsed workbook is expensive to
 * re-parse and immutable for a given file.
 */
export function useWorkbook(filePath: string | undefined) {
  return useQuery<WorkBook>({
    queryKey: ['workbook', filePath],
    queryFn: async () => {
      const blob = await downloadDocumentFile(filePath!)
      const arrayBuffer = await blob.arrayBuffer()
      return XLSX.read(arrayBuffer, { type: 'array' })
    },
    enabled: Boolean(filePath),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
