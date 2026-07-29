import type { ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

/**
 * UX-6 Phase 7's "Used: ..." trust indicator — only for the turn just
 * streamed in this session. Historical messages (after a reload) only
 * persist context_chunk_ids, not graphNodes/memoriesUsed, so this can't
 * be reconstructed for past turns yet — see the phase report's deferred
 * items for what full historical display would require.
 */
export function NovaContextUsedBadges({ contextTrace }: { contextTrace: ContextTrace }) {
  const badges: string[] = []
  if (contextTrace.retrievedChunks > 0) {
    badges.push(`${contextTrace.retrievedChunks} document${contextTrace.retrievedChunks === 1 ? '' : 's'}`)
  }
  if (contextTrace.graphNodes > 0) badges.push('Knowledge graph')
  if (contextTrace.memoriesUsed > 0) badges.push('Personal preferences')

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
      <span>Used:</span>
      {badges.map((badge) => (
        <StatusBadge key={badge} label={`✓ ${badge}`} variant="neutral" />
      ))}
    </div>
  )
}
