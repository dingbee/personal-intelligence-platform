import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { ConversationPackage } from '@/modules/knowledge-exchange/conversations/conversationPackageTypes'
import type { Message } from '@/shared/types/database'

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

import { importConversationPackage } from '@/modules/knowledge-exchange/conversations/importConversationPackage'

function fakePackage(): ConversationPackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    conversation: {
      title: 'Summarizing the Q1 report',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      messages: [
        { role: 'user', content: 'Summarize this document', createdAt: '2026-01-01T00:00:01.000Z' },
        { role: 'assistant', content: 'Here is the summary...', createdAt: '2026-01-01T00:00:05.000Z' },
      ],
    },
  }
}

function fakeInsertedMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'new-message',
    conversation_id: 'new-conversation',
    user_id: 'importer-1',
    role: 'user',
    content: 'content',
    context_chunk_ids: [],
    created_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

const context = { userId: 'importer-1', workspaceId: 'importer-workspace' }

describe('importConversationPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createConversationMock.mockResolvedValue({
      id: 'new-conversation',
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
    })
    insertMessageMock
      .mockResolvedValueOnce(fakeInsertedMessage({ id: 'm1', role: 'user', content: 'Summarize this document' }))
      .mockResolvedValueOnce(fakeInsertedMessage({ id: 'm2', role: 'assistant', content: 'Here is the summary...' }))
  })

  it('creates a brand-new conversation the importer owns, in the caller-chosen workspace', async () => {
    const result = await importConversationPackage(fakePackage(), context)

    expect(createConversationMock).toHaveBeenCalledWith({
      userId: 'importer-1',
      workspaceId: 'importer-workspace',
      title: 'Summarizing the Q1 report',
    })
    expect(result.id).toBe('new-conversation')
    // Never the exporter's own provider choice — createConversation's own default applies.
    expect(createConversationMock.mock.calls[0]![0]).not.toHaveProperty('providerId')
  })

  it('inserts every message sequentially, in package order, attributed to the importer', async () => {
    await importConversationPackage(fakePackage(), context)

    expect(insertMessageMock).toHaveBeenNthCalledWith(1, {
      conversationId: 'new-conversation',
      userId: 'importer-1',
      role: 'user',
      content: 'Summarize this document',
    })
    expect(insertMessageMock).toHaveBeenNthCalledWith(2, {
      conversationId: 'new-conversation',
      userId: 'importer-1',
      role: 'assistant',
      content: 'Here is the summary...',
    })
  })

  it('re-indexes each imported message and links known concepts, exactly like a live turn', async () => {
    await importConversationPackage(fakePackage(), context)

    expect(indexMessageMock).toHaveBeenCalledTimes(2)
    expect(linkKnownConceptsToSourceMock).toHaveBeenCalledWith({
      userId: 'importer-1',
      sourceType: 'conversation',
      sourceId: 'new-conversation',
      text: 'Summarize this document',
    })
    expect(linkKnownConceptsToSourceMock).toHaveBeenCalledWith({
      userId: 'importer-1',
      sourceType: 'conversation',
      sourceId: 'new-conversation',
      text: 'Here is the summary...',
    })
  })

  it('never carries the exporter identity anywhere in the calls made', async () => {
    await importConversationPackage(fakePackage(), context)

    expect(createConversationMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
    expect(insertMessageMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
  })
})
