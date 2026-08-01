import * as XLSX from 'xlsx'
import { buildSpreadsheetWorkbook } from '@/modules/ai/artifacts/spreadsheet/buildSpreadsheetWorkbook'
import type { SpreadsheetArtifactData } from '@/modules/ai/artifacts/spreadsheet/types'
import { downloadBinaryFile } from '@/shared/utils/downloadBinaryFile'
import { downloadTextFile } from '@/shared/utils/downloadTextFile'

export type SpreadsheetExportFormat = 'xlsx' | 'csv'

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Mirrors knowledgeExportFilename's slug convention exactly — same filesystem-safe, lowercase-hyphenated shape, extended with the export format's extension. */
export function spreadsheetExportFilename(title: string, format: SpreadsheetExportFormat): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'spreadsheet-artifact'}.${format}`
}

/**
 * Pure — flattens the first sheet to CSV text. CSV has no formula concept,
 * so a formula cell's value is whatever SheetJS's formatter renders for a
 * cell with no cached value (empty) — this is a deliberate, documented
 * limitation (§4 of the discovery doc): CSV export is for literal-value
 * sheets; a sheet with formulas should be exported as XLSX to keep them.
 */
export function buildSpreadsheetCsv(data: SpreadsheetArtifactData): string {
  const firstSheet = data.sheets[0]
  if (!firstSheet) return ''
  const workbook = buildSpreadsheetWorkbook({ sheets: [firstSheet] })
  return XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]!]!)
}

/** Client-side-only export + download trigger — no server round trip, no AI call. Thin orchestration over the pure builders above; not unit-tested, same convention as downloadTextFile's other call sites in this codebase. */
export function exportSpreadsheetArtifact(data: SpreadsheetArtifactData, title: string, format: SpreadsheetExportFormat): void {
  const filename = spreadsheetExportFilename(title, format)

  if (format === 'csv') {
    downloadTextFile(filename, buildSpreadsheetCsv(data), 'text/csv')
    return
  }

  const workbook = buildSpreadsheetWorkbook(data)
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  downloadBinaryFile(filename, bytes, XLSX_MIME_TYPE)
}
