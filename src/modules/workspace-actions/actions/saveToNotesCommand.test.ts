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

  // Reliability & Truth Audit — these are the exact phrasings a real user
  // typed in production (queried from the live database), none of which
  // the original exact-phrase-only pattern recognized.
  it('recognizes real phrasings from production that the v1 exact-match pattern missed', () => {
    expect(isSaveToNotesCommand('save this to notes')).toBe(true)
    expect(isSaveToNotesCommand('can you save this')).toBe(true)
    expect(isSaveToNotesCommand('can you save this to my notes')).toBe(true)
    expect(isSaveToNotesCommand('save this to my notes')).toBe(true)
    expect(isSaveToNotesCommand('memorise this')).toBe(true)
    expect(isSaveToNotesCommand('memorize this')).toBe(true)
    expect(isSaveToNotesCommand('please save this')).toBe(true)
    expect(isSaveToNotesCommand('could you remember this')).toBe(true)
  })

  it('still rejects the same negative cases with a polite lead-in or trailing notes phrase applied', () => {
    expect(isSaveToNotesCommand('can you save this for later?')).toBe(false)
    expect(isSaveToNotesCommand('save this document to my library')).toBe(false)
  })
})
