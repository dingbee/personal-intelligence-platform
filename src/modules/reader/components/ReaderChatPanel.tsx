import { useEffect, useState } from 'react'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { useMessages } from '@/modules/ai/chat/hooks/useMessages'
import { useSendMessage } from '@/modules/ai/chat/hooks/useSendMessage'
import { MessageBubble } from '@/modules/ai/chat/components/MessageBubble'
import { ChatInput } from '@/modules/ai/chat/components/ChatInput'
import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'
import { SaveConversationDialog } from '@/modules/notes/components/SaveConversationDialog'
import { useSaveMessageToNote } from '@/modules/notes/hooks/useSaveMessageToNote'
import { Button } from '@/shared/components/ui/Button'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useProviderOverrides } from '@/modules/ai/providers/useProviderOverrides'
import { isProviderAvailable } from '@/modules/ai/providers/availability'
import { providerRegistry } from '@/modules/core/providers/registry'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Spinner } from '@/shared/components/ui/Spinner'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { buildReaderInteractionState, type ReaderInteractionState } from '@/modules/reader/intelligence/readerInteraction'
import type { LocalSuggestionId } from '@/modules/reader/intelligence/chapterSuggestions'
import { ReaderInsightDrawer } from '@/modules/reader/components/ReaderInsightDrawer'
import { MemoryApprovalPanel } from '@/modules/ai/memory/memoryDetection/MemoryApprovalPanel'
import { useMemories } from '@/modules/ai/memory/hooks/useMemories'

export interface ReaderChatPanelProps {
  documentId: string
  /**
   * UX-9 Phase 3/10 — chapter context ReaderPage already holds (chapters,
   * activeChapterIndex, progress). Passed as props rather than re-fetched:
   * this panel never duplicates Reader state, it composes over what's
   * already loaded, same as ChapterSummaryPanel/FlashcardsPanel already do.
   */
  documentTitle: string
  workspaceId: string | null
  chapters: { index: number; title: string; content: string; chunkIds: string[] }[]
  activeChapterIndex: number
  scrollFraction: number
  hasProgress: boolean
  progressUpdatedAt: string | null
  onLocalSuggestion: (id: LocalSuggestionId) => void
  /** UX-13.10 — shows the "Basic Analyst Questions" starter chips instead of the generic empty state when this document is a spreadsheet. */
  isSpreadsheet?: boolean
}

const ANALYST_QUESTIONS = [
  'Summarize this spreadsheet',
  'What are the largest expenses?',
  'Which region performs best?',
  'Show me trends',
  'Find anomalies',
]

/**
 * Contextual chat scoped to one document, embedded in the reader rather
 * than requiring a trip to /chat. Reuses the same conversations/messages
 * hooks and AIService path as the full Chat page — including the same
 * provider-awareness model (ProviderSelect, unavailable-provider warning,
 * updateProvider switching) and, as of UX-9, the same reference/evidence/
 * signal rendering ChatPage already has, plus Reader-specific insights/
 * journey/suggestions (ReaderIntelligencePanel, collapsed by default
 * inside ReaderInsightDrawer as of UX-13.10.2 — same InsightDrawerShell
 * NovaInsightDrawer uses on the main Chat page).
 *
 * Chapter-awareness note (UX-9 Phase 3/10, see the phase report): this
 * does NOT modify AIService — retrieveContext already scopes to
 * `documentId`, and UX-6's resolveNovaContext already surfaces the
 * account's most-recent reading position, which is normally *this*
 * document while its chat panel is open. True chapter-index-precise
 * prompt injection would need a small additive AIService param change,
 * which this phase's STOP RULE explicitly gates — flagged, not done
 * silently.
 */
export function ReaderChatPanel({
  documentId,
  documentTitle,
  workspaceId,
  chapters,
  activeChapterIndex,
  scrollFraction,
  hasProgress,
  progressUpdatedAt,
  onLocalSuggestion,
  isSpreadsheet,
}: ReaderChatPanelProps) {
  const { data: conversations = [], isLoading: conversationsLoading, create, updateProvider } =
    useConversations(documentId)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [savingConversation, setSavingConversation] = useState(false)
  const defaultProviderId = useDefaultChatProviderId()

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
  const {
    send,
    streamingText,
    sending,
    error,
    contextTrace,
    references,
    signals,
    memoryCandidates,
    dismissMemoryCandidate,
  } = useSendMessage(conversation?.provider_id ?? defaultProviderId, documentId)
  const { rememberCandidate } = useMemories()
  const saveMessage = useSaveMessageToNote({
    conversationId: conversation?.id ?? '',
    conversationTitle: conversation?.title ?? documentTitle,
    workspaceId,
  })

  const commandContext = useCommandContext()
  const commandActions = useCommandActions()

  // UX-9 Phase 8/10 — recomputed whenever the chapter context or the last
  // chat turn's output changes; reuses buildReaderInteractionState (Phase
  // 8) exactly like ChatPage reuses buildInteractionState (UX-8).
  const [readerInteractionState, setReaderInteractionState] = useState<ReaderInteractionState | null>(null)
  useEffect(() => {
    let cancelled = false
    void buildReaderInteractionState({
      documentId,
      documentTitle,
      chapters,
      activeChapterIndex,
      scrollFraction,
      progressUpdatedAt: hasProgress ? progressUpdatedAt : null,
      references: contextTrace ? references : undefined,
      graphNodeCount: contextTrace?.graphNodes,
    }).then((state) => {
      if (!cancelled) setReaderInteractionState(state)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, activeChapterIndex, scrollFraction, hasProgress, progressUpdatedAt, contextTrace, references])

  const { data: availability } = useProviderAvailability()
  const { data: overrides } = useProviderOverrides()
  const conversationProviderUnavailable =
    Boolean(conversation) && !isProviderAvailable(conversation!.provider_id, availability, overrides)

  async function handleSend(text: string) {
    const id = conversationId ?? (await create.mutateAsync({ providerId: defaultProviderId })).id
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
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={() => setSavingConversation(true)}
              disabled={messages.length === 0}
            >
              Save to Notes
            </Button>
            <ProviderSelect
              value={conversation?.provider_id ?? defaultProviderId}
              onChange={handleProviderChange}
              disabled={updateProvider.isPending}
            />
          </div>
        </div>
      )}
      {conversation && (
        <SaveConversationDialog
          open={savingConversation}
          onClose={() => setSavingConversation(false)}
          conversationId={conversation.id}
          conversationTitle={conversation.title}
          workspaceId={workspaceId}
          messages={messages}
        />
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
          isSpreadsheet ? (
            <div className="flex flex-col gap-3">
              <EmptyState
                title="Ask about this spreadsheet"
                description="Grounded in the sheet's actual computed figures, not a guess at the raw text."
              />
              <div className="flex flex-wrap gap-1.5">
                {ANALYST_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void handleSend(question)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="Ask about this book"
              description="Grounded in this document's content — ask for an explanation, a comparison, or anything else."
            />
          )
        ) : (
          <div className="flex flex-col gap-3">
            {messagesLoading ? (
              <Spinner size="sm" />
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onSave={() => saveMessage.save(message)}
                  saved={saveMessage.isSaved(message.id)}
                  saving={saveMessage.isSaving(message.id)}
                />
              ))
            )}
            {streamingText !== null && (
              <MessageBubble message={{ role: 'assistant', content: streamingText || '…', context_chunk_ids: [] }} />
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>
      {!sending && readerInteractionState && (
        <ReaderInsightDrawer
          state={{ ...readerInteractionState, signals: [...readerInteractionState.signals, ...signals] }}
          workspaceId={workspaceId}
          onLocalSuggestion={onLocalSuggestion}
          commandContext={commandContext}
          commandActions={commandActions}
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
    </div>
  )
}
