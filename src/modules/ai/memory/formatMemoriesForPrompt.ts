import type { AiMemory, AiMemoryType } from '@/shared/types/database'

const SECTION_TITLES: Record<AiMemoryType, string> = {
  explicit_profile: 'What NOVA knows about you',
  learned_preference: 'Learned preferences',
  conversation_memory: 'From past conversations',
}

/** Most-durable/direct first — explicit statements outrank inferred preferences, which outrank memories extracted from a past conversation. */
const SECTION_ORDER: AiMemoryType[] = ['explicit_profile', 'learned_preference', 'conversation_memory']

export interface FormatMemoriesOptions {
  /** Caps how many memories from EACH type appear, most-recently-updated first. */
  maxPerType?: number
}

/**
 * Renders stored memories into a prompt-ready text block, grouped by
 * type. Not called from buildSystemPrompt/AIService yet — Phase UX-5 is
 * the memory foundation only (CRUD + this formatter); a later phase
 * wires the read side in once the write side (what gets remembered, and
 * when) is designed, and RAG/prompt changes are explicitly in scope for
 * that phase, not this one.
 */
export function formatMemoriesForPrompt(memories: AiMemory[], options: FormatMemoriesOptions = {}): string {
  const maxPerType = options.maxPerType ?? 20

  const sections = SECTION_ORDER.map((type) => {
    const items = memories
      .filter((memory) => memory.memory_type === type)
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
      .slice(0, maxPerType)
    if (items.length === 0) return null
    const lines = items.map((memory) => `- ${memory.content}`).join('\n')
    return `## ${SECTION_TITLES[type]}\n${lines}`
  }).filter((section): section is string => section !== null)

  return sections.join('\n\n')
}
