import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { ConfidenceBadge } from '@/shared/components/knowledge/ConfidenceBadge'

/**
 * The primary visual unit for an AI-extracted concept or entity — reused by
 * the Dashboard insights panel, the Document Detail extraction results,
 * and the Knowledge Explorer, so its look changes in one place.
 *
 * `confidence` is optional (Platform Integration Sprint) — when provided,
 * renders the same ConfidenceBadge the Concept Card in Search and the node
 * drill-down page already show, so a concept's Knowledge Confidence looks
 * identical everywhere instead of only appearing on two of four surfaces.
 *
 * `to` is optional (Platform Coherence Sprint v2) — when provided, makes
 * the title a Link to the same `/knowledge/nodes/:id` drill-down page
 * ConceptCard already links to, reusing that navigation target rather
 * than inventing a new one. The title (not the whole card) is the link
 * deliberately: this card's `children` can itself contain SourceReference
 * links (per-source chips), and a card-wide Link would nest an `<a>`
 * inside another `<a>` — invalid HTML with unpredictable click behavior.
 * Omitted by callers that render this card as pure read-only summary
 * (unchanged behavior).
 */
export function KnowledgeCard({
  title,
  typeLabel,
  description,
  confidence,
  to,
  children,
}: {
  title: string
  typeLabel: string
  description?: string | null
  confidence?: number
  to?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4 shadow-raised transition-shadow hover:shadow-floating">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">
            <StatusBadge label={typeLabel} variant="info" />
          </span>
          {to ? (
            <Link
              to={to}
              className="min-w-0 truncate text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] hover:underline"
              title={title}
            >
              {title}
            </Link>
          ) : (
            <h3 className="min-w-0 truncate text-sm font-medium text-[var(--color-ink)]" title={title}>
              {title}
            </h3>
          )}
        </div>
        {confidence !== undefined && <ConfidenceBadge confidence={confidence} />}
      </div>
      {description && <p className="text-sm text-[var(--color-ink-muted)]">{description}</p>}
      {children}
    </div>
  )
}
