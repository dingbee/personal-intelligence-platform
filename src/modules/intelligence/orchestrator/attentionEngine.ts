import type { AiMemory } from '@/shared/types/database'
import type { AttentionItem } from '@/modules/intelligence/orchestrator/types'

/** Reused by signalEngine's inactive_workspace signal — one threshold, not two. */
export const INACTIVE_WORKSPACE_DAYS = 14
const STOPPED_MIDWAY_MIN = 0.15
const STOPPED_MIDWAY_MAX = 0.85
const FINISHED_THRESHOLD = 0.95

const POSITIVE_MARKERS = /\b(prefer|prefers|like|likes|love|loves|enjoy|enjoys)\b/i
const NEGATIVE_MARKERS = /\b(dislike|dislikes|hate|hates|don'?t like|doesn'?t like)\b/i

/** "user" is excluded — every memory's content is templated as "User prefers/dislikes ...", so it would spuriously "overlap" on every single pair otherwise. */
const STOPWORDS = new Set(['user'])

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word)),
  )
}

function shareSignificantWord(a: string, b: string): boolean {
  const wordsB = significantWords(b)
  return [...significantWords(a)].some((word) => wordsB.has(word))
}

/**
 * Reused by both attentionEngine (contradictory_memories) and
 * signalEngine (contradictory_memory) — one detection algorithm, two
 * presentations. Deterministic keyword/sentiment matching, no AI: two
 * learned_preference memories that share a significant word but carry
 * opposite sentiment markers (prefer/like vs. dislike/hate).
 */
export function findContradictoryMemoryPairs(memories: AiMemory[]): [AiMemory, AiMemory][] {
  const preferences = memories.filter((memory) => memory.memory_type === 'learned_preference')
  const pairs: [AiMemory, AiMemory][] = []

  for (let i = 0; i < preferences.length; i++) {
    for (let j = i + 1; j < preferences.length; j++) {
      const a = preferences[i]!
      const b = preferences[j]!
      const aPositive = POSITIVE_MARKERS.test(a.content)
      const aNegative = NEGATIVE_MARKERS.test(a.content)
      const bPositive = POSITIVE_MARKERS.test(b.content)
      const bNegative = NEGATIVE_MARKERS.test(b.content)
      const opposite = (aPositive && bNegative) || (aNegative && bPositive)
      if (opposite && shareSignificantWord(a.content, b.content)) pairs.push([a, b])
    }
  }

  return pairs
}

export interface AttentionEngineInput {
  inProgressDocument: { title: string; scrollFraction: number } | null
  memories: AiMemory[]
  userQuery: string
  recentConversations: { title: string }[]
  workspaceLastActivityAt: string | null
  now?: Date
}

/**
 * UX-8 Phase 3 — pure heuristics over already-fetched data (no AI, no new
 * retrieval). Each check is independent; a missing input (no in-progress
 * document, no memories, etc.) just means that item never fires.
 */
export function detectAttentionItems(input: AttentionEngineInput): AttentionItem[] {
  const items: AttentionItem[] = []
  const now = input.now ?? new Date()

  if (input.inProgressDocument) {
    const { title, scrollFraction } = input.inProgressDocument
    if (scrollFraction < FINISHED_THRESHOLD) {
      items.push({ type: 'unfinished_book', message: `You haven't finished "${title}" yet.`, priority: 'medium' })
    }
    if (scrollFraction >= STOPPED_MIDWAY_MIN && scrollFraction <= STOPPED_MIDWAY_MAX) {
      items.push({ type: 'stopped_midway', message: `You stopped partway through "${title}".`, priority: 'medium' })
    }
  }

  const askedBefore = input.recentConversations.find((conversation) => shareSignificantWord(conversation.title, input.userQuery))
  if (askedBefore) {
    items.push({ type: 'asked_before', message: `You asked about something similar in "${askedBefore.title}".`, priority: 'low' })
  }

  if (findContradictoryMemoryPairs(input.memories).length > 0) {
    items.push({ type: 'contradictory_memories', message: 'Some of your stored preferences may contradict each other.', priority: 'high' })
  }

  if (input.workspaceLastActivityAt) {
    const daysSince = Math.floor((now.getTime() - new Date(input.workspaceLastActivityAt).getTime()) / (24 * 60 * 60 * 1000))
    if (daysSince >= INACTIVE_WORKSPACE_DAYS) {
      items.push({ type: 'inactive_workspace', message: `This workspace has been inactive for ${daysSince} days.`, priority: 'low' })
    }
  }

  return items
}
