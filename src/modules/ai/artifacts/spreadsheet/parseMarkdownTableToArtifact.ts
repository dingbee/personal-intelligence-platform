import type { SpreadsheetArtifactData, SpreadsheetCell, SpreadsheetSheet } from '@/modules/ai/artifacts/spreadsheet/types'
import { columnLetter } from '@/modules/ai/artifacts/spreadsheet/cellAddressing'

const TABLE_ROW_PATTERN = /^\s*\|(.+)\|\s*$/
const SEPARATOR_ROW_PATTERN = /^\s*\|?[\s:-]+\|[\s:|:-]*$/

function splitRow(line: string): string[] {
  const match = line.match(TABLE_ROW_PATTERN)
  const inner = match ? match[1]! : line
  return inner.split('|').map((cell) => cell.trim())
}

/** Bare formula text (no leading "="), or null if this cell text isn't formula-shaped. */
function parseFormula(text: string): string | null {
  if (text.startsWith('=')) return text.slice(1).trim() || null
  return null
}

function parseValue(text: string): string | number | null {
  if (text === '') return null
  const numeric = Number(text.replace(/,/g, ''))
  return text.trim() !== '' && !Number.isNaN(numeric) ? numeric : text
}

/**
 * UX-14.4 Phase 2 (Path A) — deterministic, no AI call. Converts every
 * markdown table found in `content` into a `SpreadsheetSheet`: the header
 * row becomes `columns` and row 1's cells, each body row becomes
 * subsequent rows. A cell whose text starts with "=" is stored as a
 * `formula` (leading "=" stripped, per the discovery doc's schema — never
 * evaluated here or anywhere else in this codebase); everything else is
 * stored as `value`, coerced to a number when the whole cell parses as
 * one. Multiple tables in one response become multiple sheets, named
 * "Sheet 1", "Sheet 2", ... since markdown tables carry no sheet name.
 */
export function parseMarkdownTableToArtifact(content: string): SpreadsheetArtifactData {
  const lines = content.split('\n')
  const sheets: SpreadsheetSheet[] = []
  let i = 0

  while (i < lines.length) {
    const headerLine = lines[i]!
    const separatorLine = lines[i + 1]

    if (TABLE_ROW_PATTERN.test(headerLine) && separatorLine && SEPARATOR_ROW_PATTERN.test(separatorLine)) {
      const columns = splitRow(headerLine)
      const cells: SpreadsheetCell[] = columns.map((text, columnIndex) => ({
        cell: `${columnLetter(columnIndex)}1`,
        value: text,
      }))

      let rowIndex = 2
      let j = i + 2
      while (j < lines.length && TABLE_ROW_PATTERN.test(lines[j]!)) {
        const rowCells = splitRow(lines[j]!)
        rowCells.forEach((text, columnIndex) => {
          const cell = `${columnLetter(columnIndex)}${rowIndex}`
          const formula = parseFormula(text)
          cells.push(formula ? { cell, formula } : { cell, value: parseValue(text) })
        })
        rowIndex += 1
        j += 1
      }

      sheets.push({ name: `Sheet ${sheets.length + 1}`, columns, cells })
      i = j
      continue
    }

    i += 1
  }

  return { sheets }
}
