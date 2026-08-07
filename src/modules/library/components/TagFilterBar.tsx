import { useState } from 'react'
import type { Tag } from '@/shared/types/database'
import { useTags } from '@/modules/library/hooks/useTags'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

export function TagFilterBar({
  tags,
  selectedTagId,
  onSelect,
}: {
  tags: Tag[]
  selectedTagId: string | null
  onSelect: (id: string | null) => void
}) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          selectedTagId === null
            ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]'
            : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
        }`}
      >
        All tags
      </button>
      {tags.map((tag) => (
        <TagPill
          key={tag.id}
          tag={tag}
          selected={selectedTagId === tag.id}
          onSelect={() => onSelect(tag.id)}
          onDeleted={() => {
            if (selectedTagId === tag.id) onSelect(null)
          }}
        />
      ))}
    </div>
  )
}

function TagPill({
  tag,
  selected,
  onSelect,
  onDeleted,
}: {
  tag: Tag
  selected: boolean
  onSelect: () => void
  onDeleted: () => void
}) {
  const { rename, remove } = useTags()
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (renaming) {
    return (
      <InlineTextForm
        initialValue={tag.name}
        onSubmit={(name) => {
          rename.mutate({ id: tag.id, name })
          setRenaming(false)
        }}
        onCancel={() => setRenaming(false)}
      />
    )
  }

  return (
    <div
      className={`group flex items-center rounded-full pr-0.5 text-xs font-medium transition-colors ${
        selected ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]' : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)]'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`rounded-full py-1 pl-2.5 pr-1 ${selected ? '' : 'hover:text-[var(--color-ink)]'}`}
      >
        {tag.name}
      </button>
      <DropdownMenu
        trigger={
          <span
            aria-hidden
            className={`px-1 opacity-0 group-hover:opacity-100 ${selected ? 'text-[var(--color-canvas)]' : ''}`}
          >
            ⋯
          </span>
        }
      >
        <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
        <DropdownMenuItem danger onClick={() => setConfirmingDelete(true)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete tag "${tag.name}"?`}
        description="This removes the tag from every document it's attached to. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(tag.id)
          setConfirmingDelete(false)
          onDeleted()
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
