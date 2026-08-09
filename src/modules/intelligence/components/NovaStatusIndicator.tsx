import { FloatingCard } from '@/shared/components/ui/surface/FloatingCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

/** UX-6 Phase 7 — reuses FloatingCard/StatusBadge as-is, no new visual primitives. */
export function NovaStatusIndicator({
  status,
  understanding,
  workspaceName,
}: {
  status: 'ready' | 'thinking'
  understanding: string | null
  workspaceName: string | null
}) {
  return (
    <FloatingCard className="flex flex-col gap-1 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-medium text-[var(--color-ink)]">ARRIYIA</span>
        <StatusBadge label={status === 'thinking' ? 'Thinking…' : 'Ready'} variant={status === 'thinking' ? 'info' : 'success'} />
      </div>
      {understanding && (
        <p className="max-w-xs truncate text-[var(--color-ink-muted)]" title={understanding}>
          Understanding: "{understanding}"
        </p>
      )}
      {workspaceName && <p className="text-[var(--color-ink-muted)]">Workspace: {workspaceName}</p>}
    </FloatingCard>
  )
}
