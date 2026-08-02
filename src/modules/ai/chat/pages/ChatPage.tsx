import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { useArchivedConversations } from '@/modules/ai/chat/hooks/useArchivedConversations'
import { useConversationSearch } from '@/modules/ai/chat/hooks/useConversationSearch'
import { useMessages } from '@/modules/ai/chat/hooks/useMessages'
import { useSendMessage } from '@/modules/ai/chat/hooks/useSendMessage'
import { useGenerateConversationTitle } from '@/modules/ai/chat/hooks/useGenerateConversationTitle'
import { ConversationList } from '@/modules/ai/chat/components/ConversationList'
import { MobileConversationDrawer } from '@/modules/ai/chat/components/MobileConversationDrawer'
import { ConversationTitleEditor } from '@/modules/ai/chat/components/ConversationTitleEditor'
import { MessageBubble } from '@/modules/ai/chat/components/MessageBubble'
import { ChatInput } from '@/modules/ai/chat/components/ChatInput'
import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'
import { SaveConversationDialog } from '@/modules/notes/components/SaveConversationDialog'
import { useSaveMessageToNote } from '@/modules/notes/hooks/useSaveMessageToNote'
import { AddToCollectionButton } from '@/modules/knowledge-intelligence/components/AddToCollectionButton'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useProviderOverrides } from '@/modules/ai/providers/useProviderOverrides'
import { isProviderAvailable } from '@/modules/ai/providers/availability'
import { providerRegistry } from '@/modules/core/providers/registry'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { NovaStatusIndicator } from '@/modules/intelligence/components/NovaStatusIndicator'
import { NovaInsightDrawer } from '@/modules/intelligence/components/NovaInsightDrawer'
import { computeExplainSummary } from '@/modules/intelligence/explain/computeExplainSummary'
import { computeEvidenceScore } from '@/modules/intelligence/evidence/computeEvidenceScore'
import { isContinuationMessage } from '@/modules/intelligence/conversation/detectContinuation'
import { deriveActionChips } from '@/modules/intelligence/actions/deriveActionChips'
import { buildInteractionState } from '@/modules/intelligence/orchestrator/orchestrator'
import type { InteractionState } from '@/modules/intelligence/orchestrator/types'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { selectContext } from '@/modules/intelligence/planner/contextSelector'
import { buildReasoningTrace } from '@/modules/intelligence/planner/reasoningTrace'
import { buildDecisionFramework } from '@/modules/intelligence/decision/decisionFrameworkBuilder'
import { detectLearningIntelligence } from '@/modules/intelligence/learning/learningEngine'
import { MemoryApprovalPanel } from '@/modules/ai/memory/memoryDetection/MemoryApprovalPanel'
import { useMemories } from '@/modules/ai/memory/hooks/useMemories'

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const documentId = searchParams.get('documentId') ?? undefined
  // Set by the Command Bar's "Ask NOVA: <query>" — a brand-new conversation
  // deep-linked here with a question already chosen. Sent once below via
  // the exact same handleSend a typed message goes through; not a second
  // AI pipeline.
  const initialQuery = searchParams.get('initialQuery')
  const initialQuerySentRef = useRef(false)
  // UX-13.11 Phase 2A — deep-linked from a grouped conversation search
  // result's best-matching message: scrolls to and briefly highlights it
  // once the conversation's messages have loaded, then strips the param.
  const deepLinkMessageId = searchParams.get('messageId')
  const deepLinkHandledRef = useRef(false)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  useEffect(() => () => clearTimeout(highlightTimerRef.current), [])

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    create,
    rename,
    remove,
    archive,
    restore,
    duplicate,
    togglePin,
    toggleFavorite,
    updateProvider,
  } = useConversations(documentId)
  const [viewingArchived, setViewingArchived] = useState(false)
  const { data: archivedConversations = [] } = useArchivedConversations(documentId)
  const [searchQuery, setSearchQuery] = useState('')
  const { data: searchResults } = useConversationSearch(searchQuery, documentId)
  const displayedConversations = searchQuery.trim()
    ? (searchResults ?? [])
    : viewingArchived
      ? archivedConversations
      : conversations
  const generateTitle = useGenerateConversationTitle()
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
  const [savingConversation, setSavingConversation] = useState(false)

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

  useEffect(() => {
    if (!deepLinkMessageId || deepLinkHandledRef.current) return
    if (messagesLoading || messages.length === 0) return
    const target = messages.find((m) => m.id === deepLinkMessageId)
    if (!target) return
    deepLinkHandledRef.current = true
    document.getElementById(`message-${deepLinkMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedMessageId(deepLinkMessageId)
    // Timer lives in a ref rather than an effect-cleanup return: stripping
    // the messageId param below changes this effect's own dependency, which
    // would otherwise fire React's cleanup (canceling the timer) the moment
    // it re-runs and hits the now-true deepLinkHandledRef guard.
    highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 2500)
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('messageId')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkMessageId, messagesLoading, messages])
  // Looks in both lists — opening an archived conversation to read (or restore) it works the same as opening an active one.
  const conversation = conversations.find((c) => c.id === selectedId) ?? archivedConversations.find((c) => c.id === selectedId)
  // Reading conversation.provider_id fresh here (rather than snapshotting it
  // into a ref) is what makes a provider switch take effect on the very
  // next send: this hook re-runs every render, so once the mutation below
  // updates the conversations cache, the next render's `send` closes over
  // the new value automatically.
  const {
    send,
    streamingText,
    sending,
    error,
    suggestions,
    contextTrace,
    references,
    model,
    signals,
    reasoningPlan,
    memoryCandidates,
    dismissMemoryCandidate,
    artifactPreview,
  } = useSendMessage(conversation?.provider_id ?? effectiveNewProviderId, documentId)
  const { rememberCandidate } = useMemories()
  // UX-6 Phase 7 status indicator — workspace name from the already-loaded
  // list (no new query), "understanding" from the last user turn.
  const { workspaces, currentWorkspaceId } = useWorkspace()
  const currentWorkspaceName = workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? null
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? null
  const saveMessage = useSaveMessageToNote({
    conversationId: conversation?.id ?? '',
    conversationTitle: conversation?.title ?? '',
    workspaceId: conversation?.workspace_id ?? null,
  })

  // UX-7: everything below is derived purely from data already in scope —
  // no new AIService fields beyond contextTrace/model (added this phase).
  const commandContext = useCommandContext()
  const commandActions = useCommandActions()
  const actionChips = deriveActionChips(commandContext)

  // UX-8 Phase 9 — requests InteractionState once per completed turn
  // (contextTrace/references/suggestions/signals only change when a send
  // finishes). Never touches providers/streaming/router/RAG — it composes
  // over what AIService already returned plus existing read-only APIs.
  const [interactionState, setInteractionState] = useState<InteractionState | null>(null)
  useEffect(() => {
    if (sending || !contextTrace) {
      setInteractionState(null)
      return
    }
    let cancelled = false
    void buildInteractionState({
      workspaceId: currentWorkspaceId,
      workspaceName: currentWorkspaceName,
      conversationTitle: conversation?.title ?? null,
      messageCount: messages.length,
      userQuery: lastUserMessage ?? '',
      commandContext,
      contextTrace,
      references,
      suggestions,
      signals,
    }).then((state) => {
      if (!cancelled) setInteractionState(state)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, contextTrace, references, suggestions, signals])

  // UX-14.2 (Planner Integration) — buildReasoningPlan now runs inside
  // AIService.sendMessage, before the LLM call, and its output is carried
  // through as `reasoningPlan` (via useSendMessage). This useMemo only
  // renders that plan — it no longer computes one. selectContext/
  // buildDecisionFramework/detectLearningIntelligence/buildReasoningTrace
  // stay here, unchanged, composing the already-computed plan with data
  // that's still only available client-side. detectLearningIntelligence is
  // called with journey: null here — a real DocumentJourney (UX-9) is only
  // available in the document-scoped Reader Chat panel, not this general
  // chat surface, so Learning Mode naturally stays absent here rather than
  // being faked; see the UX-12 phase report's deferred items.
  const reasoningTrace = useMemo(() => {
    if (sending || !contextTrace || !reasoningPlan) return null
    const text = lastUserMessage ?? ''
    return buildReasoningTrace({
      contextTrace,
      plan: reasoningPlan,
      selectedContext: selectContext(reasoningPlan.requiredContext),
      decisionFramework: buildDecisionFramework(text),
      learningMode: detectLearningIntelligence({ intent: reasoningPlan.intent, journey: null, unreviewedHighlightCount: 0 }),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, contextTrace, reasoningPlan, lastUserMessage])

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
    // UX-13.5A — fires alongside the send, not after it: title generation
    // only needs the user's own message, not the assistant's response, so
    // there's no reason to make the title wait on a full streamed reply.
    // Gated on the title still being the untouched default so a user who
    // renames mid-stream is never overwritten (see useGenerateConversationTitle's
    // no-throw contract — this never surfaces an error to the sender).
    if (messages.length === 0 && conversation?.title === 'New conversation') {
      generateTitle.mutate(text, {
        onSuccess: (result) => rename.mutate({ id: selectedId, title: result.title }),
      })
    }
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
        conversations={displayedConversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => void handleNew()}
        onRename={(id, title) => rename.mutate({ id, title })}
        onDuplicate={(id) => duplicate.mutate(id, { onSuccess: (created) => setSelectedId(created.id) })}
        onArchive={(id) => {
          archive.mutate(id)
          if (id === selectedId) setSelectedId(null)
        }}
        onRestore={(id) => restore.mutate(id)}
        onTogglePin={(id, isPinned) => togglePin.mutate({ id, isPinned })}
        onToggleFavorite={(id, favorite) => toggleFavorite.mutate({ id, favorite })}
        onDelete={(id) => {
          remove.mutate(id)
          if (id === selectedId) setSelectedId(null)
        }}
        mode={viewingArchived ? 'archived' : 'active'}
        archivedCount={archivedConversations.length}
        onToggleMode={() => setViewingArchived((v) => !v)}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />
      <MobileConversationDrawer
        open={conversationDrawerOpen}
        onClose={() => setConversationDrawerOpen(false)}
        conversations={displayedConversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => void handleNew()}
        onRename={(id, title) => rename.mutate({ id, title })}
        onDuplicate={(id) => duplicate.mutate(id, { onSuccess: (created) => setSelectedId(created.id) })}
        onArchive={(id) => {
          archive.mutate(id)
          if (id === selectedId) setSelectedId(null)
        }}
        onRestore={(id) => restore.mutate(id)}
        onTogglePin={(id, isPinned) => togglePin.mutate({ id, isPinned })}
        onToggleFavorite={(id, favorite) => toggleFavorite.mutate({ id, favorite })}
        onDelete={(id) => {
          remove.mutate(id)
          if (id === selectedId) setSelectedId(null)
        }}
        mode={viewingArchived ? 'archived' : 'active'}
        archivedCount={archivedConversations.length}
        onToggleMode={() => setViewingArchived((v) => !v)}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
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
              <ConversationTitleEditor
                title={conversation?.title ?? ''}
                onRename={(title) => rename.mutate({ id: conversation!.id, title })}
              />
              <div className="flex shrink-0 items-center gap-2">
                {updateProvider.isPending && <Spinner size="sm" />}
                <Button variant="secondary" onClick={() => setSavingConversation(true)} disabled={!conversation || messages.length === 0}>
                  Save to Notes
                </Button>
                {conversation && <AddToCollectionButton itemType="conversation" itemId={conversation.id} />}
                <ProviderSelect
                  value={conversation?.provider_id ?? effectiveNewProviderId}
                  onChange={handleProviderChange}
                  disabled={updateProvider.isPending}
                />
              </div>
            </div>
            {conversation && (
              <SaveConversationDialog
                open={savingConversation}
                onClose={() => setSavingConversation(false)}
                conversationId={conversation.id}
                conversationTitle={conversation.title}
                workspaceId={conversation.workspace_id}
                messages={messages}
              />
            )}
            <div className="hidden px-6 pt-3 sm:block">
              <NovaStatusIndicator
                status={sending ? 'thinking' : 'ready'}
                understanding={lastUserMessage}
                workspaceName={currentWorkspaceName}
              />
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
              {/* UX-13.6 Phase 1 — gap-5 (up from gap-4) gives each turn more breathing room, closer to how a real messaging app paces a conversation. */}
              <div className="flex flex-col gap-5">
                {messagesLoading ? (
                  <Spinner />
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      highlighted={message.id === highlightedMessageId}
                      onSave={() => saveMessage.save(message)}
                      saved={saveMessage.isSaved(message.id)}
                      saving={saveMessage.isSaving(message.id)}
                      artifactPreview={artifactPreview?.messageId === message.id ? artifactPreview : undefined}
                    />
                  ))
                )}
                {streamingText !== null && (
                  <MessageBubble
                    message={{ role: 'assistant', content: streamingText || '…', context_chunk_ids: [] }}
                  />
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>
            {!sending && contextTrace && (
              <NovaInsightDrawer
                contextTrace={contextTrace}
                references={references}
                evidenceLevel={computeEvidenceScore({
                  contextTrace,
                  isContinuation: isContinuationMessage(lastUserMessage ?? ''),
                })}
                reasoningTrace={reasoningTrace}
                explainSummary={computeExplainSummary({
                  contextTrace,
                  workspaceName: currentWorkspaceName,
                  userQuery: lastUserMessage ?? '',
                  model: model ?? 'unknown',
                })}
                suggestions={suggestions}
                onSelectSuggestion={(suggestion) => void handleSend(suggestion)}
                actionCommands={interactionState ? interactionState.actions.map((a) => a.command) : actionChips}
                commandContext={commandContext}
                commandActions={commandActions}
                attentionItems={interactionState?.attention ?? []}
                signals={interactionState?.signals ?? signals}
                workspaceInsights={interactionState?.workspace ?? []}
                workspaceId={currentWorkspaceId}
              />
            )}
            {!sending && (
              <MemoryApprovalPanel
                candidates={memoryCandidates}
                onRemember={(candidate) => {
                  rememberCandidate(candidate)
                  dismissMemoryCandidate(candidate)
                }}
                onDismiss={dismissMemoryCandidate}
              />
            )}
            <ChatInput disabled={sending} onSend={(text) => void handleSend(text)} />
          </>
        )}
      </div>
    </div>
  )
}
