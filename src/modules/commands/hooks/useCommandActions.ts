import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { buildNoteAnalysisConversationUrl } from '@/modules/commands/buildNoteAnalysisConversationUrl'
import type { CommandActions } from '@/modules/commands/types'

/**
 * The one place command execution touches React hooks/mutations — command
 * definitions themselves stay plain data and call into this pre-wired
 * bag, so filterCommands and the command modules are trivially testable
 * without a component tree.
 */
export function useCommandActions(params: { onOpenQuickCapture?: () => void } = {}): CommandActions {
  const navigate = useNavigate()
  const { setCurrentWorkspaceId } = useWorkspace()
  const { create: createNoteMutation } = useNotes()
  const { create: createConversationMutation } = useConversations()
  const defaultProviderId = useDefaultChatProviderId()
  // AI Preference Layer v1 — same "resolve via the real chain, not a
  // hardcoded constant" fallback ChatPage/ReaderChatPanel use when
  // stamping a brand-new conversation with no explicit preference.
  const chain = useProviderChain(defaultProviderId)

  return {
    navigate: (path) => navigate(path),
    setCurrentWorkspaceId,
    createNote: async () => {
      const note = await createNoteMutation.mutateAsync({ title: 'Untitled note' })
      return { id: note.id }
    },
    createConversationWithQuery: async (query) => {
      // Reuses the exact same conversation-creation path ChatPage's "Start
      // chat" button does (createConversation + the user's default
      // provider) — the initialQuery param is what tells ChatPage to send
      // this text once it mounts, via its own existing send pipeline.
      const conversation = await createConversationMutation.mutateAsync({
        title: query.slice(0, 60),
        providerId: defaultProviderId ?? chain[0],
      })
      navigate(`/chat?conversationId=${conversation.id}&initialQuery=${encodeURIComponent(query)}`)
      return { id: conversation.id }
    },
    createConversationWithNoteAnalysis: async (noteId, noteTitle) => {
      // Same conversation-creation path as createConversationWithQuery, but
      // ?initialNoteId= instead of ?initialQuery= — see this action's own
      // doc comment on CommandActions for why: a note's content doesn't fit
      // safely in a URL query param the way a short typed question does.
      const conversation = await createConversationMutation.mutateAsync({
        title: noteTitle.slice(0, 60),
        providerId: defaultProviderId ?? chain[0],
      })
      navigate(buildNoteAnalysisConversationUrl(conversation.id, noteId))
      return { id: conversation.id }
    },
    openQuickCapture: params.onOpenQuickCapture ?? (() => {}),
  }
}
