import { describe, expect, it } from 'vitest'
import {
  collectSourceChunkIds,
  filterMessagesForScope,
  formatConversationAsNoteContent,
  type ConversationNoteMessage,
} from '@/modules/notes/conversationToNote'

function message(id: string, role: ConversationNoteMessage['role'], content: string, chunkIds: string[] = []): ConversationNoteMessage {
  return { id, role, content, context_chunk_ids: chunkIds }
}

const messages: ConversationNoteMessage[] = [
  message('1', 'user', 'What is retrieval-augmented generation?', []),
  message('2', 'assistant', 'RAG grounds answers in retrieved documents.', ['chunk-a', 'chunk-b']),
  message('3', 'user', 'Give me an example.', []),
  message('4', 'assistant', 'Here is one.', ['chunk-b', 'chunk-c']),
]

describe('filterMessagesForScope', () => {
  it('returns every message for "entire"', () => {
    expect(filterMessagesForScope({ messages, scope: 'entire' })).toEqual(messages)
  })

  it('returns only assistant messages for "ai-only"', () => {
    const result = filterMessagesForScope({ messages, scope: 'ai-only' })
    expect(result.map((m) => m.id)).toEqual(['2', '4'])
  })

  it('returns only user messages for "user-only"', () => {
    const result = filterMessagesForScope({ messages, scope: 'user-only' })
    expect(result.map((m) => m.id)).toEqual(['1', '3'])
  })

  it('returns only the selected messages for "selected", preserving conversation order', () => {
    const result = filterMessagesForScope({ messages, scope: 'selected', selectedMessageIds: new Set(['3', '1']) })
    expect(result.map((m) => m.id)).toEqual(['1', '3'])
  })

  it('returns nothing for "selected" with no selection', () => {
    expect(filterMessagesForScope({ messages, scope: 'selected' })).toEqual([])
  })
})

describe('formatConversationAsNoteContent', () => {
  it('labels each message by role and joins with a blank line', () => {
    const content = formatConversationAsNoteContent([message('1', 'user', 'Hi'), message('2', 'assistant', 'Hello')])
    expect(content).toBe('**You:** Hi\n\n**ARRIYIA:** Hello')
  })

  it('skips system messages entirely', () => {
    const content = formatConversationAsNoteContent([message('1', 'system', 'ignored'), message('2', 'user', 'Hi')])
    expect(content).toBe('**You:** Hi')
  })

  it('returns an empty string for no messages', () => {
    expect(formatConversationAsNoteContent([])).toBe('')
  })
})

describe('collectSourceChunkIds', () => {
  it('deduplicates chunk ids across messages', () => {
    expect(collectSourceChunkIds(messages).sort()).toEqual(['chunk-a', 'chunk-b', 'chunk-c'])
  })

  it('returns an empty array when no messages carry context', () => {
    expect(collectSourceChunkIds([message('1', 'user', 'Hi')])).toEqual([])
  })
})
