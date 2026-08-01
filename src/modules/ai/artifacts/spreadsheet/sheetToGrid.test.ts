import { describe, expect, it } from 'vitest'
import { sheetToGrid } from '@/modules/ai/artifacts/spreadsheet/sheetToGrid'
import type { SpreadsheetSheet } from '@/modules/ai/artifacts/spreadsheet/types'

describe('sheetToGrid', () => {
  it('lays cells out into a dense grid by row/column', () => {
    const sheet: SpreadsheetSheet = {
      name: 'Sheet 1',
      cells: [
        { cell: 'A1', value: 'Month' },
        { cell: 'B1', value: 'Revenue' },
        { cell: 'A2', value: 'Jan' },
        { cell: 'B2', value: 10000 },
      ],
    }

    expect(sheetToGrid(sheet)).toEqual([
      ['Month', 'Revenue'],
      ['Jan', 10000],
    ])
  })

  it('renders a formula cell as "=formula" text, never computed', () => {
    const sheet: SpreadsheetSheet = { name: 'Sheet 1', cells: [{ cell: 'A1', value: 10 }, { cell: 'B1', value: 5 }, { cell: 'C1', formula: 'A1-B1' }] }

    expect(sheetToGrid(sheet)).toEqual([[10, 5, '=A1-B1']])
  })

  it('fills unaddressed positions with null', () => {
    const sheet: SpreadsheetSheet = { name: 'Sheet 1', cells: [{ cell: 'A1', value: 'x' }, { cell: 'C2', value: 'y' }] }

    expect(sheetToGrid(sheet)).toEqual([
      ['x', null, null],
      [null, null, 'y'],
    ])
  })

  it('returns an empty grid for a sheet with no cells', () => {
    expect(sheetToGrid({ name: 'Empty', cells: [] })).toEqual([])
  })
})
