import { describe, expect, it } from 'vitest'
import { renderSpreadsheetArtifactMarkdown } from '@/modules/ai/artifacts/spreadsheet/renderSpreadsheetArtifactMarkdown'
import { parseMarkdownTableToArtifact } from '@/modules/ai/artifacts/spreadsheet/parseMarkdownTableToArtifact'
import { compileSpreadsheetSpecification } from '@/modules/ai/artifacts/spreadsheet/compileSpreadsheetSpecification'
import type { SpreadsheetSpecification } from '@/modules/ai/artifacts/spreadsheet/specificationTypes'
import type { SpreadsheetArtifactData } from '@/modules/ai/artifacts/spreadsheet/types'

describe('renderSpreadsheetArtifactMarkdown', () => {
  it('renders a single-sheet table with header, separator, and data rows', () => {
    const data: SpreadsheetArtifactData = {
      sheets: [
        {
          name: 'Sheet 1',
          columns: ['Month', 'Revenue'],
          cells: [
            { cell: 'A1', value: 'Month' },
            { cell: 'B1', value: 'Revenue' },
            { cell: 'A2', value: 'Jan' },
            { cell: 'B2', value: 1000 },
          ],
        },
      ],
    }

    expect(renderSpreadsheetArtifactMarkdown(data)).toBe(
      ['| Month | Revenue |', '| --- | --- |', '| Jan | 1000 |'].join('\n'),
    )
  })

  it('renders a formula cell as literal "=<formula>" text', () => {
    const data: SpreadsheetArtifactData = {
      sheets: [
        {
          name: 'Sheet 1',
          columns: ['A', 'B', 'Total'],
          cells: [
            { cell: 'A1', value: 'A' },
            { cell: 'B1', value: 'B' },
            { cell: 'C1', value: 'Total' },
            { cell: 'A2', value: 1 },
            { cell: 'B2', value: 2 },
            { cell: 'C2', formula: 'A2+B2' },
          ],
        },
      ],
    }

    expect(renderSpreadsheetArtifactMarkdown(data)).toContain('| 1 | 2 | =A2+B2 |')
  })

  it('renders null cells as empty markdown cells', () => {
    const data: SpreadsheetArtifactData = {
      sheets: [
        {
          name: 'Sheet 1',
          columns: ['A', 'B'],
          cells: [
            { cell: 'A1', value: 'A' },
            { cell: 'B1', value: 'B' },
            { cell: 'A2', value: null },
            { cell: 'B2', value: 5 },
          ],
        },
      ],
    }

    expect(renderSpreadsheetArtifactMarkdown(data)).toContain('|  | 5 |')
  })

  it('escapes a pipe character inside a text value so it does not break the table', () => {
    const data: SpreadsheetArtifactData = {
      sheets: [{ name: 'Sheet 1', columns: ['Note'], cells: [{ cell: 'A1', value: 'Note' }, { cell: 'A2', value: 'a | b' }] }],
    }

    expect(renderSpreadsheetArtifactMarkdown(data)).toContain('a \\| b')
  })

  it('precedes each table with a heading only when there is more than one sheet', () => {
    const single: SpreadsheetArtifactData = { sheets: [{ name: 'Forecast', columns: ['A'], cells: [{ cell: 'A1', value: 'A' }] }] }
    expect(renderSpreadsheetArtifactMarkdown(single)).not.toContain('###')

    const multi: SpreadsheetArtifactData = {
      sheets: [
        { name: 'Forecast', columns: ['A'], cells: [{ cell: 'A1', value: 'A' }] },
        { name: 'Assumptions', columns: ['B'], cells: [{ cell: 'A1', value: 'B' }] },
      ],
    }
    const rendered = renderSpreadsheetArtifactMarkdown(multi)
    expect(rendered).toContain('### Forecast')
    expect(rendered).toContain('### Assumptions')
  })

  it('returns an empty string for a sheet with no cells and skips it', () => {
    const data: SpreadsheetArtifactData = { sheets: [{ name: 'Empty', columns: [], cells: [] }] }
    expect(renderSpreadsheetArtifactMarkdown(data)).toBe('')
  })

  describe('render → parse round trip (mirrors the Phase 3 cross-verification pattern)', () => {
    it('rendering a compiled specification then re-parsing it as markdown reproduces equivalent values and formulas', () => {
      const spec: SpreadsheetSpecification = {
        title: 'Occupancy Forecast',
        kind: 'template',
        sheets: [
          {
            name: 'Sheet 1',
            columns: [{ name: 'Month' }, { name: 'Available Rooms' }, { name: 'Sold Rooms' }, { name: 'Occupancy %' }],
            rows: [
              { values: ['January', 744, 520, null] },
              { values: ['February', 672, 480, null] },
            ],
            formulas: [
              { column: 'Occupancy %', row: 1, expression: '{{Sold Rooms}}/{{Available Rooms}}' },
              { column: 'Occupancy %', row: 2, expression: '{{Sold Rooms}}/{{Available Rooms}}' },
            ],
          },
        ],
      }

      const compiled = compileSpreadsheetSpecification(spec)
      const markdown = renderSpreadsheetArtifactMarkdown(compiled)
      const reparsed = parseMarkdownTableToArtifact(markdown)

      expect(reparsed).toEqual(compiled)
    })

    it('preserves formula cells through the round trip for a table with mixed numeric/string columns', () => {
      const data: SpreadsheetArtifactData = {
        sheets: [
          {
            name: 'Sheet 1',
            columns: ['Item', 'Qty', 'Unit Price', 'Line Total'],
            cells: [
              { cell: 'A1', value: 'Item' },
              { cell: 'B1', value: 'Qty' },
              { cell: 'C1', value: 'Unit Price' },
              { cell: 'D1', value: 'Line Total' },
              { cell: 'A2', value: 'Widget' },
              { cell: 'B2', value: 3 },
              { cell: 'C2', value: 9.5 },
              { cell: 'D2', formula: 'B2*C2' },
            ],
          },
        ],
      }

      const reparsed = parseMarkdownTableToArtifact(renderSpreadsheetArtifactMarkdown(data))
      expect(reparsed).toEqual(data)
    })
  })
})
