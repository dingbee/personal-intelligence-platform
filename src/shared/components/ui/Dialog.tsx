import { useEffect, useRef, type ReactNode } from 'react'

// PIP Stabilization v1 (P1 mobile) — max-h-[85dvh]/overflow-y-auto replace
// reliance on the native <dialog> UA-stylesheet height clamp, which is
// computed against the layout viewport rather than the visual one — on a
// short mobile viewport (e.g. keyboard open) that clamp can be taller than
// what's actually visible, with no scroll affordance of its own.
const DEFAULT_DIALOG_CLASS =
  'w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] p-6 shadow-floating backdrop:bg-black/30'

export interface DialogProps {
  open: boolean
  onClose: () => void
  /** Defaults to the shell every Knowledge Exchange Import/Export dialog already uses — override only for a genuinely different size/shape. */
  className?: string
  children: ReactNode
}

/**
 * UX-15.1 — the one native `<dialog>` shell every Import dialog
 * (`ImportNotePackageDialog`/`ImportKnowledgeNodePackageDialog`/
 * `ImportKnowledgeLinkPackageDialog`/`ImportAssetPackageDialog`/
 * `ImportDocumentPackageDialog`/`ImportKnowledgeCollectionPackageDialog`/
 * `ImportConversationPackageDialog`) and `KnowledgeExportDialog`
 * previously hand-rolled independently (`showModal()`/`close()`,
 * synced to an `open` prop via the identical `useEffect` copy-pasted
 * eight times — see UX-15.1's discovery §2.8). Factored here so any
 * future dialog gets this behavior by construction rather than by
 * copying the last one correctly. Each dialog keeps its own
 * reset-on-reopen effect (its own state to clear), and its own content
 * — this component owns only open/close mechanics and the shared shell.
 */
export function Dialog({ open, onClose, className, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} onCancel={onClose} onClose={onClose} className={className ?? DEFAULT_DIALOG_CLASS}>
      {children}
    </dialog>
  )
}
