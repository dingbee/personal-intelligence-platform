import * as XLSX from 'xlsx'
import type { CellObject, WorkBook, WorkSheet } from 'xlsx'
import type { SpreadsheetArtifactData, SpreadsheetSheet } from '@/modules/ai/artifacts/spreadsheet/types'

/**
 * UX-14.4 Phase 2 (Path A) — mirrors the read-side convention exactly:
 * `processing/extractors/spreadsheet.ts`'s `formulaColumnIndexes` reads a
 * formula off `cell.f`; this writes it back the same way. A `formula` cell
 * is written as `{ t: 'n', v: 0, f: formula }` — verified against a real
 * XLSX.write/XLSX.read round trip (see the test file): SheetJS's writer
 * silently *drops* a formula-only cell that has no cached `v`, so the `v: 0`
 * placeholder isn't optional, it's what makes the formula survive the
 * export at all. This is never "computing" the formula — 0 is an inert
 * placeholder every spreadsheet application recalculates the instant it
 * opens the file (the same thing a cell that's never been recalculated in
 * a hand-built workbook looks like); nothing in this codebase performs
 * that recalculation itself.
 */
function buildWorksheet(sheet: SpreadsheetSheet): WorkSheet {
  const ws: WorkSheet = {}
  let minRow = Infinity
  let minCol = Infinity
  let maxRow = 0
  let maxCol = 0

  for (const cell of sheet.cells) {
    const address = XLSX.utils.decode_cell(cell.cell)
    minRow = Math.min(minRow, address.r)
    minCol = Math.min(minCol, address.c)
    maxRow = Math.max(maxRow, address.r)
    maxCol = Math.max(maxCol, address.c)

    const cellObject: CellObject =
      cell.formula != null
        ? { t: 'n', v: 0, f: cell.formula }
        : typeof cell.value === 'number'
          ? { t: 'n', v: cell.value }
          : { t: 's', v: cell.value == null ? '' : String(cell.value) }

    ws[cell.cell] = cellObject
  }

  if (sheet.cells.length > 0) {
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: minRow, c: minCol }, e: { r: maxRow, c: maxCol } })
  }

  return ws
}

/** Pure — builds an in-memory SheetJS workbook, no file I/O. The caller (`exportSpreadsheetArtifact.ts`) turns this into bytes for a download. */
export function buildSpreadsheetWorkbook(data: SpreadsheetArtifactData): WorkBook {
  const workbook = XLSX.utils.book_new()
  for (const sheet of data.sheets) {
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(sheet), sheet.name.slice(0, 31))
  }
  return workbook
}
