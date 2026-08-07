import { Link } from 'react-router-dom'
import type { InProgressDocument } from '@/modules/reader/api/readingProgress'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/**
 * UX-15.2 — "what should I continue?" surfaced on the Hub itself instead
 * of only inside the Command Bar (`Cmd/Ctrl+K` → "Continue reading …",
 * `readerCommands.ts`'s `buildContinueReadingCommand`). Reuses
 * `useCommandContext()`'s existing `inProgressDocument` (backed by
 * `getMostRecentReadingProgress`) — no new query, no new hook.
 */
export function ContinueWorkingCard({ inProgressDocument }: { inProgressDocument: InProgressDocument | null }) {
  if (!inProgressDocument) {
    return (
      <EmptyState
        title="Nothing in progress"
        description="Start reading a document and it'll show up here so you can pick back up."
      />
    )
  }

  return (
    <SurfaceCard className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">{inProgressDocument.title}</p>
        <p className="text-xs text-[var(--color-ink-muted)]">Last read {formatRelativeTime(inProgressDocument.updatedAt)}</p>
      </div>
      <Link
        to={`/library/${inProgressDocument.id}/read`}
        className="shrink-0 rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-canvas)] hover:opacity-90"
      >
        Continue reading →
      </Link>
    </SurfaceCard>
  )
}
