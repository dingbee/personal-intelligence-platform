import { describe, expect, it } from 'vitest'
import { buildConversationExportContent } from '@/modules/export/content/conversationExportContent'
import type { Conversation, Message } from '@/shared/types/database'

function fakeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    document_id: null,
    title: 'Summarizing the Q1 report',
    provider_id: 'openai',
    archived_at: null,
    is_pinned: false,
    favorite: false,
    color: null,
    icon: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    conversation_id: 'conversation-1',
    user_id: 'user-1',
    role: 'user',
    content: 'Summarize this document',
    context_chunk_ids: ['chunk-1'],
    created_at: '2026-01-01T00:00:01.000Z',
    ...overrides,
  }
}

describe('buildConversationExportContent', () => {
  it('carries the title and renders each message with a role label', () => {
    const messages = [
      fakeMessage({ id: 'm1', role: 'user', content: 'Summarize this document' }),
      fakeMessage({ id: 'm2', role: 'assistant', content: 'Here is the summary...' }),
    ]
    const content = buildConversationExportContent(fakeConversation(), messages)

    expect(content.title).toBe('Summarizing the Q1 report')
    expect(content.sections).toHaveLength(1)
    expect(content.sections[0]!.body).toEqual(['You: Summarize this document', 'NOVA: Here is the summary...'])
  })

  it('summarizes the message count into the subtitle', () => {
    const content = buildConversationExportContent(fakeConversation(), [fakeMessage(), fakeMessage({ id: 'm2', role: 'assistant' })])
    expect(content.subtitle).toBe('2 messages')
  })

  it('filters out system-role messages', () => {
    const messages = [
      fakeMessage({ id: 'm1', role: 'system', content: 'You are a helpful assistant.' }),
      fakeMessage({ id: 'm2', role: 'user', content: 'Hello' }),
    ]
    const content = buildConversationExportContent(fakeConversation(), messages)
    expect(content.sections[0]!.body).toEqual(['You: Hello'])
    expect(content.subtitle).toBe('1 message')
  })

  it('shows a placeholder for an empty conversation', () => {
    const content = buildConversationExportContent(fakeConversation(), [])
    expect(content.sections[0]!.body).toEqual(['No messages in this conversation.'])
    expect(content.subtitle).toBe('0 messages')
  })

  it('never carries id/user_id/workspace_id/provider_id/context_chunk_ids', () => {
    const content = buildConversationExportContent(fakeConversation(), [fakeMessage()])
    const serialized = JSON.stringify(content)
    expect(serialized).not.toContain('conversation-1')
    expect(serialized).not.toContain('user-1')
    expect(serialized).not.toContain('workspace-1')
    expect(serialized).not.toContain('openai')
    expect(serialized).not.toContain('chunk-1')
  })
})
