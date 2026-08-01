import { describe, expect, it } from 'vitest'
import { buildSpreadsheetCsv, spreadsheetExportFilename } from '@/modules/ai/artifacts/spreadsheet/exportSpreadsheetArtifact'
import type { SpreadsheetArtifactData } from '@/modules/ai/artifacts/spreadsheet/types'

describe('spreadsheetExportFilename', () => {
  it('slugifies the title and appends the format extension', () => {
    expect(spreadsheetExportFilename('Occupancy Forecast', 'xlsx')).toBe('occupancy-forecast.xlsx')
    expect(spreadsheetExportFilename('Q1 Revenue / Cost Model!', 'csv')).toBe('q1-revenue-cost-model.csv')
  })

  it('falls back to a generic name for an empty or fully-symbolic title', () => {
    expect(spreadsheetExportFilename('   ', 'xlsx')).toBe('spreadsheet-artifact.xlsx')
  })
})

describe('buildSpreadsheetCsv', () => {
  it('renders the first sheet as CSV', () => {
    const data: SpreadsheetArtifactData = {
      sheets: [{ name: 'Sheet 1', cells: [{ cell: 'A1', value: 'Month' }, { cell: 'B1', value: 'Revenue' }, { cell: 'A2', value: 'Jan' }, { cell: 'B2', value: 10000 }] }],
    }

    const csv = buildSpreadsheetCsv(data)

    expect(csv.trim().split('\n')).toEqual(['Month,Revenue', 'Jan,10000'])
  })

  it('returns an empty string when there are no sheets', () => {
    expect(buildSpreadsheetCsv({ sheets: [] })).toBe('')
  })
})
