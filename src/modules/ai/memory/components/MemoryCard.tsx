import { useState } from 'react'
import type { AiMemory } from '@/shared/types/database'
import { useMemories } from '@/modules/ai/memory/hooks/useMemories'
import { formatMemorySource } from '@/modules/ai/memory/formatMemorySource'
import { MEMORY_TYPE_BADGE_VARIANT, MEMORY_TYPE_LABELS } from '@/modules/ai/memory/memoryTypeLabels'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { InsetPanel } from '@/shared/components/ui/surface/InsetPanel'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/** Read/edit/delete for a single memory — reuses useMemories() the same way WorkspaceCard reuses useWorkspaceManagement(), so the mutations live once and every card gets its own pending/error state for free. */
export function MemoryCard({ memory }: { memory: AiMemory }) {
  const { update, remove } = useMemories()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <SurfaceCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <StatusBadge
          label={MEMORY_TYPE_LABELS[memory.memory_type]}
          variant={MEMORY_TYPE_BADGE_VARIANT[memory.memory_type]}
        />
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
            className="rounded px-1 text-xs text-[var(--color-ink-muted)] transition-colors hover:text-red-600"
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
      </p>

      <ConfirmDialog
        open={confirmingDelete}
        title="Remove this memory?"
        description="Nova will no longer use this information when personalizing responses."
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
