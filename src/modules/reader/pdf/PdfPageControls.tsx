import { useEffect, useState } from 'react'
import type { PdfZoom } from '@/modules/reader/pdf/PdfPageView'

const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

/** UX-13.7.1 — page prev/next + jump-to-page, and zoom in/out + fit-width, for the PDF reader. Pure toolbar: all state (pageIndex, zoom) lives in ReaderPage, same as ChapterNav/goToChapter's split. */
export function PdfPageControls({
  pageIndex,
  pageCount,
  onPageChange,
  zoom,
  resolvedScale,
  onZoomChange,
}: {
  pageIndex: number
  pageCount: number
  onPageChange: (index: number) => void
  zoom: PdfZoom
  resolvedScale: number
  onZoomChange: (zoom: PdfZoom) => void
}) {
  const [pageInput, setPageInput] = useState(String(pageIndex + 1))

  // Keep the input in sync with prev/next/saved-progress navigation —
  // only the form submit/blur path below should ever drive pageIndex from
  // pageInput, not the other direction while the user is mid-navigation.
  useEffect(() => {
    setPageInput(String(pageIndex + 1))
  }, [pageIndex])

  function submitPageInput() {
    const requested = Number.parseInt(pageInput, 10)
    if (!Number.isNaN(requested)) onPageChange(Math.min(Math.max(requested, 1), pageCount) - 1)
    else setPageInput(String(pageIndex + 1))
  }

  function zoomBy(delta: number) {
    const current = zoom.type === 'scale' ? zoom.value : resolvedScale
    const next = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + delta)) * 100) / 100
    onZoomChange({ type: 'scale', value: next })
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pageIndex === 0}
          onClick={() => onPageChange(pageIndex - 1)}
          className="rounded-md px-2 py-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous page"
        >
          ←
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitPageInput()
          }}
          className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]"
        >
          <input
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={submitPageInput}
            className="w-10 rounded-md border border-[var(--color-border)] bg-[var(--surface-inset)] px-1.5 py-1 text-center text-[var(--color-ink)]"
            aria-label="Page number"
          />
          <span>of {pageCount}</span>
        </form>
        <button
          type="button"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => onPageChange(pageIndex + 1)}
          className="rounded-md px-2 py-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next page"
        >
          →
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => zoomBy(-ZOOM_STEP)}
          className="rounded-md px-2 py-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="w-10 text-center text-xs text-[var(--color-ink-muted)]">{Math.round(resolvedScale * 100)}%</span>
        <button
          type="button"
          onClick={() => zoomBy(ZOOM_STEP)}
          className="rounded-md px-2 py-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onZoomChange({ type: 'fit-width' })}
          className={`ml-1 rounded-md px-2 py-1 text-xs font-medium ${
            zoom.type === 'fit-width'
              ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]'
              : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Fit width
        </button>
      </div>
    </div>
  )
}
