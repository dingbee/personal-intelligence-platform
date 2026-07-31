import { describe, expect, it } from 'vitest'
import { detectColumnMeaning, detectColumnType, detectCurrencySymbol } from '@/modules/processing/spreadsheet/columnAnalysis'

describe('detectColumnType', () => {
  it('detects currency from header + numeric values', () => {
    expect(detectColumnType('Revenue', [1000, 2000, 3000])).toBe('currency')
  })

  it('detects currency from $-prefixed text values even without a currency-ish header', () => {
    expect(detectColumnType('Amount Paid', ['$1,000.00', '$250', '$99.99'])).toBe('currency')
  })

  it('detects date from a date-ish header and Excel serial numbers', () => {
    expect(detectColumnType('Date', [45658, 45689, 45717])).toBe('date')
  })

  it('detects date from a date-ish header and date strings', () => {
    expect(detectColumnType('Order Date', ['2025-01-15', '2025-02-20', '2025-03-01'])).toBe('date')
  })

  it('does not call a plain numeric id column a date just because the values are numbers', () => {
    expect(detectColumnType('Employee ID', [1001, 1002, 1003])).toBe('number')
  })

  it('detects category from low-cardinality text', () => {
    expect(detectColumnType('Region', ['West', 'East', 'West', 'East', 'West', 'North'])).toBe('category')
  })

  it('detects plain number for numeric non-currency non-date columns', () => {
    expect(detectColumnType('Quantity', [1, 2, 3, 4, 5])).toBe('number')
  })

  it('falls back to text for high-cardinality free text', () => {
    const notes = Array.from({ length: 20 }, (_, i) => `Note about item ${i} with unique detail`)
    expect(detectColumnType('Notes', notes)).toBe('text')
  })

  it('returns text for an entirely empty column', () => {
    expect(detectColumnType('Empty', [null, undefined, ''])).toBe('text')
  })
})

describe('detectColumnMeaning', () => {
  it('matches the worked example from the spec: Customer, Date, Revenue, Region, Product', () => {
    expect(detectColumnMeaning('Customer', 'category')).toBe('entity')
    expect(detectColumnMeaning('Date', 'date')).toBe('timeline')
    expect(detectColumnMeaning('Revenue', 'currency')).toBe('currency')
    expect(detectColumnMeaning('Region', 'category')).toBe('category')
    expect(detectColumnMeaning('Product', 'category')).toBe('category')
  })

  it('recognizes an identifier column', () => {
    expect(detectColumnMeaning('SKU', 'text')).toBe('identifier')
  })

  it('falls back to metric for a generic numeric column', () => {
    expect(detectColumnMeaning('Quantity', 'number')).toBe('metric')
  })
})

describe('detectCurrencySymbol', () => {
  it('detects USD from a $ in the header', () => {
    expect(detectCurrencySymbol('Amount ($)', [100, 200])).toBe('USD')
  })

  it('detects EUR from € in values', () => {
    expect(detectCurrencySymbol('Amount', ['€100', '€200'])).toBe('EUR')
  })

  it('detects an explicit ISO code in the header', () => {
    expect(detectCurrencySymbol('Revenue (USD)', [100])).toBe('USD')
  })

  it('returns null rather than guessing when there is no symbol/code evidence', () => {
    expect(detectCurrencySymbol('Revenue', [100, 200, 300])).toBeNull()
  })
})
