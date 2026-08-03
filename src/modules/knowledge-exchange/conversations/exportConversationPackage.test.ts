import { describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@/shared/types/database'
import {
  exportConversationPackage,
  conversationPackageExporter,
  conversationPackageFilename,
} from '@/modules/knowledge-exchange/conversations/exportConversationPackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function fakeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    document_id: 'exporter-document-1',
    title: 'Summarizing the Q1 report',
    provider_id: 'openai',
    archived_at: null,
    is_pinned: true,
    favorite: true,
    color: '#ff0000',
    icon: 'star',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function fakeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    conversation_id: 'conversation-1',
    user_id: 'exporter-1',
    role: 'user',
    content: 'Summarize this document',
    context_chunk_ids: ['chunk-1', 'chunk-2'],
    created_at: '2026-01-01T00:00:01.000Z',
    ...overrides,
  }
}

describe('exportConversationPackage', () => {
  it('carries the title and both messages in order', () => {
    const messages = [
      fakeMessage({ id: 'm1', role: 'user', content: 'Summarize this document', created_at: '2026-01-01T00:00:01.000Z' }),
      fakeMessage({ id: 'm2', role: 'assistant', content: 'Here is the summary...', created_at: '2026-01-01T00:00:05.000Z' }),
    ]
    const pkg = exportConversationPackage({ conversation: fakeConversation(), messages })

    expect(pkg.version).toBe(CURRENT_PACKAGE_VERSION)
    expect(pkg.sourceVersion).toBe(PACKAGE_SOURCE_VERSION)
    expect(pkg.conversation.title).toBe('Summarizing the Q1 report')
    expect(pkg.conversation.messages).toEqual([
      { role: 'user', content: 'Summarize this document', createdAt: '2026-01-01T00:00:01.000Z' },
      { role: 'assistant', content: 'Here is the summary...', createdAt: '2026-01-01T00:00:05.000Z' },
    ])
  })

  it('preserves message ordering exactly as given (ascending created_at)', () => {
    const messages = [
      fakeMessage({ id: 'm1', content: 'first', created_at: '2026-01-01T00:00:01.000Z' }),
      fakeMessage({ id: 'm2', content: 'second', role: 'assistant', created_at: '2026-01-01T00:00:02.000Z' }),
      fakeMessage({ id: 'm3', content: 'third', created_at: '2026-01-01T00:00:03.000Z' }),
    ]
    const pkg = exportConversationPackage({ conversation: fakeConversation(), messages })
    expect(pkg.conversation.messages.map((m) => m.content)).toEqual(['first', 'second', 'third'])
  })

  it('preserves each message and the conversation own timestamps', () => {
    const pkg = exportConversationPackage({ conversation: fakeConversation(), messages: [fakeMessage()] })
    expect(pkg.conversation.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(pkg.conversation.updatedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(pkg.conversation.messages[0]!.createdAt).toBe('2026-01-01T00:00:01.000Z')
  })

  it('filters out system-role messages — never user-facing content', () => {
    const messages = [
      fakeMessage({ id: 'm1', role: 'system', content: 'You are a helpful assistant.' }),
      fakeMessage({ id: 'm2', role: 'user', content: 'Hello' }),
    ]
    const pkg = exportConversationPackage({ conversation: fakeConversation(), messages })
    expect(pkg.conversation.messages).toHaveLength(1)
    expect(pkg.conversation.messages[0]!.content).toBe('Hello')
  })

  it('excludes ids, user_id, workspace_id, document_id, provider_id, context_chunk_ids, and UI-state fields — allow-list only', () => {
    const pkg = exportConversationPackage({ conversation: fakeConversation(), messages: [fakeMessage()] })
    const serialized = JSON.stringify(pkg)

    expect(serialized).not.toContain('conversation-1')
    expect(serialized).not.toContain('exporter-1')
    expect(serialized).not.toContain('exporter-workspace')
    expect(serialized).not.toContain('exporter-document-1')
    expect(serialized).not.toContain('message-1')
    expect(serialized).not.toContain('chunk-1')
    expect(serialized).not.toContain('chunk-2')
    expect(serialized).not.toContain('openai')
    expect(serialized).not.toContain('#ff0000')
    expect(serialized).not.toContain('star')
  })

  it('the conversationPackageExporter object delegates to the same function', () => {
    const source = { conversation: fakeConversation(), messages: [fakeMessage()] }
    const pkg = conversationPackageExporter.export(source)
    expect(pkg.conversation).toEqual(exportConversationPackage(source).conversation)
  })
})

describe('conversationPackageFilename', () => {
  it('slugifies the conversation title into a safe .json filename', () => {
    expect(conversationPackageFilename('Summarizing the Q1 report')).toBe('summarizing-the-q1-report.json')
  })

  it('falls back to a generic name for empty/symbol-only titles', () => {
    expect(conversationPackageFilename('   ')).toBe('conversation-export.json')
  })
})
