import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { Asset } from '@/shared/types/database'
import { useAssets } from '@/modules/assets/hooks/useAssets'
import { useSignedAssetUrl } from '@/modules/assets/hooks/useSignedAssetUrl'
import { createNote } from '@/modules/notes/api/notes'
import { linkNoteToAsset } from '@/modules/notes/api/knowledgeLinks'
import { useAuth } from '@/modules/auth/useAuth'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { formatFileSize } from '@/modules/library/utils/fileTypes'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * UX-13.9 — the image equivalent of DocumentCard, same shape: a thumbnail
 * (here, an actual visual instead of a file-type badge), title, metadata
 * line, primary View action, and a ⋯ menu. "Ask NOVA" deliberately does
 * not claim NOVA can see the picture — no vision/OCR this phase — it
 * opens a normal conversation seeded with the image's title via the same
 * createConversationWithQuery command action other quick-start entry
 * points already use, not a new AIService path.
 */
export function ImageCard({ asset, onOpenLightbox }: { asset: Asset; onOpenLightbox: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { rename, remove } = useAssets()
  const { createConversationWithQuery } = useCommandActions()
  const { data: thumbnailUrl, isLoading: thumbnailLoading } = useSignedAssetUrl(asset.thumbnail_path)
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // UX-13.9 — "Save as Notes" from the Library, image version of
  // DocumentCard's own saveAsNote: an empty note linked to this asset via
  // the generic knowledge_links table (linkNoteToAsset), opened for
  // editing. Same "real, not fabricated" content choice as documents'.
  const saveAsNote = useMutation({
    mutationFn: async () => {
      const note = await createNote({ userId: user!.id, workspaceId: asset.workspace_id, title: asset.title })
      await linkNoteToAsset({ userId: user!.id, workspaceId: asset.workspace_id, noteId: note.id, assetId: asset.id })
      return note
    },
    onSuccess: (note) => navigate(`/notes/${note.id}`),
  })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <button
        type="button"
        onClick={onOpenLightbox}
        className="block aspect-video w-full overflow-hidden rounded-lg bg-[var(--color-canvas)]"
      >
        {thumbnailLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="sm" />
          </div>
        ) : thumbnailUrl ? (
          <img src={thumbnailUrl} alt={asset.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-ink-muted)]">Preview unavailable</div>
        )}
      </button>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
            IMAGE
          </span>
          {renaming ? (
            <div className="mt-1">
              <InlineTextForm
                initialValue={asset.title}
                onSubmit={(title) => {
                  rename.mutate({ id: asset.id, title })
                  setRenaming(false)
                }}
                onCancel={() => setRenaming(false)}
              />
            </div>
          ) : (
            <h3 className="mt-1 truncate font-medium text-[var(--color-ink)]" title={asset.title}>
              {asset.title}
            </h3>
          )}
          <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
            {asset.width}×{asset.height} · {formatFileSize(asset.size_bytes)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to={`/library/assets/${asset.id}`}
            className="rounded-md bg-[var(--color-canvas)] px-2 py-1 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            View
          </Link>
          <DropdownMenu trigger={<span aria-hidden>⋯</span>}>
            <Link
              to={`/library/assets/${asset.id}`}
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
            >
              View
            </Link>
            <DropdownMenuItem
              onClick={() => void createConversationWithQuery(`I just uploaded an image called "${asset.title}".`)}
            >
              Ask NOVA
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => saveAsNote.mutate()}>
              {saveAsNote.isPending ? 'Saving…' : 'Save as Notes'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem danger onClick={() => setConfirmingDelete(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${asset.title}"?`}
        description="This permanently removes the image from your library. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(asset)
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
