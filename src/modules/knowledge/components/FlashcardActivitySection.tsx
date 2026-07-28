import { Link } from 'react-router-dom'
import { useFlashcardActivity } from '@/modules/knowledge/hooks/useDashboardData'
import { DashboardSection } from '@/modules/knowledge/components/DashboardSection'

export function FlashcardActivitySection() {
  const { data: activity = [], isLoading } = useFlashcardActivity()

  return (
    <DashboardSection
      title="Flashcards"
      isLoading={isLoading}
      isEmpty={activity.length === 0}
      emptyMessage="No flashcards yet — generate some from a chapter's Flashcards tab while reading."
    >
      <ul className="flex flex-col gap-2">
        {activity.map((item) => (
          <li key={item.documentId} className="flex items-center justify-between rounded-lg bg-[var(--color-canvas)] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--color-ink)]">{item.documentTitle}</p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {item.count} card{item.count === 1 ? '' : 's'} · last generated{' '}
                {new Date(item.mostRecentAt).toLocaleDateString()}
              </p>
            </div>
            <Link
              to={`/library/${item.documentId}/read`}
              className="shrink-0 text-xs text-[var(--color-accent)] hover:underline"
            >
              Open →
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
