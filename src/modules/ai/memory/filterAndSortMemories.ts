import type { AiMemory, AiMemoryType } from '@/shared/types/database'

export type MemoryTypeFilter = 'all' | AiMemoryType
export type MemorySortOrder = 'newest' | 'oldest'

/**
 * Pure filter+sort for the Memory Management page — the full active-memory
 * set is fetched once (useMemories, workspace-scoped, active-only) and
 * this runs client-side per filter/sort change, same division of labour as
 * KnowledgeExplorerPage's typeFilter.
 */
export function filterAndSortMemories(
  memories: AiMemory[],
  options: { typeFilter: MemoryTypeFilter; sortOrder: MemorySortOrder },
): AiMemory[] {
  const filtered =
    options.typeFilter === 'all' ? memories : memories.filter((memory) => memory.memory_type === options.typeFilter)

  return [...filtered].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return options.sortOrder === 'newest' ? -diff : diff
  })
}
