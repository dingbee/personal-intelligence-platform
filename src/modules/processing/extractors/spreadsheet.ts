import * as XLSX from 'xlsx'
import type { DocumentFileType } from '@/shared/types/database'
import type { DocumentProcessor, ExtractionResult } from '@/modules/processing/extractors/types'
import { countWords, normalizeText } from '@/modules/processing/extractors/textStats'

/**
 * UX-13 Phase B (Spreadsheet Intelligence) — one chapter per sheet, same
 * "chapters" contract PDF/EPUB extraction already uses, so the existing
 * chapter-aware chunker/document_chunks/RAG chat/summarize/flashcards
 * pipeline picks spreadsheets up unmodified: no new AI plumbing needed
 * for grounded chat over spreadsheet content. Each sheet is serialized as
 * a markdown table of the values SheetJS already read off the file —
 * formula cells included, but only their last-saved computed value
 * (`.v`/formatted text), never the formula itself and never
 * recalculated. Live recalculation is out of scope for this phase.
 */
function serializeSheetAsMarkdownTable(rows: unknown[][]): string {
  const cellToText = (cell: unknown) => (cell === undefined || cell === null ? '' : String(cell).replace(/\|/g, '\\|'))
  const lines: string[] = []
  const header = rows[0] ?? []
  lines.push(`| ${header.map(cellToText).join(' | ')} |`)
  lines.push(`| ${header.map(() => '---').join(' | ')} |`)
  for (const row of rows.slice(1)) {
    lines.push(`| ${row.map(cellToText).join(' | ')} |`)
  }
  return lines.join('\n')
}

async function extract(file: Blob): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const chapters = workbook.SheetNames.map((name, index) => {
    const sheet = workbook.Sheets[name]
    const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) : []
    return { index, title: name, text: normalizeText(serializeSheetAsMarkdownTable(rows)) }
  }).filter((chapter) => chapter.text.trim().length > 0)

  const text = chapters.map((chapter) => `## ${chapter.title}\n\n${chapter.text}`).join('\n\n')

  return {
    text,
    title: null,
    author: null,
    language: null,
    pageCount: chapters.length,
    wordCount: countWords(text),
    charCount: text.length,
    chapters,
  }
}

function createSpreadsheetProcessor(fileType: DocumentFileType): DocumentProcessor {
  return { fileType, extract }
}

export const xlsxProcessor = createSpreadsheetProcessor('xlsx')
export const csvProcessor = createSpreadsheetProcessor('csv')
export const odsProcessor = createSpreadsheetProcessor('ods')
