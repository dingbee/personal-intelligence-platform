import { describe, expect, it } from 'vitest'
import { classifyFinancialPattern } from '@/modules/processing/spreadsheet/financialPatterns'
import type { ColumnAnalysis } from '@/modules/processing/spreadsheet/types'

function col(name: string): ColumnAnalysis {
  return { name, columnIndex: 0, dataType: 'text', meaning: 'text', hasFormulas: false, distinctCount: 0, nonEmptyCount: 0 }
}

describe('classifyFinancialPattern', () => {
  it('classifies an income statement (Revenue + Cost + Profit)', () => {
    expect(classifyFinancialPattern([col('Revenue'), col('Cost'), col('Profit'), col('Margin')])).toBe('income-statement')
  })

  it('classifies an expense sheet (Category + Amount + Trend)', () => {
    expect(classifyFinancialPattern([col('Category'), col('Amount'), col('Trend')])).toBe('expense-sheet')
  })

  it('classifies an inventory sheet (SKU + Stock + Movement)', () => {
    expect(classifyFinancialPattern([col('SKU'), col('Stock'), col('Movement')])).toBe('inventory')
  })

  it('classifies a customer sheet (Customer ID + Purchase + Frequency + Value)', () => {
    expect(classifyFinancialPattern([col('Customer ID'), col('Purchase'), col('Frequency'), col('Value')])).toBe('customer-sheet')
  })

  it('classifies the worked sales example (Customer, Date, Revenue, Region, Product)', () => {
    expect(classifyFinancialPattern([col('Customer'), col('Date'), col('Revenue'), col('Region'), col('Product')])).toBe('sales-data')
  })

  it('falls back to unknown for a sheet with no financial signal', () => {
    expect(classifyFinancialPattern([col('Notes'), col('Comment')])).toBe('unknown')
  })

  it('does not misclassify an income statement as an expense sheet (rule order matters)', () => {
    const columns = [col('Category'), col('Revenue'), col('Cost'), col('Profit')]
    expect(classifyFinancialPattern(columns)).toBe('income-statement')
  })
})
