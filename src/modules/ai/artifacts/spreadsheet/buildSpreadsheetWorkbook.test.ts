import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { buildSpreadsheetWorkbook } from '@/modules/ai/artifacts/spreadsheet/buildSpreadsheetWorkbook'
import type { SpreadsheetArtifactData } from '@/modules/ai/artifacts/spreadsheet/types'

describe('buildSpreadsheetWorkbook', () => {
  it('writes literal values and preserves formula cells as formulas, never computing them', () => {
    const data: SpreadsheetArtifactData = {
      sheets: [
        {
          name: 'Occupancy Forecast',
          columns: ['Month', 'Available Rooms', 'Sold Rooms', 'Occupancy %'],
          cells: [
            { cell: 'A1', value: 'Month' },
            { cell: 'B1', value: 'Available Rooms' },
            { cell: 'C1', value: 'Sold Rooms' },
            { cell: 'D1', value: 'Occupancy %' },
            { cell: 'A2', value: 'January' },
            { cell: 'B2', value: 744 },
            { cell: 'C2', value: 520 },
            { cell: 'D2', formula: 'C2/B2' },
          ],
        },
      ],
    }

    const workbook = buildSpreadsheetWorkbook(data)
    const sheet = workbook.Sheets['Occupancy Forecast']!

    expect(sheet['A2']).toEqual({ t: 's', v: 'January' })
    expect(sheet['B2']).toEqual({ t: 'n', v: 744 })
    // Formula cell: has an `f` (formula) property. `v: 0` is a placeholder,
    // not a computed result — see the round-trip test below for why it has
    // to be there at all (SheetJS drops a formula cell entirely otherwise).
    expect(sheet['D2']).toEqual({ t: 'n', v: 0, f: 'C2/B2' })
  })

  it('survives a real XLSX.write/XLSX.read round trip with the formula intact', () => {
    const data: SpreadsheetArtifactData = {
      sheets: [{ name: 'Sheet 1', cells: [{ cell: 'A1', value: 10 }, { cell: 'B1', value: 5 }, { cell: 'C1', formula: 'A1-B1' }] }],
    }

    const workbook = buildSpreadsheetWorkbook(data)
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const reread = XLSX.read(bytes, { type: 'array' })
    const sheet = reread.Sheets['Sheet 1']!

    expect(sheet['C1']?.f).toBe('A1-B1')
  })

  it('caps sheet names at Excel’s 31-character limit', () => {
    const data: SpreadsheetArtifactData = {
      sheets: [{ name: 'A Very Long Sheet Name That Exceeds The Limit', cells: [{ cell: 'A1', value: 1 }] }],
    }

    const workbook = buildSpreadsheetWorkbook(data)

    expect(workbook.SheetNames[0]!.length).toBeLessThanOrEqual(31)
  })

  it('omits !ref for an empty sheet instead of writing an invalid range', () => {
    const workbook = buildSpreadsheetWorkbook({ sheets: [{ name: 'Empty', cells: [] }] })

    expect(workbook.Sheets['Empty']!['!ref']).toBeUndefined()
  })
})
