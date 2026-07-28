import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { sendMessage } from '@/modules/ai/orchestration/AIService'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import type { Message } from '@/shared/types/database'
import { normalizeAiError } from '@/modules/ai/orchestration/normalizeAiError'

/**
 * Not a react-query mutation on purpose — streaming token-by-token updates
 * don't fit useMutation's single-resolve model, so this manages its own
 * "streaming text so far" state and invalidates the messages query once
 * the full response has landed and been persisted.
 *
 * `conversationId` is passed to `send()` rather than baked into the hook
 * call so a caller can create a conversation and send the first message to
 * it in the same handler — a value from `useState` set moments earlier
 * wouldn't be visible yet in this render's closure otherwise.
 */
export function useSendMessage(providerId: string, documentId?: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(
    conversationId: string,
    text: string,
    history: ChatProviderMessage[],
  ): Promise<Message | undefined> {
    setError(null)
    setStreamingText('')
    // The new user message won't show up until the messages query refetches
    // below, so invalidate eagerly for it while the assistant reply streams.
    void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })

    try {
      const message = await sendMessage({
        conversationId,
        userId: user!.id,
        workspaceId: currentWorkspaceId,
        providerId,
        documentId,
        history,
        text,
        onDelta: setStreamingText,
      })
      await queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
      return message
    } catch (err) {
      // The provider we thought was configured may have just failed on the
      // one check that actually matters (a live send) — normalizeAiError
      // strips the raw "X_API_KEY is not configured" text in that case,
      // and invalidating here stops the selector offering that provider
      // again until availability is re-checked.
      const normalized = normalizeAiError(err)
      setError(normalized.message)
      if (normalized.isProviderUnavailable) {
        void queryClient.invalidateQueries({ queryKey: ['provider-availability'] })
      }
      return undefined
    } finally {
      setStreamingText(null)
    }
  }

  return { send, streamingText, sending: streamingText !== null, error }
}
