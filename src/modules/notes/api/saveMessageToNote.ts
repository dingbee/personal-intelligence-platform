import type { Message, Note } from '@/shared/types/database'
import { createNote } from '@/modules/notes/api/notes'
import { linkNoteToConversation, linkNoteToMessage } from '@/modules/notes/api/knowledgeLinks'
import { buildSavedMessageTitle } from '@/modules/notes/utils/savedMessageTitle'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'
import { detectArtifactKind } from '@/modules/ai/artifacts/detectArtifactKind'
import { buildArtifactGenerationMetadata } from '@/modules/ai/artifacts/buildArtifactGenerationMetadata'

/**
 * AI Workspace Actions v1 — the "Save Knowledge Action" core: the one
 * function both the per-message Save button (MessageBubble) and the
 * "Save this"/"Remember this"/"Capture this"/"Add this to my notes" chat
 * command call. Create Note -> index -> link known concepts -> record
 * provenance (conversation + the specific message), matching the same
 * indexing/linking contract every other note-creation path in this
 * codebase follows (useNotes.create, useMergeNotes, generateBriefing) —
 * this is exactly the gap the Platform Integration Sprint found and fixed
 * for Generate Briefing, applied here from the start instead of after
 * the fact.
 */
export async function saveMessageToNote(params: {
  userId: string
  workspaceId: string | null
  conversationId: string
  conversationTitle: string
  message: Message
}): Promise<Note> {
  const { userId, workspaceId, conversationId, conversationTitle, message } = params

  const note = await createNote({
    userId,
    workspaceId,
    title: buildSavedMessageTitle(message, conversationTitle),
    content: message.content,
    generationMetadata: buildArtifactGenerationMetadata(message.content, detectArtifactKind(message.content), {
      savedFrom: 'chat-message',
      conversationId,
      messageId: message.id,
      messageCreatedAt: message.created_at,
    }),
  })

  await linkNoteToConversation({ userId, workspaceId, noteId: note.id, conversationId })
  await linkNoteToMessage({ userId, workspaceId, noteId: note.id, messageId: message.id })

  void indexNote(note, workspaceId)
  void linkKnownConceptsToSource({ userId, sourceType: 'note', sourceId: note.id, text: `${note.title}\n\n${note.content}` })

  return note
}
