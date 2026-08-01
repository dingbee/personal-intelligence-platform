import { useState } from 'react'
import { sheetToGrid } from '@/modules/ai/artifacts/spreadsheet/sheetToGrid'
import { exportSpreadsheetArtifact, type SpreadsheetExportFormat } from '@/modules/ai/artifacts/spreadsheet/exportSpreadsheetArtifact'
import type { SpreadsheetArtifactData } from '@/modules/ai/artifacts/spreadsheet/types'
import { Button } from '@/shared/components/ui/Button'

const FORMAT_OPTIONS: { value: SpreadsheetExportFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV' },
]

function cellToText(value: string | number | null): string {
  return value === null ? '' : String(value)
}

/**
 * UX-14.4 Phase 2 (Path A) — same read-only-table styling
 * `SpreadsheetGridView` (Reader) already established, reused rather than
 * inventing a second table look. A formula cell shows as literal
 * `"=formula"` text, same honesty rule `sheetToGrid` documents — this
 * preview never computes anything, it shows exactly what will be written
 * to the export.
 */
export function SpreadsheetArtifactPanel({ title, data }: { title: string; data: SpreadsheetArtifactData }) {
  const [format, setFormat] = useState<SpreadsheetExportFormat>('xlsx')

  if (data.sheets.length === 0) return null

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      {data.sheets.map((sheet) => {
        const grid = sheetToGrid(sheet)
        return (
          <div key={sheet.name} className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">{sheet.name}</span>
            <div className="overflow-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {grid.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-[var(--color-canvas)] font-medium' : 'odd:bg-[var(--surface-inset)]'}>
                      {row.map((cell, colIndex) => (
                        <td
                          key={colIndex}
                          className="whitespace-nowrap border-b border-r border-[var(--color-border)] px-3 py-1.5 text-[var(--color-ink)]"
                        >
                          {cellToText(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-3">
          {FORMAT_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-1.5 text-sm text-[var(--color-ink)]">
              <input
                type="radio"
                name="spreadsheet-export-format"
                checked={format === option.value}
                onChange={() => setFormat(option.value)}
                className="accent-[var(--color-accent)]"
              />
              {option.label}
            </label>
          ))}
        </div>
        <Button onClick={() => exportSpreadsheetArtifact(data, title, format)}>Download</Button>
      </div>
    </div>
  )
}
