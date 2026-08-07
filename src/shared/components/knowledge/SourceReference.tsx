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
  if (item.type === 'asset') return `/library/assets/${item.id}`
  if (item.type === 'knowledge_node') return `/knowledge/nodes/${item.id}`
  return null
}

/**
 * Provenance chips linking back to where an AI-generated object came from.
 * UX-13.11 Phase 2B: 'conversation' evidence joins 'document'/'note' now
 * that the deterministic concept matcher links conversations too.
 *
 * `label`/`onRemove` are optional generalizations for UX-13 roadmap Phase
 * 4 (Knowledge Collections), whose item list is the same {type,id,label}
 * shape but isn't "provenance" and needs a remove affordance — every
 * existing call site omits both and keeps the original "Source:" chips.
 */
export function SourceReference({
  sources,
  label = 'Source:',
  onRemove,
}: {
  sources: SourceReferenceItem[]
  label?: string
  onRemove?: (item: SourceReferenceItem) => void
}) {
  if (sources.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-[var(--color-ink-muted)]">{label}</span>
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
        return (
          <span key={`${source.type}-${source.id}`} className="inline-flex items-center gap-1">
            {href ? <Link to={href}>{pill}</Link> : pill}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(source)}
                aria-label={`Remove ${source.label}`}
                className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-danger)]"
              >
                ×
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
