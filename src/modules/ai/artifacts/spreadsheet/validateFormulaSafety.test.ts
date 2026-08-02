import { describe, expect, it } from 'vitest'
import { validateFormulaSafety } from '@/modules/ai/artifacts/spreadsheet/validateFormulaSafety'

describe('validateFormulaSafety', () => {
  it('accepts plain arithmetic over cell references', () => {
    expect(validateFormulaSafety('A1-B1')).toEqual({ safe: true, violations: [] })
    expect(validateFormulaSafety('A1*B2/C3')).toEqual({ safe: true, violations: [] })
    expect(validateFormulaSafety('(A1+B1)*0.5')).toEqual({ safe: true, violations: [] })
  })

  it('accepts absolute references with "$"', () => {
    expect(validateFormulaSafety('$A$1+B2')).toEqual({ safe: true, violations: [] })
  })

  it('accepts each allowed function with cell-reference arguments', () => {
    for (const fn of ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT']) {
      expect(validateFormulaSafety(`${fn}(A1,A2,A3)`)).toEqual({ safe: true, violations: [] })
    }
  })

  it('accepts allowed functions case-insensitively', () => {
    expect(validateFormulaSafety('sum(A1,A2)')).toEqual({ safe: true, violations: [] })
  })

  it('accepts comparison operators', () => {
    expect(validateFormulaSafety('A1>=B1')).toEqual({ safe: true, violations: [] })
  })

  it('rejects a disallowed function call, e.g. WEBSERVICE', () => {
    const result = validateFormulaSafety('WEBSERVICE(A1)')
    expect(result.safe).toBe(false)
    expect(result.violations).toEqual([
      expect.objectContaining({ code: 'DISALLOWED_FUNCTION', detail: 'WEBSERVICE' }),
    ])
  })

  it('rejects HYPERLINK', () => {
    const result = validateFormulaSafety('HYPERLINK(A1)')
    expect(result.safe).toBe(false)
    expect(result.violations[0]?.code).toBe('DISALLOWED_FUNCTION')
  })

  it('rejects IMPORTXML with its quote/comma payload flagged as disallowed characters', () => {
    const result = validateFormulaSafety('IMPORTXML("http://evil.example","//x")')
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.code === 'DISALLOWED_CHARACTER' && v.detail === '"')).toBe(true)
  })

  it('rejects a DDE-style payload on its disallowed characters (|, \', !)', () => {
    const result = validateFormulaSafety(`cmd|'/c calc'!A1`)
    expect(result.safe).toBe(false)
    const codes = result.violations.map((v) => v.detail)
    expect(codes).toEqual(expect.arrayContaining(['|', "'", '!']))
  })

  it('rejects a bare word that is neither a cell reference nor a function call', () => {
    const result = validateFormulaSafety('TRUE')
    expect(result.safe).toBe(false)
    expect(result.violations).toEqual([
      expect.objectContaining({ code: 'DISALLOWED_IDENTIFIER', detail: 'TRUE' }),
    ])
  })

  it('rejects a column-letter run longer than 3 letters even with trailing digits', () => {
    const result = validateFormulaSafety('ABCD1')
    expect(result.safe).toBe(false)
    expect(result.violations[0]?.code).toBe('DISALLOWED_IDENTIFIER')
  })

  it('accumulates multiple violations rather than stopping at the first', () => {
    const result = validateFormulaSafety('WEBSERVICE(A1)+HYPERLINK(B1)')
    expect(result.violations).toHaveLength(2)
    expect(result.violations.map((v) => v.detail)).toEqual(['WEBSERVICE', 'HYPERLINK'])
  })

  it('treats an empty expression as safe (no content to violate the allowlist)', () => {
    expect(validateFormulaSafety('')).toEqual({ safe: true, violations: [] })
  })
})
