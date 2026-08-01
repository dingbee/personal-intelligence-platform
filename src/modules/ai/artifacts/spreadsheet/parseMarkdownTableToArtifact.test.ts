import { describe, expect, it } from 'vitest'
import { parseMarkdownTableToArtifact } from '@/modules/ai/artifacts/spreadsheet/parseMarkdownTableToArtifact'

describe('parseMarkdownTableToArtifact', () => {
  it('converts a markdown table into a sheet of addressed cells', () => {
    const content = ['| Month | Revenue | Cost |', '| --- | --- | --- |', '| Jan | 10000 | 5000 |', '| Feb | 12000 | 6000 |'].join('\n')

    const result = parseMarkdownTableToArtifact(content)

    expect(result.sheets).toHaveLength(1)
    const sheet = result.sheets[0]!
    expect(sheet.name).toBe('Sheet 1')
    expect(sheet.columns).toEqual(['Month', 'Revenue', 'Cost'])
    expect(sheet.cells).toContainEqual({ cell: 'A1', value: 'Month' })
    expect(sheet.cells).toContainEqual({ cell: 'B1', value: 'Revenue' })
    expect(sheet.cells).toContainEqual({ cell: 'A2', value: 'Jan' })
    expect(sheet.cells).toContainEqual({ cell: 'B2', value: 10000 })
    expect(sheet.cells).toContainEqual({ cell: 'C2', value: 5000 })
    expect(sheet.cells).toContainEqual({ cell: 'A3', value: 'Feb' })
    expect(sheet.cells).toContainEqual({ cell: 'B3', value: 12000 })
  })

  it('preserves a formula cell without evaluating it', () => {
    const content = ['| Label | Value |', '| --- | --- |', '| Revenue | 10000 |', '| Cost | 5000 |', '| Profit | =B2-B3 |'].join('\n')

    const result = parseMarkdownTableToArtifact(content)
    const cells = result.sheets[0]!.cells

    expect(cells).toContainEqual({ cell: 'B4', formula: 'B2-B3' })
    expect(cells.find((c) => c.cell === 'B4')).not.toHaveProperty('value')
  })

  it('handles multiple tables as separate sheets', () => {
    const content = [
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      'Some prose in between.',
      '',
      '| X | Y |',
      '| --- | --- |',
      '| 3 | 4 |',
    ].join('\n')

    const result = parseMarkdownTableToArtifact(content)

    expect(result.sheets).toHaveLength(2)
    expect(result.sheets[0]!.name).toBe('Sheet 1')
    expect(result.sheets[1]!.name).toBe('Sheet 2')
    expect(result.sheets[1]!.columns).toEqual(['X', 'Y'])
  })

  it('returns no sheets for content with no markdown table', () => {
    expect(parseMarkdownTableToArtifact('Just a normal response with no table in it.')).toEqual({ sheets: [] })
  })

  it('treats a non-numeric, non-formula cell as a string value', () => {
    const content = ['| Region | Status |', '| --- | --- |', '| North | Active |'].join('\n')

    const result = parseMarkdownTableToArtifact(content)

    expect(result.sheets[0]!.cells).toContainEqual({ cell: 'B2', value: 'Active' })
  })
})
