import { describe, expect, it, vi } from 'vitest'
import type { Message, Note } from '@/shared/types/database'

const { createNoteMock, linkNoteToConversationMock, linkNoteToMessageMock, indexNoteMock, linkKnownConceptsToSourceMock } =
  vi.hoisted(() => ({
    createNoteMock: vi.fn(),
    linkNoteToConversationMock: vi.fn(async () => {}),
    linkNoteToMessageMock: vi.fn(async () => {}),
    indexNoteMock: vi.fn(async () => {}),
    linkKnownConceptsToSourceMock: vi.fn(async () => {}),
  }))

vi.mock('@/modules/notes/api/notes', () => ({ createNote: createNoteMock }))
vi.mock('@/modules/notes/api/knowledgeLinks', () => ({
  linkNoteToConversation: linkNoteToConversationMock,
  linkNoteToMessage: linkNoteToMessageMock,
}))
vi.mock('@/modules/search/indexing/indexNote', () => ({ indexNote: indexNoteMock }))
vi.mock('@/modules/knowledge-intelligence/api/linkKnownConcepts', () => ({ linkKnownConceptsToSource: linkKnownConceptsToSourceMock }))

import { saveMessageToNote } from '@/modules/notes/api/saveMessageToNote'

function fakeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    document_id: null,
    title: 'Saved title',
    content: 'The saved content',
    source_chunk_ids: null,
    generation_metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Note
}

function fakeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    conversation_id: 'conv-1',
    user_id: 'user-1',
    role: 'assistant',
    content: 'NOVA said something worth keeping.',
    context_chunk_ids: [],
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Message
}

describe('saveMessageToNote', () => {
  it('creates the note with the message content and provenance metadata', async () => {
    createNoteMock.mockResolvedValueOnce(fakeNote())
    const message = fakeMessage()

    await saveMessageToNote({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      conversationTitle: 'Hospitality Q&A',
      message,
    })

    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        content: message.content,
        generationMetadata: {
          savedFrom: 'chat-message',
          conversationId: 'conv-1',
          messageId: 'message-1',
          messageCreatedAt: message.created_at,
          creationMethod: 'conversation_saved',
          artifactKind: 'note',
        },
      }),
    )
  })

  it('links the new note to both the conversation and the specific message', async () => {
    createNoteMock.mockResolvedValueOnce(fakeNote())
    const message = fakeMessage()

    await saveMessageToNote({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      conversationTitle: 'Hospitality Q&A',
      message,
    })

    expect(linkNoteToConversationMock).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      noteId: 'note-1',
      conversationId: 'conv-1',
    })
    expect(linkNoteToMessageMock).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      noteId: 'note-1',
      messageId: 'message-1',
    })
  })

  it('indexes the note and links known concepts — the exact gap the Integration Sprint fixed for Generate Briefing, applied here from the start', async () => {
    const note = fakeNote()
    createNoteMock.mockResolvedValueOnce(note)

    await saveMessageToNote({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      conversationTitle: 'Hospitality Q&A',
      message: fakeMessage(),
    })

    expect(indexNoteMock).toHaveBeenCalledWith(note, 'workspace-1')
    expect(linkKnownConceptsToSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', sourceType: 'note', sourceId: 'note-1' }),
    )
  })

  it('returns the created note', async () => {
    const note = fakeNote({ id: 'note-42' })
    createNoteMock.mockResolvedValueOnce(note)

    const result = await saveMessageToNote({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      conversationTitle: 'Hospitality Q&A',
      message: fakeMessage(),
    })

    expect(result).toBe(note)
  })
})
