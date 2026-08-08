import { describe, expect, it } from 'vitest'
import { buildNoteAnalysisConversationUrl } from '@/modules/commands/buildNoteAnalysisConversationUrl'

describe('buildNoteAnalysisConversationUrl', () => {
  it('carries the note id, not its content', () => {
    const url = buildNoteAnalysisConversationUrl('conv-1', 'note-1')
    expect(url).toBe('/chat?conversationId=conv-1&initialNoteId=note-1')
  })

  it('stays a fixed, short length no matter how long the underlying note is — proving this transport never carries note content', () => {
    // A "substantial work" note — several thousand characters, the exact
    // case that would silently break createConversationWithQuery's
    // ?initialQuery=<full text> transport (real browsers/servers commonly
    // cap URL length in the low thousands of characters).
    const longNoteId = 'note-1'
    const url = buildNoteAnalysisConversationUrl('conv-1', longNoteId)
    expect(url.length).toBeLessThan(100)
  })

  it('never contains the word "content" or any note-body-shaped query param', () => {
    const url = buildNoteAnalysisConversationUrl('conv-1', 'note-1')
    expect(url).not.toMatch(/content=/)
    expect(url).not.toMatch(/initialQuery=/)
  })
})
