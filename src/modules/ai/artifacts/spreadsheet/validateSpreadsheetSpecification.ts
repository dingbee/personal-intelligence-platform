import type {
  SpreadsheetColumnType,
  SpreadsheetSpecification,
  SpreadsheetSpecificationSheet,
} from '@/modules/ai/artifacts/spreadsheet/specificationTypes'

const ALLOWED_COLUMN_TYPES: ReadonlySet<SpreadsheetColumnType> = new Set([
  'currency',
  'percent',
  'integer',
  'decimal',
  'date',
  'text',
])

const MAX_SHEETS = 50
const MAX_COLUMNS_PER_SHEET = 100
const MAX_ROWS_PER_SHEET = 10_000
const MAX_CELLS_PER_SHEET = 200_000

const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g

export type SpreadsheetSpecificationValidationErrorCode =
  | 'EMPTY_TITLE'
  | 'INVALID_KIND'
  | 'EMPTY_SHEETS'
  | 'EMPTY_SHEET_NAME'
  | 'DUPLICATE_SHEET_NAME'
  | 'EMPTY_COLUMNS'
  | 'DUPLICATE_COLUMN_NAME'
  | 'UNSUPPORTED_FORMAT'
  | 'ROW_LENGTH_MISMATCH'
  | 'UNKNOWN_COLUMN_REFERENCE'
  | 'ROW_OUT_OF_RANGE'
  | 'MALFORMED_PLACEHOLDER'
  | 'SIZE_LIMIT_EXCEEDED'

export interface SpreadsheetSpecificationValidationError {
  code: SpreadsheetSpecificationValidationErrorCode
  path: string
  message: string
}

export interface SpreadsheetSpecificationValidationResult {
  valid: boolean
  errors: SpreadsheetSpecificationValidationError[]
}

/** A well-formed `{{Name}}` occurrence is stripped first; anything left containing a stray `{{` or `}}` is malformed (unbalanced/nested). */
function hasMalformedPlaceholder(expression: string): boolean {
  const stripped = expression.replace(/\{\{[^{}]*\}\}/g, '')
  return stripped.includes('{{') || stripped.includes('}}')
}

function extractPlaceholderNames(expression: string): string[] {
  return [...expression.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]!.trim())
}

function validateSheet(sheet: SpreadsheetSpecificationSheet, sheetIndex: number, errors: SpreadsheetSpecificationValidationError[]): void {
  const path = `sheets[${sheetIndex}]`

  if (!sheet.name.trim()) {
    errors.push({ code: 'EMPTY_SHEET_NAME', path: `${path}.name`, message: 'Sheet name must not be empty.' })
  }

  if (sheet.columns.length === 0) {
    errors.push({ code: 'EMPTY_COLUMNS', path: `${path}.columns`, message: 'A sheet must declare at least one column.' })
    return
  }
  if (sheet.columns.length > MAX_COLUMNS_PER_SHEET) {
    errors.push({
      code: 'SIZE_LIMIT_EXCEEDED',
      path: `${path}.columns`,
      message: `Sheet has ${sheet.columns.length} columns, exceeding the limit of ${MAX_COLUMNS_PER_SHEET}.`,
    })
  }

  const columnNames = new Set<string>()
  for (const [columnIndex, column] of sheet.columns.entries()) {
    if (columnNames.has(column.name)) {
      errors.push({
        code: 'DUPLICATE_COLUMN_NAME',
        path: `${path}.columns[${columnIndex}]`,
        message: `Duplicate column name "${column.name}" in sheet "${sheet.name}".`,
      })
    }
    columnNames.add(column.name)

    if (column.type !== undefined && !ALLOWED_COLUMN_TYPES.has(column.type)) {
      errors.push({
        code: 'UNSUPPORTED_FORMAT',
        path: `${path}.columns[${columnIndex}].type`,
        message: `Unsupported formatting hint "${column.type}" — allowed values are ${[...ALLOWED_COLUMN_TYPES].join(', ')}.`,
      })
    }
  }

  if (sheet.rows.length > MAX_ROWS_PER_SHEET) {
    errors.push({
      code: 'SIZE_LIMIT_EXCEEDED',
      path: `${path}.rows`,
      message: `Sheet has ${sheet.rows.length} rows, exceeding the limit of ${MAX_ROWS_PER_SHEET}.`,
    })
  }
  if (sheet.rows.length * sheet.columns.length > MAX_CELLS_PER_SHEET) {
    errors.push({
      code: 'SIZE_LIMIT_EXCEEDED',
      path,
      message: `Sheet would produce more than ${MAX_CELLS_PER_SHEET} cells.`,
    })
  }

  sheet.rows.forEach((row, rowIndex) => {
    if (row.values.length !== sheet.columns.length) {
      errors.push({
        code: 'ROW_LENGTH_MISMATCH',
        path: `${path}.rows[${rowIndex}].values`,
        message: `Row has ${row.values.length} values but the sheet declares ${sheet.columns.length} columns.`,
      })
    }
  })

  for (const [formulaIndex, formula] of (sheet.formulas ?? []).entries()) {
    const formulaPath = `${path}.formulas[${formulaIndex}]`

    if (!columnNames.has(formula.column)) {
      errors.push({
        code: 'UNKNOWN_COLUMN_REFERENCE',
        path: `${formulaPath}.column`,
        message: `Formula targets column "${formula.column}", which is not declared on sheet "${sheet.name}".`,
      })
    }

    if (formula.row < 1 || formula.row > sheet.rows.length) {
      errors.push({
        code: 'ROW_OUT_OF_RANGE',
        path: `${formulaPath}.row`,
        message: `Formula row ${formula.row} is out of range for a sheet with ${sheet.rows.length} data rows.`,
      })
    }

    if (hasMalformedPlaceholder(formula.expression)) {
      errors.push({
        code: 'MALFORMED_PLACEHOLDER',
        path: `${formulaPath}.expression`,
        message: `Formula expression "${formula.expression}" contains an unbalanced or nested {{ }} placeholder.`,
      })
      continue
    }

    for (const name of extractPlaceholderNames(formula.expression)) {
      if (!columnNames.has(name)) {
        errors.push({
          code: 'UNKNOWN_COLUMN_REFERENCE',
          path: `${formulaPath}.expression`,
          message: `Formula references unknown column "${name}" via {{${name}}}.`,
        })
      }
    }
  }
}

/**
 * UX-14.4 Phase 3 — deterministic, structural validation only. Never
 * repairs an invalid specification; accumulates every violation found
 * (not just the first) so a caller sees the complete picture, then leaves
 * the decision to reject entirely with the caller — `compileSpreadsheetSpecification`
 * does not call this itself and assumes it already ran (see that file's
 * header comment for the reasoning).
 */
export function validateSpreadsheetSpecification(spec: SpreadsheetSpecification): SpreadsheetSpecificationValidationResult {
  const errors: SpreadsheetSpecificationValidationError[] = []

  if (!spec.title.trim()) {
    errors.push({ code: 'EMPTY_TITLE', path: 'title', message: 'Specification title must not be empty.' })
  }
  if (spec.kind !== 'template' && spec.kind !== 'data_model') {
    errors.push({ code: 'INVALID_KIND', path: 'kind', message: `Invalid kind "${spec.kind}" — must be "template" or "data_model".` })
  }
  if (spec.sheets.length === 0) {
    errors.push({ code: 'EMPTY_SHEETS', path: 'sheets', message: 'A specification must declare at least one sheet.' })
  }
  if (spec.sheets.length > MAX_SHEETS) {
    errors.push({ code: 'SIZE_LIMIT_EXCEEDED', path: 'sheets', message: `Specification has ${spec.sheets.length} sheets, exceeding the limit of ${MAX_SHEETS}.` })
  }

  const sheetNames = new Set<string>()
  spec.sheets.forEach((sheet, sheetIndex) => {
    if (sheetNames.has(sheet.name)) {
      errors.push({ code: 'DUPLICATE_SHEET_NAME', path: `sheets[${sheetIndex}].name`, message: `Duplicate sheet name "${sheet.name}".` })
    }
    sheetNames.add(sheet.name)
    validateSheet(sheet, sheetIndex, errors)
  })

  return { valid: errors.length === 0, errors }
}
