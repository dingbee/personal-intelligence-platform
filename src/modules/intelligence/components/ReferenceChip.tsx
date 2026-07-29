import { Link } from 'react-router-dom'
import { formatReference } from '@/modules/intelligence/references/referenceFormatter'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'

/** UX-7 Phase 3 — a document/chapter/note/conversation chip. Plain <Link> to an existing route, no new navigation mechanism. */
export function ReferenceChip({ reference }: { reference: Reference }) {
  const { icon, label, typeLabel, href } = formatReference(reference)

  return (
    <Link
      to={href}
      className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-pill border border-[var(--color-border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--color-ink)] shadow-raised transition-shadow hover:shadow-floating"
      title={`${typeLabel}: ${label}`}
    >
      <span aria-hidden>{icon}</span>
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-[var(--color-ink-muted)]">· {typeLabel}</span>
    </Link>
  )
}
