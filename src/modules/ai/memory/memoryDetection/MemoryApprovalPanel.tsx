import { useState } from 'react'
import type { MemoryCandidate } from '@/modules/ai/memory/memoryDetection/types'
import { confidenceLabel, type ConfidenceLabel } from '@/modules/ai/memory/memoryDetection/scoreMemoryConfidence'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { Button } from '@/shared/components/ui/Button'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

const CONFIDENCE_VARIANT: Record<ConfidenceLabel, 'success' | 'info' | 'neutral'> = {
  High: 'success',
  Medium: 'info',
  Low: 'neutral',
}

function MemoryCandidateCard({
  candidate,
  onRemember,
  onDismiss,
}: {
  candidate: MemoryCandidate
  onRemember: (candidate: MemoryCandidate) => void
  onDismiss: (candidate: MemoryCandidate) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const label = confidenceLabel(candidate.confidence)

  return (
    <SurfaceCard className="flex flex-col gap-3">
      <StatusBadge label={`Confidence: ${label}`} variant={CONFIDENCE_VARIANT[label]} />
      <p className="text-sm text-[var(--color-ink)]">{candidate.content}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onDismiss(candidate)}>
          Dismiss
        </Button>
        <Button onClick={() => setConfirming(true)}>Remember</Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Save this memory?"
        description={`NOVA will remember: "${candidate.content}" and use it to personalize future responses.`}
        confirmLabel="Remember"
        destructive={false}
        onConfirm={() => {
          onRemember(candidate)
          setConfirming(false)
        }}
        onCancel={() => setConfirming(false)}
      />
    </SurfaceCard>
  )
}

/**
 * Phase UX-5.3B: the human-approval step — nothing in ai_memory changes
 * until the user clicks Remember and confirms. `onRemember` is expected to
 * call the same createMemory mutation Phase UX-5.3A already built
 * (source: 'conversation'); `onDismiss` just drops the candidate from
 * whatever in-memory queue the caller is holding. Renders nothing when
 * there are no candidates — safe to always mount.
 */
export function MemoryApprovalPanel({
  candidates,
  onRemember,
  onDismiss,
}: {
  candidates: MemoryCandidate[]
  onRemember: (candidate: MemoryCandidate) => void
  onDismiss: (candidate: MemoryCandidate) => void
}) {
  if (candidates.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-ink-muted)]">
        NOVA noticed something that may help personalize future responses.
      </p>
      <div className="flex flex-col gap-3">
        {candidates.map((candidate, index) => (
          <MemoryCandidateCard
            key={`${candidate.sourceConversationId}-${index}`}
            candidate={candidate}
            onRemember={onRemember}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  )
}
