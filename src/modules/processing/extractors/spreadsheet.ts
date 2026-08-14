import * as XLSX from 'xlsx'
import type { WorkSheet } from 'xlsx'
import type { DocumentFileType } from '@/shared/types/database'
import type { DocumentProcessor, ExtractionResult } from '@/modules/processing/extractors/types'
import { countWords, normalizeText } from '@/modules/processing/extractors/textStats'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'
import type { CellValue, StructuredSheet } from '@/modules/processing/spreadsheet/types'

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

/**
 * UX-13.10 — which columns (0-indexed) have at least one formula cell, read
 * directly off the raw WorkSheet's cell objects (`.f`) rather than the
 * `sheet_to_json`-derived `rows`, which only carries each formula's
 * last-computed value. Cheap: one pass over the sheet's populated cell
 * addresses, no recalculation.
 */
function formulaColumnIndexes(sheet: WorkSheet): Set<number> {
  const columns = new Set<number>()
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue
    const cell = sheet[address]
    if (cell && typeof cell === 'object' && 'f' in cell && cell.f) {
      columns.add(XLSX.utils.decode_cell(address).c)
    }
  }
  return columns
}

/**
 * Data Intelligence Foundation — normalizes one SheetJS cell value to a
 * JSON-safe primitive so the full grid can be persisted verbatim.
 * `spreadsheet.ts` never passes `cellDates` to SheetJS (confirmed by
 * `cellParsing.ts`'s own doc comment), so a date cell always arrives as
 * its Excel serial number here, not a Date object — no Date branch needed.
 */
function toCellValue(cell: unknown): CellValue {
  if (cell === undefined || cell === null) return null
  if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') return cell
  return String(cell)
}

/**
 * Data Intelligence Foundation — builds the persisted structured
 * representation from the exact same typed `rows` grid `analyzeSheet`
 * already computed `columns` from (not a re-parse), so schema and rows
 * can never disagree about what a column means. `rows[0]` is the header
 * and is excluded; every data row is padded/truncated to `columns.length`
 * so `rows[i][j]` always lines up with `columns[j]`, even for a ragged
 * sheet where a trailing row has fewer populated cells than the header.
 */
function buildStructuredSheet(rows: unknown[][], analysis: NonNullable<ReturnType<typeof analyzeSheet>>): StructuredSheet {
  const columnCount = analysis.columns.length
  const dataRows = rows.slice(1).map((row) => Array.from({ length: columnCount }, (_, i) => toCellValue(row[i])))
  return {
    sheetIndex: analysis.sheetIndex,
    sheetName: analysis.sheetName,
    columns: analysis.columns,
    rows: dataRows,
    rowCount: dataRows.length,
  }
}

async function extract(file: Blob): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sheetResults = workbook.SheetNames.map((name, index) => {
    const sheet = workbook.Sheets[name]
    const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) : []
    const chapter = { index, title: name, text: normalizeText(serializeSheetAsMarkdownTable(rows)) }
    const analysis = sheet ? analyzeSheet(rows, index, name, formulaColumnIndexes(sheet)) : null
    const structuredSheet = analysis ? buildStructuredSheet(rows, analysis) : null
    return { chapter, analysis, structuredSheet }
  }).filter((result) => result.chapter.text.trim().length > 0)

  const chapters = sheetResults.map((result) => result.chapter)
  const spreadsheetAnalysis = sheetResults.map((result) => result.analysis).filter((a): a is NonNullable<typeof a> => a !== null)
  const structuredData = sheetResults.map((result) => result.structuredSheet).filter((s): s is NonNullable<typeof s> => s !== null)
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
    spreadsheetAnalysis,
    structuredData,
  }
}

function createSpreadsheetProcessor(fileType: DocumentFileType): DocumentProcessor {
  return { fileType, extract }
}

export const xlsxProcessor = createSpreadsheetProcessor('xlsx')
export const csvProcessor = createSpreadsheetProcessor('csv')
export const odsProcessor = createSpreadsheetProcessor('ods')
