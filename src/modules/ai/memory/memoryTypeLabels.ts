import type { AiMemoryType } from '@/shared/types/database'

/** Short badge/filter labels — distinct from formatMemoriesForPrompt's longer section titles, which are prompt copy, not UI copy. */
export const MEMORY_TYPE_LABELS: Record<AiMemoryType, string> = {
  explicit_profile: 'Explicit profile',
  learned_preference: 'Learned preference',
  conversation_memory: 'Conversation memory',
}

export const MEMORY_TYPE_BADGE_VARIANT: Record<AiMemoryType, 'info' | 'success' | 'neutral'> = {
  explicit_profile: 'info',
  learned_preference: 'success',
  conversation_memory: 'neutral',
}
