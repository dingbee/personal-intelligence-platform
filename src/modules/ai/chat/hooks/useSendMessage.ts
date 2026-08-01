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
import { normalizeAiError } from '@/modules/ai/orchestration/normalizeAiError'
import { PROVIDER_UNAVAILABLE_MESSAGE } from '@/modules/ai/providers/availability'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'

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
  // Resolved once per render from the same cached availability/overrides/
  // health queries every other provider-aware hook already uses — preferred
  // provider first if it's still eligible, else health-ordered fallback
  // candidates. See resolveProviderChain for the precedence rule.
  const chain = useProviderChain(providerId)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  async function send(
    conversationId: string,
    text: string,
    history: ChatProviderMessage[],
  ): Promise<Message | undefined> {
    setError(null)
    setSuggestions([])
    setContextTrace(null)
    setSignals([])
    setReferences([])
    setModel(null)
    setReasoningPlan(null)

    // An empty chain means nothing survived candidacy filtering at all
    // (no key configured anywhere, or everything's disabled) — ai-chat
    // itself would only ever catch a missing key on ITS chosen provider,
    // never "provider_overrides says no," which is pure app data it never
    // sees. This check is what makes disabling a provider actually stop an
    // already-open conversation from using it.
    if (chain.length === 0) {
      setError(PROVIDER_UNAVAILABLE_MESSAGE)
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
      })
      setSuggestions(result.suggestions)
      setContextTrace(result.contextTrace)
      setSignals(result.signals)
      setReferences(result.references)
      setModel(result.model)
      setReasoningPlan(result.reasoningPlan)
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
      if (normalized.isProviderUnavailable) {
        void queryClient.invalidateQueries({ queryKey: ['provider-availability'] })
      }
      return undefined
    } finally {
      setStreamingText(null)
    }
  }

  return {
    send,
    streamingText,
    sending: streamingText !== null,
    error,
    suggestions,
    contextTrace,
    signals,
    references,
    model,
    reasoningPlan,
  }
}
