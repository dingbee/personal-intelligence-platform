import { useEffect, useState } from 'react'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { useMessages } from '@/modules/ai/chat/hooks/useMessages'
import { useSendMessage } from '@/modules/ai/chat/hooks/useSendMessage'
import { MessageBubble } from '@/modules/ai/chat/components/MessageBubble'
import { ChatInput } from '@/modules/ai/chat/components/ChatInput'
import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Contextual chat scoped to one document, embedded in the reader rather
 * than requiring a trip to /chat. Reuses the same conversations/messages
 * hooks and AIService path as the full Chat page — just a narrower layout
 * with the conversation picker collapsed to "the one conversation for this book".
 */
export function ReaderChatPanel({ documentId }: { documentId: string }) {
  const { data: conversations = [], isLoading: conversationsLoading, create } = useConversations(documentId)
  const [conversationId, setConversationId] = useState<string | null>(null)

  useEffect(() => {
    if (!conversationId && conversations.length > 0) setConversationId(conversations[0]!.id)
  }, [conversations, conversationId])

  const { data: messages = [], isLoading: messagesLoading } = useMessages(conversationId)
  const { send, streamingText, sending, error } = useSendMessage(DEFAULT_CHAT_PROVIDER_ID, documentId)

  async function handleSend(text: string) {
    const id = conversationId ?? (await create.mutateAsync({ providerId: DEFAULT_CHAT_PROVIDER_ID })).id
    if (!conversationId) setConversationId(id)
    const history = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    await send(id, text, history)
  }

  return (
    <div className="flex h-full flex-col">
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
