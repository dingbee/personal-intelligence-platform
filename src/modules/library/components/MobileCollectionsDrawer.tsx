import { CollectionsPanelContent, type CollectionsPanelContentProps } from '@/modules/library/components/CollectionsPanelContent'
import { Button } from '@/shared/components/ui/Button'
import { EdgeDrawerDialog } from '@/shared/components/ui/EdgeDrawerDialog'

/**
 * Below md, the Collections aside is hidden — this is how a collection
 * gets picked there instead.
 */
export function MobileCollectionsDrawer({
  open,
  onClose,
  ...panelProps
}: { open: boolean; onClose: () => void } & CollectionsPanelContentProps) {
  return (
    <EdgeDrawerDialog open={open} onClose={onClose} ariaLabel="Collections">
      <div className="flex flex-col gap-1 p-4">
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
      </div>
    </EdgeDrawerDialog>
  )
}
