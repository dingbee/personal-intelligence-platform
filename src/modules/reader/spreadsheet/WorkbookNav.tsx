/** UX-13 Phase B — sheet tabs, the spreadsheet equivalent of ChapterNav/PdfPageControls' page nav; horizontal like a real spreadsheet app's sheet tabs rather than a vertical list, since sheet names are usually short and there are rarely more than a handful. */
export function WorkbookNav({
  sheetNames,
  activeIndex,
  onSelect,
}: {
  sheetNames: string[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <nav aria-label="Sheets" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--color-border)] px-4 py-1.5">
      {sheetNames.map((name, index) => (
        <button
          key={`${name}-${index}`}
          type="button"
          onClick={() => onSelect(index)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            index === activeIndex
              ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]'
              : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'
          }`}
        >
          {name}
        </button>
      ))}
    </nav>
  )
}
