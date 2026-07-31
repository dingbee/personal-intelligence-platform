import { useMemories } from '@/modules/ai/memory/hooks/useMemories'
import {
  computeProfileCompletion,
  getMultiProfileValues,
  getSingleProfileValue,
  profileSource,
  type ProfileFieldKey,
} from '@/modules/ai/memory/profileFields'

/**
 * UX-13.6 Phase 2 — the structured read/write layer over explicit_profile
 * ai_memory rows. Every mutation here is the same create/update/remove
 * useMemories already exposes; this hook only decides *which* mutation a
 * dropdown/chip toggle should call (update the existing single-select row
 * vs. insert a new multi-select row vs. remove one) so the Profile
 * section's components never touch ai_memory rows directly.
 */
export function useProfileFields() {
  const { data: memories = [], isLoading, create, update, remove } = useMemories({ memoryType: 'explicit_profile' })

  function getSingle(field: ProfileFieldKey): string | null {
    return getSingleProfileValue(memories, field)?.content ?? null
  }

  function getMulti(field: ProfileFieldKey): string[] {
    return getMultiProfileValues(memories, field).map((m) => m.content)
  }

  /** Single-select: updates the existing row in place if one exists, so a re-selection never leaves a stale duplicate behind. */
  function setSingleValue(field: ProfileFieldKey, value: string) {
    const existing = getSingleProfileValue(memories, field)
    if (existing) update.mutate({ id: existing.id, content: value })
    else create.mutate({ memoryType: 'explicit_profile', content: value, source: profileSource(field) })
  }

  function clearSingleValue(field: ProfileFieldKey) {
    const existing = getSingleProfileValue(memories, field)
    if (existing) remove.mutate(existing.id)
  }

  /** Multi-select: each distinct value is its own row: selecting adds one, re-selecting the same value removes it (a checkbox-chip toggle). */
  function toggleMultiValue(field: ProfileFieldKey, value: string) {
    const existing = getMultiProfileValues(memories, field).find((m) => m.content === value)
    if (existing) remove.mutate(existing.id)
    else create.mutate({ memoryType: 'explicit_profile', content: value, source: profileSource(field) })
  }

  return {
    isLoading,
    getSingle,
    getMulti,
    setSingleValue,
    clearSingleValue,
    toggleMultiValue,
    completion: computeProfileCompletion(memories),
  }
}
