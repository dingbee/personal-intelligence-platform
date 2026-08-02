import type { SpreadsheetSpecification, SpreadsheetSpecificationSheet } from '@/modules/ai/artifacts/spreadsheet/specificationTypes'
import type { SpreadsheetArtifactData, SpreadsheetCell, SpreadsheetSheet } from '@/modules/ai/artifacts/spreadsheet/types'

const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g

/**
 * A1-style column letters for 0-indexed column numbers: 0 -> A, 25 -> Z,
 * 26 -> AA. Intentionally duplicated from `parseMarkdownTableToArtifact.ts`
 * rather than extracted into a shared util in this milestone — this
 * milestone's scope is new files only (types, compiler, validator, tests,
 * docs), not touching Path A's already-shipped, already-verified parser.
 * The discovery doc itself flagged extracting a shared `cellAddressing.ts`
 * as a low-risk future consolidation; this is that flag acted on for the
 * new side only, with the duplication noted as a discovered opportunity
 * in this milestone's implementation report rather than performed
 * unprompted.
 */
function columnLetter(index: number): string {
  let n = index
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letters
}

/** Strips an optional leading "=" (accepted as input syntax per this milestone's brief) so the result matches `SpreadsheetCell.formula`'s existing "no leading =" contract exactly — the same bare-text convention Path A's parser already writes. */
function normalizeFormulaExpression(expression: string): string {
  return expression.startsWith('=') ? expression.slice(1) : expression
}

/** Resolves every `{{ColumnName}}` placeholder to that column's same-row A1 address. Assumes every placeholder name is a real column — validateSpreadsheetSpecification guarantees this before compilation ever runs. */
function resolveFormulaExpression(expression: string, columnIndexByName: Map<string, number>, sheetRow: number): string {
  return normalizeFormulaExpression(expression).replace(PLACEHOLDER_PATTERN, (_match, name: string) => {
    const columnIndex = columnIndexByName.get(name.trim())!
    return `${columnLetter(columnIndex)}${sheetRow}`
  })
}

function compileSheet(sheet: SpreadsheetSpecificationSheet): SpreadsheetSheet {
  const columnIndexByName = new Map(sheet.columns.map((column, index) => [column.name, index]))
  const cells: SpreadsheetCell[] = []
  const cellIndexByAddress = new Map<string, number>()

  function setCell(cell: SpreadsheetCell): void {
    const existingIndex = cellIndexByAddress.get(cell.cell)
    if (existingIndex !== undefined) {
      cells[existingIndex] = cell
    } else {
      cellIndexByAddress.set(cell.cell, cells.length)
      cells.push(cell)
    }
  }

  // Header row (sheet row 1) — column order preserved by iterating `columns` in declared order.
  sheet.columns.forEach((column, columnIndex) => {
    setCell({ cell: `${columnLetter(columnIndex)}1`, value: column.name })
  })

  // Data rows (sheet row 2+) — row order preserved by iterating `rows` in declared order.
  sheet.rows.forEach((row, rowIndex) => {
    const sheetRow = rowIndex + 2
    row.values.forEach((value, columnIndex) => {
      setCell({ cell: `${columnLetter(columnIndex)}${sheetRow}`, value })
    })
  })

  // Formulas override the value cell at their target address — same
  // "one cell, one representation" contract Path A's parser already has
  // (a formula cell never also carries a `value`).
  for (const formula of sheet.formulas ?? []) {
    const columnIndex = columnIndexByName.get(formula.column)!
    const sheetRow = formula.row + 1
    const address = `${columnLetter(columnIndex)}${sheetRow}`
    setCell({ cell: address, formula: resolveFormulaExpression(formula.expression, columnIndexByName, sheetRow) })
  }

  const result: SpreadsheetSheet = {
    name: sheet.name,
    columns: sheet.columns.map((column) => column.name),
    cells,
  }
  if (sheet.columns.some((column) => column.type !== undefined)) {
    result.columnFormats = sheet.columns.map((column) => column.type)
  }
  return result
}

/**
 * UX-14.4 Phase 3 — the deterministic compiler from
 * `docs/ux-14.4-spreadsheet-specification-discovery.md`. Pure: no
 * randomness, no timestamps, no UUID generation, no AI call — compiling
 * the same `SpreadsheetSpecification` twice always produces byte-identical
 * `SpreadsheetArtifactData` (see the determinism test).
 *
 * Assumes `spec` already passed `validateSpreadsheetSpecification` — this
 * function does not re-validate. That split mirrors the discovery doc's
 * own explicit separation of concerns ("the compiler is not a validation
 * layer... should not re-derive or double-check what the validator
 * already confirmed") and keeps compilation to the O(rows × columns) the
 * brief requires, without a second validation pass mixed in.
 *
 * `buildSpreadsheetWorkbook` — the function that turns this output into
 * an actual workbook — is completely untouched by this file: this
 * compiler's only job is producing the same `SpreadsheetArtifactData`
 * shape Path A's markdown parser already produces, so that function never
 * needs to know or care which producer it came from.
 */
export function compileSpreadsheetSpecification(spec: SpreadsheetSpecification): SpreadsheetArtifactData {
  return { sheets: spec.sheets.map(compileSheet) }
}
