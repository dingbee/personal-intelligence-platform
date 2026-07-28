import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { useMessages } from '@/modules/ai/chat/hooks/useMessages'
import { useSendMessage } from '@/modules/ai/chat/hooks/useSendMessage'
import { ConversationList } from '@/modules/ai/chat/components/ConversationList'
import { MessageBubble } from '@/modules/ai/chat/components/MessageBubble'
import { ChatInput } from '@/modules/ai/chat/components/ChatInput'
import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'
import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

export function ChatPage() {
  const [searchParams] = useSearchParams()
  const documentId = searchParams.get('documentId') ?? undefined

  const { data: conversations = [], isLoading: conversationsLoading, create, remove, updateProvider } =
    useConversations(documentId)
  // Deep-linked from a search result — if it's outside the current
  // workspace/document filter it still opens (messages load independently
  // of the sidebar list), it just won't be highlighted in that list.
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('conversationId'))
  const [newProviderId, setNewProviderId] = useState(DEFAULT_CHAT_PROVIDER_ID)

  useEffect(() => {
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0]!.id)
  }, [conversations, selectedId])

  // Don't carry a provider-switch error over when the user moves to a
  // different conversation — it belongs to the conversation it happened in.
  useEffect(() => {
    updateProvider.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const { data: messages = [], isLoading: messagesLoading } = useMessages(selectedId)
  const conversation = conversations.find((c) => c.id === selectedId)
  // Reading conversation.provider_id fresh here (rather than snapshotting it
  // into a ref) is what makes a provider switch take effect on the very
  // next send: this hook re-runs every render, so once the mutation below
  // updates the conversations cache, the next render's `send` closes over
  // the new value automatically.
  const { send, streamingText, sending, error } = useSendMessage(conversation?.provider_id ?? newProviderId, documentId)

  async function handleNew() {
    const created = await create.mutateAsync({ providerId: newProviderId })
    setSelectedId(created.id)
  }

  function handleProviderChange(providerId: string) {
    if (!conversation || providerId === conversation.provider_id || updateProvider.isPending) return
    updateProvider.mutate({ id: conversation.id, providerId })
  }

  async function handleSend(text: string) {
    if (!selectedId) return
    const history = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    await send(selectedId, text, history)
  }

  if (conversationsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="-m-8 flex h-[calc(100vh-3.5rem)]">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => void handleNew()}
        onDelete={(id) => {
          remove.mutate(id)
          if (id === selectedId) setSelectedId(null)
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="Ask about your library"
              description="Answers are grounded in your own documents via retrieval-augmented generation — not model memory."
              action={
                <div className="flex items-center gap-2">
                  <ProviderSelect value={newProviderId} onChange={setNewProviderId} />
                  <Button onClick={() => void handleNew()}>Start chat</Button>
                </div>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-6 py-3">
              <h2 className="truncate text-sm font-medium text-[var(--color-ink)]">{conversation?.title}</h2>
              <div className="flex shrink-0 items-center gap-2">
                {updateProvider.isPending && <Spinner size="sm" />}
                <ProviderSelect
                  value={conversation?.provider_id ?? newProviderId}
                  onChange={handleProviderChange}
                  disabled={updateProvider.isPending}
                />
              </div>
            </div>
            {updateProvider.isError && (
              <p className="px-6 pt-2 text-xs text-red-600">
                Couldn't switch provider — reverted to the previous one.{' '}
                {updateProvider.error instanceof Error ? updateProvider.error.message : ''}
              </p>
            )}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-4">
                {messagesLoading ? (
                  <Spinner />
                ) : (
                  messages.map((message) => <MessageBubble key={message.id} message={message} />)
                )}
                {streamingText !== null && (
                  <MessageBubble
                    message={{ role: 'assistant', content: streamingText || '…', context_chunk_ids: [] }}
                  />
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>
            <ChatInput disabled={sending} onSend={(text) => void handleSend(text)} />
          </>
        )}
      </div>
    </div>
  )
}
