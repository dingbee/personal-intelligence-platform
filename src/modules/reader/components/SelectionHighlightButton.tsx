import { useEffect, useState, type RefObject } from 'react'
import { computeSelectionPopupPosition } from '@/modules/reader/components/selectionPopupPosition'

interface SelectionState {
  text: string
  top: number
  left: number
}

/**
 * V1 Launch Hardening, Workstream 3 — same inline copy pattern established
 * in ActionsPage.tsx/MessageBubble.tsx (copyText + a "Copied" flash),
 * repeated locally rather than extracted into a shared helper: this is the
 * third occurrence, but the two existing call sites are untouched,
 * already-tested code that doesn't need touching for this fix.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Floating Highlight/Copy button pair that appears over a text selection
 * made inside `containerRef`. Uses viewport-relative coordinates (position:
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
  const [copied, setCopied] = useState(false)

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
      const position = computeSelectionPopupPosition(rect, { width: window.innerWidth, height: window.innerHeight })
      setSelection({ text, top: position.top, left: position.left })
      setCopied(false)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [containerRef])

  if (!selection) return null

  async function handleCopy() {
    const succeeded = await copyText(selection!.text)
    if (succeeded) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div
      style={{ position: 'fixed', top: selection.top, left: selection.left, transform: 'translateX(-50%)' }}
      className="z-50 flex items-center gap-1"
    >
      <button
        type="button"
        onClick={() => {
          onHighlight(selection.text)
          window.getSelection()?.removeAllRanges()
          setSelection(null)
        }}
        className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] shadow-md hover:opacity-90"
      >
        Highlight
      </button>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label="Copy selection"
        className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] shadow-md hover:opacity-90"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
