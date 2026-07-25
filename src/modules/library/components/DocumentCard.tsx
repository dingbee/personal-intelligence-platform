import { useState } from 'react'
import type { Collection } from '@/shared/types/database'
import type { DocumentWithTags } from '@/modules/library/api/documents'
import { useDocumentMutations } from '@/modules/library/hooks/useDocumentMutations'
import { useTags } from '@/modules/library/hooks/useTags'
import { fileTypeLabel, formatFileSize } from '@/modules/library/utils/fileTypes'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

const STATUS_LABEL: Record<DocumentWithTags['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  ready: 'Ready',
  error: 'Error',
}

export function DocumentCard({
  document,
  collections,
}: {
  document: DocumentWithTags
  collections: Collection[]
}) {
  const { rename, move, remove } = useDocumentMutations()
  const { addTag, removeTag } = useTags()
  const [renaming, setRenaming] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
            {fileTypeLabel(document.file_type)}
          </span>
          {renaming ? (
            <div className="mt-1">
              <InlineTextForm
                initialValue={document.title}
                onSubmit={(title) => {
                  rename.mutate({ id: document.id, title })
                  setRenaming(false)
                }}
                onCancel={() => setRenaming(false)}
              />
            </div>
          ) : (
            <h3 className="mt-1 truncate font-medium text-[var(--color-ink)]" title={document.title}>
              {document.title}
            </h3>
          )}
          <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
            {formatFileSize(document.file_size)} · {STATUS_LABEL[document.status]}
          </p>
        </div>
        <DropdownMenu trigger={<span aria-hidden>⋯</span>}>
          <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem danger onClick={() => setConfirmingDelete(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {document.tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]"
          >
            {tag.name}
            <button
              type="button"
              aria-label={`Remove tag ${tag.name}`}
              onClick={() => removeTag.mutate({ documentId: document.id, tagId: tag.id })}
              className="hover:text-[var(--color-ink)]"
            >
              ×
            </button>
          </span>
        ))}
        {addingTag ? (
          <InlineTextForm
            placeholder="Tag name"
            onSubmit={(name) => {
              addTag.mutate({ documentId: document.id, tagName: name })
              setAddingTag(false)
            }}
            onCancel={() => setAddingTag(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingTag(true)}
            className="rounded-full border border-dashed border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            + Tag
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
        Collection
        <select
          value={document.collection_id ?? ''}
          onChange={(e) => move.mutate({ id: document.id, collectionId: e.target.value || null })}
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-ink)]"
        >
          <option value="">None</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
      </label>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${document.title}"?`}
        description="This permanently removes the file from your library. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate({ id: document.id, filePath: document.file_path })
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
