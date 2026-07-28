import { Link } from 'react-router-dom'
import { useDocumentConnections } from '@/modules/knowledge/hooks/useDashboardData'
import { DashboardSection } from '@/modules/knowledge/components/DashboardSection'

export function DocumentConnectionsSection() {
  const { data: connections = [], isLoading } = useDocumentConnections(8)

  return (
    <DashboardSection
      title="Document connections"
      viewAllHref="/library"
      isLoading={isLoading}
      isEmpty={connections.length === 0}
      emptyMessage="Upload a document to start building connections."
    >
      <ul className="flex flex-col gap-2">
        {connections.map((connection) => (
          <li key={connection.documentId} className="flex items-center justify-between rounded-lg bg-[var(--color-canvas)] px-3 py-2">
            <Link to={`/library/${connection.documentId}`} className="min-w-0 truncate text-sm text-[var(--color-ink)] hover:text-[var(--color-accent)]">
              {connection.documentTitle}
            </Link>
            <span className="shrink-0 text-xs text-[var(--color-ink-muted)]">
              {connection.noteCount} note{connection.noteCount === 1 ? '' : 's'} · {connection.highlightCount} highlight
              {connection.highlightCount === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
