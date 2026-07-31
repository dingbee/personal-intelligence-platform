import { ConversationListContent, type ConversationListProps } from '@/modules/ai/chat/components/ConversationList'
import { Button } from '@/shared/components/ui/Button'
import { EdgeDrawerDialog } from '@/shared/components/ui/EdgeDrawerDialog'

/**
 * Below md, ConversationList is hidden — this is how a conversation gets
 * picked, created, or deleted there instead.
 */
export function MobileConversationDrawer({
  open,
  onClose,
  ...listProps
}: { open: boolean; onClose: () => void } & ConversationListProps) {
  return (
    <EdgeDrawerDialog open={open} onClose={onClose} ariaLabel="Conversations">
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
    </EdgeDrawerDialog>
  )
}
