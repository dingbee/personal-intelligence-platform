import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useKnowledgeLinks } from '@/modules/knowledgeLinks/hooks/useKnowledgeLinks'
import { useLinkableSearch } from '@/modules/knowledgeLinks/hooks/useLinkableSearch'
import type { LinkableType } from '@/modules/knowledgeLinks/types'
import { Input } from '@/shared/components/ui/Input'
import { Spinner } from '@/shared/components/ui/Spinner'

const SEARCH_DEBOUNCE_MS = 300

const TYPE_LABELS: Record<LinkableType, string> = {
  note: 'Note',
  document: 'Document',
  highlight: 'Highlight',
  conversation: 'Conversation',
  flashcard: 'Flashcard',
}

/**
 * Backlinks + add-link picker for one knowledge-graph node. Generic over
 * LinkableType so it can be dropped onto documents, highlights, etc. later —
 * not just notes — without any changes here.
 */
export function KnowledgeLinksPanel({ sourceType, sourceId }: { sourceType: LinkableType; sourceId: string }) {
  const { links, isLoading, addLink, removeLink } = useKnowledgeLinks(sourceType, sourceId)
  const { search, results, loading: searching } = useLinkableSearch(sourceType, sourceId)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const debounceTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  function handleQueryChange(value: string) {
    setQuery(value)
    clearTimeout(debounceTimeout.current)
    debounceTimeout.current = setTimeout(() => void search(value), SEARCH_DEBOUNCE_MS)
  }

  function closeAdding() {
    setAdding(false)
    setQuery('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">Linked items</h3>
        <button
          type="button"
          onClick={() => setAdding((prev) => !prev)}
          className="text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          {adding ? 'Cancel' : '+ Link'}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2">
          <Input
            label="Search notes, documents, highlights, conversations, flashcards"
            placeholder="Search to link..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
          />
          {searching ? (
            <Spinner size="sm" />
          ) : query.trim() && results.length === 0 ? (
            <p className="text-xs text-[var(--color-ink-muted)]">No matches.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((result) => (
                <li key={`${result.type}:${result.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      addLink.mutate({ type: result.type, id: result.id })
                      closeAdding()
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
                  >
                    <span className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs text-[var(--color-ink-muted)]">
                      {TYPE_LABELS[result.type]}
                    </span>
                    <span className="truncate">{result.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading ? (
        <Spinner size="sm" />
      ) : links.length === 0 ? (
        <p className="text-xs text-[var(--color-ink-muted)]">No links yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map(({ linkId, item }) => (
            <li key={linkId} className="flex items-center justify-between gap-2">
              <Link
                to={item.href}
                className="flex min-w-0 items-center gap-2 text-sm text-[var(--color-ink)] hover:text-[var(--color-accent)]"
              >
                <span className="shrink-0 rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs text-[var(--color-ink-muted)]">
                  {TYPE_LABELS[item.type]}
                </span>
                <span className="truncate">{item.title}</span>
              </Link>
              <button
                type="button"
                aria-label={`Remove link to ${item.title}`}
                onClick={() => removeLink.mutate(linkId)}
                className="shrink-0 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
