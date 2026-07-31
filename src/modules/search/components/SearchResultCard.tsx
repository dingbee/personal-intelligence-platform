import { Link } from 'react-router-dom'
import type { SearchResult } from '@/modules/search/types'

const SOURCE_LABEL: Record<string, string> = {
  document: 'Document',
  conversation: 'Conversation',
  note: 'Note',
}

export function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <Link
      to={result.href}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
    >
      <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
        {SOURCE_LABEL[result.sourceType] ?? result.sourceType}
      </span>
      <h3 className="mt-1.5 truncate font-medium text-[var(--color-ink)]">{result.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">{result.snippet}</p>
    </Link>
  )
}
