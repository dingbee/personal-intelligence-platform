import type { KnowledgeHealthReport } from '@/modules/evolution/knowledgeHealth/knowledgeHealthScore'
import { StatCard } from '@/shared/components/ui/surface/StatCard'

/** UX-13 Knowledge Health — the 0-100 score plus the issue list behind it, the same StatCard + explanation-list pattern IntelligenceScoreSection already uses for the Personal Intelligence Index. */
export function KnowledgeHealthSection({ health }: { health: KnowledgeHealthReport }) {
  return (
    <div className="flex flex-col gap-3">
      <StatCard label="Knowledge Health" value={health.score} />
      {health.issues.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">No health issues detected.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {health.issues.map((issue) => (
            <li key={issue.type} className="text-sm text-[var(--color-ink-muted)]">
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
