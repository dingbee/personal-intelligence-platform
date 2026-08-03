import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, Message } from '@/shared/types/database'

/**
 * UX-14.5.12 integration test: export a conversation, serialize it,
 * parse/validate the serialized text as if it were a re-uploaded file,
 * then import it into a different account/workspace — the same
 * lifecycle every prior package type's own round-trip test already
 * exercises, extended here to a multi-message transcript.
 */

const { createConversationMock, insertMessageMock, indexMessageMock, linkKnownConceptsToSourceMock } = vi.hoisted(() => ({
  createConversationMock: vi.fn(),
  insertMessageMock: vi.fn(),
  indexMessageMock: vi.fn(),
  linkKnownConceptsToSourceMock: vi.fn(),
}))

vi.mock('@/modules/ai/chat/api/conversations', () => ({ createConversation: createConversationMock }))
vi.mock('@/modules/ai/chat/api/messages', () => ({ insertMessage: insertMessageMock }))
vi.mock('@/modules/search/indexing/indexMessage', () => ({ indexMessage: indexMessageMock }))
vi.mock('@/modules/knowledge-intelligence/api/linkKnownConcepts', () => ({ linkKnownConceptsToSource: linkKnownConceptsToSourceMock }))

import { exportConversationPackage } from '@/modules/knowledge-exchange/conversations/exportConversationPackage'
import { parseConversationPackage } from '@/modules/knowledge-exchange/conversations/validateConversationPackage'
import { importConversationPackage } from '@/modules/knowledge-exchange/conversations/importConversationPackage'

function fakeSourceConversation(): Conversation {
  return {
    id: 'source-conversation-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    document_id: 'exporter-document-1',
    title: 'Summarizing the Q1 report',
    provider_id: 'openai',
    archived_at: null,
    is_pinned: true,
    favorite: false,
    color: null,
    icon: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:05:00.000Z',
  }
}

function fakeSourceMessages(): Message[] {
  return [
    {
      id: 'msg-1',
      conversation_id: 'source-conversation-1',
      user_id: 'exporter-1',
      role: 'user',
      content: 'Summarize this document',
      context_chunk_ids: ['chunk-1'],
      created_at: '2026-01-01T00:00:01.000Z',
    },
    {
      id: 'msg-2',
      conversation_id: 'source-conversation-1',
      user_id: 'exporter-1',
      role: 'assistant',
      content: 'Here is the summary: revenue grew 12% quarter over quarter.',
      context_chunk_ids: ['chunk-1', 'chunk-2'],
      created_at: '2026-01-01T00:00:05.000Z',
    },
    {
      id: 'msg-3',
      conversation_id: 'source-conversation-1',
      user_id: 'exporter-1',
      role: 'user',
      content: 'What drove the growth?',
      context_chunk_ids: [],
      created_at: '2026-01-01T00:01:00.000Z',
    },
  ]
}

function fakeImportedConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'imported-conversation',
    user_id: 'importer-1',
    workspace_id: 'importer-workspace',
    document_id: null,
    title: 'Summarizing the Q1 report',
    provider_id: 'openai',
    archived_at: null,
    is_pinned: false,
    favorite: false,
    color: null,
    icon: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakeInsertedMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'inserted-message',
    conversation_id: 'imported-conversation',
    user_id: 'importer-1',
    role: 'user',
    content: 'content',
    context_chunk_ids: [],
    created_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

const context = { userId: 'importer-1', workspaceId: 'importer-workspace' }

describe('Conversation export -> transfer -> import round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a conversation exported by one account is imported by another, transcript preserved exactly, ordering intact', async () => {
    const exportedPackage = exportConversationPackage({ conversation: fakeSourceConversation(), messages: fakeSourceMessages() })

    // Simulate the file round trip: serialize to text, then parse it back as if a different account had just uploaded the downloaded file.
    const serialized = JSON.stringify(exportedPackage)
    const parsed = parseConversationPackage(serialized)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    createConversationMock.mockResolvedValueOnce(fakeImportedConversation())
    insertMessageMock
      .mockResolvedValueOnce(fakeInsertedMessage({ id: 'im1', role: 'user', content: 'Summarize this document' }))
      .mockResolvedValueOnce(fakeInsertedMessage({ id: 'im2', role: 'assistant', content: 'Here is the summary: revenue grew 12% quarter over quarter.' }))
      .mockResolvedValueOnce(fakeInsertedMessage({ id: 'im3', role: 'user', content: 'What drove the growth?' }))

    const result = await importConversationPackage(parsed.package, context)

    expect(result.id).toBe('imported-conversation')
    expect(createConversationMock).toHaveBeenCalledWith({ userId: 'importer-1', workspaceId: 'importer-workspace', title: 'Summarizing the Q1 report' })

    // Transcript equality: same roles, same content, same order as the source.
    const insertedTranscript = insertMessageMock.mock.calls.map((call) => ({ role: call[0].role, content: call[0].content }))
    expect(insertedTranscript).toEqual([
      { role: 'user', content: 'Summarize this document' },
      { role: 'assistant', content: 'Here is the summary: revenue grew 12% quarter over quarter.' },
      { role: 'user', content: 'What drove the growth?' },
    ])

    // Never the exporter's identity or original ids.
    expect(createConversationMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
    const serializedPackage = JSON.stringify(parsed.package)
    expect(serializedPackage).not.toContain('source-conversation-1')
    expect(serializedPackage).not.toContain('exporter-1')
    expect(serializedPackage).not.toContain('exporter-workspace')
    expect(serializedPackage).not.toContain('chunk-1')
    expect(serializedPackage).not.toContain('openai')
  })

  it('re-importing the same package a second time creates a brand-new, independent conversation — no dedup', async () => {
    const exportedPackage = exportConversationPackage({ conversation: fakeSourceConversation(), messages: fakeSourceMessages() })
    const parsed = parseConversationPackage(JSON.stringify(exportedPackage))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    createConversationMock
      .mockResolvedValueOnce(fakeImportedConversation({ id: 'first-import' }))
      .mockResolvedValueOnce(fakeImportedConversation({ id: 'second-import' }))
    insertMessageMock.mockResolvedValue(fakeInsertedMessage())

    const first = await importConversationPackage(parsed.package, context)
    const second = await importConversationPackage(parsed.package, context)

    expect(first.id).not.toBe(second.id)
    expect(createConversationMock).toHaveBeenCalledTimes(2)
  })

  it('imports into a workspace the exporter was never in', async () => {
    const exportedPackage = exportConversationPackage({ conversation: fakeSourceConversation(), messages: fakeSourceMessages() })
    const parsed = parseConversationPackage(JSON.stringify(exportedPackage))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    createConversationMock.mockResolvedValueOnce(fakeImportedConversation({ workspace_id: 'a-brand-new-workspace' }))
    insertMessageMock.mockResolvedValue(fakeInsertedMessage())

    await importConversationPackage(parsed.package, { userId: 'importer-1', workspaceId: 'a-brand-new-workspace' })

    expect(createConversationMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'a-brand-new-workspace' }))
  })

  it('rejects a hand-tampered package (unsupported version) before any import call', () => {
    const exportedPackage = exportConversationPackage({ conversation: fakeSourceConversation(), messages: fakeSourceMessages() })
    const tampered = { ...exportedPackage, version: 999 }

    const parsed = parseConversationPackage(JSON.stringify(tampered))

    expect(parsed.valid).toBe(false)
    expect(createConversationMock).not.toHaveBeenCalled()
    expect(insertMessageMock).not.toHaveBeenCalled()
  })

  it('rejects a truncated/corrupted download (malformed JSON) before any import call', () => {
    const exportedPackage = exportConversationPackage({ conversation: fakeSourceConversation(), messages: fakeSourceMessages() })
    const truncated = JSON.stringify(exportedPackage).slice(0, -10)

    const parsed = parseConversationPackage(truncated)

    expect(parsed.valid).toBe(false)
    if (!parsed.valid) expect(parsed.issues[0]!.code).toBe('malformed_json')
    expect(createConversationMock).not.toHaveBeenCalled()
  })

  it('rejects a package hand-tampered to remove all its messages before any import call', () => {
    const exportedPackage = exportConversationPackage({ conversation: fakeSourceConversation(), messages: fakeSourceMessages() })
    const tampered = { ...exportedPackage, conversation: { ...exportedPackage.conversation, messages: [] } }

    const parsed = parseConversationPackage(JSON.stringify(tampered))

    expect(parsed.valid).toBe(false)
    expect(createConversationMock).not.toHaveBeenCalled()
  })
})
