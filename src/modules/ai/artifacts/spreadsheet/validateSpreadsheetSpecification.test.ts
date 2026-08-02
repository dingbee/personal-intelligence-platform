import { describe, expect, it } from 'vitest'
import { validateSpreadsheetSpecification } from '@/modules/ai/artifacts/spreadsheet/validateSpreadsheetSpecification'
import type { SpreadsheetSpecification } from '@/modules/ai/artifacts/spreadsheet/specificationTypes'

function validSpec(): SpreadsheetSpecification {
  return {
    title: 'Occupancy Forecast',
    kind: 'template',
    sheets: [
      {
        name: 'Sheet 1',
        columns: [{ name: 'Month' }, { name: 'Available Rooms', type: 'integer' }, { name: 'Sold Rooms' }, { name: 'Occupancy %', type: 'percent' }],
        rows: [
          { values: ['January', 744, 520, null] },
          { values: ['February', 672, 480, null] },
        ],
        formulas: [
          { column: 'Occupancy %', row: 1, expression: '={{Sold Rooms}}/{{Available Rooms}}' },
          { column: 'Occupancy %', row: 2, expression: '{{Sold Rooms}}/{{Available Rooms}}' },
        ],
      },
    ],
  }
}

describe('validateSpreadsheetSpecification', () => {
  it('accepts a well-formed specification', () => {
    expect(validateSpreadsheetSpecification(validSpec())).toEqual({ valid: true, errors: [] })
  })

  it('rejects an empty title', () => {
    const spec = { ...validSpec(), title: '  ' }
    const result = validateSpreadsheetSpecification(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'EMPTY_TITLE' }))
  })

  it('rejects an invalid kind', () => {
    const spec = { ...validSpec(), kind: 'nonsense' as SpreadsheetSpecification['kind'] }
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_KIND' }))
  })

  it('rejects an empty sheet list', () => {
    const spec = { ...validSpec(), sheets: [] }
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'EMPTY_SHEETS' }))
  })

  it('rejects duplicate sheet names', () => {
    const sheet = validSpec().sheets[0]!
    const spec: SpreadsheetSpecification = { title: 'x', kind: 'template', sheets: [sheet, { ...sheet }] }
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_SHEET_NAME' }))
  })

  it('rejects an empty column list', () => {
    const spec = validSpec()
    spec.sheets[0]!.columns = []
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'EMPTY_COLUMNS' }))
  })

  it('rejects duplicate column names', () => {
    const spec = validSpec()
    spec.sheets[0]!.columns = [{ name: 'Month' }, { name: 'Month' }]
    spec.sheets[0]!.rows = [{ values: ['Jan', 'Jan2'] }]
    spec.sheets[0]!.formulas = []
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_COLUMN_NAME' }))
  })

  it('rejects an unsupported formatting hint', () => {
    const spec = validSpec()
    spec.sheets[0]!.columns[1]!.type = 'nonsense' as never
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'UNSUPPORTED_FORMAT' }))
  })

  it('rejects a row whose length does not match the column count', () => {
    const spec = validSpec()
    spec.sheets[0]!.rows[0]!.values = ['January', 744]
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(
      expect.objectContaining({ code: 'ROW_LENGTH_MISMATCH', path: 'sheets[0].rows[0].values' }),
    )
  })

  it('rejects a formula targeting an unknown column', () => {
    const spec = validSpec()
    spec.sheets[0]!.formulas = [{ column: 'Nonexistent', row: 1, expression: '{{Sold Rooms}}' }]
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_COLUMN_REFERENCE', path: 'sheets[0].formulas[0].column' }),
    )
  })

  it('rejects a formula referencing an unknown column via a placeholder', () => {
    const spec = validSpec()
    spec.sheets[0]!.formulas = [{ column: 'Occupancy %', row: 1, expression: '{{Nonexistent}}' }]
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_COLUMN_REFERENCE', path: 'sheets[0].formulas[0].expression' }),
    )
  })

  it('rejects a formula row out of range', () => {
    const spec = validSpec()
    spec.sheets[0]!.formulas = [{ column: 'Occupancy %', row: 99, expression: '{{Sold Rooms}}' }]
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'ROW_OUT_OF_RANGE' }))
  })

  it('rejects a malformed (unclosed) placeholder', () => {
    const spec = validSpec()
    spec.sheets[0]!.formulas = [{ column: 'Occupancy %', row: 1, expression: '{{Sold Rooms' }]
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'MALFORMED_PLACEHOLDER' }))
  })

  it('rejects a malformed (nested) placeholder', () => {
    const spec = validSpec()
    spec.sheets[0]!.formulas = [{ column: 'Occupancy %', row: 1, expression: '{{Sold {{Rooms}}' }]
    expect(validateSpreadsheetSpecification(spec).errors).toContainEqual(expect.objectContaining({ code: 'MALFORMED_PLACEHOLDER' }))
  })

  it('accumulates every violation rather than stopping at the first', () => {
    const spec: SpreadsheetSpecification = { title: '', kind: 'template', sheets: [] }
    const result = validateSpreadsheetSpecification(spec)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})
