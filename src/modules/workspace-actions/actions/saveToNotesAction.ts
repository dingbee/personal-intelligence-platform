import type { WorkspaceAction } from '@/modules/workspace-actions/types'
import { isSaveToNotesCommand } from '@/modules/workspace-actions/actions/saveToNotesCommand'
import { listMessages } from '@/modules/ai/chat/api/messages'
import { getConversation } from '@/modules/ai/chat/api/conversations'
import { saveMessageToNote } from '@/modules/notes/api/saveMessageToNote'

/**
 * AI Workspace Actions v1 — "this" resolves to the most recent assistant
 * message in the conversation (the thing NOVA just said), the natural
 * reading of "save this"/"remember this" said right after a reply. Saving
 * the user's own last message is a plausible future variant, not this
 * one — a scoping decision, not an oversight.
 *
 * Reuses saveMessageToNote() — the exact same function the per-message
 * Save button on MessageBubble calls — so there is one save pipeline
 * regardless of entry point, not two.
 */
export const saveToNotesAction: WorkspaceAction<Record<string, never>> = {
  id: 'save-to-notes',
  match: (text) => (isSaveToNotesCommand(text) ? {} : undefined),
  run: async (_payload, context) => {
    const messages = await listMessages(context.conversationId)
    const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
    if (!lastAssistantMessage) {
      return { responseText: "There's nothing to save yet — ask NOVA something first, then try again." }
    }

    const conversation = await getConversation(context.conversationId)
    const note = await saveMessageToNote({
      userId: context.userId,
      workspaceId: context.workspaceId,
      conversationId: context.conversationId,
      conversationTitle: conversation.title,
      message: lastAssistantMessage,
    })

    return {
      responseText: `Saved to Notes: "${note.title}". It's linked back to this conversation and this message.`,
      references: [{ type: 'note', id: note.id, title: note.title }],
    }
  },
}
