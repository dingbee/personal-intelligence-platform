import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { sendMessage } from '@/modules/ai/orchestration/AIService'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import type { Message } from '@/shared/types/database'

/**
 * Not a react-query mutation on purpose — streaming token-by-token updates
 * don't fit useMutation's single-resolve model, so this manages its own
 * "streaming text so far" state and invalidates the messages query once
 * the full response has landed and been persisted.
 */
export function useSendMessage(conversationId: string, providerId: string, documentId?: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(text: string, history: ChatProviderMessage[]): Promise<Message | undefined> {
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
      setError(err instanceof Error ? err.message : 'Failed to get a response')
      return undefined
    } finally {
      setStreamingText(null)
    }
  }

  return { send, streamingText, sending: streamingText !== null, error }
}
