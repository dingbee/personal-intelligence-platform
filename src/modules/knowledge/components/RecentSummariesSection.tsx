import { Link } from 'react-router-dom'
import { useRecentChapterSummaries } from '@/modules/knowledge/hooks/useDashboardData'
import { DashboardSection } from '@/modules/knowledge/components/DashboardSection'

function previewText(content: string): string {
  const trimmed = content.trim()
  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed
}

export function RecentSummariesSection() {
  const { data: summaries = [], isLoading } = useRecentChapterSummaries(5)

  return (
    <DashboardSection
      title="Recent AI summaries"
      isLoading={isLoading}
      emptyMessage="No chapter summaries yet — generate one from a chapter's Summary tab while reading."
      isEmpty={summaries.length === 0}
    >
      <ul className="flex flex-col gap-3">
        {summaries.map((summary) => (
          <li key={`${summary.document_id}-${summary.chapter_index}`} className="rounded-lg bg-[var(--color-canvas)] p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]">
              <span className="min-w-0 truncate font-medium text-[var(--color-ink)]">
                {summary.document?.title ?? 'Unknown document'} · Chapter {summary.chapter_index + 1}
              </span>
              <span className="shrink-0">{new Date(summary.updated_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{previewText(summary.content)}</p>
            <Link
              to={`/library/${summary.document_id}/read`}
              className="mt-1.5 inline-block text-xs text-[var(--color-accent)] hover:underline"
            >
              Open in reader →
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
