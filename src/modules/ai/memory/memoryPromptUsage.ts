import { MAX_MEMORIES_PER_TYPE } from '@/modules/ai/memory/retrieveMemoryContext'
import { rankMemories } from '@/modules/ai/memory/rankMemories'
import type { AiMemory } from '@/shared/types/database'

/**
 * UX-13.6 — mirrors formatMemoriesForPrompt's own ranking (rankMemories:
 * confidence descending, then most-recently-updated, capped per type) so
 * "used by NOVA" in the UI can never drift from what retrieveMemoryContext
 * actually sends. `allMemories` should be the same active-only list the
 * Memory page already has — inactive memories are excluded upstream by
 * useMemories()'s default filter, matching listMemories()'s own is_active
 * filter.
 */
export function isMemoryUsedByPrompt(memory: AiMemory, allMemories: AiMemory[]): boolean {
  const rank = rankMemories(allMemories.filter((m) => m.memory_type === memory.memory_type)).findIndex(
    (m) => m.id === memory.id,
  )
  return rank !== -1 && rank < MAX_MEMORIES_PER_TYPE
}
