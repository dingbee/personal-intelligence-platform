import { useEffect, useRef } from 'react'
import { CollectionsPanelContent, type CollectionsPanelContentProps } from '@/modules/library/components/CollectionsPanelContent'
import { Button } from '@/shared/components/ui/Button'

/**
 * Below md, the Collections aside is hidden — this is how a collection
 * gets picked there instead. Same native <dialog> drawer pattern as
 * MobileNavDrawer/MobileConversationDrawer (left-edge, showModal/close,
 * backdrop), just scoped to Library's Collections panel.
 */
export function MobileCollectionsDrawer({
  open,
  onClose,
  ...panelProps
}: { open: boolean; onClose: () => void } & CollectionsPanelContentProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      aria-label="Collections"
      className="fixed inset-y-0 left-0 m-0 h-full max-h-none w-64 max-w-[80vw] flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 open:flex backdrop:bg-black/30"
    >
      <div className="mb-2 flex items-center justify-end">
        <Button variant="ghost" onClick={onClose} aria-label="Close collections">
          Close
        </Button>
      </div>
      <CollectionsPanelContent
        {...panelProps}
        onSelect={(id) => {
          panelProps.onSelect(id)
          onClose()
        }}
      />
    </dialog>
  )
}
