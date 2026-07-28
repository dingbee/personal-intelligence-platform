import { describe, expect, it } from 'vitest'
import { detectMemoryCandidates } from '@/modules/ai/memory/memoryDetection/detectMemoryCandidates'
import type { MemoryCandidate } from '@/modules/ai/memory/memoryDetection/types'

function first(candidates: MemoryCandidate[]): MemoryCandidate {
  const candidate = candidates[0]
  if (!candidate) throw new Error('expected at least one candidate')
  return candidate
}

describe('detectMemoryCandidates', () => {
  it('detects a preference statement as learned_preference, high confidence', () => {
    const candidate = first(detectMemoryCandidates('I prefer dark mode interfaces.', 'conv-1'))
    expect(candidate.type).toBe('learned_preference')
    expect(candidate.content).toBe('User prefers dark mode interfaces.')
    expect(candidate.confidence).toBeGreaterThanOrEqual(0.8)
    expect(candidate.sourceConversationId).toBe('conv-1')
  })

  it('detects an explicit personal fact as explicit_profile, high confidence', () => {
    const candidate = first(detectMemoryCandidates('My daughter is named Elyana.', 'conv-2'))
    expect(candidate.type).toBe('explicit_profile')
    expect(candidate.content).toBe('User has a daughter named Elyana.')
    expect(candidate.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('detects a transient conversation topic as conversation_memory, lower confidence', () => {
    const candidate = first(detectMemoryCandidates('I am currently researching Renaissance architecture.', 'conv-3'))
    expect(candidate.type).toBe('conversation_memory')
    expect(candidate.confidence).toBeLessThan(0.8)
  })

  it('returns no candidates for a plain question', () => {
    expect(detectMemoryCandidates('What time is it in Tokyo right now?', 'conv-4')).toEqual([])
  })

  it('returns no candidates for unrelated small talk', () => {
    expect(detectMemoryCandidates('Thanks, that summary was really helpful!', 'conv-5')).toEqual([])
  })

  it('suppresses every candidate when the message touches a sensitive topic', () => {
    const result = detectMemoryCandidates(
      'I prefer concise explanations, and I take medication for my anxiety disorder.',
      'conv-6',
    )
    expect(result).toEqual([])
  })

  it('drops a hypothetical statement below the confidence floor', () => {
    const result = detectMemoryCandidates('What if I prefer dark mode instead?', 'conv-7')
    expect(result).toEqual([])
  })

  it('does not duplicate identical content from overlapping patterns', () => {
    const result = detectMemoryCandidates('I always prefer dark mode.', 'conv-8')
    const contents = result.map((c) => c.content)
    expect(new Set(contents).size).toBe(contents.length)
  })
})
