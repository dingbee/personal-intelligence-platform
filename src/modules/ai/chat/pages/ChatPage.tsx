import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { useMessages } from '@/modules/ai/chat/hooks/useMessages'
import { useSendMessage } from '@/modules/ai/chat/hooks/useSendMessage'
import { ConversationList } from '@/modules/ai/chat/components/ConversationList'
import { MobileConversationDrawer } from '@/modules/ai/chat/components/MobileConversationDrawer'
import { MessageBubble } from '@/modules/ai/chat/components/MessageBubble'
import { ChatInput } from '@/modules/ai/chat/components/ChatInput'
import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useProviderOverrides } from '@/modules/ai/providers/useProviderOverrides'
import { isProviderAvailable } from '@/modules/ai/providers/availability'
import { providerRegistry } from '@/modules/core/providers/registry'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const documentId = searchParams.get('documentId') ?? undefined
  // Set by the Command Bar's "Ask NOVA: <query>" — a brand-new conversation
  // deep-linked here with a question already chosen. Sent once below via
  // the exact same handleSend a typed message goes through; not a second
  // AI pipeline.
  const initialQuery = searchParams.get('initialQuery')
  const initialQuerySentRef = useRef(false)

  const { data: conversations = [], isLoading: conversationsLoading, create, remove, updateProvider } =
    useConversations(documentId)
  // Deep-linked from a search result — if it's outside the current
  // workspace/document filter it still opens (messages load independently
  // of the sidebar list), it just won't be highlighted in that list.
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('conversationId'))
  const defaultProviderId = useDefaultChatProviderId()
  // null = "no explicit choice yet, follow the live default" — as opposed to
  // snapshotting defaultProviderId into useState's initializer, which would
  // freeze it at whatever it resolved to before the profile/availability
  // queries finished loading.
  const [newProviderId, setNewProviderId] = useState<string | null>(null)
  const effectiveNewProviderId = newProviderId ?? defaultProviderId
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false)

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
  const { send, streamingText, sending, error } = useSendMessage(
    conversation?.provider_id ?? effectiveNewProviderId,
    documentId,
  )

  const { data: availability } = useProviderAvailability()
  const { data: overrides } = useProviderOverrides()
  // Only meaningful for an existing conversation — a not-yet-created one's
  // newProviderId can only ever be something ProviderSelect already offered,
  // which is available by construction.
  const conversationProviderUnavailable =
    Boolean(conversation) && !isProviderAvailable(conversation!.provider_id, availability, overrides)

  async function handleNew() {
    const created = await create.mutateAsync({ providerId: effectiveNewProviderId })
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

  // Fires exactly once per mount: only once messages have loaded (so we
  // know for sure this conversation is still empty — never resend into
  // one that already has content) and only for the conversation the
  // command bar actually created. Stripping the param afterwards means
  // refreshing or navigating back never re-triggers it.
  useEffect(() => {
    if (!initialQuery || initialQuerySentRef.current) return
    if (!selectedId || messagesLoading || messages.length > 0) return
    initialQuerySentRef.current = true
    void handleSend(initialQuery)
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('initialQuery')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, selectedId, messagesLoading, messages.length])

  if (conversationsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] md:-m-8">
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
      <MobileConversationDrawer
        open={conversationDrawerOpen}
        onClose={() => setConversationDrawerOpen(false)}
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
        <div className="flex items-center border-b border-[var(--color-border)] px-4 py-2 md:hidden">
          <Button variant="ghost" onClick={() => setConversationDrawerOpen(true)}>
            ☰ Conversations
          </Button>
        </div>
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="Ask about your library"
              description="Answers are grounded in your own documents via retrieval-augmented generation — not model memory."
              action={
                <div className="flex items-center gap-2">
                  <ProviderSelect value={effectiveNewProviderId} onChange={setNewProviderId} />
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
                  value={conversation?.provider_id ?? effectiveNewProviderId}
                  onChange={handleProviderChange}
                  disabled={updateProvider.isPending}
                />
              </div>
            </div>
            {conversationProviderUnavailable && (
              <p className="px-6 pt-2 text-xs text-amber-600">
                This conversation is set to {providerRegistry.get(conversation!.provider_id)?.label ?? conversation!.provider_id},
                which isn't currently available. It's still selected above so nothing about this conversation is
                changed — pick a different provider to continue chatting.
              </p>
            )}
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
