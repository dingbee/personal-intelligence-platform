import { useState } from 'react'
import type { AiMemory } from '@/shared/types/database'
import { useMemories } from '@/modules/ai/memory/hooks/useMemories'
import { formatMemorySource } from '@/modules/ai/memory/formatMemorySource'
import { MEMORY_TYPE_BADGE_VARIANT, MEMORY_TYPE_LABELS } from '@/modules/ai/memory/memoryTypeLabels'
import { isMemoryUsedByPrompt } from '@/modules/ai/memory/memoryPromptUsage'
import { computeEffectiveConfidence } from '@/modules/ai/memory/computeEffectiveConfidence'
import { CONFIDENCE_LABEL_VARIANT, confidenceLabel } from '@/modules/ai/memory/memoryDetection/scoreMemoryConfidence'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { InsetPanel } from '@/shared/components/ui/surface/InsetPanel'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/**
 * Read/edit/delete for a single memory — reuses useMemories() the same way
 * WorkspaceCard reuses useWorkspaceManagement(), so the mutations live once
 * and every card gets its own pending/error state for free.
 *
 * `allMemories` is the full active-only list the page already fetched —
 * passed through (not re-fetched) so isMemoryUsedByPrompt can rank this
 * memory against its type-siblings exactly as retrieveMemoryContext would.
 */
export function MemoryCard({ memory, allMemories }: { memory: AiMemory; allMemories: AiMemory[] }) {
  const { update, remove } = useMemories()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const usedByPrompt = isMemoryUsedByPrompt(memory, allMemories)
  // UX-14.2 Memory Evolution — effective confidence, not the raw stored
  // value: a compact High/Medium/Low badge (never a bare 0..1 number,
  // per the brief's "not raw implementation scores"), left off entirely
  // for a memory with no confidence at all (manually-authored/profile —
  // never fabricated) rather than shown as some fake "unscored" state.
  const effectiveConfidence = computeEffectiveConfidence(memory)

  return (
    <SurfaceCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            label={MEMORY_TYPE_LABELS[memory.memory_type]}
            variant={MEMORY_TYPE_BADGE_VARIANT[memory.memory_type]}
          />
          {effectiveConfidence !== null && (
            <StatusBadge
              label={`Confidence: ${confidenceLabel(effectiveConfidence)}`}
              variant={CONFIDENCE_LABEL_VARIANT[confidenceLabel(effectiveConfidence)]}
            />
          )}
          {usedByPrompt ? (
            <span
              title="ARRIYIA can draw on this memory when building a response — for conversation memories, only when it's relevant to what you're asking."
              className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]"
            >
              Used by ARRIYIA
            </span>
          ) : (
            <span
              title="This memory exists but falls outside the most-recent items ARRIYIA includes for this category."
              className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-muted)]"
            >
              Not currently used
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded px-1 text-xs text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded px-1 text-xs text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-danger)]"
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <InlineTextForm
          initialValue={memory.content}
          onSubmit={(content) => {
            update.mutate({ id: memory.id, content })
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <InsetPanel className="p-3 text-sm text-[var(--color-ink)]">{memory.content}</InsetPanel>
      )}

      <p className="text-xs text-[var(--color-ink-muted)]">
        {formatMemorySource(memory.source)} · Added {formatRelativeTime(memory.created_at)}
        {memory.reinforcement_count > 0 && memory.last_reinforced_at && (
          <>
            {' '}
            · Reinforced {memory.reinforcement_count} {memory.reinforcement_count === 1 ? 'time' : 'times'} · last{' '}
            {formatRelativeTime(memory.last_reinforced_at)}
          </>
        )}
      </p>

      <ConfirmDialog
        open={confirmingDelete}
        title="Remove this memory?"
        description="ARRIYIA will no longer use this information when personalizing responses."
        confirmLabel="Remove"
        onConfirm={() => {
          remove.mutate(memory.id)
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </SurfaceCard>
  )
}
