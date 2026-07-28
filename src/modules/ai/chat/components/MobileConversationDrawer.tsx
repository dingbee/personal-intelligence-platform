import { useEffect, useRef } from 'react'
import { ConversationListContent, type ConversationListProps } from '@/modules/ai/chat/components/ConversationList'
import { Button } from '@/shared/components/ui/Button'

/**
 * Below md, ConversationList is hidden — this is how a conversation gets
 * picked, created, or deleted there instead. Same native <dialog> drawer
 * pattern as MobileNavDrawer (left-edge, showModal/close, backdrop), just
 * scoped to Chat instead of primary navigation.
 */
export function MobileConversationDrawer({
  open,
  onClose,
  ...listProps
}: { open: boolean; onClose: () => void } & ConversationListProps) {
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
      aria-label="Conversations"
      className="fixed inset-y-0 left-0 m-0 h-full max-h-none w-64 max-w-[80vw] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] open:flex backdrop:bg-black/30"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-sm font-medium text-[var(--color-ink)]">Conversations</span>
        <Button variant="ghost" onClick={onClose} aria-label="Close conversations">
          Close
        </Button>
      </div>
      <ConversationListContent
        {...listProps}
        onSelect={(id) => {
          listProps.onSelect(id)
          onClose()
        }}
        onNew={() => {
          listProps.onNew()
          onClose()
        }}
      />
    </dialog>
  )
}
