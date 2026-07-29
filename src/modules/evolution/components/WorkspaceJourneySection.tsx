import type { JourneyMilestone } from '@/modules/evolution/workspaceJourney/workspaceJourney'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/** UX-13 Workspace Journey — a fixed six-milestone list; unreached milestones (achievedAt null) render dimmed rather than being hidden, so the journey's remaining steps are still visible. */
export function WorkspaceJourneySection({ milestones }: { milestones: JourneyMilestone[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {milestones.map((milestone) => (
        <li key={milestone.key} className="flex items-baseline justify-between gap-4 text-sm">
          <span className={milestone.achievedAt ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]'}>
            {milestone.label}
          </span>
          <span className="shrink-0 text-xs text-[var(--color-ink-muted)]">
            {milestone.achievedAt ? formatRelativeTime(milestone.achievedAt) : 'Not yet reached'}
          </span>
        </li>
      ))}
    </ol>
  )
}
