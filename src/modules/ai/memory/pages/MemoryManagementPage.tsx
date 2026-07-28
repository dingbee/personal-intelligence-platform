import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMemories } from '@/modules/ai/memory/hooks/useMemories'
import { MemoryCard } from '@/modules/ai/memory/components/MemoryCard'
import {
  filterAndSortMemories,
  type MemorySortOrder,
  type MemoryTypeFilter,
} from '@/modules/ai/memory/filterAndSortMemories'
import { MEMORY_TYPE_LABELS } from '@/modules/ai/memory/memoryTypeLabels'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'

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
          ? 'bg-[var(--color-ink)] text-white'
          : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
      }`}
    >
      {label}
    </button>
  )
}

/** Phase UX-5.3A: the user-facing control plane for `ai_memory` — list, filter, sort, edit, delete. No memory-creation or approval UI here; NOVA doesn't write memories on its own yet (that's UX-5.3B). */
export function MemoryManagementPage() {
  const { data: memories = [], isLoading } = useMemories()
  const [typeFilter, setTypeFilter] = useState<MemoryTypeFilter>('all')
  const [sortOrder, setSortOrder] = useState<MemorySortOrder>('newest')

  const filtered = useMemo(
    () => filterAndSortMemories(memories, { typeFilter, sortOrder }),
    [memories, typeFilter, sortOrder],
  )

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

      {isLoading ? (
        <Spinner size="sm" />
      ) : memories.length === 0 ? (
        <EmptyState
          title="NOVA has not learned anything about you yet."
          description="Start conversations and NOVA will learn preferences when appropriate."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

          <div>
            <SectionHeader level="section" title="Active Memories" />
            {filtered.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No memories match this filter.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
