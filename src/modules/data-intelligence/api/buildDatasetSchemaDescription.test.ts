import { describe, expect, it } from 'vitest'
import { buildDatasetSchemaDescription } from '@/modules/data-intelligence/api/buildDatasetSchemaDescription'
import type { ColumnAnalysis } from '@/modules/processing/spreadsheet/types'

describe('buildDatasetSchemaDescription', () => {
  it('lists every column with its name, type, and meaning', () => {
    const columns: ColumnAnalysis[] = [
      { name: 'Region', columnIndex: 0, dataType: 'category', meaning: 'category', hasFormulas: false, distinctCount: 2, nonEmptyCount: 10 },
      { name: 'Total Price', columnIndex: 1, dataType: 'currency', meaning: 'currency', hasFormulas: false, distinctCount: 8, nonEmptyCount: 10 },
    ]
    const description = buildDatasetSchemaDescription('Sales', columns)

    expect(description).toContain('Sales')
    expect(description).toContain('"Region"')
    expect(description).toContain('category')
    expect(description).toContain('"Total Price"')
    expect(description).toContain('currency')
  })
})
