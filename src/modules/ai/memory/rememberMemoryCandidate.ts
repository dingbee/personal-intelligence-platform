import type { AiMemory } from '@/shared/types/database'
import type { MemoryCandidate } from '@/modules/ai/memory/memoryDetection/types'
import { createMemory, listMemories, reinforceMemory } from '@/modules/ai/memory/api/memory'
import { findReinforcementTarget } from '@/modules/ai/memory/detectMemoryDuplicate'
import { reinforceConfidence } from '@/modules/ai/memory/reinforceMemoryConfidence'

/**
 * UX-14.2 Memory Evolution (Reinforcement) — the one place a
 * MemoryCandidate turns into either a new row or reinforcement of an
 * existing one. `explicit_profile` candidates (e.g. "my name is ...",
 * detected by detectMemoryCandidates alongside learned_preference/
 * conversation_memory ones) are never auto-reinforced — a structured
 * profile field is a singleton per source (see profileFields.ts) and gets
 * edited in place through that dedicated UI, not silently merged with a
 * repeated mention; every explicit_profile candidate always creates its
 * own new row here, exactly as before this capability existed.
 *
 * For learned_preference/conversation_memory: fetches the caller's
 * current active memories of the same type+workspace (a fresh read, not
 * a client cache, so the reinforcement decision is never made against
 * stale data), finds a confirmed lexical repeat via
 * findReinforcementTarget, and either reinforces it or falls back to
 * creating a new row exactly as before. A memory the user has disabled
 * is never a reinforcement target — listMemories' default `is_active:
 * true` scope already excludes it, so a repeated statement about
 * something the user turned off starts a fresh row rather than silently
 * reactivating what they disabled.
 */
export async function rememberMemoryCandidate(
  candidate: MemoryCandidate,
  context: { userId: string; workspaceId: string | null },
): Promise<AiMemory> {
  if (candidate.type !== 'explicit_profile') {
    const existing = await listMemories({ workspaceId: context.workspaceId, memoryType: candidate.type })
    const target = findReinforcementTarget(candidate.content, existing)
    if (target) {
      const baseConfidence = target.confidence ?? candidate.confidence
      return reinforceMemory(target.id, {
        newConfidence: reinforceConfidence(baseConfidence),
        newReinforcementCount: target.reinforcement_count + 1,
      })
    }
  }

  return createMemory({
    userId: context.userId,
    workspaceId: context.workspaceId,
    memoryType: candidate.type,
    content: candidate.content,
    source: 'conversation',
    confidence: candidate.confidence,
  })
}
