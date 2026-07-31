import { Link } from 'react-router-dom'

export interface SourceReferenceItem {
  type: string
  id: string
  label: string
}

function hrefFor(item: SourceReferenceItem): string | null {
  if (item.type === 'document') return `/library/${item.id}`
  if (item.type === 'note') return `/notes/${item.id}`
  if (item.type === 'conversation') return `/chat?conversationId=${item.id}`
  return null
}

/** Provenance chips linking back to where an AI-generated object came from. UX-13.11 Phase 2B: 'conversation' evidence joins 'document'/'note' now that the deterministic concept matcher links conversations too. */
export function SourceReference({ sources }: { sources: SourceReferenceItem[] }) {
  if (sources.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-[var(--color-ink-muted)]">Source:</span>
      {sources.map((source) => {
        const href = hrefFor(source)
        const pill = (
          <span
            title={source.label}
            className="inline-block max-w-[12rem] truncate rounded-pill bg-[var(--surface-inset)] px-1.5 py-0.5 align-bottom text-xs text-[var(--color-ink-muted)] shadow-inset transition-colors hover:text-[var(--color-ink)]"
          >
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
