import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { Message } from '@/shared/types/database'
import { saveMessageToNote } from '@/modules/notes/api/saveMessageToNote'
import { useAuth } from '@/modules/auth/useAuth'

/**
 * AI Workspace Actions v1 — backs the per-message "Save to Notes" button on
 * MessageBubble. Calls the same saveMessageToNote() the "Save this"/
 * "Remember this" chat command calls, so there is one save pipeline
 * regardless of entry point. `savedMessageIds` tracks which messages in
 * this conversation have been saved this session, so a saved message's
 * button can read "Saved" instead of re-triggering a duplicate note.
 */
export function useSaveMessageToNote(params: { conversationId: string; conversationTitle: string; workspaceId: string | null }) {
  const { conversationId, conversationTitle, workspaceId } = params
  const { user } = useAuth()
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set())

  const mutation = useMutation({
    mutationFn: (message: Message) =>
      saveMessageToNote({
        userId: user!.id,
        workspaceId,
        conversationId,
        conversationTitle,
        message,
      }),
    onSuccess: (_note, message) => {
      setSavedMessageIds((current) => new Set(current).add(message.id))
    },
  })

  return {
    save: (message: Message) => mutation.mutate(message),
    isSaved: (messageId: string) => savedMessageIds.has(messageId),
    isSaving: (messageId: string) => mutation.isPending && mutation.variables?.id === messageId,
  }
}
