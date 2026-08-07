import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMemories } from '@/modules/ai/memory/hooks/useMemories'
import { MemoryCard } from '@/modules/ai/memory/components/MemoryCard'
import { ProfileSection } from '@/modules/ai/memory/components/ProfileSection'
import { MemoryTogglesSection } from '@/modules/ai/memory/components/MemoryTogglesSection'
import { HowNovaUsesThisSection } from '@/modules/ai/memory/components/HowNovaUsesThisSection'
import {
  filterAndSortMemories,
  type MemorySortOrder,
  type MemoryTypeFilter,
} from '@/modules/ai/memory/filterAndSortMemories'
import { MEMORY_TYPE_LABELS } from '@/modules/ai/memory/memoryTypeLabels'
import { MemoryApprovalPanel } from '@/modules/ai/memory/memoryDetection/MemoryApprovalPanel'
import type { MemoryCandidate } from '@/modules/ai/memory/memoryDetection/types'
import type { AiMemoryType } from '@/shared/types/database'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Button } from '@/shared/components/ui/Button'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

const TYPE_FILTERS: { value: MemoryTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'explicit_profile', label: MEMORY_TYPE_LABELS.explicit_profile },
  { value: 'learned_preference', label: 'Preferences' },
  { value: 'conversation_memory', label: 'Conversation memories' },
]

const SORT_OPTIONS: { value: MemorySortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
]

const ADDABLE_TYPES: { value: AiMemoryType; label: string }[] = [
  { value: 'explicit_profile', label: MEMORY_TYPE_LABELS.explicit_profile },
  { value: 'learned_preference', label: MEMORY_TYPE_LABELS.learned_preference },
  { value: 'conversation_memory', label: MEMORY_TYPE_LABELS.conversation_memory },
]

function FilterPill<T extends string>({
  value,
  label,
  active,
  onSelect,
}: {
  value: T
  label: string
  active: boolean
  onSelect: (value: T) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]'
          : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
      }`}
    >
      {label}
    </button>
  )
}

/** UX-13.6 Phase 2 — a manual free-text memory: type picker + InlineTextForm, reusing the exact same `create` mutation MemoryApprovalPanel's Remember action already calls. */
function AddMemoryForm({ onSubmit, onCancel }: { onSubmit: (type: AiMemoryType, content: string) => void; onCancel: () => void }) {
  const [type, setType] = useState<AiMemoryType>('learned_preference')

  return (
    <div className="flex items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as AiMemoryType)}
        className="shrink-0 rounded-control border border-[var(--color-border)] bg-[var(--surface-raised)] px-2 py-1 text-xs"
      >
        {ADDABLE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="flex-1">
        <InlineTextForm placeholder="What should NOVA remember?" onSubmit={(content) => onSubmit(type, content)} onCancel={onCancel} />
      </div>
    </div>
  )
}

/**
 * UX-13.6 Phase 2 — Memory & Personalization redesign. Profile (structured
 * dropdowns/chips) and Memory (bulk category toggles) are new, onboarding-
 * first sections above the fold; "What NOVA currently knows" is the
 * original UX-5.3A filter/sort/card grid, renamed and now with a manual
 * Add affordance, kept exactly as it worked before. MemoryApprovalPanel
 * (UX-5.3B) is unchanged.
 */
export function MemoryManagementPage() {
  const { data: memories = [], isLoading, create, rememberCandidate: rememberCandidateShared } = useMemories()
  const [typeFilter, setTypeFilter] = useState<MemoryTypeFilter>('all')
  const [sortOrder, setSortOrder] = useState<MemorySortOrder>('newest')
  const [pendingCandidates, setPendingCandidates] = useState<MemoryCandidate[]>([])
  const [addingMemory, setAddingMemory] = useState(false)

  const filtered = useMemo(
    () => filterAndSortMemories(memories, { typeFilter, sortOrder }),
    [memories, typeFilter, sortOrder],
  )

  function dismissCandidate(candidate: MemoryCandidate) {
    setPendingCandidates((current) => current.filter((c) => c !== candidate))
  }

  function rememberCandidate(candidate: MemoryCandidate) {
    rememberCandidateShared(candidate)
    dismissCandidate(candidate)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/settings"
          className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          ← Back to Settings
        </Link>
        <div className="mt-2">
          <SectionHeader
            level="page"
            title="Memory & Personalization"
            description="Control what NOVA remembers to personalize your experience."
          />
        </div>
      </div>

      <HowNovaUsesThisSection />
      <ProfileSection />
      <MemoryTogglesSection />

      <MemoryApprovalPanel candidates={pendingCandidates} onRemember={rememberCandidate} onDismiss={dismissCandidate} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <SectionHeader level="section" title="What NOVA currently knows" />
          {!addingMemory && (
            <Button variant="secondary" onClick={() => setAddingMemory(true)}>
              + Add
            </Button>
          )}
        </div>

        {addingMemory && (
          <div className="mt-3">
            <AddMemoryForm
              onSubmit={(type, content) => {
                create.mutate({ memoryType: type, content })
                setAddingMemory(false)
              }}
              onCancel={() => setAddingMemory(false)}
            />
          </div>
        )}

        {isLoading ? (
          <Spinner size="sm" />
        ) : memories.length === 0 ? (
          <EmptyState
            title="Nothing here yet."
            description="Fill in your profile above, add a memory manually, or just start chatting — NOVA learns preferences as you go."
          />
        ) : (
          <>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {TYPE_FILTERS.map((filter) => (
                  <FilterPill
                    key={filter.value}
                    value={filter.value}
                    label={filter.label}
                    active={typeFilter === filter.value}
                    onSelect={setTypeFilter}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                {SORT_OPTIONS.map((option) => (
                  <FilterPill
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    active={sortOrder === option.value}
                    onSelect={setSortOrder}
                  />
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No memories match this filter.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} allMemories={memories} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
