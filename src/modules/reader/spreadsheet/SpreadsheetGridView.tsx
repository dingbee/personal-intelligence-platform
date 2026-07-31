import * as XLSX from 'xlsx'
import type { WorkSheet } from 'xlsx'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const MAX_DISPLAY_ROWS = 500
const MAX_DISPLAY_COLS = 50

function cellToText(cell: unknown): string {
  return cell === undefined || cell === null ? '' : String(cell)
}

/**
 * UX-13 Phase B — one sheet rendered as a real HTML table of its cached
 * cell values (SheetJS's sheet_to_json already resolves formulas to
 * their last-saved result, never re-evaluating them — see
 * extractors/spreadsheet.ts's header comment for why that's this phase's
 * deliberate scope). Capped at 500 rows / 50 columns so a very large
 * sheet doesn't turn into tens of thousands of DOM nodes; the full data
 * is still fully extracted/chunked/chattable regardless of this display
 * cap, which is display-only.
 */
export function SpreadsheetGridView({ sheet }: { sheet: WorkSheet | undefined }) {
  if (!sheet) {
    return <EmptyState title="Sheet is empty" description="This sheet has no data." />
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
  if (rows.length === 0) {
    return <EmptyState title="Sheet is empty" description="This sheet has no data." />
  }

  const truncatedRows = rows.length > MAX_DISPLAY_ROWS
  const displayRows = rows.slice(0, MAX_DISPLAY_ROWS)
  const colCount = Math.min(MAX_DISPLAY_COLS, Math.max(...displayRows.map((row) => row.length)))
  const truncatedCols = Math.max(...rows.map((row) => row.length)) > MAX_DISPLAY_COLS

  return (
    <div className="flex flex-col gap-2">
      {(truncatedRows || truncatedCols) && (
        <p className="text-xs text-[var(--color-ink-muted)]">
          Showing the first {MAX_DISPLAY_ROWS} rows{truncatedCols ? ` and ${MAX_DISPLAY_COLS} columns` : ''} for display — the
          full sheet is still fully searchable and chattable.
        </p>
      )}
      <div className="overflow-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? 'bg-[var(--color-canvas)] font-medium' : 'odd:bg-[var(--surface-inset)]'}>
                {Array.from({ length: colCount }, (_, colIndex) => (
                  <td key={colIndex} className="whitespace-nowrap border-b border-r border-[var(--color-border)] px-3 py-1.5 text-[var(--color-ink)]">
                    {cellToText(row[colIndex])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
