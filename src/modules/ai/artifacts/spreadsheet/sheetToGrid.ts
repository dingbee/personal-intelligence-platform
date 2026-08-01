import * as XLSX from 'xlsx'
import type { SpreadsheetSheet } from '@/modules/ai/artifacts/spreadsheet/types'

/**
 * Pure — lays `cells` out into a dense 2D grid for preview rendering.
 * Unaddressed positions are `null`. A formula cell renders as `"=<formula>"`
 * text (never computed) — the preview is honest about "this is a formula,
 * open the export to see it calculated," not a fake computed number.
 */
export function sheetToGrid(sheet: SpreadsheetSheet): (string | number | null)[][] {
  let maxRow = -1
  let maxCol = -1
  for (const cell of sheet.cells) {
    const address = XLSX.utils.decode_cell(cell.cell)
    maxRow = Math.max(maxRow, address.r)
    maxCol = Math.max(maxCol, address.c)
  }
  if (maxRow < 0 || maxCol < 0) return []

  const grid: (string | number | null)[][] = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(null))
  for (const cell of sheet.cells) {
    const address = XLSX.utils.decode_cell(cell.cell)
    grid[address.r]![address.c] = cell.formula != null ? `=${cell.formula}` : (cell.value ?? null)
  }
  return grid
}
