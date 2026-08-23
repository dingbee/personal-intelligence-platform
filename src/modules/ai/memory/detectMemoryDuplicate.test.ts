import { describe, expect, it } from 'vitest'
import {
  findReinforcementTarget,
  isNearDuplicateMemoryContent,
  memoryContentOverlap,
  normalizeMemoryContent,
} from '@/modules/ai/memory/detectMemoryDuplicate'
import type { AiMemory } from '@/shared/types/database'

let counter = 0
function makeMemory(overrides: Partial<AiMemory> = {}): AiMemory {
  counter += 1
  return {
    id: `memory-${counter}`,
    user_id: 'user-1',
    workspace_id: null,
    memory_type: 'learned_preference',
    content: `Content ${counter}`,
    source: 'conversation',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    confidence: 0.8,
    reinforcement_count: 0,
    last_reinforced_at: null,
    ...overrides,
  }
}

describe('normalizeMemoryContent', () => {
  it('collapses case, whitespace, and trailing punctuation differences', () => {
    expect(normalizeMemoryContent('User prefers concise answers.')).toBe(normalizeMemoryContent('user  prefers   CONCISE answers'))
  })
})

describe('memoryContentOverlap', () => {
  it('is 0 when either side has no tokens', () => {
    expect(memoryContentOverlap('', 'User prefers concise answers.')).toBe(0)
    expect(memoryContentOverlap('...', 'User prefers concise answers.')).toBe(0)
  })

  it('is 1 for identical content', () => {
    expect(memoryContentOverlap('User prefers concise answers.', 'User prefers concise answers.')).toBe(1)
  })

  it('is well below the duplicate threshold for a genuine contradiction sharing most words', () => {
    // "concise" vs "detailed" is the one word that matters — these must
    // never be treated as the same statement despite sharing 3 of 5 words.
    const overlap = memoryContentOverlap('User prefers concise answers.', 'User prefers detailed answers.')
    expect(overlap).toBeCloseTo(0.6, 5)
  })
})

describe('isNearDuplicateMemoryContent', () => {
  it('treats an exact repeat as a duplicate', () => {
    expect(isNearDuplicateMemoryContent('User prefers concise answers.', 'User prefers concise answers.')).toBe(true)
  })

  it('treats whitespace/case/punctuation-only differences as a duplicate', () => {
    expect(isNearDuplicateMemoryContent('User prefers concise answers.', 'user prefers concise answers')).toBe(true)
  })

  it('treats a close paraphrase with high token overlap as a duplicate', () => {
    expect(isNearDuplicateMemoryContent('User is researching quantum computing.', 'User is researching quantum computing basics.')).toBe(true)
  })

  it('never treats a genuine contradiction as a duplicate', () => {
    expect(isNearDuplicateMemoryContent('User prefers concise answers.', 'User prefers detailed answers.')).toBe(false)
  })

  it('never treats two unrelated statements as a duplicate', () => {
    expect(isNearDuplicateMemoryContent('User dislikes loud restaurants.', 'User is building a mobile app.')).toBe(false)
  })
})

describe('findReinforcementTarget', () => {
  it('returns null when nothing in the existing set is a confirmed repeat', () => {
    const existing = [makeMemory({ content: 'User dislikes loud restaurants.' })]
    expect(findReinforcementTarget('User prefers concise answers.', existing)).toBeNull()
  })

  it('finds the matching memory for an exact repeat', () => {
    const target = makeMemory({ content: 'User prefers concise answers.' })
    const existing = [makeMemory({ content: 'User dislikes loud restaurants.' }), target]
    expect(findReinforcementTarget('User prefers concise answers.', existing)?.id).toBe(target.id)
  })

  it('never matches a genuine contradiction, so it never reinforces the wrong statement', () => {
    const existing = [makeMemory({ content: 'User prefers concise answers.' })]
    expect(findReinforcementTarget('User prefers detailed answers.', existing)).toBeNull()
  })

  it('picks the single best match when more than one candidate overlaps', () => {
    const exact = makeMemory({ content: 'User prefers concise answers.' })
    const partial = makeMemory({ content: 'User prefers concise, direct answers.' })
    const existing = [partial, exact]
    expect(findReinforcementTarget('User prefers concise answers.', existing)?.id).toBe(exact.id)
  })
})
