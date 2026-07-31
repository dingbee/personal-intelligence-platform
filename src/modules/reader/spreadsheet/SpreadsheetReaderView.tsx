import { useEffect } from 'react'
import { useWorkbook } from '@/modules/reader/spreadsheet/useWorkbook'
import { WorkbookNav } from '@/modules/reader/spreadsheet/WorkbookNav'
import { SpreadsheetGridView } from '@/modules/reader/spreadsheet/SpreadsheetGridView'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

export interface SpreadsheetReaderViewProps {
  filePath: string
  sheetIndex: number
  onSheetChange: (index: number) => void
  onSheetCountChange: (count: number) => void
}

/**
 * UX-13 Phase B (Spreadsheet Intelligence) — the spreadsheet-specific half
 * of the reader (sheet tabs + grid), lazy-loaded from ReaderPage via
 * React.lazy, mirroring PdfReaderView: SheetJS (~1MB) only downloads when
 * someone actually opens a spreadsheet, not on every page of the app.
 *
 * No highlighting/SelectionHighlightButton here — a spreadsheet cell
 * isn't a passage of prose to select the way EPUB/PDF text is, so this
 * phase doesn't force that interaction onto a grid. ReaderPage hides the
 * Highlights tab for spreadsheet mode accordingly.
 */
export default function SpreadsheetReaderView({ filePath, sheetIndex, onSheetChange, onSheetCountChange }: SpreadsheetReaderViewProps) {
  const workbookQuery = useWorkbook(filePath)

  useEffect(() => {
    if (workbookQuery.data) onSheetCountChange(workbookQuery.data.SheetNames.length)
  }, [workbookQuery.data, onSheetCountChange])

  const namedRanges = workbookQuery.data?.Workbook?.Names?.filter((name) => !name.Name.startsWith('_xlnm')) ?? []

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {workbookQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : workbookQuery.isError || !workbookQuery.data ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState title="Couldn't load this spreadsheet" description="Try reloading the page." />
        </div>
      ) : (
        <>
          <WorkbookNav sheetNames={workbookQuery.data.SheetNames} activeIndex={sheetIndex} onSelect={onSheetChange} />
          {namedRanges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border)] px-4 py-2">
              <span className="text-xs font-medium text-[var(--color-ink-muted)]">Named ranges:</span>
              {namedRanges.map((name) => (
                <span
                  key={name.Name}
                  title={name.Ref}
                  className="rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]"
                >
                  {name.Name}
                </span>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-auto p-4">
            <SpreadsheetGridView sheet={workbookQuery.data.Sheets[workbookQuery.data.SheetNames[sheetIndex] ?? '']} />
          </div>
        </>
      )}
    </div>
  )
}
