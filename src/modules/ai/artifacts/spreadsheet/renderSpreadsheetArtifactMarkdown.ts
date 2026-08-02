import type { SpreadsheetArtifactData, SpreadsheetSheet } from '@/modules/ai/artifacts/spreadsheet/types'
import { decodeCellAddress } from '@/modules/ai/artifacts/spreadsheet/cellAddressing'

/**
 * UX-14.4.2 — the last step of the generation pipeline: turns already
 * validated, already compiled `SpreadsheetArtifactData` into the markdown
 * table text shown as NOVA's chat reply. Lays out its own grid via
 * `decodeCellAddress` rather than reusing `sheetToGrid.ts` — that
 * function's `XLSX.utils.decode_cell` pulls in the ~330KB `xlsx` library,
 * which is fine behind `NoteDetailPage.tsx`'s `React.lazy()` boundary but
 * is reached here from `generateSpreadsheetArtifactAction.ts`, an
 * eagerly-registered Workspace Action imported unconditionally from
 * `App.tsx`. Reusing `sheetToGrid` regressed the main bundle by ~430KB in
 * this milestone's first build (caught by `verify:bundle`); this avoids
 * the dependency entirely instead of trying to lazy-load a synchronous,
 * pure function. A formula cell renders as literal `"=<formula>"` text —
 * the same convention `sheetToGrid` uses — which is exactly the syntax
 * `parseMarkdownTableToArtifact`'s `parseFormula` expects, so the existing
 * (unchanged) Save-to-Notes flow can still turn this same markdown back
 * into an equivalent `SpreadsheetArtifactData` once the user explicitly
 * approves saving it. This function never persists anything itself.
 */
function formatCell(value: string | number | null): string {
  if (value == null) return ''
  const text = typeof value === 'number' ? String(value) : value
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function layoutGrid(sheet: SpreadsheetSheet): (string | number | null)[][] {
  let maxRow = -1
  let maxCol = -1
  for (const cell of sheet.cells) {
    const address = decodeCellAddress(cell.cell)
    maxRow = Math.max(maxRow, address.row)
    maxCol = Math.max(maxCol, address.col)
  }
  if (maxRow < 0 || maxCol < 0) return []

  const grid: (string | number | null)[][] = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(null))
  for (const cell of sheet.cells) {
    const address = decodeCellAddress(cell.cell)
    grid[address.row]![address.col] = cell.formula != null ? `=${cell.formula}` : (cell.value ?? null)
  }
  return grid
}

function renderSheetMarkdown(sheet: SpreadsheetSheet): string {
  const grid = layoutGrid(sheet)
  if (grid.length === 0) return ''

  const [header, ...body] = grid
  const columnCount = header!.length
  const headerRow = `| ${header!.map(formatCell).join(' | ')} |`
  const separatorRow = `| ${Array(columnCount).fill('---').join(' | ')} |`
  const bodyRows = body.map((row) => `| ${row.map(formatCell).join(' | ')} |`)

  return [headerRow, separatorRow, ...bodyRows].join('\n')
}

/**
 * Pure. One markdown table per sheet; when there's more than one sheet,
 * each table is preceded by a `### <sheet name>` heading purely for
 * readability in chat — `parseMarkdownTableToArtifact` ignores headings
 * entirely, so this has no bearing on what gets saved.
 */
export function renderSpreadsheetArtifactMarkdown(data: SpreadsheetArtifactData): string {
  const multiSheet = data.sheets.length > 1
  const sections = data.sheets
    .map((sheet) => {
      const table = renderSheetMarkdown(sheet)
      if (!table) return ''
      return multiSheet ? `### ${sheet.name}\n\n${table}` : table
    })
    .filter((section) => section !== '')

  return sections.join('\n\n')
}
