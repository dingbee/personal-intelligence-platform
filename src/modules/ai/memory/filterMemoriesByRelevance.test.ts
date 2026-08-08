import { describe, expect, it } from 'vitest'
import { filterMemoriesByRelevance } from '@/modules/ai/memory/filterMemoriesByRelevance'
import type { AiMemory, AiMemoryType } from '@/shared/types/database'

let counter = 0
function makeMemory(overrides: Partial<AiMemory> = {}): AiMemory {
  counter += 1
  return {
    id: `memory-${counter}`,
    user_id: 'user-1',
    workspace_id: null,
    memory_type: 'explicit_profile',
    content: `Content ${counter}`,
    source: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    confidence: null,
    ...overrides,
  }
}

describe('filterMemoriesByRelevance', () => {
  it('always keeps explicit_profile memories regardless of the question', () => {
    const memory = makeMemory({ memory_type: 'explicit_profile', content: 'User is a hotel manager in Bali.' })
    const result = filterMemoriesByRelevance([memory], 'What is the weather like today?')
    expect(result).toEqual([memory])
  })

  it('always keeps learned_preference memories regardless of the question — Test A: a stated preference applies without being repeated', () => {
    const memory = makeMemory({ memory_type: 'learned_preference', content: 'User prefers concise executive summaries.' })
    const result = filterMemoriesByRelevance([memory], 'Can you put together a report on last quarter?')
    expect(result).toEqual([memory])
  })

  it('excludes a conversation_memory entry unrelated to the current question — Test C', () => {
    const memory = makeMemory({ memory_type: 'conversation_memory', content: 'User is researching the Northern Expansion project.' })
    const result = filterMemoriesByRelevance([memory], 'What is my favorite recipe for banana bread?')
    expect(result).toEqual([])
  })

  it('keeps a conversation_memory entry whose content overlaps a term extracted from the question', () => {
    const memory = makeMemory({ memory_type: 'conversation_memory', content: 'User is researching the Northern Expansion project.' })
    const result = filterMemoriesByRelevance([memory], 'Any updates on Northern Expansion?')
    expect(result).toEqual([memory])
  })

  it('matches case-insensitively', () => {
    const memory = makeMemory({ memory_type: 'conversation_memory', content: 'User is writing a book about ARRIYIA.' })
    const result = filterMemoriesByRelevance([memory], 'What do you know about Arriyia')
    expect(result).toEqual([memory])
  })

  it('excludes every conversation_memory when the question has no extractable terms at all', () => {
    const memory = makeMemory({ memory_type: 'conversation_memory', content: 'User is building a mobile app.' })
    const result = filterMemoriesByRelevance([memory], 'what is up')
    expect(result).toEqual([])
  })

  it('ranks a mix correctly: keeps always-relevant types, filters conversation_memory independently per item', () => {
    const profile = makeMemory({ memory_type: 'explicit_profile', content: 'User works in hospitality.' })
    const relevantMemory = makeMemory({ memory_type: 'conversation_memory', content: 'User is building the Northern Expansion budget.' })
    const irrelevantMemory = makeMemory({ memory_type: 'conversation_memory', content: 'User is planning a birthday party.' })
    const result = filterMemoriesByRelevance([profile, relevantMemory, irrelevantMemory], 'How is Northern Expansion progressing?')
    expect(result).toEqual([profile, relevantMemory])
  })

  it('returns an empty array for an empty input list', () => {
    expect(filterMemoriesByRelevance([], 'anything')).toEqual([])
  })

  it('never removes learned_preference or explicit_profile memories even when other conversation_memory items are filtered out', () => {
    const types: AiMemoryType[] = ['explicit_profile', 'learned_preference']
    const memories = types.map((memory_type) => makeMemory({ memory_type, content: `Some ${memory_type} content` }))
    const result = filterMemoriesByRelevance(memories, 'totally unrelated question with no proper nouns')
    expect(result).toHaveLength(2)
  })
})
