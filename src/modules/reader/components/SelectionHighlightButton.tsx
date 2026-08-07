import { useEffect, useState, type RefObject } from 'react'

interface SelectionState {
  text: string
  top: number
  left: number
}

/**
 * Floating "Highlight" button that appears over a text selection made
 * inside `containerRef`. Uses viewport-relative coordinates (position:
 * fixed) rather than container-relative + scroll-offset math — simpler
 * and avoids a class of positioning bugs when the reader pane scrolls.
 */
export function SelectionHighlightButton({
  containerRef,
  onHighlight,
}: {
  containerRef: RefObject<HTMLElement | null>
  onHighlight: (quote: string) => void
}) {
  const [selection, setSelection] = useState<SelectionState | null>(null)

  useEffect(() => {
    function handleSelectionChange() {
      const sel = window.getSelection()
      const container = containerRef.current
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !container) {
        setSelection(null)
        return
      }
      const text = sel.toString().trim()
      const range = sel.getRangeAt(0)
      if (!text || !container.contains(range.commonAncestorContainer)) {
        setSelection(null)
        return
      }
      const rect = range.getBoundingClientRect()
      setSelection({ text, top: rect.top - 44, left: rect.left + rect.width / 2 })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [containerRef])

  if (!selection) return null

  return (
    <button
      type="button"
      style={{ position: 'fixed', top: selection.top, left: selection.left, transform: 'translateX(-50%)' }}
      onClick={() => {
        onHighlight(selection.text)
        window.getSelection()?.removeAllRanges()
        setSelection(null)
      }}
      className="z-50 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] shadow-md hover:opacity-90"
    >
      Highlight
    </button>
  )
}
