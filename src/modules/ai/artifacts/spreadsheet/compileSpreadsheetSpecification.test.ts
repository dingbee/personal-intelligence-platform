import { describe, expect, it } from 'vitest'
import { compileSpreadsheetSpecification } from '@/modules/ai/artifacts/spreadsheet/compileSpreadsheetSpecification'
import { parseMarkdownTableToArtifact } from '@/modules/ai/artifacts/spreadsheet/parseMarkdownTableToArtifact'
import type { SpreadsheetSpecification } from '@/modules/ai/artifacts/spreadsheet/specificationTypes'

describe('compileSpreadsheetSpecification', () => {
  it('assigns A1 addresses in declared column/row order, header on row 1, data from row 2', () => {
    const spec: SpreadsheetSpecification = {
      title: 'Simple',
      kind: 'template',
      sheets: [
        {
          name: 'Sheet 1',
          columns: [{ name: 'A' }, { name: 'B' }],
          rows: [{ values: [1, 2] }, { values: [3, 4] }],
        },
      ],
    }

    const result = compileSpreadsheetSpecification(spec)

    expect(result.sheets[0]!.cells).toEqual([
      { cell: 'A1', value: 'A' },
      { cell: 'B1', value: 'B' },
      { cell: 'A2', value: 1 },
      { cell: 'B2', value: 2 },
      { cell: 'A3', value: 3 },
      { cell: 'B3', value: 4 },
    ])
  })

  it('preserves row order and column order exactly as declared', () => {
    const spec: SpreadsheetSpecification = {
      title: 'Order',
      kind: 'template',
      sheets: [
        {
          name: 'Sheet 1',
          columns: [{ name: 'Third' }, { name: 'First' }, { name: 'Second' }],
          rows: [{ values: ['r1c1', 'r1c2', 'r1c3'] }, { values: ['r2c1', 'r2c2', 'r2c3'] }],
        },
      ],
    }

    const result = compileSpreadsheetSpecification(spec)

    expect(result.sheets[0]!.columns).toEqual(['Third', 'First', 'Second'])
    expect(result.sheets[0]!.cells.find((c) => c.cell === 'A2')).toEqual({ cell: 'A2', value: 'r1c1' })
    expect(result.sheets[0]!.cells.find((c) => c.cell === 'A3')).toEqual({ cell: 'A3', value: 'r2c1' })
  })

  it('substitutes formula placeholders with the same-row A1 address, stripping a leading "="', () => {
    const spec: SpreadsheetSpecification = {
      title: 'Occupancy',
      kind: 'template',
      sheets: [
        {
          name: 'Sheet 1',
          columns: [{ name: 'Available' }, { name: 'Sold' }, { name: 'Occupancy' }],
          rows: [{ values: [744, 520, null] }],
          formulas: [{ column: 'Occupancy', row: 1, expression: '={{Sold}}/{{Available}}' }],
        },
      ],
    }

    const result = compileSpreadsheetSpecification(spec)

    expect(result.sheets[0]!.cells.find((c) => c.cell === 'C2')).toEqual({ cell: 'C2', formula: 'B2/A2' })
  })

  it('accepts an expression with no leading "=" identically', () => {
    const spec: SpreadsheetSpecification = {
      title: 'Occupancy',
      kind: 'template',
      sheets: [
        {
          name: 'Sheet 1',
          columns: [{ name: 'Available' }, { name: 'Sold' }, { name: 'Occupancy' }],
          rows: [{ values: [744, 520, null] }],
          formulas: [{ column: 'Occupancy', row: 1, expression: '{{Sold}}/{{Available}}' }],
        },
      ],
    }

    expect(compileSpreadsheetSpecification(spec).sheets[0]!.cells.find((c) => c.cell === 'C2')).toEqual({ cell: 'C2', formula: 'B2/A2' })
  })

  it('never leaves a stray `value` on a cell overridden by a formula', () => {
    const spec: SpreadsheetSpecification = {
      title: 'x',
      kind: 'template',
      sheets: [
        {
          name: 'Sheet 1',
          columns: [{ name: 'A' }, { name: 'B' }],
          rows: [{ values: [1, null] }],
          formulas: [{ column: 'B', row: 1, expression: '{{A}}' }],
        },
      ],
    }

    const cell = compileSpreadsheetSpecification(spec).sheets[0]!.cells.find((c) => c.cell === 'B2')
    expect(cell).toEqual({ cell: 'B2', formula: 'A2' })
    expect(cell).not.toHaveProperty('value')
  })

  it('preserves formatting hints into columnFormats, index-aligned to columns', () => {
    const spec: SpreadsheetSpecification = {
      title: 'x',
      kind: 'template',
      sheets: [
        {
          name: 'Sheet 1',
          columns: [{ name: 'Label' }, { name: 'Amount', type: 'currency' }, { name: 'Rate', type: 'percent' }],
          rows: [{ values: ['x', 1, 2] }],
        },
      ],
    }

    expect(compileSpreadsheetSpecification(spec).sheets[0]!.columnFormats).toEqual([undefined, 'currency', 'percent'])
  })

  it('omits columnFormats entirely when no column declares a type', () => {
    const spec: SpreadsheetSpecification = {
      title: 'x',
      kind: 'template',
      sheets: [{ name: 'Sheet 1', columns: [{ name: 'A' }], rows: [{ values: [1] }] }],
    }

    expect(compileSpreadsheetSpecification(spec).sheets[0]!.columnFormats).toBeUndefined()
  })

  it('handles empty (null) values', () => {
    const spec: SpreadsheetSpecification = {
      title: 'x',
      kind: 'template',
      sheets: [{ name: 'Sheet 1', columns: [{ name: 'A' }], rows: [{ values: [null] }] }],
    }

    expect(compileSpreadsheetSpecification(spec).sheets[0]!.cells).toContainEqual({ cell: 'A2', value: null })
  })

  it('does not substitute placeholder-looking text inside an ordinary string value', () => {
    const spec: SpreadsheetSpecification = {
      title: 'x',
      kind: 'template',
      sheets: [{ name: 'Sheet 1', columns: [{ name: 'A' }], rows: [{ values: ['Contains {{literal}} braces'] }] }],
    }

    expect(compileSpreadsheetSpecification(spec).sheets[0]!.cells).toContainEqual({ cell: 'A2', value: 'Contains {{literal}} braces' })
  })

  it('preserves mixed numeric and string values within the same column without coercion', () => {
    const spec: SpreadsheetSpecification = {
      title: 'x',
      kind: 'template',
      sheets: [{ name: 'Sheet 1', columns: [{ name: 'A' }], rows: [{ values: [42] }, { values: ['forty-two'] }] }],
    }

    const cells = compileSpreadsheetSpecification(spec).sheets[0]!.cells
    expect(cells).toContainEqual({ cell: 'A2', value: 42 })
    expect(cells).toContainEqual({ cell: 'A3', value: 'forty-two' })
  })

  it('compiles multiple sheets independently, each with its own addressing', () => {
    const spec: SpreadsheetSpecification = {
      title: 'x',
      kind: 'template',
      sheets: [
        { name: 'Sheet A', columns: [{ name: 'X' }], rows: [{ values: [1] }] },
        { name: 'Sheet B', columns: [{ name: 'Y' }], rows: [{ values: [2] }] },
      ],
    }

    const result = compileSpreadsheetSpecification(spec)

    expect(result.sheets).toHaveLength(2)
    expect(result.sheets[0]!.name).toBe('Sheet A')
    expect(result.sheets[1]!.name).toBe('Sheet B')
  })

  it('is deterministic — compiling the same specification twice produces identical output', () => {
    const spec: SpreadsheetSpecification = {
      title: 'Determinism',
      kind: 'data_model',
      sheets: [
        {
          name: 'Sheet 1',
          columns: [{ name: 'A' }, { name: 'B' }],
          rows: [{ values: [1, 2] }],
          formulas: [{ column: 'B', row: 1, expression: '{{A}}' }],
        },
      ],
    }

    expect(compileSpreadsheetSpecification(spec)).toEqual(compileSpreadsheetSpecification(spec))
  })

  describe('cross-verification against Path A (the primary correctness guarantee)', () => {
    it('produces byte-equivalent SpreadsheetArtifactData for the same logical table, markdown-parsed vs. specification-compiled', () => {
      const markdown = [
        '| Month | Available Rooms | Sold Rooms | Occupancy % |',
        '| --- | --- | --- | --- |',
        '| January | 744 | 520 | =C2/B2 |',
        '| February | 672 | 480 | =C3/B3 |',
      ].join('\n')

      const fromMarkdown = parseMarkdownTableToArtifact(markdown)

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
      const fromSpecification = compileSpreadsheetSpecification(spec)

      expect(fromSpecification).toEqual(fromMarkdown)
    })
  })
})
