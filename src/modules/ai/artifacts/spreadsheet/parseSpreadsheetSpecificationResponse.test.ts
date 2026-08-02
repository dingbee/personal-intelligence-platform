import { describe, expect, it } from 'vitest'
import { parseSpreadsheetSpecificationResponse } from '@/modules/ai/artifacts/spreadsheet/parseSpreadsheetSpecificationResponse'

const VALID_SPEC_JSON = JSON.stringify({
  title: 'Occupancy Forecast',
  kind: 'template',
  sheets: [
    {
      name: 'Forecast',
      columns: [{ name: 'Month', type: 'text' }, { name: 'Revenue', type: 'currency' }, { name: 'Expenses', type: 'currency' }],
      rows: [
        { values: ['Jan', 1000, 400] },
        { values: ['Feb', 1200, 450] },
      ],
      formulas: [{ column: 'Revenue', row: 1, expression: '{{Revenue}}-{{Expenses}}' }],
    },
  ],
})

describe('parseSpreadsheetSpecificationResponse', () => {
  it('parses a well-formed JSON object response', () => {
    expect(parseSpreadsheetSpecificationResponse(VALID_SPEC_JSON)).toEqual({
      title: 'Occupancy Forecast',
      kind: 'template',
      sheets: [
        {
          name: 'Forecast',
          columns: [{ name: 'Month', type: 'text' }, { name: 'Revenue', type: 'currency' }, { name: 'Expenses', type: 'currency' }],
          rows: [{ values: ['Jan', 1000, 400] }, { values: ['Feb', 1200, 450] }],
          formulas: [{ column: 'Revenue', row: 1, expression: '{{Revenue}}-{{Expenses}}' }],
        },
      ],
    })
  })

  it('tolerates a markdown code fence around the JSON', () => {
    const fenced = `Here you go:\n\`\`\`json\n${VALID_SPEC_JSON}\n\`\`\``
    expect(parseSpreadsheetSpecificationResponse(fenced).title).toBe('Occupancy Forecast')
  })

  it('tolerates leading/trailing prose around the JSON object', () => {
    const withProse = `Sure, here is the spec:\n${VALID_SPEC_JSON}\nLet me know if you want changes.`
    expect(parseSpreadsheetSpecificationResponse(withProse).title).toBe('Occupancy Forecast')
  })

  it('throws when the response contains no JSON object at all', () => {
    expect(() => parseSpreadsheetSpecificationResponse('Sorry, I cannot build that spreadsheet.')).toThrow()
  })

  it('coerces missing fields to safe, obviously-invalid defaults rather than throwing', () => {
    const result = parseSpreadsheetSpecificationResponse('{}')
    expect(result).toEqual({ title: '', kind: '', sheets: [] })
  })

  it('coerces a sheet missing columns/rows to empty arrays rather than throwing', () => {
    const result = parseSpreadsheetSpecificationResponse(JSON.stringify({ title: 'X', kind: 'data_model', sheets: [{ name: 'Sheet 1' }] }))
    expect(result.sheets).toEqual([{ name: 'Sheet 1', columns: [], rows: [] }])
  })

  it('coerces non-string/non-number row values to null', () => {
    const result = parseSpreadsheetSpecificationResponse(
      JSON.stringify({
        title: 'X',
        kind: 'data_model',
        sheets: [{ name: 'S', columns: [{ name: 'A' }], rows: [{ values: [{ nested: true }] }] }],
      }),
    )
    expect(result.sheets[0]!.rows[0]!.values).toEqual([null])
  })

  it('preserves an invalid kind value rather than silently defaulting it, so validation can reject it explicitly', () => {
    const result = parseSpreadsheetSpecificationResponse(JSON.stringify({ title: 'X', kind: 'spreadsheet', sheets: [] }))
    expect(result.kind).toBe('spreadsheet')
  })
})
