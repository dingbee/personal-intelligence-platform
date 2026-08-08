import { describe, expect, it } from 'vitest'
import { buildChatHistory, MAX_HISTORY_MESSAGES } from '@/modules/ai/chat/api/buildChatHistory'

function makeMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `message ${i}`,
  }))
}

describe('buildChatHistory', () => {
  it('maps every message to the provider wire shape unchanged when under the cap', () => {
    const messages = makeMessages(3)
    expect(buildChatHistory(messages)).toEqual([
      { role: 'user', content: 'message 0' },
      { role: 'assistant', content: 'message 1' },
      { role: 'user', content: 'message 2' },
    ])
  })

  it('returns an empty array for an empty conversation', () => {
    expect(buildChatHistory([])).toEqual([])
  })

  // PIP Sprint 9/10 — the actual bug this function fixes: a long-running
  // conversation previously sent every message, ever, to the model on
  // every single turn. This pins the bound.
  it('keeps only the most recent MAX_HISTORY_MESSAGES when the conversation exceeds the cap', () => {
    const messages = makeMessages(MAX_HISTORY_MESSAGES + 25)
    const result = buildChatHistory(messages)

    expect(result).toHaveLength(MAX_HISTORY_MESSAGES)
    // Oldest-first ordering is preserved — only the OLDEST messages are dropped.
    expect(result[0]!.content).toBe(`message 25`)
    expect(result.at(-1)!.content).toBe(`message ${MAX_HISTORY_MESSAGES + 24}`)
  })

  it('never grows past the cap regardless of how much larger the conversation gets', () => {
    expect(buildChatHistory(makeMessages(500))).toHaveLength(MAX_HISTORY_MESSAGES)
    expect(buildChatHistory(makeMessages(5000))).toHaveLength(MAX_HISTORY_MESSAGES)
  })

  it('keeps exactly the cap size unchanged when the conversation is exactly at the boundary', () => {
    expect(buildChatHistory(makeMessages(MAX_HISTORY_MESSAGES))).toHaveLength(MAX_HISTORY_MESSAGES)
  })
})
