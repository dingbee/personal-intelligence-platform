import type { Tag } from '@/shared/types/database'

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
            ? 'bg-[var(--color-ink)] text-white'
            : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
        }`}
      >
        All tags
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => onSelect(tag.id)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            selectedTagId === tag.id
              ? 'bg-[var(--color-ink)] text-white'
              : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          {tag.name}
        </button>
      ))}
    </div>
  )
}
