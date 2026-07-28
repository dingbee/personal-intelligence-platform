import { Link } from 'react-router-dom'

export interface SourceReferenceItem {
  type: string
  id: string
  label: string
}

function hrefFor(item: SourceReferenceItem): string | null {
  if (item.type === 'document') return `/library/${item.id}`
  if (item.type === 'note') return `/notes/${item.id}`
  return null
}

/** Provenance chips linking back to where an AI-generated object came from. Only 'document' sources exist today (extraction is document-scoped); 'note' is wired for reuse once something else adopts this component. */
export function SourceReference({ sources }: { sources: SourceReferenceItem[] }) {
  if (sources.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-[var(--color-ink-muted)]">Source:</span>
      {sources.map((source) => {
        const href = hrefFor(source)
        const pill = (
          <span className="inline-block rounded-pill bg-[var(--surface-inset)] px-1.5 py-0.5 text-xs text-[var(--color-ink-muted)] shadow-inset transition-colors hover:text-[var(--color-ink)]">
            {source.label}
          </span>
        )
        return href ? (
          <Link key={`${source.type}-${source.id}`} to={href}>
            {pill}
          </Link>
        ) : (
          <span key={`${source.type}-${source.id}`}>{pill}</span>
        )
      })}
    </div>
  )
}
