import type { AttentionItem, AttentionPriority } from '@/modules/intelligence/orchestrator/types'
import { AttentionList } from '@/modules/intelligence/components/AttentionList'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const PRIORITY_GROUPS: { priority: AttentionPriority; label: string; variant: 'error' | 'warning' | 'info' }[] = [
  { priority: 'high', label: 'High', variant: 'error' },
  { priority: 'medium', label: 'Medium', variant: 'warning' },
  { priority: 'low', label: 'Low', variant: 'info' },
]

/** UX-11 Phase 6 — groups the already-composed AttentionItem[] (dashboardSignals.buildAttentionCenter) by priority, reusing AttentionList/StatusBadge for each group rather than a new list component. */
export function AttentionCenterSection({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nothing needs your attention" description="You're all caught up." />
  }

  return (
    <div className="flex flex-col gap-3">
      {PRIORITY_GROUPS.map(({ priority, label, variant }) => {
        const group = items.filter((item) => item.priority === priority)
        if (group.length === 0) return null
        return (
          <div key={priority} className="flex flex-col gap-1">
            <StatusBadge label={label} variant={variant} />
            <AttentionList items={group} />
          </div>
        )
      })}
    </div>
  )
}
