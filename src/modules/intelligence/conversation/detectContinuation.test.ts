import { describe, expect, it } from 'vitest'
import { isContinuationMessage } from '@/modules/intelligence/conversation/detectContinuation'

describe('isContinuationMessage', () => {
  it.each(['continue', 'Continue.', 'keep going', 'go on', 'more', 'and then?', "what's next", 'what is next', 'next'])(
    'treats "%s" as a continuation',
    (text) => {
      expect(isContinuationMessage(text)).toBe(true)
    },
  )

  it.each(['What is the capital of France?', 'Summarize chapter 3.', ''])('does not treat "%s" as a continuation', (text) => {
    expect(isContinuationMessage(text)).toBe(false)
  })
})
