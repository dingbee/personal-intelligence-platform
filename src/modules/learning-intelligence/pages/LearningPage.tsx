import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHasLearningIntelligence } from '@/modules/plans/hooks/useHasLearningIntelligence'
import { useLearningSignals } from '@/modules/learning-intelligence/hooks/useLearningSignals'
import { useLearningSignalProvenance } from '@/modules/learning-intelligence/hooks/useLearningSignalProvenance'
import { useRevokeLearningSignal } from '@/modules/learning-intelligence/hooks/useRevokeLearningSignal'
import { isSignalStale } from '@/modules/learning-intelligence/api/signalStaleness'
import type { LearningSignal } from '@/modules/learning-intelligence/learning'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'error' | 'neutral'

const STATUS_BADGE: Record<LearningSignal['status'], { label: string; variant: BadgeVariant }> = {
  proposed: { label: 'Proposed — single observation', variant: 'neutral' },
  active: { label: 'Active — corroborated', variant: 'success' },
  contested: { label: 'Contested', variant: 'warning' },
  revoked: { label: 'Revoked', variant: 'error' },
}

const STRENGTH_BADGE: Record<LearningSignal['strength'], BadgeVariant> = { weak: 'neutral', moderate: 'info', strong: 'success' }
const DIRECTION_LABEL: Record<LearningSignal['direction'], string> = { positive: 'Tends to succeed', negative: 'Tends to fail or mismatch' }

function LearningSignalEvidence({ signalId }: { signalId: string }) {
  const { data, isLoading } = useLearningSignalProvenance(signalId)

  if (isLoading) return <Spinner size="sm" />
  if (!data) return null

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-[var(--color-border)] pt-2 text-xs">
      {data.contradicts && (
        <p className="text-[var(--color-ink-muted)]">
          Contests an earlier signal:{' '}
          <Link to="/learning" className="text-[var(--color-accent)] hover:underline">
            {data.contradicts.statement}
          </Link>{' '}
          ({data.contradicts.status})
        </p>
      )}
      {data.contradictedBy.length > 0 && (
        <p className="text-[var(--color-warning-strong)]">Later contested by {data.contradictedBy.length} newer signal(s) — see the newer entries in this list.</p>
      )}
      {data.evidence.length > 0 && (
        <div>
          <p className="font-medium text-[var(--color-ink-muted)]">Evidence ({data.evidence.length})</p>
          <ul className="mt-1 flex flex-col gap-1">
            {data.evidence.map((item) => (
              <li key={item.evaluation.id} className="text-[var(--color-ink-muted)]">
                [{item.evaluation.source === 'user_feedback' ? 'User feedback' : 'System observed'}] {item.evaluation.comparisonResult}: {item.evaluation.actualOutcome}
                {item.record && (
                  <>
                    {' — '}
                    <Link to={`/history/records/${item.record.id}`} className="text-[var(--color-accent)] hover:underline">
                      view source record
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function LearningSignalCard({ signal }: { signal: LearningSignal }) {
  const [showEvidence, setShowEvidence] = useState(false)
  const [reason, setReason] = useState('')
  const revokeMutation = useRevokeLearningSignal()
  const statusBadge = STATUS_BADGE[signal.status]
  const stale = isSignalStale(signal)

  return (
    <li className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge label={statusBadge.label} variant={statusBadge.variant} />
        <StatusBadge label={`${signal.strength} signal`} variant={STRENGTH_BADGE[signal.strength]} />
        <StatusBadge label={DIRECTION_LABEL[signal.direction]} variant={signal.direction === 'positive' ? 'success' : 'error'} />
        {stale && <StatusBadge label="Stale — not re-confirmed in 90+ days" variant="warning" />}
      </div>

      <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{signal.statement}</p>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        Based on {signal.evidenceCount} verified outcome{signal.evidenceCount === 1 ? '' : 's'} — last confirmed {new Date(signal.lastEvidenceAt).toLocaleDateString()}.
      </p>

      {signal.status === 'revoked' && signal.revokedReason && <p className="mt-1 text-[var(--color-ink-muted)]">Revoked: {signal.revokedReason}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {signal.status !== 'revoked' && (
          <>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why? (optional)"
              className="w-40 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-1.5 py-1 text-[10px]"
            />
            <button
              type="button"
              onClick={() => revokeMutation.mutate({ signalId: signal.id, reason: reason.trim() || undefined })}
              disabled={revokeMutation.isPending}
              className="rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-danger)] disabled:opacity-50"
            >
              {revokeMutation.isPending ? 'Revoking…' : 'Revoke'}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setShowEvidence((v) => !v)}
          className="rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)]"
        >
          {showEvidence ? 'Hide evidence' : 'View evidence'}
        </button>
      </div>

      {revokeMutation.isError && (
        <p role="alert" className="mt-1 text-[10px] text-[var(--color-danger)]">
          {errorMessage(revokeMutation.error, 'Failed to revoke.')}
        </p>
      )}

      {showEvidence && <LearningSignalEvidence signalId={signal.id} />}
    </li>
  )
}

/**
 * I8 — what ARRIYIA has learned from what actually happened, and why.
 * Deliberately not a chat-personalization "memory" page (see ai_memory's
 * own, separate Memory Management page) — every entry here traces back
 * to a real, verified outcome (see LearningSignalEvidence's own
 * evidence-with-source-record links). A signal never appears here as
 * trusted until it has been genuinely corroborated more than once
 * (STATUS_BADGE's own 'proposed' framing makes that explicit) — and a
 * revoked one stops influencing anything immediately (see
 * gatherRelevantLearningSignals.ts's own 'active'-only read path) while
 * staying visible here for transparency.
 */
export function LearningPage() {
  const { data: hasLearningIntelligence, isLoading: isCheckingEntitlement } = useHasLearningIntelligence()
  const { data: signals, isLoading } = useLearningSignals()

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        level="page"
        title="Learning"
        description="What ARRIYIA has learned from what actually happened — grounded in verified outcomes, never a single observation, never silently overwritten when new evidence disagrees."
      />

      <SurfaceCard className="flex flex-col gap-3">
        {isCheckingEntitlement ? (
          <Spinner size="sm" />
        ) : !hasLearningIntelligence ? (
          <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
            <p>Learning is a Pro Intelligence capability.</p>
            <Link to="/pricing" className="text-[var(--color-accent)] hover:underline">
              Upgrade to Pro →
            </Link>
          </div>
        ) : isLoading ? (
          <Spinner size="sm" />
        ) : !signals || signals.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            No learning signals yet. These appear once ARRIYIA has verified outcomes to learn from — starting with executed, verified actions.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {signals.map((signal) => (
              <LearningSignalCard key={signal.id} signal={signal} />
            ))}
          </ul>
        )}
      </SurfaceCard>
    </div>
  )
}
