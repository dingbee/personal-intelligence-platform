import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { sendMessage } from '@/modules/ai/orchestration/AIService'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import type { Message } from '@/shared/types/database'
import type { ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'
import type { ReasoningPlan } from '@/modules/intelligence/planner/plannerTypes'
import { normalizeAiError, type AiErrorCategory } from '@/modules/ai/orchestration/normalizeAiError'
import { ChatSendFailure } from '@/modules/ai/orchestration/chatSendErrors'
import { PROVIDER_UNAVAILABLE_MESSAGE } from '@/modules/ai/providers/availability'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { detectMemoryCandidates } from '@/modules/ai/memory/memoryDetection/detectMemoryCandidates'
import type { MemoryCandidate } from '@/modules/ai/memory/memoryDetection/types'
import type { ArtifactPreview } from '@/modules/workspace-actions/types'

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
export function useSendMessage(providerId: string | null, documentId?: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  // Resolved once per render from the same cached availability/overrides/
  // health queries every other provider-aware hook already uses — preferred
  // provider first if it's still eligible, else health-ordered fallback
  // candidates. See resolveProviderChain for the precedence rule.
  const chain = useProviderChain(providerId)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Phase 4 Commercial Architecture — distinct from `error` (a safe display
  // string) so the UI can offer an "Upgrade" CTA specifically for
  // quota_exceeded without string-matching the message text.
  const [errorCategory, setErrorCategory] = useState<AiErrorCategory | null>(null)
  // UX-6: the latest turn's context-derived suggestions/trace/signals —
  // reset per send, not persisted across conversation switches (they
  // describe "this last response," not conversation-level state).
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [contextTrace, setContextTrace] = useState<ContextTrace | null>(null)
  const [signals, setSignals] = useState<IntelligenceSignal[]>([])
  // UX-7: this turn's resolved reference chips + the model that answered.
  const [references, setReferences] = useState<Reference[]>([])
  const [model, setModel] = useState<string | null>(null)
  // UX-14.2 — the plan AIService now computes before the LLM call; ChatPage
  // renders this instead of recomputing buildReasoningPlan itself.
  const [reasoningPlan, setReasoningPlan] = useState<ReasoningPlan | null>(null)
  // UX-14.3.5 — candidates detected from the just-sent user message, queued
  // for user approval; never persisted until MemoryApprovalPanel's Remember
  // action calls useMemories().rememberCandidate.
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidate[]>([])
  // UX-14.4.3 — the just-completed turn's structured artifact preview, if
  // any, bundled with the message id it belongs to so the caller can match
  // it to the right MessageBubble without a second piece of state. Reset
  // per send, same as everything else above — this view is only available
  // for the live turn, never reconstructed from persisted data.
  const [artifactPreview, setArtifactPreview] = useState<(ArtifactPreview & { messageId: string }) | null>(null)
  // The most recent send that failed, kept only so `retry()` can replay it
  // — `userMessage` is null when nothing was persisted yet (the chain===0
  // early-return below never reaches AIService at all), and set once
  // insertMessage has actually run, so retry never inserts a second row for
  // the same turn (see ChatSendFailure / AIService's existingUserMessage).
  const [failedSend, setFailedSend] = useState<{
    conversationId: string
    text: string
    history: ChatProviderMessage[]
    userMessage: Message | null
  } | null>(null)

  async function send(
    conversationId: string,
    text: string,
    history: ChatProviderMessage[],
    existingUserMessage?: Message,
  ): Promise<Message | undefined> {
    setError(null)
    setErrorCategory(null)
    setSuggestions([])
    setContextTrace(null)
    setSignals([])
    setReferences([])
    setModel(null)
    setReasoningPlan(null)
    setMemoryCandidates([])
    setArtifactPreview(null)

    // An empty chain means nothing survived candidacy filtering at all
    // (no key configured anywhere, or everything's disabled) — ai-chat
    // itself would only ever catch a missing key on ITS chosen provider,
    // never "provider_overrides says no," which is pure app data it never
    // sees. This check is what makes disabling a provider actually stop an
    // already-open conversation from using it.
    if (chain.length === 0) {
      setError(PROVIDER_UNAVAILABLE_MESSAGE)
      // Nothing was persisted (this never reaches AIService), so a retry
      // just re-attempts the plain send — there's no row to reuse.
      setFailedSend({ conversationId, text, history, userMessage: null })
      return undefined
    }

    setStreamingText('')
    // The new user message won't show up until the messages query refetches
    // below, so invalidate eagerly for it while the assistant reply streams.
    void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })

    try {
      const result = await sendMessage({
        conversationId,
        userId: user!.id,
        workspaceId: currentWorkspaceId,
        providerChain: chain,
        documentId,
        history,
        text,
        onDelta: setStreamingText,
        existingUserMessage,
      })
      setSuggestions(result.suggestions)
      setContextTrace(result.contextTrace)
      setSignals(result.signals)
      setReferences(result.references)
      setModel(result.model)
      setReasoningPlan(result.reasoningPlan)
      setMemoryCandidates(detectMemoryCandidates(text, conversationId))
      setArtifactPreview(result.artifactPreview ? { ...result.artifactPreview, messageId: result.message.id } : null)
      setFailedSend(null)
      await queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
      return result.message
    } catch (err) {
      // The provider we thought was configured may have just failed on the
      // one check that actually matters (a live send) — normalizeAiError
      // strips the raw "X_API_KEY is not configured" text in that case,
      // and invalidating here stops the selector offering that provider
      // again until availability is re-checked.
      const normalized = normalizeAiError(err)
      setError(normalized.message)
      setErrorCategory(normalized.category)
      if (normalized.isProviderUnavailable) {
        void queryClient.invalidateQueries({ queryKey: ['provider-availability'] })
      }
      // ChatSendFailure carries the user message AIService already
      // persisted before this failure (see chatSendErrors.ts) — keeping it
      // here is what lets retry() resend without inserting a duplicate.
      const persistedUserMessage = err instanceof ChatSendFailure ? err.userMessage : null
      setFailedSend({ conversationId, text, history, userMessage: persistedUserMessage })
      if (persistedUserMessage) {
        // The user's turn is in the DB even though the reply failed —
        // surface it in the transcript instead of leaving it invisible.
        void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      }
      return undefined
    } finally {
      setStreamingText(null)
    }
  }

  /** Replays the most recent failed send with its original text/history, reusing the already-persisted user message (if any) instead of inserting a duplicate. No-op if nothing has failed since the last successful send. */
  function retry() {
    if (!failedSend) return
    void send(failedSend.conversationId, failedSend.text, failedSend.history, failedSend.userMessage ?? undefined)
  }

  function dismissMemoryCandidate(candidate: MemoryCandidate) {
    setMemoryCandidates((current) => current.filter((c) => c !== candidate))
  }

  return {
    send,
    retry,
    canRetry: failedSend !== null,
    streamingText,
    sending: streamingText !== null,
    error,
    errorCategory,
    suggestions,
    contextTrace,
    signals,
    references,
    model,
    reasoningPlan,
    memoryCandidates,
    dismissMemoryCandidate,
    artifactPreview,
    // AI Preference Layer v1 — chain[0] is "what NOVA would actually pick
    // right now" (platform governance -> availability -> preference ->
    // health-ordered automatic fallback). Exposed so a caller creating a
    // brand-new conversation with no explicit preference can stamp it with
    // a genuinely resolved provider instead of a hardcoded constant.
    chain,
  }
}
