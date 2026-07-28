import { useEffect, useState } from 'react'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { useMessages } from '@/modules/ai/chat/hooks/useMessages'
import { useSendMessage } from '@/modules/ai/chat/hooks/useSendMessage'
import { MessageBubble } from '@/modules/ai/chat/components/MessageBubble'
import { ChatInput } from '@/modules/ai/chat/components/ChatInput'
import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'
import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { isProviderAvailable } from '@/modules/ai/providers/availability'
import { providerRegistry } from '@/modules/core/providers/registry'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Contextual chat scoped to one document, embedded in the reader rather
 * than requiring a trip to /chat. Reuses the same conversations/messages
 * hooks and AIService path as the full Chat page — including, now, the
 * same provider-awareness model: ProviderSelect (same component, not a
 * copy), the unavailable-provider warning, and updateProvider switching,
 * all already built for ChatPage and reused here as-is.
 */
export function ReaderChatPanel({ documentId }: { documentId: string }) {
  const { data: conversations = [], isLoading: conversationsLoading, create, updateProvider } =
    useConversations(documentId)
  const [conversationId, setConversationId] = useState<string | null>(null)

  useEffect(() => {
    if (!conversationId && conversations.length > 0) setConversationId(conversations[0]!.id)
  }, [conversations, conversationId])

  // Don't carry a provider-switch error over when the reader moves to a
  // different conversation — same reasoning as ChatPage.
  useEffect(() => {
    updateProvider.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const { data: messages = [], isLoading: messagesLoading } = useMessages(conversationId)
  const conversation = conversations.find((c) => c.id === conversationId)
  const { send, streamingText, sending, error } = useSendMessage(
    conversation?.provider_id ?? DEFAULT_CHAT_PROVIDER_ID,
    documentId,
  )

  const { data: availability } = useProviderAvailability()
  const conversationProviderUnavailable =
    Boolean(conversation) && !isProviderAvailable(conversation!.provider_id, availability)

  async function handleSend(text: string) {
    const id = conversationId ?? (await create.mutateAsync({ providerId: DEFAULT_CHAT_PROVIDER_ID })).id
    if (!conversationId) setConversationId(id)
    const history = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    await send(id, text, history)
  }

  function handleProviderChange(providerId: string) {
    if (!conversation || providerId === conversation.provider_id || updateProvider.isPending) return
    updateProvider.mutate({ id: conversation.id, providerId })
  }

  return (
    <div className="flex h-full flex-col">
      {conversationId && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2">
          <span className="text-xs font-medium text-[var(--color-ink-muted)]">AI provider</span>
          <div className="flex items-center gap-2">
            {updateProvider.isPending && <Spinner size="sm" />}
            <ProviderSelect
              value={conversation?.provider_id ?? DEFAULT_CHAT_PROVIDER_ID}
              onChange={handleProviderChange}
              disabled={updateProvider.isPending}
            />
          </div>
        </div>
      )}
      {conversationProviderUnavailable && (
        <p className="px-4 pt-2 text-xs text-amber-600">
          This conversation is set to{' '}
          {providerRegistry.get(conversation!.provider_id)?.label ?? conversation!.provider_id}, which isn't
          currently available. Pick a different provider above to continue.
        </p>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {conversationsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : !conversationId ? (
          <EmptyState
            title="Ask about this book"
            description="Grounded in this document's content — ask for an explanation, a comparison, or anything else."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {messagesLoading ? (
              <Spinner size="sm" />
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
            {streamingText !== null && (
              <MessageBubble message={{ role: 'assistant', content: streamingText || '…', context_chunk_ids: [] }} />
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>
      <ChatInput disabled={sending} onSend={(text) => void handleSend(text)} />
    </div>
  )
}
