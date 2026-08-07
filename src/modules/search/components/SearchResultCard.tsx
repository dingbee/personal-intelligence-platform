import { Link } from 'react-router-dom'
import type { SearchResult } from '@/modules/search/types'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import { scoreToStars } from '@/modules/search/ranking/conversationScore'

const SOURCE_LABEL: Record<string, string> = {
  document: 'Document',
  conversation: 'Conversation',
  note: 'Note',
  asset: 'Image',
}

const SOURCE_ICON: Record<string, string> = {
  conversation: '💬',
  asset: '🖼️',
}

export function SearchResultCard({ result }: { result: SearchResult }) {
  const { workspaces } = useWorkspace()
  const workspaceName = result.workspaceId ? (workspaces.find((w) => w.id === result.workspaceId)?.name ?? null) : null

  return (
    <Link
      to={result.href}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
          {SOURCE_ICON[result.sourceType] ? `${SOURCE_ICON[result.sourceType]} ` : ''}
          {SOURCE_LABEL[result.sourceType] ?? result.sourceType}
        </span>
        {result.matchCount !== undefined && (
          <span aria-label={`${scoreToStars(result.similarity)} out of 5 relevance`} className="text-xs text-[var(--color-warning)]">
            {'★'.repeat(scoreToStars(result.similarity))}
            <span className="text-[var(--color-border)]">{'★'.repeat(5 - scoreToStars(result.similarity))}</span>
          </span>
        )}
      </div>
      <h3 className="mt-1.5 truncate font-medium text-[var(--color-ink)]">{result.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">{result.snippet}</p>
      {(result.matchCount !== undefined || result.updatedAt || workspaceName) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-ink-muted)]">
          {result.matchCount !== undefined && (
            <span>
              {result.matchCount} relevant message{result.matchCount === 1 ? '' : 's'}
            </span>
          )}
          {result.updatedAt && <span>Updated {formatRelativeTime(result.updatedAt)}</span>}
          {workspaceName && <span>{workspaceName}</span>}
        </div>
      )}
    </Link>
  )
}
