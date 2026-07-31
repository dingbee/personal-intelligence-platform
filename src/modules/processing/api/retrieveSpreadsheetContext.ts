import { getExtractionMetadata, getSpreadsheetAnalysis } from '@/modules/processing/api/extractionMetadata'
import { formatSpreadsheetContextText } from '@/modules/processing/spreadsheet/formatForChat'

/**
 * UX-13.10 — mirrors retrieveGraphContext's contract exactly (same "never
 * throw, missing data is just null" rule): when the active document is a
 * spreadsheet with computed analysis, formats its precomputed sums/
 * comparisons/trends/anomalies for the chat system prompt, so Chat answers
 * "what were the largest expenses" from the same deterministic figures the
 * Spreadsheet Summary Card shows — never re-deriving them from raw chunk
 * text. Returns null for every non-spreadsheet document, or when nothing's
 * been computed yet (processing still running, or pre-UX-13.10 upload).
 */
export async function retrieveSpreadsheetContext(documentId: string | undefined): Promise<string | null> {
  if (!documentId) return null
  try {
    const metadata = await getExtractionMetadata(documentId)
    const analysis = getSpreadsheetAnalysis(metadata)
    if (!analysis) return null
    return formatSpreadsheetContextText(analysis)
  } catch {
    return null
  }
}
