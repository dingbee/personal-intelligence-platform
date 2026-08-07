import type { SheetAnalysis } from '@/modules/processing/spreadsheet/types'
import { summarizeWorkbook } from '@/modules/processing/spreadsheet/workbookSummary'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatPeriodLabel(start: string, end: string): string {
  const [startYear, startMonth] = start.split('-')
  const [endYear, endMonth] = end.split('-')
  const startLabel = MONTHS[Number(startMonth) - 1]
  const endLabel = MONTHS[Number(endMonth) - 1]
  if (startYear === endYear) return `${startLabel}–${endLabel} ${startYear}`
  return `${startLabel} ${startYear} – ${endLabel} ${endYear}`
}

const PATTERN_LABELS: Record<string, string> = {
  'income-statement': 'Income statement',
  'expense-sheet': 'Expense sheet',
  inventory: 'Inventory',
  'customer-sheet': 'Customer sheet',
  'sales-data': 'Sales data',
}

/**
 * UX-13.10 — "Spreadsheet Summary Card": replaces the generic "Excel file
 * uploaded" treatment with what NOVA actually detected — sheets, rows,
 * financial patterns, period, currency — computed once at processing time
 * (analyzeSheet) and read back here, never re-derived in the UI.
 */
export function SpreadsheetSummaryCard({ analyses, lastUpdatedLabel }: { analyses: SheetAnalysis[]; lastUpdatedLabel: string }) {
  const summary = summarizeWorkbook(analyses)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-[var(--color-ink-muted)]">Sheets</dt>
        <dd className="text-[var(--color-ink)]">{summary.sheetCount}</dd>
        <dt className="text-[var(--color-ink-muted)]">Rows</dt>
        <dd className="text-[var(--color-ink)]">{summary.totalRows.toLocaleString()}</dd>
        {summary.period && (
          <>
            <dt className="text-[var(--color-ink-muted)]">Period</dt>
            <dd className="text-[var(--color-ink)]">{formatPeriodLabel(summary.period.start, summary.period.end)}</dd>
          </>
        )}
        {summary.currency && (
          <>
            <dt className="text-[var(--color-ink-muted)]">Currency</dt>
            <dd className="text-[var(--color-ink)]">{summary.currency}</dd>
          </>
        )}
        <dt className="text-[var(--color-ink-muted)]">Last updated</dt>
        <dd className="text-[var(--color-ink)]">{lastUpdatedLabel}</dd>
      </dl>

      {summary.detectedLabels.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Detected</h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm text-[var(--color-ink)]">
            {summary.detectedLabels.map((label) => (
              <li key={label} className="flex items-center gap-1.5">
                <span className="text-[var(--color-success)]" aria-hidden>
                  ✓
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Sheets</h3>
        {analyses.map((sheet) => (
          <div key={sheet.sheetIndex} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[var(--color-ink)]">{sheet.sheetName}</span>
              <span className="text-xs text-[var(--color-ink-muted)]">
                {sheet.rowCount.toLocaleString()} rows{sheet.pattern !== 'unknown' ? ` · ${PATTERN_LABELS[sheet.pattern]}` : ''}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {sheet.columns.map((c) => `${c.name} (${c.meaning})`).join(', ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
