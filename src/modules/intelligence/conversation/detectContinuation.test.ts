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

  // Retrieval Prerequisite Fix — short conversational follow-ups that only
  // make sense in light of the prior turn.
  it.each(['why?', 'Why', 'how?', 'How', 'what about that?', 'What about that', 'and?', 'And', 'yes', 'Yes.', 'yes, exactly', 'yes exactly.'])(
    'treats "%s" as a continuation',
    (text) => {
      expect(isContinuationMessage(text)).toBe(true)
    },
  )

  // Retrieval Prerequisite Fix — the same words/prefixes, but with real
  // substantive content attached, must NOT be swept in as content-free
  // follow-ups.
  it.each([
    'why is Tanzania different from Kenya?',
    'how do I upload a document?',
    'yes, create a note',
    'more information about Tanzania',
    'next chapter please',
    'what about that other document I uploaded?',
  ])('does not treat "%s" as a continuation', (text) => {
    expect(isContinuationMessage(text)).toBe(false)
  })
})
