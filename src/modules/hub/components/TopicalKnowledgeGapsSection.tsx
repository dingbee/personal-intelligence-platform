import { useDetectTopicalKnowledgeGaps } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { Button } from '@/shared/components/ui/Button'

/**
 * Knowledge Intelligence Layer v1, Feature 6 — the semantic half of
 * "Knowledge Gaps": WorkspaceGapsSection (next to this on the Hub) shows
 * deterministic structural gaps (orphaned/stale/unread); this is a
 * manually-triggered model suggestion of a plausible missing *topic*,
 * always labeled as a suggestion the user confirms, never as a detected
 * fact — kept as its own AI call, not folded into computeKnowledgeGaps.
 */
export function TopicalKnowledgeGapsSection() {
  const detect = useDetectTopicalKnowledgeGaps()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-ink-muted)]">ARRIYIA's best guess at what topic you haven't covered yet — always worth double-checking.</p>
        <Button variant="secondary" loading={detect.isPending} onClick={() => detect.mutate()}>
          {detect.isPending ? 'Thinking…' : 'Suggest missing areas'}
        </Button>
      </div>

      {detect.isError && (
        <p className="text-sm text-[var(--color-danger)]">
          {detect.error instanceof Error ? detect.error.message : 'Failed to suggest missing areas.'}
        </p>
      )}

      {detect.isSuccess && detect.data.length === 0 && (
        <p className="text-sm text-[var(--color-ink-muted)]">Nothing stood out as conspicuously missing.</p>
      )}

      {detect.isSuccess && detect.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {detect.data.map((gap) => (
            <li key={gap.label} className="text-sm">
              <span className="font-medium text-[var(--color-ink)]">{gap.label}</span>
              {gap.reason && <span className="text-[var(--color-ink-muted)]"> — {gap.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
