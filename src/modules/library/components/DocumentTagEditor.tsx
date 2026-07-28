import { useState } from 'react'
import { useTags } from '@/modules/library/hooks/useTags'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

export function DocumentTagEditor({
  documentId,
  tags,
  onSuccess,
}: {
  documentId: string
  tags: { id: string; name: string }[]
  /** Called after a tag is added/removed, in addition to the hook's own cache invalidation — for callers (e.g. the document detail page) that cache this document under a separate query key. */
  onSuccess?: () => void
}) {
  const { addTag, removeTag } = useTags()
  const [addingTag, setAddingTag] = useState(false)
  const mutateOptions = onSuccess ? { onSuccess } : undefined

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]"
        >
          {tag.name}
          <button
            type="button"
            aria-label={`Remove tag ${tag.name}`}
            onClick={() => removeTag.mutate({ documentId, tagId: tag.id }, mutateOptions)}
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
            addTag.mutate({ documentId, tagName: name }, mutateOptions)
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
  )
}
