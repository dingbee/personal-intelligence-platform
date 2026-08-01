import { describe, expect, it } from 'vitest'
import { isSaveToNotesCommand } from '@/modules/workspace-actions/actions/saveToNotesCommand'

describe('isSaveToNotesCommand', () => {
  it('recognizes all four documented phrasings', () => {
    expect(isSaveToNotesCommand('Save this')).toBe(true)
    expect(isSaveToNotesCommand('Remember this')).toBe(true)
    expect(isSaveToNotesCommand('Capture this')).toBe(true)
    expect(isSaveToNotesCommand('Add this to my notes')).toBe(true)
  })

  it('is case-insensitive and tolerates surrounding whitespace and trailing punctuation', () => {
    expect(isSaveToNotesCommand('  SAVE THIS!!  ')).toBe(true)
    expect(isSaveToNotesCommand('remember this.')).toBe(true)
  })

  it('does not fire on an ordinary sentence that merely contains the words', () => {
    expect(isSaveToNotesCommand('Can you save this for later?')).toBe(false)
    expect(isSaveToNotesCommand("I'll remember this next time.")).toBe(false)
    expect(isSaveToNotesCommand('Save this document to my library.')).toBe(false)
  })

  it('returns false for unrelated chat messages', () => {
    expect(isSaveToNotesCommand('What do you know about Revenue?')).toBe(false)
    expect(isSaveToNotesCommand('')).toBe(false)
  })
})
